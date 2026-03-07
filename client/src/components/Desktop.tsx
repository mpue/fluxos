import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import Tetris from './Tetris';
import SpaceInvaders from './SpaceInvaders';
import Sokoban from './Sokoban';
import FluxiRun from './FluxiRun';
import ImageViewer from './ImageViewer';
import Spreadsheet from './Spreadsheet';
import VectorEditor from './VectorEditor';
import VideoPlayer from './VideoPlayer';
import AppManager, { getInstalledApps } from './AppManager';
import PieMenu, { PieMenuItem } from './PieMenu';
import SystemInfo from './SystemInfo';
import { DesktopIcon as DesktopIconType } from '../types/desktop';
import { colorSchemes, getColorScheme } from '../utils/colorSchemes';
import './Desktop.css';

const Desktop: React.FC = () => {
  const { windows, addWindow, wallpaper, setWallpaper, colorScheme, setColorScheme } = useDesktop();
  
  const [installedApps, setInstalledAppsState] = useState<Set<string>>(getInstalledApps);

  useEffect(() => {
    const handler = () => setInstalledAppsState(getInstalledApps());
    window.addEventListener('fluxos-apps-changed', handler);
    return () => window.removeEventListener('fluxos-apps-changed', handler);
  }, []);

  // Handle app open events from start menu
  useEffect(() => {
    const handler = (e: Event) => {
      const appId = (e as CustomEvent).detail?.appId;
      if (!appId) return;
      if (appId === 'system-info') {
        addWindow({
          title: 'Systeminformationen', icon: '💻',
          position: { x: 300, y: 100 }, size: { width: 700, height: 600 },
          isMinimized: false, isMaximized: false, content: <SystemInfo />,
        });
        return;
      }
      const icon = iconsRef.current.find(i => i.id === appId);
      if (icon) icon.onDoubleClick();
    };
    window.addEventListener('fluxos-open-app', handler);
    return () => window.removeEventListener('fluxos-open-app', handler);
  }, [addWindow]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const [pieMenu, setPieMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0, y: 0, visible: false,
  });

  const [iconContextMenu, setIconContextMenu] = useState<{ x: number; y: number; iconId: string } | null>(null);
  const [renamingIconId, setRenamingIconId] = useState<string | null>(null);

  const [desktopIcons, setDesktopIcons] = useState<DesktopIconType[]>(() => {
    const savedPositions: Record<string, { x: number; y: number }> = {};
    try {
      const stored = localStorage.getItem('fluxos-icon-positions');
      if (stored) Object.assign(savedPositions, JSON.parse(stored));
    } catch { /* ignore */ }

    const defaultIcons: DesktopIconType[] = [
    {
      id: 'file-explorer',
      name: 'Datei-Explorer',
      icon: '📂',
      position: savedPositions['file-explorer'] || { x: 20, y: 20 },
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
      position: savedPositions['my-computer'] || { x: 20, y: 120 },
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
      position: savedPositions['browser'] || { x: 20, y: 220 },
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
      position: savedPositions['settings'] || { x: 20, y: 320 },
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
      position: savedPositions['user-management'] || { x: 20, y: 420 },
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
      position: savedPositions['group-management'] || { x: 20, y: 520 },
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
      position: savedPositions['calculator'] || { x: 20, y: 620 },
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
      position: savedPositions['notepad'] || { x: 20, y: 720 },
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
    {
      id: 'tetris',
      name: 'Tetris',
      icon: '🎮',
      position: savedPositions['tetris'] || { x: 20, y: 820 },
      onDoubleClick: () => {
        addWindow({
          title: 'Tetris',
          icon: '🎮',
          position: { x: 200, y: 50 },
          size: { width: 460, height: 580 },
          isMinimized: false,
          isMaximized: false,
          content: <Tetris />,
        });
      },
    },
    {
      id: 'space-invaders',
      name: 'Space Invaders',
      icon: '👾',
      position: savedPositions['space-invaders'] || { x: 110, y: 20 },
      onDoubleClick: () => {
        addWindow({
          title: 'Space Invaders',
          icon: '👾',
          position: { x: 200, y: 30 },
          size: { width: 440, height: 620 },
          isMinimized: false,
          isMaximized: false,
          content: <SpaceInvaders />,
        });
      },
    },
    {
      id: 'sokoban',
      name: 'Sokoban',
      icon: '📦',
      position: savedPositions['sokoban'] || { x: 110, y: 120 },
      onDoubleClick: () => {
        addWindow({
          title: 'Sokoban',
          icon: '📦',
          position: { x: 150, y: 50 },
          size: { width: 500, height: 520 },
          isMinimized: false,
          isMaximized: false,
          content: <Sokoban />,
        });
      },
    },
    {
      id: 'fluxi-run',
      name: 'Fluxi Run',
      icon: '⚡',
      position: savedPositions['fluxi-run'] || { x: 200, y: 20 },
      onDoubleClick: () => {
        addWindow({
          title: 'Fluxi Run',
          icon: '⚡',
          position: { x: 120, y: 30 },
          size: { width: 680, height: 480 },
          isMinimized: false,
          isMaximized: false,
          content: <FluxiRun />,
        });
      },
    },
    {
      id: 'image-viewer',
      name: 'Bildbetrachter',
      icon: '🖼️',
      position: savedPositions['image-viewer'] || { x: 110, y: 220 },
      onDoubleClick: () => {
        addWindow({
          title: 'Bildbetrachter',
          icon: '🖼️',
          position: { x: 150, y: 60 },
          size: { width: 700, height: 500 },
          isMinimized: false,
          isMaximized: false,
          content: <ImageViewer />,
        });
      },
    },
    {
      id: 'spreadsheet',
      name: 'Tabellen',
      icon: '📊',
      position: savedPositions['spreadsheet'] || { x: 110, y: 320 },
      onDoubleClick: () => {
        addWindow({
          title: 'Tabellenkalkulation',
          icon: '📊',
          position: { x: 80, y: 40 },
          size: { width: 950, height: 600 },
          isMinimized: false,
          isMaximized: false,
          content: <Spreadsheet />,
        });
      },
    },
    {
      id: 'vector-editor',
      name: 'Zeichnen',
      icon: '✏️',
      position: savedPositions['vector-editor'] || { x: 110, y: 420 },
      onDoubleClick: () => {
        addWindow({
          title: 'Vektor-Zeichenprogramm',
          icon: '✏️',
          position: { x: 60, y: 30 },
          size: { width: 1000, height: 650 },
          isMinimized: false,
          isMaximized: false,
          content: <VectorEditor />,
        });
      },
    },
    {
      id: 'video-player',
      name: 'Video Player',
      icon: '🎬',
      position: savedPositions['video-player'] || { x: 110, y: 620 },
      onDoubleClick: () => {
        addWindow({
          title: 'Video Player',
          icon: '🎬',
          position: { x: 120, y: 40 },
          size: { width: 900, height: 600 },
          isMinimized: false,
          isMaximized: false,
          content: <VideoPlayer />,
        });
      },
    },
    {
      id: 'app-manager',
      name: 'Programme',
      icon: '📦',
      position: savedPositions['app-manager'] || { x: 110, y: 520 },
      onDoubleClick: () => {
        addWindow({
          title: 'Programme & Features',
          icon: '📦',
          position: { x: 150, y: 60 },
          size: { width: 800, height: 600 },
          isMinimized: false,
          isMaximized: false,
          content: <AppManager />,
        });
      },
    },
  ];
    return defaultIcons;
  });

  // Persist icon positions to localStorage
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    desktopIcons.forEach(icon => { positions[icon.id] = icon.position; });
    localStorage.setItem('fluxos-icon-positions', JSON.stringify(positions));
  }, [desktopIcons]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

  // Refs for drag logic — direct DOM manipulation during drag, commit on mouseup
  const dragRef = useRef<{ iconId: string; lastX: number; lastY: number; hasMoved: boolean; offsets: Map<string, { dx: number; dy: number }> } | null>(null);
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const iconsRef = useRef(desktopIcons);
  iconsRef.current = desktopIcons;

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const handleIconMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const isSelected = selectedIdsRef.current.has(id);
    const additive = e.ctrlKey || e.metaKey;

    if (!isSelected) {
      const newSet = additive ? new Set([...selectedIdsRef.current, id]) : new Set([id]);
      selectedIdsRef.current = newSet;
      setSelectedIds(newSet);
    } else if (additive) {
      const newSet = new Set(selectedIdsRef.current);
      newSet.delete(id);
      selectedIdsRef.current = newSet;
      setSelectedIds(newSet);
      return;
    }

    // Collect DOM elements and init offsets for all dragged icons
    const offsets = new Map<string, { dx: number; dy: number }>();
    const sel = selectedIdsRef.current;
    const draggedIds = new Set(sel);
    draggedIds.add(id);
    draggedIds.forEach(iconId => offsets.set(iconId, { dx: 0, dy: 0 }));

    dragRef.current = { iconId: id, lastX: e.clientX, lastY: e.clientY, hasMoved: false, offsets };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = ev.clientX - dragRef.current.lastX;
      const deltaY = ev.clientY - dragRef.current.lastY;
      if (deltaX === 0 && deltaY === 0) return;
      dragRef.current.hasMoved = true;
      dragRef.current.lastX = ev.clientX;
      dragRef.current.lastY = ev.clientY;

      // Update accumulated offsets and move DOM elements directly
      dragRef.current.offsets.forEach((off, iconId) => {
        off.dx += deltaX;
        off.dy += deltaY;
        const el = document.querySelector(`[data-icon-id="${iconId}"]`) as HTMLElement | null;
        if (el) {
          el.style.transform = `translate(${off.dx}px, ${off.dy}px)`;
        }
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (!dragRef.current) return;
      const finalOffsets = dragRef.current.offsets;
      const moved = dragRef.current.hasMoved;
      dragRef.current = null;

      if (!moved) return;

      // Reset transforms and commit final positions to React state
      finalOffsets.forEach((_off, iconId) => {
        const el = document.querySelector(`[data-icon-id="${iconId}"]`) as HTMLElement | null;
        if (el) el.style.transform = '';
      });

      setDesktopIcons(prev => prev.map(icon => {
        const off = finalOffsets.get(icon.id);
        if (off) {
          return { ...icon, position: { x: icon.position.x + off.dx, y: icon.position.y + off.dy } };
        }
        return icon;
      }));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleIconDoubleClick = useCallback((id: string) => {
    if (dragRef.current?.hasMoved) return;
    const icon = iconsRef.current.find(i => i.id === id);
    if (icon) icon.onDoubleClick();
  }, []);

  const handleIconContextMenu = useCallback((id: string, e: React.MouseEvent) => {
    setIconContextMenu({ x: e.clientX, y: e.clientY, iconId: id });
    setPieMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleIconRename = useCallback((id: string, newName: string) => {
    setDesktopIcons(prev => prev.map(icon =>
      icon.id === id ? { ...icon, name: newName } : icon
    ));
    setRenamingIconId(null);
  }, []);

  const handleDeleteIcon = useCallback((id: string) => {
    const icon = iconsRef.current.find(i => i.id === id);
    if (icon?.isShortcut) {
      setDesktopIcons(prev => prev.filter(i => i.id !== id));
    }
    setIconContextMenu(null);
  }, []);

  // Close icon context menu on click anywhere
  useEffect(() => {
    if (!iconContextMenu) return;
    const handler = () => setIconContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [iconContextMenu]);

  const handleDesktopMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.desktop-icon') || target.closest('.windows-container') || target.closest('.taskbar')) return;

    if (!e.ctrlKey && !e.metaKey) {
      selectedIdsRef.current = new Set();
      setSelectedIds(new Set());
    }

    const startX = e.clientX;
    const startY = e.clientY;
    setMarquee({ startX, startY, endX: startX, endY: startY });
  }, []);

  // Marquee mouse tracking via refs to avoid re-registering listeners
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;

  useEffect(() => {
    if (!marquee) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMarquee(prev => prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null);
    };

    const handleMouseUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const m = marqueeRef.current;
      if (m) {
        const left = Math.min(m.startX, e.clientX);
        const right = Math.max(m.startX, e.clientX);
        const top = Math.min(m.startY, e.clientY);
        const bottom = Math.max(m.startY, e.clientY);

        if (right - left > 5 || bottom - top > 5) {
          const icons = iconsRef.current;
          const newSelected = new Set<string>();
          icons.forEach(icon => {
            const cx = icon.position.x + 45;
            const cy = icon.position.y + 45;
            if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
              newSelected.add(icon.id);
            }
          });
          selectedIdsRef.current = newSelected;
          setSelectedIds(newSelected);
        }
      }
      setMarquee(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [!!marquee]);  // only re-run when marquee toggles between null and non-null

  // Handle right-click: always prevent browser context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Show pie menu only on desktop background
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('desktop-background')) {
      setContextMenu({ x: e.clientX, y: e.clientY, visible: false });
      setPieMenu({ x: e.clientX, y: e.clientY, visible: true });
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

  const pieMenuItems: PieMenuItem[] = [
    {
      id: 'pie-explorer',
      icon: '📂',
      label: 'Datei-Explorer',
      onClick: () => addWindow({
        title: 'Datei-Explorer', icon: '📂',
        position: { x: 100, y: 80 }, size: { width: 900, height: 600 },
        isMinimized: false, isMaximized: false, content: <FileExplorer />,
      }),
    },
    {
      id: 'pie-notepad',
      icon: '📝',
      label: 'Notizen',
      onClick: () => addWindow({
        title: 'Notizen', icon: '📝',
        position: { x: 450, y: 100 }, size: { width: 700, height: 500 },
        isMinimized: false, isMaximized: false, content: <Notepad />,
      }),
    },
    {
      id: 'pie-browser',
      icon: '🌐',
      label: 'Browser',
      onClick: () => addWindow({
        title: 'FluxOS Browser', icon: '🌐',
        position: { x: 100, y: 80 }, size: { width: 1000, height: 700 },
        isMinimized: false, isMaximized: false, content: <Browser />,
      }),
    },
    {
      id: 'pie-calculator',
      icon: '🔢',
      label: 'Rechner',
      onClick: () => addWindow({
        title: 'Rechner', icon: '🔢',
        position: { x: 400, y: 150 }, size: { width: 400, height: 550 },
        isMinimized: false, isMaximized: false, content: <Calculator />,
      }),
    },
    {
      id: 'pie-personalize',
      icon: '🎨',
      label: 'Personalisieren',
      onClick: handlePersonalize,
    },
    {
      id: 'pie-programs',
      icon: '📦',
      label: 'Programme',
      onClick: () => addWindow({
        title: 'Programme & Features', icon: '📦',
        position: { x: 150, y: 60 }, size: { width: 800, height: 600 },
        isMinimized: false, isMaximized: false, content: <AppManager />,
      }),
    },
    {
      id: 'pie-sysinfo',
      icon: '💻',
      label: 'Systeminformationen',
      onClick: () => addWindow({
        title: 'Systeminformationen', icon: '💻',
        position: { x: 300, y: 100 }, size: { width: 700, height: 600 },
        isMinimized: false, isMaximized: false, content: <SystemInfo />,
      }),
    },
    {
      id: 'pie-refresh',
      icon: '🔄',
      label: 'Aktualisieren',
      onClick: handleRefresh,
    },
  ];

  // Handle drop from start menu to create desktop shortcut
  const handleDesktopDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData('application/fluxos-app');
    if (!appId) return;
    const sourceIcon = iconsRef.current.find(i => i.id === appId);
    if (!sourceIcon) return;

    // Check if a shortcut for this app already exists
    const shortcutId = `shortcut-${appId}`;
    const existingShortcut = iconsRef.current.find(i => i.id === shortcutId);
    if (existingShortcut) {
      // Reposition the existing shortcut
      setDesktopIcons(prev => prev.map(icon =>
        icon.id === shortcutId
          ? { ...icon, position: { x: e.clientX - 45, y: e.clientY - 45 } }
          : icon
      ));
    } else {
      // Create a new shortcut
      const newShortcut: DesktopIconType = {
        id: shortcutId,
        name: sourceIcon.name,
        icon: sourceIcon.icon,
        position: { x: e.clientX - 45, y: e.clientY - 45 },
        isShortcut: true,
        onDoubleClick: sourceIcon.onDoubleClick,
      };
      setDesktopIcons(prev => [...prev, newShortcut]);
    }
  }, []);

  const handleDesktopDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/fluxos-app')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  return (
    <div
      className="desktop"
      onContextMenu={handleContextMenu}
      onMouseDown={handleDesktopMouseDown}
      onDrop={handleDesktopDrop}
      onDragOver={handleDesktopDragOver}
    >
      <div className="desktop-background" style={{ background: wallpaper }}></div>
      
      <div className="desktop-icons">
        {desktopIcons
          .filter(icon => icon.id === 'app-manager' || installedApps.has(icon.id) || icon.isShortcut)
          .map(icon => (
          <DesktopIcon
            key={icon.id}
            icon={icon}
            selected={selectedIds.has(icon.id)}
            renaming={renamingIconId === icon.id}
            onMouseDown={handleIconMouseDown}
            onDoubleClick={handleIconDoubleClick}
            onContextMenu={handleIconContextMenu}
            onRename={handleIconRename}
          />
        ))}
      </div>

      {marquee && (
        <div
          className="marquee-selection"
          style={{
            left: Math.min(marquee.startX, marquee.endX),
            top: Math.min(marquee.startY, marquee.endY),
            width: Math.abs(marquee.endX - marquee.startX),
            height: Math.abs(marquee.endY - marquee.startY),
          }}
        />
      )}

      <div className="windows-container">
        {windows.map(window => (
          <Window key={window.id} window={window} />
        ))}
      </div>

      {/* Pie Menu */}
      {pieMenu.visible && (
        <PieMenu
          x={pieMenu.x}
          y={pieMenu.y}
          items={pieMenuItems}
          onClose={() => setPieMenu(prev => ({ ...prev, visible: false }))}
          accentColor={getColorScheme(colorScheme).primary}
        />
      )}

      {/* Icon Context Menu */}
      {iconContextMenu && (() => {
        const targetIcon = desktopIcons.find(i => i.id === iconContextMenu.iconId);
        return (
          <div
            className="icon-context-menu"
            style={{ left: iconContextMenu.x, top: iconContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="icon-ctx-item" onClick={() => {
              if (targetIcon) targetIcon.onDoubleClick();
              setIconContextMenu(null);
            }}>
              ▶ Öffnen
            </div>
            <div className="icon-ctx-separator" />
            <div className="icon-ctx-item" onClick={() => {
              setRenamingIconId(iconContextMenu.iconId);
              setIconContextMenu(null);
            }}>
              ✏️ Umbenennen
            </div>
            {targetIcon?.isShortcut && (
              <div className="icon-ctx-item icon-ctx-delete" onClick={() => handleDeleteIcon(iconContextMenu.iconId)}>
                🗑️ Verknüpfung löschen
              </div>
            )}
          </div>
        );
      })()}

      <Taskbar />
    </div>
  );
};

export default Desktop;
