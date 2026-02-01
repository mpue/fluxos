import React, { useRef, useEffect, useState } from 'react';
import { WindowState } from '../types/desktop';
import { useDesktop } from '../contexts/DesktopContext';
import { getColorScheme } from '../utils/colorSchemes';
import './Window.css';

interface WindowProps {
  window: WindowState;
}

const Window: React.FC<WindowProps> = ({ window }) => {
  const { removeWindow, focusWindow, minimizeWindow, maximizeWindow, updateWindowPosition, updateWindowSize, colorScheme } = useDesktop();
  const currentColorScheme = getColorScheme(colorScheme);
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

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

  const handleResizeMouseDown = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    focusWindow(window.id);
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: typeof window.size.width === 'number' ? window.size.width : parseInt(window.size.width as string),
      height: typeof window.size.height === 'number' ? window.size.height : parseInt(window.size.height as string),
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !window.isMaximized) {
        updateWindowPosition(window.id, {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }

      if (isResizing && !window.isMaximized) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = window.position.x;
        let newY = window.position.y;

        if (resizeDirection.includes('e')) {
          newWidth = Math.max(300, resizeStart.width + deltaX);
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(200, resizeStart.height + deltaY);
        }
        if (resizeDirection.includes('w')) {
          const width = Math.max(300, resizeStart.width - deltaX);
          newX = window.position.x + (resizeStart.width - width);
          newWidth = width;
        }
        if (resizeDirection.includes('n')) {
          const height = Math.max(200, resizeStart.height - deltaY);
          newY = window.position.y + (resizeStart.height - height);
          newHeight = height;
        }

        updateWindowSize(window.id, { width: newWidth, height: newHeight });
        if (newX !== window.position.x || newY !== window.position.y) {
          updateWindowPosition(window.id, { x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, resizeDirection, window.id, window.position, window.size, window.isMaximized, updateWindowPosition, updateWindowSize]);

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
      <div 
        className="window-titlebar" 
        onMouseDown={handleMouseDown}
        style={{
          background: window.isFocused ? currentColorScheme.gradient : undefined,
        }}
      >
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
      
      {!window.isMaximized && (
        <>
          <div className="resize-handle resize-n" onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
          <div className="resize-handle resize-e" onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
          <div className="resize-handle resize-s" onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
          <div className="resize-handle resize-w" onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
          <div className="resize-handle resize-ne" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
          <div className="resize-handle resize-se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
          <div className="resize-handle resize-sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
          <div className="resize-handle resize-nw" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
        </>
      )}
    </div>
  );
};

export default Window;
