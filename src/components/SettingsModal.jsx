import { useState } from 'react';
import { CloseIcon } from './Icons.jsx';

export function SettingsModal({ settings, onSaveSettings, onClose }) {
  const [concurrency, setConcurrency] = useState(settings.concurrency || 32);
  const [timeout, setTimeoutVal] = useState(settings.timeout || 700);
  const [ports, setPorts] = useState(settings.ports || []);
  const [newPortNumber, setNewPortNumber] = useState('');
  const [newPortService, setNewPortService] = useState('');

  const handleTogglePort = (portNum) => {
    setPorts((prev) => {
      const exists = prev.some((p) => p.port === portNum);
      if (exists) {
        return prev.filter((p) => p.port !== portNum);
      }
      return [...prev, { port: portNum, service: `Port ${portNum}` }];
    });
  };

  const handleAddCustomPort = (e) => {
    e.preventDefault();
    const num = parseInt(newPortNumber, 10);
    if (!num || num < 1 || num > 65535) {
      alert('Número de puerto inválido (1-65535)');
      return;
    }
    if (ports.some((p) => p.port === num)) {
      alert('Este puerto ya está en la lista');
      return;
    }

    setPorts((prev) => [
      ...prev,
      { port: num, service: newPortService.trim() || `Port ${num}` },
    ]);
    setNewPortNumber('');
    setNewPortService('');
  };

  const handleSave = () => {
    onSaveSettings({
      concurrency: Math.max(1, Math.min(128, parseInt(concurrency, 10) || 32)),
      timeout: Math.max(200, Math.min(5000, parseInt(timeout, 10) || 700)),
      ports,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-settings-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configuración del Escáner</h3>
          <button className="btn-close-modal" onClick={onClose}>
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body settings-body">
          {/* Concurrencia */}
          <div className="settings-field">
            <label>
              <strong>Hilos Concurrentes ({concurrency}):</strong>
              <span className="field-hint">
                Mayor número = escaneo más rápido, pero consume más recursos de red.
              </span>
            </label>
            <input
              type="range"
              min="4"
              max="128"
              step="4"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="slider-input"
            />
          </div>

          {/* Timeout */}
          <div className="settings-field">
            <label>
              <strong>Timeout por Host / Ping ({timeout} ms):</strong>
              <span className="field-hint">
                Tiempo máximo de espera para dar por inactivo un host.
              </span>
            </label>
            <input
              type="range"
              min="200"
              max="2500"
              step="50"
              value={timeout}
              onChange={(e) => setTimeoutVal(Number(e.target.value))}
              className="slider-input"
            />
          </div>

          {/* Puertos Activos */}
          <div className="settings-field">
            <label>
              <strong>Puertos a comprobar durante el escaneo:</strong>
              <span className="field-hint">
                Marca los servicios que deseas detectar automáticamente en cada host.
              </span>
            </label>

            <div className="ports-checkbox-grid">
              {ports.map((p) => (
                <label key={p.port} className="port-check-item">
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => handleTogglePort(p.port)}
                  />
                  <span>
                    <strong>{p.port}</strong> ({p.service})
                  </span>
                </label>
              ))}
            </div>

            {/* Agregar Puerto Personalizado */}
            <form onSubmit={handleAddCustomPort} className="add-port-form">
              <input
                type="number"
                placeholder="Nº Puerto"
                className="input-port-num"
                value={newPortNumber}
                onChange={(e) => setNewPortNumber(e.target.value)}
              />
              <input
                type="text"
                placeholder="Nombre servicio (ej. MQTT, Plex)"
                className="input-port-name"
                value={newPortService}
                onChange={(e) => setNewPortService(e.target.value)}
              />
              <button type="submit" className="btn btn-outline btn-sm">
                + Agregar Puerto
              </button>
            </form>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
}

