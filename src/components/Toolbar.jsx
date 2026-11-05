import { useState } from 'react';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  SearchIcon,
  SettingsIcon,
  DownloadIcon,
  NetworkIcon,
  StarIcon,
  SunIcon,
  MoonIcon,
} from './Icons.jsx';

export function Toolbar({
  range,
  onRangeChange,
  status, // 'idle', 'running', 'paused', 'completed'
  onStartScan,
  onPauseScan,
  onResumeScan,
  onStopScan,
  activeTab,
  onTabChange,
  resultsCount,
  favoritesCount,
  searchQuery,
  onSearchChange,
  filterOnlyAlive,
  onToggleFilterAlive,
  interfaces,
  onOpenSettings,
  onExport,
  theme,
  onToggleTheme,
}) {
  const [showInterfaceDropdown, setShowInterfaceDropdown] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const isScanning = status === 'running';
  const isPaused = status === 'paused';

  return (
    <div className="toolbar-container">
      {/* Fila Principal de Control */}
      <div className="toolbar-main-row">
        {/* Botones de Escaneo */}
        <div className="toolbar-controls-group">
          {!isScanning && !isPaused && (
            <button
              className="btn btn-primary btn-scan"
              onClick={onStartScan}
              title="Iniciar escaneo de red (Enter)"
            >
              <PlayIcon className="btn-icon" />
              <span>Explorar</span>
            </button>
          )}

          {isScanning && (
            <button
              className="btn btn-warning"
              onClick={onPauseScan}
              title="Pausar escaneo temporalmente"
            >
              <PauseIcon className="btn-icon" />
              <span>Pausa</span>
            </button>
          )}

          {isPaused && (
            <button
              className="btn btn-primary"
              onClick={onResumeScan}
              title="Reanudar escaneo"
            >
              <PlayIcon className="btn-icon" />
              <span>Reanudar</span>
            </button>
          )}

          <button
            className="btn btn-danger"
            onClick={onStopScan}
            disabled={status === 'idle' || status === 'completed'}
            title="Detener escaneo por completo"
          >
            <StopIcon className="btn-icon" />
            <span>Detener</span>
          </button>
        </div>

        {/* Campo de Rango IP y Selector de Interface */}
        <div className="toolbar-range-wrapper">
          <div className="range-input-group">
            <span className="range-prefix">Rango IP:</span>
            <input
              type="text"
              className="input-range"
              value={range}
              onChange={(e) => onRangeChange(e.target.value)}
              placeholder="ej. 192.168.1.1-254 o 192.168.1.0/24"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isScanning) onStartScan();
              }}
            />
            <div className="interface-selector-btn-wrapper">
              <button
                type="button"
                className="btn-ip-detect"
                title="Detectar y seleccionar interfaz de red local"
                onClick={() => setShowInterfaceDropdown(!showInterfaceDropdown)}
              >
                <NetworkIcon className="w-3.5 h-3.5 mr-1" />
                <span>IP</span>
              </button>

              {showInterfaceDropdown && (
                <div className="interface-dropdown">
                  <div className="dropdown-title">Interfaces de Red Locales:</div>
                  {interfaces.map((iface) => (
                    <button
                      key={`${iface.name}-${iface.ip}`}
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        onRangeChange(iface.suggestedRange);
                        setShowInterfaceDropdown(false);
                      }}
                    >
                      <div className="dropdown-item-header">
                        <strong>{iface.name}</strong>
                        <span className="badge badge-sm">{iface.ip}</span>
                      </div>
                      <div className="dropdown-item-sub">
                        Sugerido: <code>{iface.suggestedRange}</code>
                      </div>
                    </button>
                  ))}
                  {interfaces.length === 0 && (
                    <div className="dropdown-empty">Sin interfaces detectadas</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buscador Rápido */}
        <div className="toolbar-search-wrapper">
          <SearchIcon className="search-icon-inside" />
          <input
            type="text"
            className="input-search"
            placeholder="Buscar por IP, nombre, MAC, fabricante, puerto..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => onSearchChange('')}>
              ✕
            </button>
          )}
        </div>

        {/* Acciones de Ajustes y Tema */}
        <div className="toolbar-actions-group">
          <div className="export-menu-wrapper">
            <button
              className="btn btn-outline"
              title="Exportar resultados"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <DownloadIcon className="btn-icon" />
              <span>Exportar</span>
            </button>
            {showExportMenu && (
              <div className="export-dropdown">
                <button
                  onClick={() => {
                    onExport('csv');
                    setShowExportMenu(false);
                  }}
                >
                  Exportar a CSV (.csv)
                </button>
                <button
                  onClick={() => {
                    onExport('json');
                    setShowExportMenu(false);
                  }}
                >
                  Exportar a JSON (.json)
                </button>
                <button
                  onClick={() => {
                    onExport('txt');
                    setShowExportMenu(false);
                  }}
                >
                  Exportar a Texto Plano (.txt)
                </button>
              </div>
            )}
          </div>

          <button
            className="btn btn-outline"
            title="Configuración de escaneo (hilos, puertos, timeouts)"
            onClick={onOpenSettings}
          >
            <SettingsIcon className="btn-icon" />
          </button>

          <button
            className="btn btn-outline"
            title="Alternar modo claro / oscuro"
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <SunIcon className="btn-icon" /> : <MoonIcon className="btn-icon" />}
          </button>
        </div>
      </div>

      {/* Fila Secundaria: Pestañas y Filtro */}
      <div className="toolbar-secondary-row">
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => onTabChange('results')}
          >
            <NetworkIcon className="tab-icon" />
            <span>Resultados</span>
            <span className="tab-badge">{resultsCount}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => onTabChange('favorites')}
          >
            <StarIcon filled className="tab-icon" />
            <span>Favoritos</span>
            <span className="tab-badge">{favoritesCount}</span>
          </button>
        </div>

        <div className="filter-container">
          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={filterOnlyAlive}
              onChange={(e) => onToggleFilterAlive(e.target.checked)}
            />
            <span>Mostrar solo dispositivos activos (Online)</span>
          </label>
        </div>
      </div>
    </div>
  );
}

