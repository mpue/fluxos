import React, { useState } from 'react';
import { useDesktop } from '../contexts/DesktopContext';
import { useAuth } from '../contexts/AuthContext';
import { getColorScheme } from '../utils/colorSchemes';
import Calculator from './Calculator';
import Notepad from './Notepad';
import SystemInfo from './SystemInfo';
import FileExplorer from './FileExplorer';
import Browser from './Browser';
import './Taskbar.css';

const Taskbar: React.FC = () => {
  const { windows, focusWindow, minimizeWindow, addWindow, colorScheme } = useDesktop();
  const { user, logout } = useAuth();
  const currentColorScheme = getColorScheme(colorScheme);
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTaskbarItemClick = (windowId: string, isMinimized: boolean) => {
    if (isMinimized) {
      minimizeWindow(windowId);
    }
    focusWindow(windowId);
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const handleShutdown = () => {
    if (window.confirm('Möchten Sie FluxOS wirklich beenden?')) {
      window.close();
      // Falls window.close() blockiert wird, leere Seite anzeigen
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:24px;font-family:sans-serif">FluxOS wurde heruntergefahren</div>';
    }
  };

  const handleLogout = () => {
    if (window.confirm('Möchten Sie sich wirklich abmelden?')) {
      logout();
    }
  };

  const openApp = (appName: string) => {
    setShowStartMenu(false);
    
    switch(appName) {
      case 'fileexplorer':
        addWindow({
          title: 'Datei-Explorer',
          icon: '📂',
          position: { x: 100, y: 80 },
          size: { width: 900, height: 600 },
          isMinimized: false,
          isMaximized: false,
          content: <FileExplorer />,
        });
        break;
      case 'browser':
        addWindow({
          title: 'FluxOS Browser',
          icon: '🌐',
          position: { x: 100, y: 80 },
          size: { width: 1000, height: 700 },
          isMinimized: false,
          isMaximized: false,
          content: <Browser />,
        });
        break;
      case 'calculator':
        addWindow({
          title: 'Rechner',
          icon: '🔢',
          position: { x: 400, y: 150 },
          size: { width: 400, height: 550 },
          isMinimized: false,
          isMaximized: false,
          content: <Calculator />,
        });
        break;
      case 'notepad':
        addWindow({
          title: 'Notizen',
          icon: '📝',
          position: { x: 450, y: 100 },
          size: { width: 700, height: 500 },
          isMinimized: false,
          isMaximized: false,
          content: <Notepad />,
        });
        break;
      case 'systeminfo':
        addWindow({
          title: 'Systeminformationen',
          icon: '💻',
          position: { x: 300, y: 100 },
          size: { width: 700, height: 600 },
          isMinimized: false,
          isMaximized: false,
          content: <SystemInfo />,
        });
        break;
    }
  };

  return (
    <div className="taskbar">
      <button 
        className={`start-button ${showStartMenu ? 'active' : ''}`}
        onClick={() => setShowStartMenu(!showStartMenu)}
        style={{
          background: showStartMenu ? currentColorScheme.gradient : undefined,
          borderColor: currentColorScheme.primary,
          color: showStartMenu ? 'white' : undefined,
        }}
      >
        <span className="start-icon">⊞</span>
        Start
      </button>

      <div className="taskbar-apps">
        {windows.map(window => (
          <button
            key={window.id}
            className={`taskbar-app ${window.isFocused && !window.isMinimized ? 'active' : ''}`}
            onClick={() => handleTaskbarItemClick(window.id, window.isMinimized)}
            style={{
              background: window.isFocused && !window.isMinimized ? `linear-gradient(135deg, ${currentColorScheme.primary}20, ${currentColorScheme.secondary}20)` : undefined,
              borderColor: window.isFocused && !window.isMinimized ? currentColorScheme.primary : undefined,
            }}
          >
            {window.icon && <span className="app-icon">{window.icon}</span>}
            <span className="app-title">{window.title}</span>
          </button>
        ))}
      </div>

      <div className="system-tray">
        <div className="tray-icons">
          <button className="tray-icon">🔊</button>
          <button className="tray-icon">📶</button>
        </div>
        <div className="clock">
          <div className="time">{formatTime()}</div>
          <div className="date">{formatDate()}</div>
        </div>
      </div>

      {showStartMenu && (
        <div className="start-menu">
          <div 
            className="start-menu-header"
            style={{
              background: `linear-gradient(135deg, ${currentColorScheme.primary}15, ${currentColorScheme.secondary}10)`,
            }}
          >
            <div>⊞</div>
            <div>
              <div style={{ fontWeight: 700 }}>FluxOS</div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
                {user?.username}
              </div>
            </div>
          </div>
          <div className="start-menu-content">
            <div className="start-menu-section">
              <div className="start-menu-item" onClick={() => openApp('fileexplorer')}>
                📂 <span>Datei-Explorer</span>
              </div>
              <div className="start-menu-item" onClick={() => openApp('browser')}>
                🌐 <span>Browser</span>
              </div>
              <div className="start-menu-item" onClick={() => openApp('calculator')}>
                🔢 <span>Rechner</span>
              </div>
              <div className="start-menu-item" onClick={() => openApp('notepad')}>
                📝 <span>Notizen</span>
              </div>
            </div>
            <div className="start-menu-separator"></div>
            <div className="start-menu-section">
              <div className="start-menu-item" onClick={() => openApp('systeminfo')}>
                💻 <span>Systeminformationen</span>
              </div>
            </div>
            <div className="start-menu-separator"></div>
            <div className="start-menu-section">
              <div className="start-menu-item logout" onClick={handleLogout}>
                👤 <span>Abmelden</span>
              </div>
              <div className="start-menu-item shutdown" onClick={handleShutdown}>
                ⏻ <span>Herunterfahren</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Taskbar;
