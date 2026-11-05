import { useState } from 'react';
import {
  CloseIcon,
  ZapIcon,
  ExternalLinkIcon,
  TerminalIcon,
  RefreshIcon,
  CopyIcon,
  CheckIcon,
} from './Icons.jsx';
import { pingSingleHost, runDeepPortScan, triggerWakeOnLan } from '../services/api.js';

const EXTENDED_PORTS = [
  { port: 21, service: 'FTP' },
  { port: 22, service: 'SSH' },
  { port: 23, service: 'Telnet' },
  { port: 25, service: 'SMTP' },
  { port: 53, service: 'DNS' },
  { port: 80, service: 'HTTP' },
  { port: 110, service: 'POP3' },
  { port: 139, service: 'NetBIOS' },
  { port: 143, service: 'IMAP' },
  { port: 443, service: 'HTTPS' },
  { port: 445, service: 'SMB' },
  { port: 993, service: 'IMAPS' },
  { port: 995, service: 'POP3S' },
  { port: 1433, service: 'MSSQL' },
  { port: 3306, service: 'MySQL' },
  { port: 3389, service: 'RDP' },
  { port: 5432, service: 'PostgreSQL' },
  { port: 5900, service: 'VNC' },
  { port: 6379, service: 'Redis' },
  { port: 8080, service: 'HTTP-Alt' },
  { port: 8443, service: 'HTTPS-Alt' },
  { port: 9000, service: 'Portainer' },
];

