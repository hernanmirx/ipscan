import net from 'node:net';
import dns from 'node:dns/promises';
import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { lookupVendor } from './oui.js';
import { queryNetBios } from './netbios.js';

export const COMMON_PORTS = [
  { port: 21, service: 'FTP' },
  { port: 22, service: 'SSH' },
  { port: 23, service: 'Telnet' },
  { port: 53, service: 'DNS' },
  { port: 80, service: 'HTTP' },
  { port: 139, service: 'NetBIOS' },
  { port: 443, service: 'HTTPS' },
  { port: 445, service: 'SMB' },
  { port: 3389, service: 'RDP' },
  { port: 5900, service: 'VNC' },
  { port: 8080, service: 'HTTP-Alt' },
  { port: 8443, service: 'HTTPS-Alt' },
];

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

// Parsea expresiones como "192.168.1.1-254", "192.168.1.1-192.168.1.254", "192.168.1.0/24", "192.168.1.1"
export function parseIpRange(rangeStr, maxIps = 4096) {
  const parts = rangeStr.split(/[\s,]+/).filter(Boolean);
  const ipSet = new Set();

  for (const part of parts) {
    // Caso CIDR: ej. 192.168.1.0/24
    if (part.includes('/')) {
      const [baseIp, maskStr] = part.split('/');
      const mask = parseInt(maskStr, 10);
      if (mask >= 16 && mask <= 32) {
        const baseInt = ipToInt(baseIp);
        const netmask = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
        const netInt = (baseInt & netmask) >>> 0;
        const count = 1 << (32 - mask);

        // Si es /24 o menor, incluimos del 1 al count - 2 si mask < 31
        const startOffset = mask <= 30 ? 1 : 0;
        const endOffset = mask <= 30 ? count - 2 : count - 1;

        for (let i = startOffset; i <= endOffset; i++) {
          ipSet.add(intToIp(netInt + i));
          if (ipSet.size >= maxIps) break;
        }
      }
      continue;
    }

    // Caso Guión: 192.168.1.1-254 o 192.168.1.1-192.168.1.254
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      let startIp = startStr.trim();
      let endIp = endStr.trim();

      if (!endIp.includes('.')) {
        // Solo el último octeto: ej. "1-254"
        const prefix = startIp.split('.').slice(0, 3).join('.');
        endIp = `${prefix}.${endIp}`;
      }

      const startInt = ipToInt(startIp);
      const endInt = ipToInt(endIp);

      if (startInt <= endInt) {
        for (let curr = startInt; curr <= endInt; curr++) {
          ipSet.add(intToIp(curr));
          if (ipSet.size >= maxIps) break;
        }
      }
      continue;
    }

    // Caso IP única
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(part)) {
      ipSet.add(part);
    }
  }

  return Array.from(ipSet);
}

// Lee la tabla ARP del sistema para obtener MACs
export async function getArpTable() {
  const arpMap = new Map();

  // Intento 1: /proc/net/arp en Linux
  try {
    const data = await fs.readFile('/proc/net/arp', 'utf8');
    const lines = data.split('\n').slice(1);
    for (const line of lines) {
      const tokens = line.trim().split(/\s+/);
      if (tokens.length >= 4) {
        const ip = tokens[0];
        const mac = tokens[3].toUpperCase();
        if (mac && mac !== '00:00:00:00:00:00' && mac.includes(':')) {
          arpMap.set(ip, mac);
        }
      }
    }
    if (arpMap.size > 0) return arpMap;
  } catch {
    // no linux /proc/net/arp
  }

  // Intento 2: comando arp -a o ip neigh
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const cmd = isWin ? 'arp -a' : 'ip neigh 2>/dev/null || arp -an 2>/dev/null';

    exec(cmd, { timeout: 3000 }, (err, stdout) => {
      if (stdout) {
        const lines = stdout.split('\n');
        for (const line of lines) {
          // Extraer IP y MAC con regex
          const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
          const macMatch = line.match(/([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})/);
          if (ipMatch && macMatch) {
            const ip = ipMatch[1];
            const mac = macMatch[1].replace(/-/g, ':').toUpperCase();
            if (mac !== '00:00:00:00:00:00' && mac !== 'FF:FF:FF:FF:FF:FF') {
              arpMap.set(ip, mac);
            }
          }
        }
      }
      resolve(arpMap);
    });
  });
}

