import { useState } from 'react';
import {
  StarIcon,
  CopyIcon,
  CheckIcon,
  ZapIcon,
  TerminalIcon,
} from './Icons.jsx';

function ipToNumeric(ip) {
  if (!ip) return 0;
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function HostTable({
  hosts,
  favorites,
  onToggleFavorite,
  onSelectHost,
  onWakeOnLan,
  onSaveNote,
}) {
  const [sortField, setSortField] = useState('ip');
  const [sortAsc, setSortAsc] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);
  const [editingNoteIp, setEditingNoteIp] = useState(null);
  const [tempNote, setTempNote] = useState('');

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedHosts = [...hosts].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'ip') {
      valA = ipToNumeric(a.ip);
      valB = ipToNumeric(b.ip);
      return sortAsc ? valA - valB : valB - valA;
    }

    if (sortField === 'latency') {
      valA = a.latency == null ? 99999 : a.latency;
      valB = b.latency == null ? 99999 : b.latency;
      return sortAsc ? valA - valB : valB - valA;
    }

    if (typeof valA === 'string') {
      return sortAsc
        ? (valA || '').localeCompare(valB || '')
        : (valB || '').localeCompare(valA || '');
    }

    return 0;
  });

  return (
    <div className="table-responsive-container">
      <table className="ipscan-table">
        <thead>
          <tr>
            <th className="th-fav">Fav</th>
            <th className="th-status" onClick={() => handleSort('status')}>
              Estado {sortField === 'status' && (sortAsc ? '▲' : '▼')}
            </th>
            <th className="th-ip" onClick={() => handleSort('ip')}>
              Dirección IP {sortField === 'ip' && (sortAsc ? '▲' : '▼')}
            </th>
            <th className="th-hostname" onClick={() => handleSort('hostname')}>
              Nombre de Equipo {sortField === 'hostname' && (sortAsc ? '▲' : '▼')}
            </th>
            <th className="th-mac" onClick={() => handleSort('mac')}>
              Dirección MAC {sortField === 'mac' && (sortAsc ? '▲' : '▼')}
            </th>
            <th className="th-vendor" onClick={() => handleSort('manufacturer')}>
              Fabricante {sortField === 'manufacturer' && (sortAsc ? '▲' : '▼')}
            </th>
            <th className="th-ping" onClick={() => handleSort('latency')}>
              Ping {sortField === 'latency' && (sortAsc ? '▲' : '▼')}
            </th>
            <th className="th-ports">Servicios / Puertos</th>
            <th className="th-notes">Comentarios</th>
            <th className="th-actions">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sortedHosts.map((host) => {
            const isFav = favorites.some((f) => f.ip === host.ip);
            const isOnline = host.status === 'online';

            return (
              <tr
                key={host.ip}
                className={`table-row ${isOnline ? 'row-online' : 'row-offline'}`}
                onDoubleClick={() => onSelectHost(host)}
              >
                {/* Favorito */}
                <td className="td-fav">
                  <button
                    type="button"
                    className="btn-fav-star"
                    onClick={() => onToggleFavorite(host)}
                    title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                  >
                    <StarIcon filled={isFav} className="w-4 h-4" />
                  </button>
                </td>

                {/* Estado */}
                <td className="td-status">
                  <span
                    className={`status-dot ${isOnline ? 'dot-online' : 'dot-offline'}`}
                    title={isOnline ? 'Dispositivo Online / Activo' : 'Dispositivo Offline'}
                  />
                </td>

                {/* IP */}
                <td className="td-ip">
                  <div className="ip-cell-wrapper">
                    <span className="ip-text">{host.ip}</span>
                    <button
                      type="button"
                      className="btn-copy-mini"
                      onClick={() => handleCopy(host.ip, `ip-${host.ip}`)}
                      title="Copiar IP"
                    >
                      {copiedKey === `ip-${host.ip}` ? (
                        <CheckIcon className="w-3.5 h-3.5 text-green" />
                      ) : (
                        <CopyIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </td>

                {/* Hostname */}
                <td className="td-hostname">
                  <span className="hostname-text" title={host.hostname}>
                    {host.hostname || (isOnline ? 'Desconocido' : '—')}
                  </span>
                </td>

                {/* MAC */}
                <td className="td-mac">
                  {host.mac && host.mac !== 'Unknown' && host.mac !== 'N/A' ? (
                    <div className="mac-cell-wrapper">
                      <code className="mac-text">{host.mac}</code>
                      <button
                        type="button"
                        className="btn-copy-mini"
                        onClick={() => handleCopy(host.mac, `mac-${host.ip}`)}
                        title="Copiar MAC"
                      >
                        {copiedKey === `mac-${host.ip}` ? (
                          <CheckIcon className="w-3.5 h-3.5 text-green" />
                        ) : (
                          <CopyIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>

                {/* Fabricante */}
                <td className="td-vendor">
                  <span className="vendor-text" title={host.manufacturer}>
                    {host.manufacturer || '—'}
                  </span>
                </td>

                {/* Latencia Ping */}
                <td className="td-ping">
                  {host.latency != null ? (
                    <span
                      className={`latency-badge ${
                        host.latency < 15
                          ? 'latency-fast'
                          : host.latency < 60
                          ? 'latency-medium'
                          : 'latency-slow'
                      }`}
                    >
                      {host.latency} ms
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>

                {/* Puertos */}
                <td className="td-ports">
                  <div className="ports-badges-wrapper">
                    {(host.ports || []).map((p) => {
                      const isWeb = p.port === 80 || p.port === 443 || p.port === 8080 || p.port === 8443;
                      const protocol = p.port === 443 || p.port === 8443 ? 'https' : 'http';
                      const url = `${protocol}://${host.ip}:${p.port}`;

                      return isWeb ? (
                        <a
                          key={p.port}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="port-badge port-badge-link"
                          title={`Abrir ${p.service} en navegador (${url})`}
                        >
                          {p.port} ({p.service})
                        </a>
                      ) : (
                        <span key={p.port} className="port-badge">
                          {p.port} ({p.service})
                        </span>
                      );
                    })}
                    {(!host.ports || host.ports.length === 0) && isOnline && (
                      <span className="text-muted text-xs">Sin puertos com.</span>
                    )}
                  </div>
                </td>

                {/* Notas / Comentario */}
                <td className="td-notes">
                  {editingNoteIp === host.ip ? (
                    <input
                      type="text"
                      className="input-note-inline"
                      value={tempNote}
                      autoFocus
                      onChange={(e) => setTempNote(e.target.value)}
                      onBlur={() => {
                        onSaveNote(host.ip, tempNote);
                        setEditingNoteIp(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onSaveNote(host.ip, tempNote);
                          setEditingNoteIp(null);
                        } else if (e.key === 'Escape') {
                          setEditingNoteIp(null);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="note-text-clickable"
                      onClick={() => {
                        setEditingNoteIp(host.ip);
                        setTempNote(host.note || '');
                      }}
                      title="Clic para editar comentario"
                    >
                      {host.note || <span className="placeholder-note">+ Nota</span>}
                    </span>
                  )}
                </td>

                {/* Acciones */}
                <td className="td-actions">
                  <div className="row-actions-group">
                    {/* Botón WOL si tiene MAC */}
                    {host.mac && host.mac !== 'Unknown' && host.mac !== 'N/A' && (
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={() => onWakeOnLan(host.mac, host.ip)}
                        title="Enviar Wake-On-LAN (WOL) para encender"
                      >
                        <ZapIcon className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Botón Detalles / Deep scan */}
                    <button
                      type="button"
                      className="btn-action-icon"
                      onClick={() => onSelectHost(host)}
                      title="Ver detalles, ping en vivo y escaneo de puertos"
                    >
                      <TerminalIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {sortedHosts.length === 0 && (
            <tr>
              <td colSpan={10} className="table-empty-row">
                <div className="empty-state-content">
                  <p>No hay dispositivos para mostrar.</p>
                  <span>Haz clic en "Explorar" para escanear el rango de red especificado.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
