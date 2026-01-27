export type FileSystemItemType = 'file' | 'folder';

export interface FileSystemItem {
  id: string;
  name: string;
  type: FileSystemItemType;
  parentId: string | null;
  createdAt: Date;
  modifiedAt: Date;
  size?: number; // in bytes (nur für Dateien)
  content?: string; // Dateiinhalt (nur für Dateien)
  extension?: string; // Dateierweiterung (nur für Dateien)
  icon?: string; // Icon für spezielle Ordner oder Dateitypen
}

export interface FileSystemPath {
  items: FileSystemItem[];
  path: string;
}

export interface ClipboardItem {
  item: FileSystemItem;
  operation: 'copy' | 'cut';
}
