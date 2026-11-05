import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getNetworkInterfaces, getDefaultRange } from './interfaces.js';
import {
  NetworkScanJob,
  COMMON_PORTS,
  pingHost,
  scanPorts,
  getArpTable,
  resolveDns,
} from './scanner.js';
import { sendWakeOnLan } from './wol.js';
import { lookupVendor } from './oui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const PORT = process.env.PORT || 3001;

let currentScanJob = null;
const sseClients = new Set();

function broadcastSse(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Manejo de CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // --- API ROUTES ---

    // 1. Interfaces de red
    if (req.method === 'GET' && pathname === '/api/interfaces') {
      const interfaces = getNetworkInterfaces();
      const defaultRange = getDefaultRange();
      return sendJson(res, 200, { interfaces, defaultRange });
    }

    // 2. Puertos estándar disponibles
    if (req.method === 'GET' && pathname === '/api/ports') {
      return sendJson(res, 200, { ports: COMMON_PORTS });
    }

    // 3. SSE Stream de eventos de escaneo en tiempo real
    if (req.method === 'GET' && pathname === '/api/scan/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(': connected\n\n');

      sseClients.add(res);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // 4. Estado actual del escáner
    if (req.method === 'GET' && pathname === '/api/scan/status') {
      return sendJson(res, 200, {
        status: currentScanJob ? currentScanJob.status : 'idle',
        scanned: currentScanJob ? currentScanJob.scanned : 0,
        total: currentScanJob ? currentScanJob.total : 0,
        aliveCount: currentScanJob ? currentScanJob.aliveCount : 0,
        range: currentScanJob ? currentScanJob.rangeStr : '',
      });
    }

    // 5. Iniciar escaneo
    if (req.method === 'POST' && pathname === '/api/scan/start') {
      const body = await readJsonBody(req);
      const range = (body.range || '').trim() || getDefaultRange();
      const concurrency = parseInt(body.concurrency, 10) || 32;
      const timeout = parseInt(body.timeout, 10) || 700;
      const customPorts = Array.isArray(body.ports) ? body.ports : COMMON_PORTS;

      if (currentScanJob && (currentScanJob.status === 'running' || currentScanJob.status === 'paused')) {
        currentScanJob.stop();
      }

      currentScanJob = new NetworkScanJob({
        rangeStr: range,
        concurrency,
        timeout,
        portsToScan: customPorts,
      });

      currentScanJob.on('start', (data) => broadcastSse('scan-start', data));
      currentScanJob.on('progress', (data) => broadcastSse('scan-progress', data));
      currentScanJob.on('host-found', (data) => broadcastSse('host-found', data));
      currentScanJob.on('pause', () => broadcastSse('scan-paused', {}));
      currentScanJob.on('resume', () => broadcastSse('scan-resumed', {}));
      currentScanJob.on('stop', (data) => broadcastSse('scan-stopped', data));
      currentScanJob.on('complete', (data) => broadcastSse('scan-complete', data));

      // Iniciar en segundo plano
      currentScanJob.start().catch((err) => {
        broadcastSse('scan-error', { message: err.message });
      });

      return sendJson(res, 200, {
        message: 'Escaneo iniciado',
        range,
        concurrency,
        timeout,
      });
    }

    // 6. Pausar escaneo
    if (req.method === 'POST' && pathname === '/api/scan/pause') {
      if (currentScanJob) {
        currentScanJob.pause();
        return sendJson(res, 200, { message: 'Escaneo pausado' });
      }
      return sendJson(res, 400, { error: 'No hay escaneo activo' });
    }

    // 7. Reanudar escaneo
    if (req.method === 'POST' && pathname === '/api/scan/resume') {
      if (currentScanJob) {
        currentScanJob.resume();
        return sendJson(res, 200, { message: 'Escaneo reanudado' });
      }
      return sendJson(res, 400, { error: 'No hay escaneo pausado' });
    }

    // 8. Detener escaneo
    if (req.method === 'POST' && pathname === '/api/scan/stop') {
      if (currentScanJob) {
        currentScanJob.stop();
        return sendJson(res, 200, { message: 'Escaneo detenido' });
      }
      return sendJson(res, 200, { message: 'No había escaneo activo' });
    }

    // 9. Wake-On-LAN
    if (req.method === 'POST' && pathname === '/api/wol') {
      const body = await readJsonBody(req);
      if (!body.mac) {
        return sendJson(res, 400, { error: 'Se requiere el parámetro mac' });
      }

      try {
        const result = await sendWakeOnLan(body.mac, {
          port: body.port || 9,
          address: body.address || '255.255.255.255',
        });
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 10. Ping individual
    if (req.method === 'POST' && pathname === '/api/ping') {
      const body = await readJsonBody(req);
      if (!body.ip) {
        return sendJson(res, 400, { error: 'Se requiere el parámetro ip' });
      }

      const pingRes = await pingHost(body.ip, body.timeout || 1000);
      return sendJson(res, 200, { ip: body.ip, ...pingRes });
    }

    // 11. Escaneo profundo de puertos para un host
    if (req.method === 'POST' && pathname === '/api/portscan') {
      const body = await readJsonBody(req);
      if (!body.ip) {
        return sendJson(res, 400, { error: 'Se requiere el parámetro ip' });
      }

      const targetPorts = Array.isArray(body.ports) ? body.ports : COMMON_PORTS;
      const ports = await scanPorts(body.ip, targetPorts, body.timeout || 600);
      const dnsName = await resolveDns(body.ip);

      return sendJson(res, 200, {
        ip: body.ip,
        hostname: dnsName,
        ports,
      });
    }

    // 12. Tabla ARP actual
    if (req.method === 'GET' && pathname === '/api/arp') {
      const arp = await getArpTable();
      const entries = Array.from(arp.entries()).map(([ip, mac]) => ({
        ip,
        mac,
        vendor: lookupVendor(mac),
      }));
      return sendJson(res, 200, { entries });
    }

    // --- STATIC FILES (si existe dist/ para producción) ---
    if (req.method === 'GET') {
      let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        return fs.createReadStream(filePath).pipe(res);
      }
    }

    // 404
    sendJson(res, 404, { error: 'Ruta no encontrada' });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`[Advanced IP Scanner Backend] Servidor ejecutándose en http://localhost:${PORT}`);
});

