import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { FileSystemItem, FileSystemItemType, ClipboardItem } from '../types/filesystem';

// ─── IndexedDB-Helfer ───────────────────────────────────────────────────

const DB_NAME = 'fluxos-fs';
const DB_VERSION = 1;
const STORE_NAME = 'items';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadAllItems(): Promise<FileSystemItem[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = req.result as FileSystemItem[];
        if (rows.length === 0) { resolve(null); return; }
        resolve(rows.map(item => ({
          ...item,
          createdAt: new Date(item.createdAt),
          modifiedAt: new Date(item.modifiedAt),
        })));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function saveAllItems(items: FileSystemItem[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    items.forEach(item => store.put(item));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ignore */ }
}

interface FileSystemContextType {
  items: FileSystemItem[];
  currentPath: string;
  clipboard: ClipboardItem | null;
  
  // Navigation
  navigateTo: (path: string) => void;
  getCurrentItems: () => FileSystemItem[];
  getItemsByPath: (path: string) => FileSystemItem[];
  getItemById: (id: string) => FileSystemItem | undefined;
  getPathString: (itemId: string) => string;
  
  // CRUD-Operationen
  createItem: (name: string, type: FileSystemItemType, parentId: string | null) => FileSystemItem;
  deleteItem: (id: string) => void;
  renameItem: (id: string, newName: string) => void;
  moveItem: (itemId: string, newParentId: string | null) => void;
  updateFileContent: (id: string, content: string) => void;
  
  // Clipboard-Operationen
  copyItem: (itemId: string) => void;
  cutItem: (itemId: string) => void;
  paste: (targetParentId: string | null) => void;
  
  // Upload
  uploadFile: (file: File, parentId: string | null) => Promise<FileSystemItem>;
  
  // Suche
  searchItems: (query: string) => FileSystemItem[];
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export const useFileSystem = () => {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error('useFileSystem must be used within FileSystemProvider');
  }
  return context;
};

interface FileSystemProviderProps {
  children: ReactNode;
}

export const FileSystemProvider: React.FC<FileSystemProviderProps> = ({ children }) => {
  const defaultItems = (): FileSystemItem[] => {
    const now = new Date();
    return [
      {
        id: 'root',
        name: 'C:',
        type: 'folder',
        parentId: null,
        createdAt: now,
        modifiedAt: now,
        icon: '💾'
      },
      {
        id: 'documents',
        name: 'Dokumente',
        type: 'folder',
        parentId: 'root',
        createdAt: now,
        modifiedAt: now,
        icon: '📁'
      },
      {
        id: 'downloads',
        name: 'Downloads',
        type: 'folder',
        parentId: 'root',
        createdAt: now,
        modifiedAt: now,
        icon: '📥'
      },
      {
        id: 'pictures',
        name: 'Bilder',
        type: 'folder',
        parentId: 'root',
        createdAt: now,
        modifiedAt: now,
        icon: '🖼️'
      },
      {
        id: 'music',
        name: 'Musik',
        type: 'folder',
        parentId: 'root',
        createdAt: now,
        modifiedAt: now,
        icon: '🎵'
      },
      {
        id: 'sample-file-1',
        name: 'Willkommen.txt',
        type: 'file',
        parentId: 'documents',
        createdAt: now,
        modifiedAt: now,
        size: 250,
        content: 'Willkommen zu ReactOS!\n\nDies ist ein virtuelles Dateisystem.\nSie können Dateien und Ordner erstellen, bearbeiten und löschen.',
        extension: 'txt',
        icon: '📄'
      },
      {
        id: 'sample-file-2',
        name: 'README.md',
        type: 'file',
        parentId: 'root',
        createdAt: now,
        modifiedAt: now,
        size: 180,
        content: '# ReactOS\n\nEin virtuelles Desktop-Betriebssystem',
        extension: 'md',
        icon: '📝'
      }
    ];
  };

  const [items, setItems] = useState<FileSystemItem[]>(defaultItems);
  const initialLoadDone = useRef(false);

  // Beim Start: Daten aus IndexedDB laden
  useEffect(() => {
    loadAllItems().then(loaded => {
      if (loaded && loaded.length > 0) {
        setItems(loaded);
      }
      initialLoadDone.current = true;
    });
  }, []);

  const [currentPath, setCurrentPath] = useState<string>('root');
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);

  // Dateisystem in IndexedDB persistieren (nach initialem Laden)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    saveAllItems(items);
  }, [items]);

  // Navigation
  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  const getItemsByPath = useCallback((path: string): FileSystemItem[] => {
    return items.filter(item => item.parentId === path);
  }, [items]);

  const getCurrentItems = useCallback((): FileSystemItem[] => {
    return getItemsByPath(currentPath);
  }, [currentPath, getItemsByPath]);

  const getItemById = useCallback((id: string): FileSystemItem | undefined => {
    return items.find(item => item.id === id);
  }, [items]);

  const getPathString = useCallback((itemId: string): string => {
    const pathParts: string[] = [];
    let currentItem = getItemById(itemId);
    
    while (currentItem) {
      pathParts.unshift(currentItem.name);
      if (currentItem.parentId) {
        currentItem = getItemById(currentItem.parentId);
      } else {
        break;
      }
    }
    
    return pathParts.join(' > ');
  }, [getItemById]);

  // CRUD-Operationen
  const createItem = useCallback((name: string, type: FileSystemItemType, parentId: string | null): FileSystemItem => {
    const now = new Date();
    const newItem: FileSystemItem = {
      id: `${type}-${Date.now()}-${Math.random()}`,
      name,
      type,
      parentId,
      createdAt: now,
      modifiedAt: now,
      ...(type === 'file' && {
        size: 0,
        content: '',
        extension: name.split('.').pop() || 'txt'
      })
    };

    setItems(prev => [...prev, newItem]);
    return newItem;
  }, []);

  const deleteItem = useCallback((id: string) => {
    // Rekursiv alle Kinder löschen
    const deleteRecursive = (itemId: string, itemsList: FileSystemItem[]): FileSystemItem[] => {
      const children = itemsList.filter(item => item.parentId === itemId);
      let result = itemsList.filter(item => item.id !== itemId);
      
      children.forEach(child => {
        result = deleteRecursive(child.id, result);
      });
      
      return result;
    };

    setItems(prev => deleteRecursive(id, prev));
  }, []);

  const renameItem = useCallback((id: string, newName: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const modifiedItem = { ...item, name: newName, modifiedAt: new Date() };
          if (item.type === 'file') {
            modifiedItem.extension = newName.split('.').pop() || 'txt';
          }
          return modifiedItem;
        }
        return item;
      })
    );
  }, []);

  const moveItem = useCallback((itemId: string, newParentId: string | null) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, parentId: newParentId, modifiedAt: new Date() }
          : item
      )
    );
  }, []);

  const updateFileContent = useCallback((id: string, content: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id === id && item.type === 'file') {
          return {
            ...item,
            content,
            size: new Blob([content]).size,
            modifiedAt: new Date()
          };
        }
        return item;
      })
    );
  }, []);

  // Clipboard-Operationen
  const copyItem = useCallback((itemId: string) => {
    const item = getItemById(itemId);
    if (item) {
      setClipboard({ item, operation: 'copy' });
    }
  }, [getItemById]);

  const cutItem = useCallback((itemId: string) => {
    const item = getItemById(itemId);
    if (item) {
      setClipboard({ item, operation: 'cut' });
    }
  }, [getItemById]);

  const paste = useCallback((targetParentId: string | null) => {
    if (!clipboard) return;

    const { item, operation } = clipboard;

    if (operation === 'copy') {
      // Rekursiv kopieren
      const copyRecursive = (sourceItem: FileSystemItem, newParentId: string | null): FileSystemItem => {
        const now = new Date();
        const newItem: FileSystemItem = {
          ...sourceItem,
          id: `${sourceItem.type}-${Date.now()}-${Math.random()}`,
          parentId: newParentId,
          createdAt: now,
          modifiedAt: now,
        };

        setItems(prev => [...prev, newItem]);

        // Kopiere alle Kinder
        const children = items.filter(i => i.parentId === sourceItem.id);
        children.forEach(child => copyRecursive(child, newItem.id));

        return newItem;
      };

      copyRecursive(item, targetParentId);
    } else if (operation === 'cut') {
      moveItem(item.id, targetParentId);
      setClipboard(null);
    }
  }, [clipboard, items, moveItem]);

  // Upload
  const uploadFile = useCallback(async (file: File, parentId: string | null): Promise<FileSystemItem> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const now = new Date();
        const extension = file.name.split('.').pop() || 'txt';
        
        const newItem: FileSystemItem = {
          id: `file-${Date.now()}-${Math.random()}`,
          name: file.name,
          type: 'file',
          parentId,
          createdAt: now,
          modifiedAt: now,
          size: file.size,
          content: content,
          extension: extension
        };
        
        setItems(prev => [...prev, newItem]);
        resolve(newItem);
      };
      
      reader.onerror = () => {
        reject(new Error('Fehler beim Lesen der Datei'));
      };
      
      // Lese als Text für Textdateien, als DataURL für andere
      if (file.type.startsWith('text/') || 
          file.name.endsWith('.txt') || 
          file.name.endsWith('.md') || 
          file.name.endsWith('.json') ||
          file.name.endsWith('.xml') ||
          file.name.endsWith('.csv') ||
          file.name.endsWith('.js') ||
          file.name.endsWith('.ts') ||
          file.name.endsWith('.jsx') ||
          file.name.endsWith('.tsx') ||
          file.name.endsWith('.html') ||
          file.name.endsWith('.css')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  }, []);

  // Suche
  const searchItems = useCallback((query: string): FileSystemItem[] => {
    const lowerQuery = query.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      (item.type === 'file' && item.content?.toLowerCase().includes(lowerQuery))
    );
  }, [items]);

  return (
    <FileSystemContext.Provider
      value={{
        items,
        currentPath,
        clipboard,
        navigateTo,
        getCurrentItems,
        getItemsByPath,
        getItemById,
        getPathString,
        createItem,
        deleteItem,
        renameItem,
        moveItem,
        updateFileContent,
        copyItem,
        cutItem,
        paste,
        uploadFile,
        searchItems,
      }}
    >
      {children}
    </FileSystemContext.Provider>
  );
};
