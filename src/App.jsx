import { useState, useEffect, useRef } from 'react';
import './App.css';
import {
  fetchInterfaces,
  fetchCommonPorts,
  startScan,
  pauseScan,
  resumeScan,
  stopScan,
  subscribeScanEvents,
  triggerWakeOnLan,
} from './services/api.js';
import { Toolbar } from './components/Toolbar.jsx';
import { ProgressBar } from './components/ProgressBar.jsx';
import { HostTable } from './components/HostTable.jsx';
import { HostDetailModal } from './components/HostDetailModal.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { NetworkIcon } from './components/Icons.jsx';
import { exportHostsToFile } from './utils/export.js';

const STORAGE_FAVS_KEY = 'ipscan_favorites';
const STORAGE_NOTES_KEY = 'ipscan_notes';
const STORAGE_SETTINGS_KEY = 'ipscan_settings';
const STORAGE_THEME_KEY = 'ipscan_theme';

export default function App() {
  // Configuración y Tema
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_THEME_KEY) || 'dark');
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      return saved ? JSON.parse(saved) : { concurrency: 32, timeout: 700, ports: [] };
    } catch {
      return { concurrency: 32, timeout: 700, ports: [] };
    }
  });

  // Interfaces de red
  const [interfaces, setInterfaces] = useState([]);
  const [range, setRange] = useState('192.168.1.1-254');
  const [localIp, setLocalIp] = useState('');

  // Estado del Escaneo
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle', 'running', 'paused', 'stopped', 'completed'
  const [progress, setProgress] = useState({
    scanned: 0,
    total: 0,
    percentage: 0,
    currentIp: '',
    aliveCount: 0,
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  // Datos
  const [hosts, setHosts] = useState([]);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FAVS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_NOTES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Filtros y Vista
  const [activeTab, setActiveTab] = useState('results'); // 'results' | 'favorites'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlyAlive, setFilterOnlyAlive] = useState(false);

  // Modales
  const [selectedHost, setSelectedHost] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Aplicar tema en el elemento html o root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_THEME_KEY, theme);
  }, [theme]);

  // Cargar interfaces y puertos iniciales
  useEffect(() => {
    fetchInterfaces()
      .then((data) => {
        if (data.interfaces && data.interfaces.length > 0) {
          setInterfaces(data.interfaces);
          const external = data.interfaces.find((i) => !i.internal) || data.interfaces[0];
          setLocalIp(external.ip);
          if (data.defaultRange) {
            setRange(data.defaultRange);
          }
        }
      })
      .catch((err) => console.warn('No se pudo conectar al backend aún:', err.message));

    fetchCommonPorts()
      .then((data) => {
        if (data.ports) {
          setSettings((prev) => {
            if (!prev.ports || prev.ports.length === 0) {
              return { ...prev, ports: data.ports };
            }
            return prev;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Suscribirse a eventos de Server-Sent Events (SSE)
  useEffect(() => {
    const unsubscribe = subscribeScanEvents({
      onStart: (data) => {
        setScanStatus('running');
        setHosts([]);
        setProgress({
          scanned: 0,
          total: data.total || 0,
          percentage: 0,
          currentIp: '',
          aliveCount: 0,
        });
        setElapsedTime(0);
        clearInterval(timerRef.current);
        const startTime = Date.now();
        timerRef.current = setInterval(() => {
          setElapsedTime(Math.round((Date.now() - startTime) / 1000));
        }, 1000);
      },
      onProgress: (data) => {
        setProgress((prev) => ({
          ...prev,
          scanned: data.scanned,
          total: data.total,
          percentage: data.percentage,
          currentIp: data.currentIp,
          aliveCount: data.aliveCount,
        }));
      },
      onHostFound: (hostData) => {
        setHosts((prev) => {
          const note = notes[hostData.ip] || '';
          const updatedHost = { ...hostData, note };
          const index = prev.findIndex((h) => h.ip === hostData.ip);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedHost;
            return next;
          }
          return [...prev, updatedHost];
        });
      },
      onPause: () => {
        setScanStatus('paused');
        clearInterval(timerRef.current);
      },
      onResume: () => {
        setScanStatus('running');
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setElapsedTime((e) => e + 1);
        }, 1000);
      },
      onStop: () => {
        setScanStatus('stopped');
        clearInterval(timerRef.current);
      },
      onComplete: () => {
        setScanStatus('completed');
        clearInterval(timerRef.current);
      },
      onError: (err) => {
        console.error('Error reportado por el backend:', err);
        setScanStatus('stopped');
        clearInterval(timerRef.current);
      },
    });

    return () => {
      unsubscribe();
      clearInterval(timerRef.current);
    };
  }, [notes]);

  // Manejo de Inicio de Escaneo
  const handleStartScan = async () => {
    if (!range.trim()) {
      alert('Por favor, ingresa un rango de direcciones IP.');
      return;
    }

    try {
      await startScan({
        range,
        concurrency: settings.concurrency || 32,
        timeout: settings.timeout || 700,
        ports: settings.ports || [],
      });
      setActiveTab('results');
    } catch (err) {
      alert(`Error iniciando escaneo: ${err.message}. Asegúrate de que el servidor backend esté corriendo en el puerto 3001.`);
    }
  };

  const handlePauseScan = async () => {
    try {
      await pauseScan();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResumeScan = async () => {
    try {
      await resumeScan();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStopScan = async () => {
    try {
      await stopScan();
    } catch (err) {
      console.error(err);
    }
  };

  // Favoritos
  const handleToggleFavorite = (host) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.ip === host.ip);
      let updated;
      if (exists) {
        updated = prev.filter((f) => f.ip !== host.ip);
      } else {
        updated = [...prev, { ...host, note: notes[host.ip] || host.note || '' }];
      }
      localStorage.setItem(STORAGE_FAVS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Guardar Notas
  const handleSaveNote = (ip, note) => {
    const updatedNotes = { ...notes, [ip]: note };
    setNotes(updatedNotes);
    localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(updatedNotes));

    // Actualizar en hosts activos
    setHosts((prev) =>
      prev.map((h) => (h.ip === ip ? { ...h, note } : h))
    );

    // Actualizar en favoritos
    setFavorites((prev) =>
      prev.map((f) => (f.ip === ip ? { ...f, note } : f))
    );

    if (selectedHost && selectedHost.ip === ip) {
      setSelectedHost((prev) => ({ ...prev, note }));
    }
  };

  // Wake on LAN
  const handleWakeOnLan = async (mac, ip) => {
    try {
      await triggerWakeOnLan(mac);
      alert(`¡Paquete Magic Packet WOL enviado a ${ip} (${mac})!`);
    } catch (err) {
      alert(`Error enviando Wake-on-LAN: ${err.message}`);
    }
  };

  // Exportar
  const handleExport = (format) => {
    const listToExport = activeTab === 'favorites' ? favorites : hosts;
    if (listToExport.length === 0) {
      alert('No hay dispositivos para exportar en esta vista.');
      return;
    }
    exportHostsToFile(listToExport, format);
  };

  // Filtrado de Dispositivos para la tabla
  const currentList = activeTab === 'favorites' ? favorites : hosts;
  const filteredHosts = currentList.filter((host) => {
    if (filterOnlyAlive && host.status !== 'online') return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();

    return (
      (host.ip && host.ip.toLowerCase().includes(q)) ||
      (host.hostname && host.hostname.toLowerCase().includes(q)) ||
      (host.mac && host.mac.toLowerCase().includes(q)) ||
      (host.manufacturer && host.manufacturer.toLowerCase().includes(q)) ||
      (host.note && host.note.toLowerCase().includes(q)) ||
      (host.ports && host.ports.some((p) => p.port.toString().includes(q) || p.service.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="app-wrapper">
      {/* Encabezado Superior */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <NetworkIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="brand-title">
              Advanced IP Scanner
              <span className="brand-badge">Node + React</span>
            </h1>
          </div>
        </div>

        <div className="header-meta">
          {localIp && (
            <div className="local-ip-chip">
              <span>Mi IP:</span>
              <strong>{localIp}</strong>
            </div>
          )}
        </div>
      </header>

      {/* Barra de Herramientas Principal */}
      <Toolbar
        range={range}
        onRangeChange={setRange}
        status={scanStatus}
        onStartScan={handleStartScan}
        onPauseScan={handlePauseScan}
        onResumeScan={handleResumeScan}
        onStopScan={handleStopScan}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        resultsCount={hosts.filter((h) => h.status === 'online').length}
        favoritesCount={favorites.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterOnlyAlive={filterOnlyAlive}
        onToggleFilterAlive={setFilterOnlyAlive}
        interfaces={interfaces}
        onOpenSettings={() => setShowSettingsModal(true)}
        onExport={handleExport}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      {/* Barra de Progreso */}
      <ProgressBar
        status={scanStatus}
        scanned={progress.scanned}
        total={progress.total}
        percentage={progress.percentage}
        currentIp={progress.currentIp}
        aliveCount={progress.aliveCount}
        elapsedTime={elapsedTime}
      />

      {/* Tabla de Dispositivos */}
      <HostTable
        hosts={filteredHosts}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onSelectHost={setSelectedHost}
        onWakeOnLan={handleWakeOnLan}
        onSaveNote={handleSaveNote}
      />

      {/* Modal de Detalles del Host */}
      {selectedHost && (
        <HostDetailModal
          host={selectedHost}
          onClose={() => setSelectedHost(null)}
          onSaveNote={handleSaveNote}
          onHostUpdated={(updated) => {
            setSelectedHost(updated);
            setHosts((prev) => prev.map((h) => (h.ip === updated.ip ? updated : h)));
          }}
        />
      )}

      {/* Modal de Configuración */}
      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettingsModal(false)}
          onSaveSettings={(newSettings) => {
            setSettings(newSettings);
            localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(newSettings));
          }}
        />
      )}
    </div>
  );
}
