import React, { createContext, useContext, useState, ReactNode } from 'react';
import { WindowState } from '../types/desktop';

interface DesktopContextType {
  windows: WindowState[];
  wallpaper: string;
  addWindow: (window: Omit<WindowState, 'id' | 'zIndex' | 'isFocused'>) => void;
  removeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: { x: number; y: number }) => void;
  updateWindowSize: (id: string, size: { width: number; height: number }) => void;
  setWallpaper: (wallpaper: string) => void;
}

const DesktopContext = createContext<DesktopContextType | undefined>(undefined);

export const useDesktop = () => {
  const context = useContext(DesktopContext);
  if (!context) {
    throw new Error('useDesktop must be used within DesktopProvider');
  }
  return context;
};

interface DesktopProviderProps {
  children: ReactNode;
}

export const DesktopProvider: React.FC<DesktopProviderProps> = ({ children }) => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [nextZIndex, setNextZIndex] = useState(1);
  const [wallpaper, setWallpaperState] = useState<string>('linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)');

  const addWindow = (window: Omit<WindowState, 'id' | 'zIndex' | 'isFocused'>) => {
    const newWindow: WindowState = {
      ...window,
      id: `window-${Date.now()}-${Math.random()}`,
      zIndex: nextZIndex,
      isFocused: true,
    };

    setWindows(prev => [
      ...prev.map(w => ({ ...w, isFocused: false })),
      newWindow
    ]);
    setNextZIndex(prev => prev + 1);
  };

  const removeWindow = (id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  };

  const focusWindow = (id: string) => {
    setWindows(prev => {
      const window = prev.find(w => w.id === id);
      if (!window || window.isFocused) return prev;

      return [
        ...prev.filter(w => w.id !== id).map(w => ({ ...w, isFocused: false })),
        { ...window, isFocused: true, zIndex: nextZIndex }
      ];
    });
    setNextZIndex(prev => prev + 1);
  };

  const minimizeWindow = (id: string) => {
    setWindows(prev =>
      prev.map(w =>
        w.id === id ? { ...w, isMinimized: !w.isMinimized } : w
      )
    );
  };

  const maximizeWindow = (id: string) => {
    setWindows(prev =>
      prev.map(w =>
        w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
      )
    );
  };

  const updateWindowPosition = (id: string, position: { x: number; y: number }) => {
    setWindows(prev =>
      prev.map(w =>
        w.id === id ? { ...w, position } : w
      )
    );
  };

  const updateWindowSize = (id: string, size: { width: number; height: number }) => {
    setWindows(prev =>
      prev.map(w =>
        w.id === id ? { ...w, size } : w
      )
    );
  };

  const setWallpaper = (newWallpaper: string) => {
    setWallpaperState(newWallpaper);
  };

  return (
    <DesktopContext.Provider
      value={{
        windows,
        wallpaper,
        addWindow,
        removeWindow,
        focusWindow,
        minimizeWindow,
        maximizeWindow,
        updateWindowPosition,
        updateWindowSize,
        setWallpaper,
      }}
    >
      {children}
    </DesktopContext.Provider>
  );
};
