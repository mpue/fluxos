import React, { useState, useRef, useEffect } from 'react';
import { DesktopIcon as DesktopIconType } from '../types/desktop';
import './DesktopIcon.css';

interface DesktopIconProps {
  icon: DesktopIconType;
  selected: boolean;
  renaming: boolean;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
  onContextMenu: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, newName: string) => void;
}

const DesktopIcon: React.FC<DesktopIconProps> = ({ icon, selected, renaming, onMouseDown, onDoubleClick, onContextMenu, onRename }) => {
  const [renameValue, setRenameValue] = useState(icon.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming && inputRef.current) {
      setRenameValue(icon.name);
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming, icon.name]);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== icon.name) {
      onRename(icon.id, trimmed);
    } else {
      onRename(icon.id, icon.name); // cancel — keep original
    }
  };

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
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(icon.id, e); }}
    >
      <div className="icon-image">
        {icon.icon}
        {icon.isShortcut && <span className="shortcut-badge">↗</span>}
      </div>
      {renaming ? (
        <input
          ref={inputRef}
          className="icon-rename-input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') onRename(icon.id, icon.name);
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="icon-label">{icon.name}</div>
      )}
    </div>
  );
};

export default DesktopIcon;
