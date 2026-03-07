import React from 'react';
import { DesktopIcon as DesktopIconType } from '../types/desktop';
import './DesktopIcon.css';

interface DesktopIconProps {
  icon: DesktopIconType;
  selected: boolean;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
}

const DesktopIcon: React.FC<DesktopIconProps> = ({ icon, selected, onMouseDown, onDoubleClick }) => {
  return (
    <div
      className={`desktop-icon${selected ? ' selected' : ''}`}
      data-icon-id={icon.id}
      style={{
        left: icon.position.x,
        top: icon.position.y,
      }}
      onMouseDown={(e) => onMouseDown(icon.id, e)}
      onDoubleClick={() => onDoubleClick(icon.id)}
    >
      <div className="icon-image">{icon.icon}</div>
      <div className="icon-label">{icon.name}</div>
    </div>
  );
};

export default DesktopIcon;
