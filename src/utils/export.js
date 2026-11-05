export function exportHostsToFile(hosts, format = 'csv') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let content = '';
  let filename = `ipscan-export-${timestamp}`;
  let mimeType = 'text/plain';

  if (format === 'json') {
    content = JSON.stringify(hosts, null, 2);
    filename += '.json';
    mimeType = 'application/json';
  } else if (format === 'csv') {
    mimeType = 'text/csv';
    filename += '.csv';
    const headers = ['Estado', 'IP', 'Nombre de Equipo', 'Dirección MAC', 'Fabricante', 'Ping (ms)', 'Puertos Abiertos', 'Comentarios'];
    const rows = hosts.map((h) => [
      h.status,
      h.ip,
      `"${(h.hostname || '').replace(/"/g, '""')}"`,
      h.mac || '',
      `"${(h.manufacturer || '').replace(/"/g, '""')}"`,
      h.latency != null ? h.latency : '',
      `"${(h.ports || []).map((p) => `${p.port}/${p.service}`).join(', ')}"`,
      `"${(h.note || '').replace(/"/g, '""')}"`,
    ]);
    content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  } else if (format === 'txt') {
    filename += '.txt';
    content = hosts
      .map((h) => {
        const portsStr = (h.ports || []).map((p) => `${p.port}(${p.service})`).join(', ');
        return `IP: ${h.ip.padEnd(16)} | Estado: ${h.status.padEnd(7)} | Hostname: ${(h.hostname || 'Unknown').padEnd(25)} | MAC: ${(h.mac || 'N/A').padEnd(18)} | Vendor: ${(h.manufacturer || 'Unknown').padEnd(25)} | Ping: ${(h.latency ? `${h.latency}ms` : '—').padEnd(8)} | Puertos: [${portsStr}] | Nota: ${h.note || ''}`;
      })
      .join('\n');
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