// Probar si un puerto TCP responde
export function testTcpPort(ip, port, timeout = 400) {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();
    let resolved = false;

    const done = (open) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      const latency = Math.round(performance.now() - start);
      resolve({ open, latency });
    };

    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', (err) => {
      // Si la conexión fue rechazada (ECONNREFUSED), el host está VIVO y tiene stack TCP activo!
      if (err.code === 'ECONNREFUSED') {
        done(false); // puerto cerrado pero host activo
      } else {
        done(false);
      }
    });

    socket.connect(port, ip);
  });
}

// Realiza ping ICMP usando el comando del sistema
export function pingHost(ip, timeoutMs = 800) {
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const isMac = os.platform() === 'darwin';

    let cmd;
    if (isWin) {
      cmd = `ping -n 1 -w ${timeoutMs} ${ip}`;
    } else if (isMac) {
      cmd = `ping -c 1 -W ${timeoutMs} ${ip}`;
    } else {
      const sec = Math.max(1, Math.ceil(timeoutMs / 1000));
      cmd = `ping -c 1 -W ${sec} ${ip}`;
    }

    const start = performance.now();
    exec(cmd, { timeout: timeoutMs + 500 }, (err, stdout) => {
      const latency = Math.round(performance.now() - start);
      if (!err && stdout) {
        // Parsear tiempo devuelto por ping si existe (time=X.X ms)
        const match = stdout.match(/time[=<]([\d.]+)\s*ms/i);
        const parsedLat = match ? Math.round(parseFloat(match[1])) : latency;
        resolve({ alive: true, latency: parsedLat });
      } else {
        resolve({ alive: false, latency: null });
      }
    });
  });
}

// Sonda combinada para determinar si un host está vivo
export async function probeHostAlive(ip, timeoutMs = 700) {
  // 1. Probar ping ICMP
  const pingRes = await pingHost(ip, timeoutMs);
  if (pingRes.alive) {
    return { alive: true, latency: pingRes.latency };
  }

  // 2. Si el ping falló (firewalls comunes bloquean ICMP), probar puertos comunes rápidos
  const probePorts = [80, 443, 445, 22, 139];
  const promises = probePorts.map(
    (port) =>
      new Promise((res) => {
        const socket = new net.Socket();
        const start = performance.now();
        let ended = false;

        const finish = (alive) => {
          if (ended) return;
          ended = true;
          socket.destroy();
          res(alive ? { alive: true, latency: Math.round(performance.now() - start) } : null);
        };

        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', (err) => {
          // ECONNREFUSED significa que el host respondió reseteando la conexión: ¡está vivo!
          if (err.code === 'ECONNREFUSED') {
            finish(true);
          } else {
            finish(false);
          }
        });

        socket.connect(port, ip);
      })
  );

  const results = await Promise.all(promises);
  const found = results.find((r) => r && r.alive);
  if (found) {
    return found;
  }

  return { alive: false, latency: null };
}

// Escaneo profundo de puertos para un host
export async function scanPorts(ip, ports = COMMON_PORTS, timeoutMs = 500) {
  const openPorts = [];
  const promises = ports.map(async ({ port, service }) => {
    const res = await testTcpPort(ip, port, timeoutMs);
    if (res.open) {
      openPorts.push({ port, service, latency: res.latency });
    }
  });

  await Promise.all(promises);
  openPorts.sort((a, b) => a.port - b.port);
  return openPorts;
}

// Resuelve nombre DNS inverso
export async function resolveDns(ip) {
  try {
    const hostnames = await dns.reverse(ip);
    if (hostnames && hostnames.length > 0) {
      return hostnames[0];
    }
  } catch {
    // no reverse dns
  }
  return null;
}

// Clase controladora del escaneo completo con concurrencia
export class NetworkScanJob extends EventEmitter {
  constructor(options = {}) {
    super();
    this.rangeStr = options.rangeStr || '192.168.1.1-254';
    this.concurrency = options.concurrency || 32;
    this.timeout = options.timeout || 700;
    this.portsToScan = options.portsToScan || COMMON_PORTS;

    this.status = 'idle'; // 'idle', 'running', 'paused', 'stopped', 'completed'
    this.ips = [];
    this.total = 0;
    this.scanned = 0;
    this.aliveCount = 0;
    this.hosts = [];
    this.queue = [];
    this.activeWorkers = 0;
    this.arpMap = new Map();
  }

