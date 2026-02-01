import React from 'react';
import './SystemInfo.css';

const SystemInfo: React.FC = () => {
  const getSystemInfo = () => {
    return {
      os: 'FluxOS 1.0',
      browser: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${window.screen.width} x ${window.screen.height}`,
      windowSize: `${window.innerWidth} x ${window.innerHeight}`,
      cores: navigator.hardwareConcurrency || 'Unbekannt',
      memory: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'Unbekannt',
      online: navigator.onLine ? 'Verbunden' : 'Offline',
      cookiesEnabled: navigator.cookieEnabled ? 'Aktiviert' : 'Deaktiviert',
    };
  };

  const info = getSystemInfo();

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="info-row">
      <div className="info-label">{label}:</div>
      <div className="info-value">{value}</div>
    </div>
  );

  return (
    <div className="system-info">
      <div className="system-info-header">
        <div className="system-logo">💻</div>
        <div>
          <h2>FluxOS</h2>
          <p>Version 1.0.0</p>
        </div>
      </div>

      <div className="system-info-section">
        <h3>Systeminformationen</h3>
        <InfoRow label="Betriebssystem" value={info.os} />
        <InfoRow label="Plattform" value={info.platform} />
        <InfoRow label="Sprache" value={info.language} />
        <InfoRow label="CPU-Kerne" value={String(info.cores)} />
        <InfoRow label="Arbeitsspeicher" value={info.memory} />
      </div>

      <div className="system-info-section">
        <h3>Anzeige</h3>
        <InfoRow label="Bildschirmauflösung" value={info.screenResolution} />
        <InfoRow label="Fenstergröße" value={info.windowSize} />
      </div>

      <div className="system-info-section">
        <h3>Netzwerk & Browser</h3>
        <InfoRow label="Verbindungsstatus" value={info.online} />
        <InfoRow label="Cookies" value={info.cookiesEnabled} />
        <InfoRow label="Browser" value={info.browser} />
      </div>

      <div className="system-info-footer">
        <p>© 2026 FluxOS - Web-basiertes Desktop-Betriebssystem</p>
      </div>
    </div>
  );
};

export default SystemInfo;
