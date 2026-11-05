export function ProgressBar({
  status,
  scanned,
  total,
  percentage,
  currentIp,
  aliveCount,
  elapsedTime,
}) {
  const isScanning = status === 'running';

  return (
    <div className="progress-section">
      <div className="progress-info-row">
        <div className="progress-status-badge-wrapper">
          <span className={`status-pill pill-${status}`}>
            {status === 'running' && 'ESCANEANDO'}
            {status === 'paused' && 'PAUSADO'}
            {status === 'completed' && 'COMPLETADO'}
            {status === 'stopped' && 'DETENIDO'}
            {status === 'idle' && 'LISTO'}
          </span>
          {isScanning && currentIp && (
            <span className="current-scanning-text">
              Comprobando: <strong>{currentIp}</strong>
            </span>
          )}
        </div>

        <div className="progress-counters">
          <span className="counter-item">
            Escaneados: <strong>{scanned}</strong> / {total}
          </span>
          <span className="counter-item counter-alive">
            Activos: <strong>{aliveCount}</strong>
          </span>
          {elapsedTime > 0 && (
            <span className="counter-item counter-time">
              Tiempo: <strong>{elapsedTime}s</strong>
            </span>
          )}
        </div>
      </div>

      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${isScanning ? 'animated' : ''}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}

