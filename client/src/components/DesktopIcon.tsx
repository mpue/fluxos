import React from 'react';
import { DesktopIcon as DesktopIconType } from '../types/desktop';
import './DesktopIcon.css';

interface DesktopIconProps {
  icon: DesktopIconType;
}

const DesktopIcon: React.FC<DesktopIconProps> = ({ icon }) => {
  return (
    <div
      className="desktop-icon"
      style={{
        left: icon.position.x,
        top: icon.position.y,
      }}
      onDoubleClick={icon.onDoubleClick}
    >
      <div className="icon-image">{icon.icon}</div>
      <div className="icon-label">{icon.name}</div>
    </div>
  );
};

export default DesktopIcon;
