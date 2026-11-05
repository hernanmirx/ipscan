import os from 'node:os';

function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function intToIp(int) {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}

export function getNetworkInterfaces() {
  const ifaces = os.networkInterfaces();
  const list = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs || []) {
      // Priorizar IPv4
      if (addr.family === 'IPv4') {
        const ipInt = ipToInt(addr.address);
        const maskInt = ipToInt(addr.netmask || '255.255.255.0');
        const netInt = (ipInt & maskInt) >>> 0;
        const bcastInt = (netInt | (~maskInt >>> 0)) >>> 0;

        // Calcular rango escaneable
        const firstHostInt = netInt + 1;
        const lastHostInt = bcastInt - 1;

        const firstHost = firstHostInt <= lastHostInt ? intToIp(firstHostInt) : addr.address;
        const lastHost = firstHostInt <= lastHostInt ? intToIp(lastHostInt) : addr.address;

        let suggestedRange = `${firstHost}-${lastHost.split('.').pop()}`;
        if (firstHost.split('.').slice(0, 3).join('.') !== lastHost.split('.').slice(0, 3).join('.')) {
          suggestedRange = `${firstHost}-${lastHost}`;
        }

        list.push({
          name,
          ip: addr.address,
          netmask: addr.netmask,
          mac: addr.mac,
          internal: addr.internal,
          cidr: addr.cidr,
          network: intToIp(netInt),
          broadcast: intToIp(bcastInt),
          firstHost,
          lastHost,
          suggestedRange,
        });
      }
    }
  }

  // Filtrar interfaces: preferir externas primero (no loopback)
  list.sort((a, b) => {
    if (!a.internal && b.internal) return -1;
    if (a.internal && !b.internal) return 1;
    return a.name.localeCompare(b.name);
  });

  return list;
}

export function getDefaultRange() {
  const ifaces = getNetworkInterfaces();
  const external = ifaces.find((i) => !i.internal);
  if (external) {
    return external.suggestedRange;
  }
  // Si solo hay loopback o no se detectó nada externo
  return '192.168.1.1-254';
}

