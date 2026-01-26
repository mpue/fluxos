import React, { useState } from 'react';
import { useDesktop } from '../contexts/DesktopContext';
import './Taskbar.css';

const Taskbar: React.FC = () => {
  const { windows, focusWindow, minimizeWindow } = useDesktop();
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

  return (
    <div className="taskbar">
      <button 
        className={`start-button ${showStartMenu ? 'active' : ''}`}
        onClick={() => setShowStartMenu(!showStartMenu)}
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
          <div className="start-menu-header">FluxOS</div>
          <div className="start-menu-content">
            <div className="start-menu-item">📁 Dateien</div>
            <div className="start-menu-item">⚙️ Einstellungen</div>
            <div className="start-menu-item">🖥️ System</div>
            <div className="start-menu-separator"></div>
            <div className="start-menu-item">⏻ Herunterfahren</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Taskbar;
