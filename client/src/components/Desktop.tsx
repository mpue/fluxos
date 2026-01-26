import React, { useState } from 'react';
import { useDesktop } from '../contexts/DesktopContext';
import Window from './Window';
import Taskbar from './Taskbar';
import DesktopIcon from './DesktopIcon';
import UserManagement from './UserManagement';
import GroupManagement from './GroupManagement';
import { DesktopIcon as DesktopIconType } from '../types/desktop';
import './Desktop.css';

const Desktop: React.FC = () => {
  const { windows, addWindow } = useDesktop();

  const [desktopIcons] = useState<DesktopIconType[]>([
    {
      id: 'my-computer',
      name: 'Dieser PC',
      icon: '🖥️',
      position: { x: 20, y: 20 },
      onDoubleClick: () => {
        addWindow({
          title: 'Dieser PC',
          icon: '🖥️',
          position: { x: 100, y: 100 },
          size: { width: 600, height: 400 },
          isMinimized: false,
          isMaximized: false,
          content: (
            <div>
              <h2>Dieser PC</h2>
              <p>Lokale Festplatten und Netzwerklaufwerke</p>
              <div style={{ marginTop: '20px' }}>
                <div style={{ padding: '10px', background: '#f0f0f0', marginBottom: '8px' }}>
                  💿 Lokaler Datenträger (C:)
                </div>
                <div style={{ padding: '10px', background: '#f0f0f0', marginBottom: '8px' }}>
                  💿 Lokaler Datenträger (D:)
                </div>
              </div>
            </div>
          ),
        });
      },
    },
    {
      id: 'documents',
      name: 'Dokumente',
      icon: '📁',
      position: { x: 20, y: 120 },
      onDoubleClick: () => {
        addWindow({
          title: 'Dokumente',
          icon: '📁',
          position: { x: 150, y: 150 },
          size: { width: 500, height: 350 },
          isMinimized: false,
          isMaximized: false,
          content: (
            <div>
              <h2>Dokumente</h2>
              <p>Ihre persönlichen Dateien</p>
            </div>
          ),
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
          position: { x: 200, y: 200 },
          size: { width: 800, height: 600 },
          isMinimized: false,
          isMaximized: false,
          content: (
            <div>
              <h2>FluxOS Browser</h2>
              <p>Willkommen im Browser</p>
            </div>
          ),
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
  ]);

  return (
    <div className="desktop">
      <div className="desktop-background"></div>
      
      <div className="desktop-icons">
        {desktopIcons.map(icon => (
          <DesktopIcon key={icon.id} icon={icon} />
        ))}
      </div>

      <div className="windows-container">
        {windows.map(window => (
          <Window key={window.id} window={window} />
        ))}
      </div>

      <Taskbar />
    </div>
  );
};

export default Desktop;