export function HostDetailModal({ host, onClose, onSaveNote, onHostUpdated }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'ping', 'ports'
  const [noteText, setNoteText] = useState(host.note || '');
  const [copiedKey, setCopiedKey] = useState(null);

  // Estado de Ping
  const [pingHistory, setPingHistory] = useState([]);
  const [isPinging, setIsPinging] = useState(false);

  // Estado de Portscan
  const [portScanResults, setPortScanResults] = useState(host.ports || []);
  const [isScanningPorts, setIsScanningPorts] = useState(false);

  // Estado WOL
  const [wolStatus, setWolStatus] = useState(null);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handlePing = async () => {
    setIsPinging(true);
    try {
      const res = await pingSingleHost(host.ip);
      const newEntry = {
        time: new Date().toLocaleTimeString(),
        alive: res.alive,
        latency: res.latency,
      };
      setPingHistory((prev) => [newEntry, ...prev].slice(0, 20));
      if (res.alive && onHostUpdated) {
        onHostUpdated({ ...host, latency: res.latency, status: 'online' });
      }
    } catch {
      setPingHistory((prev) => [
        { time: new Date().toLocaleTimeString(), alive: false, latency: null },
        ...prev,
      ]);
    } finally {
      setIsPinging(false);
    }
  };

  const handleDeepPortScan = async () => {
    setIsScanningPorts(true);
    try {
      const res = await runDeepPortScan(host.ip, EXTENDED_PORTS);
      setPortScanResults(res.ports || []);
      if (onHostUpdated) {
        onHostUpdated({ ...host, ports: res.ports });
      }
    } catch (err) {
      alert(`Error escaneando puertos: ${err.message}`);
    } finally {
      setIsScanningPorts(false);
    }
  };

  const handleWol = async () => {
    if (!host.mac || host.mac === 'Unknown' || host.mac === 'N/A') return;
    setWolStatus('Enviando...');
    try {
      await triggerWakeOnLan(host.mac);
      setWolStatus('¡Paquete Magic Packet WOL enviado exitosamente!');
    } catch (err) {
      setWolStatus(`Error WOL: ${err.message}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span
              className={`status-dot ${
                host.status === 'online' ? 'dot-online' : 'dot-offline'
              }`}
            />
            <h3>{host.ip}</h3>
            {host.hostname && host.hostname !== 'Unknown' && (
              <span className="modal-hostname-sub">({host.hostname})</span>
            )}
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas del Modal */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Detalles Generales
          </button>
          <button
            className={`modal-tab ${activeTab === 'ping' ? 'active' : ''}`}
            onClick={() => setActiveTab('ping')}
          >
            Diagnóstico Ping
          </button>
          <button
            className={`modal-tab ${activeTab === 'ports' ? 'active' : ''}`}
            onClick={() => setActiveTab('ports')}
          >
            Escáner de Puertos ({portScanResults.length})
          </button>
        </div>

        {/* Contenido Pestañas */}
        <div className="modal-body">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="modal-overview-grid">
              <div className="info-item">
                <span className="info-label">Dirección IP:</span>
                <div className="info-val-row">
                  <code>{host.ip}</code>
                  <button
                    className="btn-copy-mini"
                    onClick={() => handleCopy(host.ip, 'modal-ip')}
                  >
                    {copiedKey === 'modal-ip' ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
              </div>

              <div className="info-item">
                <span className="info-label">Nombre de Equipo (DNS/NetBIOS):</span>
                <span className="info-val">{host.hostname || 'Desconocido'}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Dirección MAC:</span>
                <div className="info-val-row">
                  <code>{host.mac || 'No detectada'}</code>
                  {host.mac && host.mac !== 'Unknown' && (
                    <button
                      className="btn-copy-mini"
                      onClick={() => handleCopy(host.mac, 'modal-mac')}
                    >
                      {copiedKey === 'modal-mac' ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  )}
                </div>
              </div>

              <div className="info-item">
                <span className="info-label">Fabricante (OUI):</span>
                <span className="info-val">{host.manufacturer || 'Desconocido'}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Latencia Ping:</span>
                <span className="info-val">
                  {host.latency != null ? `${host.latency} ms` : '—'}
                </span>
              </div>

              {host.netbios && host.netbios.group && (
                <div className="info-item">
                  <span className="info-label">Grupo de Trabajo NetBIOS:</span>
                  <span className="info-val">{host.netbios.group}</span>
                </div>
              )}

              {/* Acciones Rápidas */}
              <div className="modal-section-full">
                <h4>Enlaces de Conexión Rápida</h4>
                <div className="quick-links-group">
                  <a
                    href={`http://${host.ip}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                    <span>HTTP (80)</span>
                  </a>
                  <a
                    href={`https://${host.ip}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                    <span>HTTPS (443)</span>
                  </a>
                  <a href={`ssh://${host.ip}`} className="btn btn-outline btn-sm">
                    <TerminalIcon className="w-3.5 h-3.5" />
                    <span>SSH (22)</span>
                  </a>
                  <a href={`ftp://${host.ip}`} className="btn btn-outline btn-sm">
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                    <span>FTP (21)</span>
                  </a>
                  <a href={`rdp://${host.ip}`} className="btn btn-outline btn-sm">
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                    <span>RDP (3389)</span>
                  </a>
                </div>
              </div>

              {/* Wake-On-LAN */}
              {host.mac && host.mac !== 'Unknown' && host.mac !== 'N/A' && (
                <div className="modal-section-full">
                  <h4>Encendido Remoto (Wake-On-LAN)</h4>
                  <div className="wol-control-row">
                    <button className="btn btn-primary btn-sm" onClick={handleWol}>
                      <ZapIcon className="w-4 h-4 mr-1" />
                      <span>Enviar Magic Packet</span>
                    </button>
                    {wolStatus && <span className="wol-status-text">{wolStatus}</span>}
                  </div>
                </div>
              )}

              {/* Comentarios / Notas */}
              <div className="modal-section-full">
                <h4>Notas Personalizadas</h4>
                <div className="note-edit-group">
                  <textarea
                    rows={2}
                    className="input-textarea"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Escribe una nota para este equipo (ej. Impresora oficina, Switch piso 2)..."
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => onSaveNote(host.ip, noteText)}
                  >
                    Guardar Nota
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PING */}
          {activeTab === 'ping' && (
            <div className="modal-ping-section">
              <div className="ping-controls-row">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handlePing}
                  disabled={isPinging}
                >
                  <RefreshIcon className={`w-4 h-4 ${isPinging ? 'spinner' : ''}`} />
                  <span>{isPinging ? 'Comprobando...' : 'Hacer Ping Ahora'}</span>
                </button>
                <span className="text-muted text-xs">
                  Prueba la respuesta y latencia directa hacia {host.ip}
                </span>
              </div>

              <div className="ping-log-table-wrapper">
                <table className="ping-log-table">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Estado</th>
                      <th>Latencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pingHistory.map((p, idx) => (
                      <tr key={idx}>
                        <td>{p.time}</td>
                        <td>
                          <span
                            className={`badge ${p.alive ? 'badge-green' : 'badge-red'}`}
                          >
                            {p.alive ? 'Responde' : 'Sin respuesta / Timeout'}
                          </span>
                        </td>
                        <td>{p.latency != null ? `${p.latency} ms` : '—'}</td>
                      </tr>
                    ))}
                    {pingHistory.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-muted py-4">
                          Haz clic en "Hacer Ping Ahora" para iniciar la prueba.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PORTS */}
          {activeTab === 'ports' && (
            <div className="modal-ports-section">
              <div className="ports-controls-row">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleDeepPortScan}
                  disabled={isScanningPorts}
                >
                  <RefreshIcon className={`w-4 h-4 ${isScanningPorts ? 'spinner' : ''}`} />
                  <span>{isScanningPorts ? 'Escaneando puertos...' : 'Escanear 22 Puertos Clave'}</span>
                </button>
                <span className="text-muted text-xs">
                  Verifica SSH, HTTP, HTTPS, SMB, RDP, bases de datos y más.
                </span>
              </div>

              <div className="open-ports-grid">
                {portScanResults.map((p) => (
                  <div key={p.port} className="port-card-item">
                    <div className="port-card-header">
                      <strong>Puerto {p.port}</strong>
                      <span className="badge badge-green">Abierto</span>
                    </div>
                    <div className="port-card-service">{p.service}</div>
                    {p.latency && <div className="port-card-latency">{p.latency} ms</div>}
                  </div>
                ))}
                {portScanResults.length === 0 && !isScanningPorts && (
                  <div className="ports-empty-state">
                    No se detectaron puertos abiertos en la lista examinada.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

