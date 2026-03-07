export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface WindowState {
  id: string;
  title: string;
  icon?: string;
  position: Position;
  size: Size;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  zIndex: number;
  content?: React.ReactNode;
}

export interface DesktopIcon {
  id: string;
  name: string;
  icon: string;
  position: Position;
  isShortcut?: boolean;
  onDoubleClick: () => void;
}

export interface TaskbarApp {
  id: string;
  title: string;
  icon?: string;
  isActive: boolean;
  windowId: string;
}
