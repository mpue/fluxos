import React, { useRef, useCallback } from 'react';
import { DesktopIcon as DesktopIconType } from '../types/desktop';
import './DesktopIcon.css';

interface DesktopIconProps {
  icon: DesktopIconType;
  onMove: (id: string, x: number, y: number) => void;
}

const DesktopIcon: React.FC<DesktopIconProps> = ({ icon, onMove }) => {
  const dragging = useRef(false);
  const hasMoved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    hasMoved.current = false;
    offset.current = {
      x: e.clientX - icon.position.x,
      y: e.clientY - icon.position.y,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      hasMoved.current = true;
      onMove(icon.id, ev.clientX - offset.current.x, ev.clientY - offset.current.y);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [icon.id, icon.position.x, icon.position.y, onMove]);

  const handleDoubleClick = useCallback(() => {
    if (hasMoved.current) return;
    icon.onDoubleClick();
  }, [icon]);

  return (
    <div
      className="desktop-icon"
      style={{
        left: icon.position.x,
        top: icon.position.y,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className="icon-image">{icon.icon}</div>
      <div className="icon-label">{icon.name}</div>
    </div>
  );
};

export default DesktopIcon;
