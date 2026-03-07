import React, { useState, useEffect, useCallback } from 'react';
import { useDesktop } from '../contexts/DesktopContext';
import Window from './Window';
import Taskbar from './Taskbar';
import DesktopIcon from './DesktopIcon';
import UserManagement from './UserManagement';
import GroupManagement from './GroupManagement';
import Browser from './Browser';
import FileExplorer from './FileExplorer';
import Calculator from './Calculator';
import Notepad from './Notepad';
import { DesktopIcon as DesktopIconType } from '../types/desktop';
import { colorSchemes, getColorScheme } from '../utils/colorSchemes';
import './Desktop.css';

const Desktop: React.FC = () => {
  const { windows, addWindow, wallpaper, setWallpaper, colorScheme, setColorScheme } = useDesktop();
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const [desktopIcons, setDesktopIcons] = useState<DesktopIconType[]>([
    {
      id: 'file-explorer',
      name: 'Datei-Explorer',
      icon: '📂',
      position: { x: 20, y: 20 },
      onDoubleClick: () => {
        addWindow({
          title: 'Datei-Explorer',
          icon: '📂',
          position: { x: 100, y: 80 },
          size: { width: 900, height: 600 },
          isMinimized: false,
          isMaximized: false,
          content: <FileExplorer />,
        });
      },
    },
    {
      id: 'my-computer',
      name: 'Dieser PC',
      icon: '🖥️',
      position: { x: 20, y: 120 },
      onDoubleClick: () => {
        addWindow({
          title: 'Dieser PC',
          icon: '🖥️',
          position: { x: 100, y: 100 },
          size: { width: 900, height: 600 },
          isMinimized: false,
          isMaximized: false,
          content: <FileExplorer />,
        });
      },
    },
    {
      id: 'browser',
      name: 'Browser',
      icon: '🌐',
      position: { x: 20, y: 220 },
      onDoubleClick: () => {
        addWindow({
          title: 'FluxOS Browser',
          icon: '🌐',
          position: { x: 100, y: 80 },
          size: { width: 1000, height: 700 },
          isMinimized: false,
          isMaximized: false,
          content: <Browser />,
        });
      },
    },
    {
      id: 'settings',
      name: 'Einstellungen',
      icon: '⚙️',
      position: { x: 20, y: 320 },
      onDoubleClick: () => {
        addWindow({
          title: 'Einstellungen',
          icon: '⚙️',
          position: { x: 250, y: 150 },
          size: { width: 700, height: 500 },
          isMinimized: false,
          isMaximized: false,
          content: (
            <div>
              <h2>Systemeinstellungen</h2>
              <p>Passen Sie Ihr System an</p>
            </div>
          ),
        });
      },
    },
    {
      id: 'user-management',
      name: 'Benutzer',
      icon: '👥',
      position: { x: 20, y: 420 },
      onDoubleClick: () => {
        addWindow({
          title: 'Benutzerverwaltung',
          icon: '👥',
          position: { x: 300, y: 100 },
          size: { width: 900, height: 600 },
          isMinimized: false,
          isMaximized: false,
          content: <UserManagement />,
        });
      },
    },
    {
      id: 'group-management',
      name: 'Gruppen',
      icon: '👨‍👩‍👧‍👦',
      position: { x: 20, y: 520 },
      onDoubleClick: () => {
        addWindow({
          title: 'Gruppenverwaltung',
          icon: '👨‍👩‍👧‍👦',
          position: { x: 350, y: 120 },
          size: { width: 950, height: 650 },
          isMinimized: false,
          isMaximized: false,
          content: <GroupManagement />,
        });
      },
    },
    {
      id: 'calculator',
      name: 'Rechner',
      icon: '🔢',
      position: { x: 20, y: 620 },
      onDoubleClick: () => {
        addWindow({
          title: 'Rechner',
          icon: '🔢',
          position: { x: 400, y: 150 },
          size: { width: 400, height: 550 },
          isMinimized: false,
          isMaximized: false,
          content: <Calculator />,
        });
      },
    },
    {
      id: 'notepad',
      name: 'Notizen',
      icon: '📝',
      position: { x: 20, y: 720 },
      onDoubleClick: () => {
        addWindow({
          title: 'Notizen',
          icon: '📝',
          position: { x: 450, y: 100 },
          size: { width: 700, height: 500 },
          isMinimized: false,
          isMaximized: false,
          content: <Notepad />,
        });
      },
    },
  ]);

  const handleIconMove = useCallback((id: string, x: number, y: number) => {
    setDesktopIcons(prev => prev.map(icon =>
      icon.id === id ? { ...icon, position: { x, y } } : icon
    ));
  }, []);

  // Handle right-click: always prevent browser context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Show custom context menu only on desktop background
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('desktop-background')) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true,
      });
    }
  };

  // Close context menu on any click
  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handlePersonalize = () => {
    const wallpapers = [
      { name: 'Gradient Lila', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)' },
      { name: 'Gradient Blau', value: 'linear-gradient(135deg, #2e3192 0%, #1bffff 100%)' },
      { name: 'Gradient Orange', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
      { name: 'Gradient Grün', value: 'linear-gradient(135deg, #00d2ff 0%, #3a47d5 50%, #00d2ff 100%)' },
      { name: 'Nacht', value: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
      { name: 'Sonnenuntergang', value: 'linear-gradient(135deg, #ff512f 0%, #dd2476 100%)' },
      { name: 'Ozean', value: 'linear-gradient(135deg, #2e3192 0%, #1bffff 100%)' },
      { name: 'Wald', value: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
    ];

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageUrl = e.target?.result as string;
          setWallpaper(`url(${imageUrl}) center/cover no-repeat`);
        };
        reader.readAsDataURL(file);
      }
    };

    addWindow({
      title: 'Personalisierung',
      icon: '🎨',
      position: { x: 200, y: 100 },
      size: { width: 750, height: 700 },
      isMinimized: false,
      isMaximized: false,
      content: (
        <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
          {/* Color Scheme Section */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '10px' }}>Farbschema</h2>
            <p style={{ marginBottom: '20px', color: '#666' }}>Wählen Sie ein Farbschema für das System</p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
              gap: '12px',
            }}>
              {colorSchemes.map((scheme) => (
                <div 
                  key={scheme.id}
                  onClick={() => setColorScheme(scheme.id)}
                  style={{
                    cursor: 'pointer',
                    border: colorScheme === scheme.id ? '3px solid #0078d4' : '2px solid #ddd',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    boxShadow: colorScheme === scheme.id ? '0 4px 8px rgba(0,120,212,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  onMouseEnter={(e) => {
                    if (colorScheme !== scheme.id) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <div style={{
                    background: scheme.gradient,
                    height: '80px',
                    width: '100%',
                  }}></div>
                  <div style={{
                    padding: '10px',
                    background: 'white',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: colorScheme === scheme.id ? 'bold' : 'normal',
                    color: colorScheme === scheme.id ? '#0078d4' : '#333',
                  }}>
                    {scheme.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Wallpaper Section */}
          <div>
            <h2 style={{ marginTop: 0, marginBottom: '10px' }}>Desktop-Hintergrund</h2>
            <p style={{ marginBottom: '20px', color: '#666' }}>Wählen Sie ein Hintergrundbild für Ihren Desktop</p>
          
            {/* Upload Section */}
            <div style={{
              marginBottom: '25px',
              padding: '20px',
              border: '2px dashed #0078d4',
              borderRadius: '8px',
              textAlign: 'center',
              background: '#f5f5f5'
            }}>
              <div style={{ marginBottom: '10px', fontSize: '32px' }}>🖼️</div>
              <label htmlFor="wallpaper-upload" style={{
                display: 'inline-block',
                padding: '10px 20px',
                background: '#0078d4',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                Eigenes Bild hochladen
              </label>
              <input
                id="wallpaper-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                JPG, PNG oder GIF - Maximale Größe: 10MB
              </p>
            </div>

            <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Vordefinierte Hintergründe</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
              gap: '15px',
              marginTop: '20px'
            }}>
            {wallpapers.map((wp) => (
              <div 
                key={wp.name}
                onClick={() => setWallpaper(wp.value)}
                style={{
                  cursor: 'pointer',
                  border: wallpaper === wp.value ? '3px solid #0078d4' : '2px solid #ddd',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  boxShadow: wallpaper === wp.value ? '0 4px 8px rgba(0,120,212,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                }}
                onMouseEnter={(e) => {
                  if (wallpaper !== wp.value) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <div style={{
                  background: wp.value,
                  height: '100px',
                  width: '100%',
                }}></div>
                <div style={{
                  padding: '10px',
                  background: 'white',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: wallpaper === wp.value ? 'bold' : 'normal',
                  color: wallpaper === wp.value ? '#0078d4' : '#333',
                }}>
                  {wp.name}
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      ),
    });
  };

  return (
    <div className="desktop" onContextMenu={handleContextMenu}>
      <div className="desktop-background" style={{ background: wallpaper }}></div>
      
      <div className="desktop-icons">
        {desktopIcons.map(icon => (
          <DesktopIcon key={icon.id} icon={icon} onMove={handleIconMove} />
        ))}
      </div>

      <div className="windows-container">
        {windows.map(window => (
          <Window key={window.id} window={window} />
        ))}
      </div>

      {/* Desktop Context Menu */}
      {contextMenu.visible && (
        <div 
          className="desktop-context-menu"
          style={{ 
            left: contextMenu.x, 
            top: contextMenu.y 
          }}
        >
          <div className="context-menu-section">
            <div className="context-menu-item" onClick={handleRefresh}>
              <span className="context-menu-icon">🔄</span>
              <span>Aktualisieren</span>
            </div>
          </div>
          
          <div className="context-menu-divider"></div>
          
          <div className="context-menu-section">
            <div className="context-menu-item context-menu-item-submenu">
              <span className="context-menu-icon">➕</span>
              <span>Neu</span>
              <span className="context-menu-arrow">▶</span>
            </div>
          </div>
          
          <div className="context-menu-divider"></div>
          
          <div className="context-menu-section">
            <div className="context-menu-item context-menu-item-submenu">
              <span className="context-menu-icon">👁️</span>
              <span>Ansicht</span>
              <span className="context-menu-arrow">▶</span>
            </div>
            <div className="context-menu-item context-menu-item-submenu">
              <span className="context-menu-icon">📊</span>
              <span>Sortieren nach</span>
              <span className="context-menu-arrow">▶</span>
            </div>
          </div>
          
          <div className="context-menu-divider"></div>
          
          <div className="context-menu-section">
            <div 
              className="context-menu-item" 
              onClick={handlePersonalize}
              style={{
                background: undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `linear-gradient(90deg, ${getColorScheme(colorScheme).primary}15, ${getColorScheme(colorScheme).secondary}10)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '';
              }}
            >
              <span className="context-menu-icon">🎨</span>
              <span>Personalisieren</span>
            </div>
          </div>
        </div>
      )}

      <Taskbar />
    </div>
  );
};

export default Desktop;
