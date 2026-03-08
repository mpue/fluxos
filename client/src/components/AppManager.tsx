import React, { useState, useEffect } from 'react';
import { getColorScheme } from '../utils/colorSchemes';
import { useDesktop } from '../contexts/DesktopContext';
import './AppManager.css';

export interface AppInfo {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  size: string;
  version: string;
  isSystem: boolean;
}

export const APP_REGISTRY: AppInfo[] = [
  { id: 'file-explorer', name: 'Datei-Explorer', icon: '📂', category: 'System', description: 'Dateien und Ordner verwalten', size: '3.2 MB', version: '1.0.0', isSystem: true },
  { id: 'my-computer', name: 'Dieser PC', icon: '🖥️', category: 'System', description: 'Übersicht über Ihren Computer', size: '1.5 MB', version: '1.0.0', isSystem: true },
  { id: 'browser', name: 'Browser', icon: '🌐', category: 'Internet', description: 'Im Internet surfen', size: '8.7 MB', version: '1.0.0', isSystem: false },
  { id: 'settings', name: 'Einstellungen', icon: '⚙️', category: 'System', description: 'Systemeinstellungen anpassen', size: '2.1 MB', version: '1.0.0', isSystem: true },
  { id: 'user-management', name: 'Benutzerverwaltung', icon: '👥', category: 'Verwaltung', description: 'Benutzerkonten verwalten', size: '1.8 MB', version: '1.0.0', isSystem: false },
  { id: 'group-management', name: 'Gruppenverwaltung', icon: '👨‍👩‍👧‍👦', category: 'Verwaltung', description: 'Benutzergruppen verwalten', size: '1.6 MB', version: '1.0.0', isSystem: false },
  { id: 'calculator', name: 'Rechner', icon: '🔢', category: 'Zubehör', description: 'Mathematische Berechnungen', size: '0.8 MB', version: '1.0.0', isSystem: false },
  { id: 'notepad', name: 'Notizen', icon: '📝', category: 'Zubehör', description: 'Texte schreiben und bearbeiten', size: '1.2 MB', version: '1.0.0', isSystem: false },
  { id: 'tetris', name: 'Tetris', icon: '🎮', category: 'Spiele', description: 'Klassisches Tetris-Spiel', size: '2.3 MB', version: '1.0.0', isSystem: false },
  { id: 'space-invaders', name: 'Space Invaders', icon: '👾', category: 'Spiele', description: 'Klassisches Arcade-Spiel', size: '2.8 MB', version: '1.0.0', isSystem: false },
  { id: 'sokoban', name: 'Sokoban', icon: '📦', category: 'Spiele', description: 'Kisten-Schiebe-Rätsel', size: '1.9 MB', version: '1.0.0', isSystem: false },
  { id: 'fluxi-run', name: 'Fluxi Run', icon: '⚡', category: 'Spiele', description: 'Jump & Run – Fluxi vs. Der Böse User', size: '3.1 MB', version: '1.0.0', isSystem: false },
  { id: 'image-viewer', name: 'Bildbetrachter', icon: '🖼️', category: 'Multimedia', description: 'Bilder anzeigen und betrachten', size: '3.5 MB', version: '1.0.0', isSystem: false },
  { id: 'spreadsheet', name: 'Tabellenkalkulation', icon: '📊', category: 'Büro', description: 'Tabellen und Kalkulationen erstellen', size: '5.4 MB', version: '1.0.0', isSystem: false },
  { id: 'vector-editor', name: 'Vektor-Zeichenprogramm', icon: '✏️', category: 'Multimedia', description: 'Vektorgrafiken erstellen und bearbeiten', size: '6.1 MB', version: '1.0.0', isSystem: false },
  { id: 'video-player', name: 'Video Player', icon: '🎬', category: 'Multimedia', description: 'Videos abspielen', size: '4.2 MB', version: '1.0.0', isSystem: false },
  { id: 'terminal', name: 'Terminal', icon: '>_', category: 'System', description: 'Linux-kompatible Terminalemulation', size: '2.5 MB', version: '2.0.0', isSystem: true },
  { id: 'code-editor', name: 'Code Editor', icon: '</>', category: 'Entwicklung', description: 'Code-Editor mit Syntax-Highlighting und Skript-Ausführung', size: '4.8 MB', version: '1.0.0', isSystem: false },
];

