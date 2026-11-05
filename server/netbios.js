import dgram from 'node:dgram';

// Codificación NetBIOS para '*' (wildcard node status)
// '*' (ASCII 42) + 15 espacios (ASCII 32)
// Cada byte X se codifica como dos caracteres: (X >> 4) + 0x41 y (X & 0x0F) + 0x41
function encodeNetbiosName(name) {
  const padded = name.padEnd(16, ' ');
  let encoded = '';
  for (let i = 0; i < 16; i++) {
    const code = padded.charCodeAt(i);
    encoded += String.fromCharCode(((code >> 4) & 0x0f) + 0x41);
    encoded += String.fromCharCode((code & 0x0f) + 0x41);
  }
  return encoded;
}

export function queryNetBios(ip, timeoutMs = 800) {
  return new Promise((resolve) => {
    let resolved = false;
    const socket = dgram.createSocket('udp4');

    const cleanUp = () => {
      try {
        socket.close();
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanUp();
        resolve(null);
      }
    }, timeoutMs);

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanUp();
        resolve(null);
      }
    });

    socket.on('message', (msg) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      cleanUp();

      try {
        // Parsear respuesta NBSTAT
        // Offset hacia la sección de datos
        // Header (12 bytes) + Query Name (~34 bytes) + Type (2) + Class (2) + TTL (4) + DataLen (2)
        // Generalmente la respuesta empieza con los nombres en el offset 56 o buscando tras el query
        if (msg.length < 57) {
          resolve(null);
          return;
        }

        // Buscar el número de nombres reportados
        // Generalmente a partir del byte 56
        let offset = 56;
        if (offset >= msg.length) {
          resolve(null);
          return;
        }

        const numNames = msg[offset];
        offset += 1;

        const names = [];
        let macAddress = null;

        for (let i = 0; i < numNames && offset + 18 <= msg.length; i++) {
          const rawName = msg.subarray(offset, offset + 15).toString('latin1').trim();
          const type = msg[offset + 15];
          const flags = msg.readUInt16BE(offset + 16);
          const isGroup = (flags & 0x8000) !== 0;

          names.push({ name: rawName, type, isGroup });
          offset += 18;
        }

        // Si hay datos para la MAC (los siguientes 6 bytes)
        if (offset + 6 <= msg.length) {
          const macBytes = [];
          for (let i = 0; i < 6; i++) {
            macBytes.push(msg[offset + i].toString(16).padStart(2, '0').toUpperCase());
          }
          const candidateMac = macBytes.join(':');
          if (candidateMac !== '00:00:00:00:00:00') {
            macAddress = candidateMac;
          }
        }

        const computerNameObj = names.find((n) => !n.isGroup && (n.type === 0x00 || n.type === 0x20));
        const groupObj = names.find((n) => n.isGroup && n.type === 0x00);

        resolve({
          name: computerNameObj ? computerNameObj.name : null,
          group: groupObj ? groupObj.name : null,
          mac: macAddress,
          rawNames: names.map((n) => n.name),
        });
      } catch {
        resolve(null);
      }
    });

    try {
      // Construir paquete NBSTAT
      const encodedWildcard = encodeNetbiosName('*');
      const packet = Buffer.alloc(12 + 1 + 32 + 1 + 4);

      // Header
      packet.writeUInt16BE(0x8123, 0); // Transaction ID
      packet.writeUInt16BE(0x0000, 2); // Flags: standard query
      packet.writeUInt16BE(0x0001, 4); // Questions: 1
      packet.writeUInt16BE(0x0000, 6); // Answer RRs
      packet.writeUInt16BE(0x0000, 8); // Authority RRs
      packet.writeUInt16BE(0x0000, 10); // Additional RRs

      // Question Name
      packet.writeUInt8(32, 12); // Longitud del nombre codificado
      packet.write(encodedWildcard, 13, 32, 'ascii');
      packet.writeUInt8(0, 45); // Terminating null

      // Question Type & Class
      packet.writeUInt16BE(0x0021, 46); // Type: NBSTAT
      packet.writeUInt16BE(0x0001, 48); // Class: IN

      socket.send(packet, 0, packet.length, 137, ip, (err) => {
        if (err && !resolved) {
          resolved = true;
          clearTimeout(timer);
          cleanUp();
          resolve(null);
        }
      });
    } catch {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanUp();
        resolve(null);
      }
    }
  });
}

