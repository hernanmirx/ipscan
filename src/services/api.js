const API_BASE = '/api';

export async function fetchInterfaces() {
  const res = await fetch(`${API_BASE}/interfaces`);
  if (!res.ok) throw new Error('Error al obtener interfaces de red');
  return res.json();
}

export async function fetchCommonPorts() {
  const res = await fetch(`${API_BASE}/ports`);
  if (!res.ok) throw new Error('Error al obtener lista de puertos');
  return res.json();
}

export async function startScan({ range, concurrency, timeout, ports }) {
  const res = await fetch(`${API_BASE}/scan/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, concurrency, timeout, ports }),
  });
  if (!res.ok) throw new Error('Error al iniciar el escaneo');
  return res.json();
}

export async function pauseScan() {
  const res = await fetch(`${API_BASE}/scan/pause`, { method: 'POST' });
  return res.json();
}

export async function resumeScan() {
  const res = await fetch(`${API_BASE}/scan/resume`, { method: 'POST' });
  return res.json();
}

export async function stopScan() {
  const res = await fetch(`${API_BASE}/scan/stop`, { method: 'POST' });
  return res.json();
}

export async function pingSingleHost(ip, timeout = 1000) {
  const res = await fetch(`${API_BASE}/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, timeout }),
  });
  return res.json();
}

export async function runDeepPortScan(ip, ports, timeout = 600) {
  const res = await fetch(`${API_BASE}/portscan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, ports, timeout }),
  });
  return res.json();
}

export async function triggerWakeOnLan(mac, options = {}) {
  const res = await fetch(`${API_BASE}/wol`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mac, ...options }),
  });
  return res.json();
}

export async function fetchArpCache() {
  const res = await fetch(`${API_BASE}/arp`);
  return res.json();
}

export function subscribeScanEvents({
  onStart,
  onProgress,
  onHostFound,
  onPause,
  onResume,
  onStop,
  onComplete,
  onError,
}) {
  const eventSource = new EventSource(`${API_BASE}/scan/events`);

  eventSource.addEventListener('scan-start', (e) => {
    try {
      const data = JSON.parse(e.data);
      onStart?.(data);
    } catch {
      // ignore
    }
  });

  eventSource.addEventListener('scan-progress', (e) => {
    try {
      const data = JSON.parse(e.data);
      onProgress?.(data);
    } catch {
      // ignore
    }
  });

  eventSource.addEventListener('host-found', (e) => {
    try {
      const data = JSON.parse(e.data);
      onHostFound?.(data);
    } catch {
      // ignore
    }
  });

  eventSource.addEventListener('scan-paused', () => onPause?.());
  eventSource.addEventListener('scan-resumed', () => onResume?.());
  eventSource.addEventListener('scan-stopped', (e) => {
    try {
      const data = JSON.parse(e.data);
      onStop?.(data);
    } catch {
      onStop?.({});
    }
  });

  eventSource.addEventListener('scan-complete', (e) => {
    try {
      const data = JSON.parse(e.data);
      onComplete?.(data);
    } catch {
      onComplete?.({});
    }
  });

  eventSource.addEventListener('scan-error', (e) => {
    try {
      const data = JSON.parse(e.data);
      onError?.(data);
    } catch {
      onError?.({ message: 'Error en escaneo' });
    }
  });

  eventSource.onerror = (err) => {
    console.warn('SSE Connection warning/reconnecting...', err);
  };

  return () => {
    eventSource.close();
  };
}