const STORAGE_KEY = 'fluxos-installed-apps';

export function getInstalledApps(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ids = new Set<string>(JSON.parse(stored));
      // Auto-add newly registered apps that aren't in the saved set yet
      const knownIds = new Set<string>(JSON.parse(stored));
      for (const app of APP_REGISTRY) {
        if (!knownIds.has(app.id) && !ids.has(app.id)) {
          ids.add(app.id);
        }
      }
      return ids;
    }
  } catch { /* ignore */ }
  return new Set(APP_REGISTRY.map(a => a.id));
}

export function setInstalledApps(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent('fluxos-apps-changed'));
}

const AppManager: React.FC = () => {
  const { colorScheme } = useDesktop();
  const scheme = getColorScheme(colorScheme);

  const [installedApps, setInstalledLocal] = useState<Set<string>>(getInstalledApps);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Alle');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'category'>('name');

  useEffect(() => {
    const handler = () => setInstalledLocal(getInstalledApps());
    window.addEventListener('fluxos-apps-changed', handler);
    return () => window.removeEventListener('fluxos-apps-changed', handler);
  }, []);

  const categories = ['Alle', ...Array.from(new Set(APP_REGISTRY.map(a => a.category)))];

  const filteredApps = APP_REGISTRY
    .filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Alle' || app.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'category') return a.category.localeCompare(b.category);
      return parseFloat(a.size) - parseFloat(b.size);
    });

  const installedCount = APP_REGISTRY.filter(a => installedApps.has(a.id)).length;
  const totalSize = APP_REGISTRY
    .filter(a => installedApps.has(a.id))
    .reduce((sum, a) => sum + parseFloat(a.size), 0)
    .toFixed(1);

  const handleToggleApp = (appId: string) => {
    const app = APP_REGISTRY.find(a => a.id === appId);
    if (!app || app.isSystem) return;

    const next = new Set<string>(installedApps);
    if (next.has(appId)) {
      next.delete(appId);
    } else {
      next.add(appId);
    }
    setInstalledLocal(next);
    setInstalledApps(next);
  };

  return (
    <div className="app-manager">
      <div className="app-manager-header">
        <div className="app-manager-title">
          <h2>Programme &amp; Features</h2>
          <p className="app-manager-subtitle">
            {installedCount} Programme installiert · {totalSize} MB belegt
          </p>
        </div>
      </div>

      <div className="app-manager-toolbar">
        <div className="app-manager-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Programme durchsuchen..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <div className="app-manager-filters">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'name' | 'size' | 'category')}
            className="filter-select"
          >
            <option value="name">Name</option>
            <option value="size">Größe</option>
            <option value="category">Kategorie</option>
          </select>
        </div>
      </div>

      <div className="app-manager-list">
        {filteredApps.length === 0 ? (
          <div className="app-manager-empty">
            <span className="empty-icon">📭</span>
            <p>Keine Programme gefunden</p>
          </div>
        ) : (
          filteredApps.map(app => {
            const isInstalled = installedApps.has(app.id);
            return (
              <div key={app.id} className={`app-item ${isInstalled ? 'installed' : 'not-installed'}`}>
                <div className="app-item-icon">{app.icon}</div>
                <div className="app-item-info">
                  <div className="app-item-name">{app.name}</div>
                  <div className="app-item-description">{app.description}</div>
                  <div className="app-item-meta">
                    <span className="app-item-category">{app.category}</span>
                    <span className="app-item-separator">·</span>
                    <span className="app-item-size">{app.size}</span>
                    <span className="app-item-separator">·</span>
                    <span className="app-item-version">v{app.version}</span>
                  </div>
                </div>
                <div className="app-item-actions">
                  {app.isSystem ? (
                    <span className="app-item-system-badge">System</span>
                  ) : isInstalled ? (
                    <button
                      className="app-item-btn uninstall-btn"
                      onClick={() => handleToggleApp(app.id)}
                    >
                      Deinstallieren
                    </button>
                  ) : (
                    <button
                      className="app-item-btn install-btn"
                      onClick={() => handleToggleApp(app.id)}
                      style={{ background: scheme.gradient }}
                    >
                      Installieren
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AppManager;
