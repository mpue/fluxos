import React, { useRef, useEffect, useState } from 'react';
import { WindowState } from '../types/desktop';
import { useDesktop } from '../contexts/DesktopContext';
import './Window.css';

interface WindowProps {
  window: WindowState;
}

const Window: React.FC<WindowProps> = ({ window }) => {
  const { removeWindow, focusWindow, minimizeWindow, maximizeWindow, updateWindowPosition } = useDesktop();
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-titlebar')) {
      focusWindow(window.id);
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - window.position.x,
        y: e.clientY - window.position.y,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !window.isMaximized) {
        updateWindowPosition(window.id, {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, window.id, window.isMaximized, updateWindowPosition]);

  if (window.isMinimized) {
    return null;
  }

  const style: React.CSSProperties = {
    left: window.isMaximized ? 0 : window.position.x,
    top: window.isMaximized ? 0 : window.position.y,
    width: window.isMaximized ? '100%' : window.size.width,
    height: window.isMaximized ? 'calc(100% - 48px)' : window.size.height,
    zIndex: window.zIndex,
  };

  return (
    <div
      ref={windowRef}
      className={`window ${window.isFocused ? 'focused' : ''} ${window.isMaximized ? 'maximized' : ''} ${isDragging ? 'dragging' : ''}`}
      style={style}
      onMouseDown={() => focusWindow(window.id)}
    >
      <div className="window-titlebar" onMouseDown={handleMouseDown}>
        <div className="window-title">
          {window.icon && <span className="window-icon">{window.icon}</span>}
          {window.title}
        </div>
        <div className="window-controls">
          <button className="window-button minimize" onClick={() => minimizeWindow(window.id)}>
            −
          </button>
          <button className="window-button maximize" onClick={() => maximizeWindow(window.id)}>
            {window.isMaximized ? '❐' : '□'}
          </button>
          <button className="window-button close" onClick={() => removeWindow(window.id)}>
            ×
          </button>
        </div>
      </div>
      <div className="window-content">
        {window.content || <div>Window Content</div>}
      </div>
    </div>
  );
};

export default Window;