  async start() {
    if (this.status === 'running') return;

    this.status = 'running';
    this.ips = parseIpRange(this.rangeStr);
    this.total = this.ips.length;
    this.scanned = 0;
    this.aliveCount = 0;
    this.hosts = [];
    this.queue = [...this.ips];

    this.emit('start', { total: this.total, range: this.rangeStr });

    // Actualizar tabla ARP inicial
    try {
      this.arpMap = await getArpTable();
    } catch {
      this.arpMap = new Map();
    }

    // Iniciar trabajadores concurrentes
    const workersCount = Math.min(this.concurrency, this.queue.length);
    for (let i = 0; i < workersCount; i++) {
      this.runNext();
    }

    if (this.queue.length === 0) {
      this.finish();
    }
  }

  pause() {
    if (this.status === 'running') {
      this.status = 'paused';
      this.emit('pause');
    }
  }

  resume() {
    if (this.status === 'paused') {
      this.status = 'running';
      this.emit('resume');
      const workersCount = Math.min(this.concurrency - this.activeWorkers, this.queue.length);
      for (let i = 0; i < workersCount; i++) {
        this.runNext();
      }
    }
  }

  stop() {
    this.status = 'stopped';
    this.queue = [];
    this.emit('stop', { scanned: this.scanned, total: this.total, aliveCount: this.aliveCount });
  }

  finish() {
    if (this.status !== 'stopped' && this.status !== 'completed') {
      this.status = 'completed';
      this.emit('complete', {
        scanned: this.scanned,
        total: this.total,
        aliveCount: this.aliveCount,
        hosts: this.hosts,
      });
    }
  }

  async runNext() {
    if (this.status !== 'running' || this.queue.length === 0) {
      if (this.activeWorkers === 0 && this.queue.length === 0) {
        this.finish();
      }
      return;
    }

    const ip = this.queue.shift();
    this.activeWorkers++;

    try {
      await this.scanSingleIp(ip);
    } catch {
      // error individual no detiene el escaneo
    } finally {
      this.activeWorkers--;
      this.scanned++;

      this.emit('progress', {
        scanned: this.scanned,
        total: this.total,
        percentage: Math.round((this.scanned / this.total) * 100),
        currentIp: ip,
        aliveCount: this.aliveCount,
      });

      if (this.queue.length > 0 && this.status === 'running') {
        this.runNext();
      } else if (this.activeWorkers === 0 && this.queue.length === 0) {
        this.finish();
      }
    }
  }

  async scanSingleIp(ip) {
    // 1. Probar si responde
    const probe = await probeHostAlive(ip, this.timeout);

    // 2. Consultar ARP cache
    let mac = this.arpMap.get(ip) || null;

    // Si no estaba en ARP, reconsultar tras el ping (el kernel suele añadir la entrada ARP tras el ping)
    if (!mac && probe.alive) {
      try {
        const freshArp = await getArpTable();
        mac = freshArp.get(ip) || null;
      } catch {
        // ignore
      }
    }

    let hostname = null;
    let netbiosInfo = null;
    let ports = [];

    // Si el host responde o está presente en ARP
    const isAlive = probe.alive || !!mac;

    if (isAlive) {
      this.aliveCount++;

      // Resolver en paralelo: Reverse DNS, NetBIOS y escaneo de puertos
      const [dnsResult, nbResult, portResults] = await Promise.all([
        resolveDns(ip),
        queryNetBios(ip, 600),
        scanPorts(ip, this.portsToScan, 400),
      ]);

      hostname = dnsResult;
      netbiosInfo = nbResult;
      ports = portResults;

      // Si NetBIOS resolvió un nombre más específico (ej. nombre de equipo Windows)
      if (netbiosInfo && netbiosInfo.name) {
        hostname = hostname ? `${netbiosInfo.name} (${hostname})` : netbiosInfo.name;
      }

      // Si NetBIOS descubrió la MAC y no la teníamos
      if (!mac && netbiosInfo && netbiosInfo.mac) {
        mac = netbiosInfo.mac;
      }
    }

    const manufacturer = mac ? lookupVendor(mac) : 'Unknown';

    const hostData = {
      ip,
      status: isAlive ? 'online' : 'offline',
      latency: probe.latency,
      hostname: hostname || (isAlive ? 'Unknown' : 'N/A'),
      mac: mac || (isAlive ? 'Unknown' : 'N/A'),
      manufacturer: isAlive ? manufacturer : 'N/A',
      ports,
      netbios: netbiosInfo ? { name: netbiosInfo.name, group: netbiosInfo.group } : null,
      updatedAt: new Date().toISOString(),
    };

    if (isAlive) {
      this.hosts.push(hostData);
      this.emit('host-found', hostData);
    }

    this.emit('host-scanned', hostData);
    return hostData;
  }
}

