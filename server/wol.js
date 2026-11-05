import dgram from 'node:dgram';

export function sendWakeOnLan(macAddress, options = {}) {
  const { port = 9, address = '255.255.255.255' } = options;

  return new Promise((resolve, reject) => {
    // Limpiar MAC
    const cleanMac = macAddress.replace(/[^a-fA-F0-9]/g, '');
    if (cleanMac.length !== 12) {
      return reject(new Error('Dirección MAC inválida. Debe tener 12 dígitos hexadecimales.'));
    }

    const macBuffer = Buffer.from(cleanMac, 'hex');

    // 6 bytes de 0xFF seguidos de 16 repeticiones de la MAC
    const magicPacket = Buffer.alloc(6 + 16 * 6);
    magicPacket.fill(0xff, 0, 6);

    for (let i = 0; i < 16; i++) {
      macBuffer.copy(magicPacket, 6 + i * 6, 0, 6);
    }

    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
      try {
        socket.close();
      } catch {
        // ignore
      }
      reject(err);
    });

    socket.bind(0, () => {
      socket.setBroadcast(true);
      socket.send(magicPacket, 0, magicPacket.length, port, address, (err) => {
        try {
          socket.close();
        } catch {
          // ignore
        }
        if (err) return reject(err);
        resolve({ success: true, mac: macAddress, target: `${address}:${port}` });
      });
    });
  });
}

