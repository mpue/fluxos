import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useFileSystem } from '../contexts/FileSystemContext';
import { useDesktop } from '../contexts/DesktopContext';
import { useDialog } from '../contexts/DialogContext';
import { FileSystemItem } from '../types/filesystem';
import TextEditor from './TextEditor';
import ImageViewer from './ImageViewer';
import './FileExplorer.css';

const FileExplorer: React.FC = () => {
  const {
    currentPath,
    getCurrentItems,
    createItem,
    deleteItem,
    renameItem,
    copyItem,
    cutItem,
    paste,
    navigateTo,
    getItemById,
    getPathString,
    clipboard,
    uploadFile,
  } = useFileSystem();

  const { addWindow } = useDesktop();
  const { showPrompt, showConfirm, showInfo } = useDialog();

  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null);
  const [renamingItem, setRenamingItem] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [viewMode, setViewMode] = useState<'icons' | 'list'>('icons');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: string | null } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentItems = getCurrentItems();

  useEffect(() => {
    if (renamingItem && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingItem]);

  const getFileIcon = (item: FileSystemItem) => {
    if (item.type === 'folder') return '📁';
    const ext = item.extension?.toLowerCase();
    switch (ext) {
      case 'txt': return '📄';
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx': return '📜';
      case 'json': return '📋';
      case 'css': return '🎨';
      case 'html': return '🌐';
      case 'md': return '📝';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif': return '🖼️';
      default: return '📄';
    }
  };

  const handleItemClick = (item: FileSystemItem) => {
    setSelectedItem(item);
  };

  const handleItemDoubleClick = (item: FileSystemItem) => {
    if (item.type === 'folder') {
      navigateTo(item.id);
      setSelectedItem(null);
    } else {
      const ext = item.extension?.toLowerCase();
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico'];
      if (ext && imageExts.includes(ext) && item.content) {
        addWindow({
          title: item.name,
          icon: '🖼️',
          position: { x: 150, y: 80 },
          size: { width: 700, height: 500 },
          isMinimized: false,
          isMaximized: false,
          content: <ImageViewer src={item.content} fileName={item.name} />,
        });
      } else {
        addWindow({
          title: item.name,
          icon: '📝',
          position: { x: 150, y: 80 },
          size: { width: 800, height: 600 },
          isMinimized: false,
          isMaximized: false,
          content: <TextEditor fileId={item.id} />,
        });
      }
    }
  };

  const handleNavigateUp = () => {
    if (currentPath) {
      const folder = getItemById(currentPath);
      if (folder && folder.parentId) {
        navigateTo(folder.parentId);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, itemId: string | null = null) => {
    e.preventDefault();
    
    const x = Math.min(e.clientX, window.innerWidth - 250);
    const y = Math.min(e.clientY, window.innerHeight - 400);
    
    setContextMenu({ x, y, itemId });
  };

  const handleCreateFolder = async () => {
    setContextMenu(null);
    const name = await showPrompt('Neuer Ordner', 'Ordnername:');
    if (name) {
      createItem(name, 'folder', currentPath);
    }
  };

  const handleCreateFile = async () => {
    setContextMenu(null);
    const name = await showPrompt('Neue Datei', 'Dateiname:');
    if (name) {
      createItem(name, 'file', currentPath);
    }
  };

  const handleRename = (itemId: string) => {
    const item = getItemById(itemId);
    if (item) {
      setRenamingItem(itemId);
      setRenameValue(item.name);
    }
    setContextMenu(null);
  };

  const handleRenameSubmit = () => {
    if (renamingItem && renameValue.trim()) {
      renameItem(renamingItem, renameValue.trim());
    }
    setRenamingItem(null);
    setRenameValue('');
  };

  const handleDelete = async (itemId: string) => {
    const item = getItemById(itemId);
    setContextMenu(null);
    if (item && await showConfirm('Löschen', `"${item.name}" wirklich löschen?`, '🗑️')) {
      deleteItem(itemId);
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
    }
  };

  const handleCopy = (itemId: string) => {
    copyItem(itemId);
    setContextMenu(null);
  };

  const handleCut = (itemId: string) => {
    cutItem(itemId);
    setContextMenu(null);
  };

  const handlePaste = () => {
    paste(currentPath);
    setContextMenu(null);
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
    setContextMenu(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      await uploadFile(files[i], currentPath);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      await uploadFile(files[i], currentPath);
    }
  };

  const handleRefresh = () => {
    setSelectedItem(null);
    setContextMenu(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedItem) return;

      if (e.key === 'Delete') {
        handleDelete(selectedItem.id);
      } else if (e.key === 'F2') {
        handleRename(selectedItem.id);
      } else if (e.ctrlKey && e.key === 'c') {
        handleCopy(selectedItem.id);
      } else if (e.ctrlKey && e.key === 'x') {
        handleCut(selectedItem.id);
      } else if (e.ctrlKey && e.key === 'v') {
        handlePaste();
      } else if (e.key === 'Enter') {
        handleItemDoubleClick(selectedItem);
      } else if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        handleCreateFolder();
      } else if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleCreateFile();
      } else if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        handleUploadClick();
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, currentPath]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="file-explorer">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <div className="file-explorer-toolbar">
        <button onClick={handleNavigateUp} disabled={!currentPath} title="Nach oben (Backspace)">
          ⬆️
        </button>
        <div className="file-explorer-path">{getPathString(currentPath)}</div>
        <button onClick={handleUploadClick} title="Dateien hochladen (Strg+U)">
          📤
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCreateFolder();
          }}
          title="Neuer Ordner (Strg+Umschalt+N)"
        >
          📁➕
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCreateFile();
          }}
          title="Neue Datei (Strg+N)"
        >
          📄➕
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRefresh();
          }}
          title="Aktualisieren (F5)"
        >
          🔄
        </button>
        <button
          onClick={() => setViewMode(viewMode === 'icons' ? 'list' : 'icons')}
          title="Ansicht wechseln"
        >
          {viewMode === 'icons' ? '📋' : '🔲'}
        </button>
      </div>

      <div
        className={`file-explorer-content ${viewMode} ${isDragging ? 'dragging' : ''}`}
        onContextMenu={(e) => handleContextMenu(e, null)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {viewMode === 'icons' ? (
          <div className="file-explorer-grid">
            {currentItems.map((item) => (
              <div
                key={item.id}
                className={`file-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
                onClick={() => handleItemClick(item)}
                onDoubleClick={() => handleItemDoubleClick(item)}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, item.id);
                }}
              >
                <div className="file-icon">{getFileIcon(item)}</div>
                {renamingItem === item.id ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    className="rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameSubmit()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit();
                      if (e.key === 'Escape') setRenamingItem(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="file-name">{item.name}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <table className="file-explorer-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Typ</th>
                <th>Größe</th>
                <th>Geändert</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item) => (
                <tr
                  key={item.id}
                  className={`file-row ${selectedItem?.id === item.id ? 'selected' : ''}`}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, item.id);
                  }}
                >
                  <td>
                    <span className="file-icon-small">{getFileIcon(item)}</span>
                    {renamingItem === item.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        className="rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameSubmit()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit();
                          if (e.key === 'Escape') setRenamingItem(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      item.name
                    )}
                  </td>
                  <td>{item.type === 'folder' ? 'Ordner' : item.extension || 'Datei'}</td>
                  <td>{item.type === 'file' ? formatFileSize(item.size || 0) : '-'}</td>
                  <td>{formatDate(item.modifiedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {contextMenu &&
        ReactDOM.createPortal(
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.itemId ? (
              <>
                <div
                  className="context-menu-item"
                  onClick={() => {
                    const item = getItemById(contextMenu.itemId!);
                    if (item) handleItemDoubleClick(item);
                  }}
                >
                  <span className="context-menu-icon">📂</span>
                  <span>Öffnen</span>
                  <span className="context-menu-shortcut">Enter</span>
                </div>
                <div className="context-menu-separator"></div>
                <div className="context-menu-item" onClick={() => handleCopy(contextMenu.itemId!)}>
                  <span className="context-menu-icon">📋</span>
                  <span>Kopieren</span>
                  <span className="context-menu-shortcut">Strg+C</span>
                </div>
                <div className="context-menu-item" onClick={() => handleCut(contextMenu.itemId!)}>
                  <span className="context-menu-icon">✂️</span>
                  <span>Ausschneiden</span>
                  <span className="context-menu-shortcut">Strg+X</span>
                </div>
                <div
                  className={`context-menu-item ${!clipboard ? 'disabled' : ''}`}
                  onClick={() => handlePaste()}
                >
                  <span className="context-menu-icon">📄</span>
                  <span>Einfügen</span>
                  <span className="context-menu-shortcut">Strg+V</span>
                </div>
                <div className="context-menu-separator"></div>
                <div className="context-menu-item" onClick={() => handleRename(contextMenu.itemId!)}>
                  <span className="context-menu-icon">✏️</span>
                  <span>Umbenennen</span>
                  <span className="context-menu-shortcut">F2</span>
                </div>
                <div className="context-menu-separator"></div>
                <div className="context-menu-item context-menu-item-danger">
                  <div onClick={() => {
                    const item = getItemById(contextMenu.itemId!);
                    if (item) {
                      showInfo('Eigenschaften', `Name: ${item.name}\nTyp: ${item.type}\nGröße: ${item.type === 'file' ? formatFileSize(item.size || 0) : '-'}\nErstellt: ${formatDate(item.createdAt)}\nGeändert: ${formatDate(item.modifiedAt)}`);
                      setContextMenu(null);
                    }
                  }}>
                    <span className="context-menu-icon">ℹ️</span>
                    <span>Eigenschaften</span>
                  </div>
                </div>
                <div className="context-menu-separator"></div>
                <div
                  className="context-menu-item context-menu-item-danger"
                  onClick={() => handleDelete(contextMenu.itemId!)}
                >
                  <span className="context-menu-icon">🗑️</span>
                  <span>Löschen</span>
                  <span className="context-menu-shortcut">Entf</span>
                </div>
              </>
            ) : (
              <>
                <div className="context-menu-item" onClick={() => handleCreateFolder()}>
                  <span className="context-menu-icon">📁</span>
                  <span>Neuer Ordner</span>
                  <span className="context-menu-shortcut">Strg+Umschalt+N</span>
                </div>
                <div className="context-menu-item" onClick={() => handleCreateFile()}>
                  <span className="context-menu-icon">📄</span>
                  <span>Neue Datei</span>
                  <span className="context-menu-shortcut">Strg+N</span>
                </div>
                <div
                  className={`context-menu-item ${!clipboard ? 'disabled' : ''}`}
                  onClick={() => handlePaste()}
                >
                  <span className="context-menu-icon">📄</span>
                  <span>Einfügen</span>
                  <span className="context-menu-shortcut">Strg+V</span>
                  {clipboard && <span className="context-menu-hint">{clipboard.operation === 'copy' ? '(Kopie)' : '(Verschieben)'}</span>}
                </div>
                <div className="context-menu-separator"></div>
                <div className="context-menu-item" onClick={() => handleUploadClick()}>
                  <span className="context-menu-icon">📤</span>
                  <span>Dateien hochladen</span>
                  <span className="context-menu-shortcut">Strg+U</span>
                </div>
                <div className="context-menu-separator"></div>
                <div className="context-menu-item" onClick={() => setViewMode('icons')}>
                  <span className="context-menu-icon">🔲</span>
                  <span>Symbolansicht</span>
                  {viewMode === 'icons' && <span className="context-menu-check">✓</span>}
                </div>
                <div className="context-menu-item" onClick={() => setViewMode('list')}>
                  <span className="context-menu-icon">📋</span>
                  <span>Listenansicht</span>
                  {viewMode === 'list' && <span className="context-menu-check">✓</span>}
                </div>
                <div className="context-menu-separator"></div>
                <div className="context-menu-item" onClick={() => handleRefresh()}>
                  <span className="context-menu-icon">🔄</span>
                  <span>Aktualisieren</span>
                  <span className="context-menu-shortcut">F5</span>
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default FileExplorer;
