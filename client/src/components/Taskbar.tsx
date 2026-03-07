import React, { useState, useEffect } from 'react';
import { useDesktop } from '../contexts/DesktopContext';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { getColorScheme } from '../utils/colorSchemes';
import { APP_REGISTRY, getInstalledApps } from './AppManager';
import './Taskbar.css';

const CATEGORY_ORDER = ['System', 'Internet', 'Büro', 'Multimedia', 'Zubehör', 'Verwaltung', 'Spiele'];

const Taskbar: React.FC = () => {
  const { windows, focusWindow, minimizeWindow, colorScheme } = useDesktop();
  const { user, logout } = useAuth();
  const currentColorScheme = getColorScheme(colorScheme);
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [installedApps, setInstalledLocal] = useState<Set<string>>(getInstalledApps);

  useEffect(() => {
    const handler = () => setInstalledLocal(getInstalledApps());
    window.addEventListener('fluxos-apps-changed', handler);
    return () => window.removeEventListener('fluxos-apps-changed', handler);
  }, []);

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

  const { showConfirm } = useDialog();

  const handleShutdown = async () => {
    if (await showConfirm('Herunterfahren', 'Möchten Sie FluxOS wirklich beenden?', '⏻')) {
      window.close();
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:24px;font-family:sans-serif">FluxOS wurde heruntergefahren</div>';
    }
  };

  const handleLogout = async () => {
    if (await showConfirm('Abmelden', 'Möchten Sie sich wirklich abmelden?', '🚪')) {
      logout();
    }
  };

  const openAppById = (appId: string) => {
    setShowStartMenu(false);
    window.dispatchEvent(new CustomEvent('fluxos-open-app', { detail: { appId } }));
  };

  const handleDragStart = (e: React.DragEvent, appId: string) => {
    e.dataTransfer.setData('application/fluxos-app', appId);
    e.dataTransfer.effectAllowed = 'copy';
    // Close start menu after a short delay so drag ghost is visible
    setTimeout(() => setShowStartMenu(false), 150);
  };

  // Build categorized list of installed apps
  const installedAppList = APP_REGISTRY.filter(app => installedApps.has(app.id));
  const groupedApps = CATEGORY_ORDER
    .map(cat => ({ category: cat, apps: installedAppList.filter(a => a.category === cat) }))
    .filter(g => g.apps.length > 0);

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
            <div className="start-menu-apps">
              {groupedApps.map(({ category, apps }) => (
                <div key={category}>
                  <div className="start-menu-category">{category}</div>
                  {apps.map(app => (
                    <div
                      key={app.id}
                      className="start-menu-item"
                      onClick={() => openAppById(app.id)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, app.id)}
                      title="Zum Desktop ziehen für Verknüpfung"
                    >
                      {app.icon} <span>{app.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="start-menu-separator"></div>
            <div className="start-menu-section">
              <div className="start-menu-item" onClick={() => openAppById('system-info')}>
                💻 <span>Systeminformationen</span>
              </div>
              <div className="start-menu-item" onClick={() => openAppById('app-manager')}>
                📦 <span>Programme &amp; Features</span>
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
