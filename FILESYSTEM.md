# Virtuelles Dateisystem - ReactOS

## Übersicht

Das virtuelle Dateisystem ermöglicht die vollständige Verwaltung von Dateien und Ordnern innerhalb der ReactOS-Anwendung. Es bietet eine Windows-ähnliche Benutzeroberfläche mit allen wichtigen Funktionen.

## Features

### ✨ Hauptfunktionen

- **Ordnernavigation**: Hierarchische Ordnerstruktur mit Pfadanzeige
- **Ansichtsmodi**: 
  - Symbolansicht (Icons Grid)
  - Listenansicht (Detaillierte Tabelle)
- **CRUD-Operationen**:
  - Erstellen von Dateien und Ordnern
  - Umbenennen
  - Löschen (mit Bestätigung)
  - Verschieben (Cut & Paste)
  - Kopieren (Copy & Paste)
- **Texteditor**: Integrierter Editor zum Bearbeiten von Textdateien
- **Kontextmenü**: Rechtsklick-Menü für schnellen Zugriff auf Aktionen
- **Tastaturkürzel**: Strg+S zum Speichern im Editor

### 📁 Dateistruktur

Das System startet mit folgender Ordnerstruktur:

```
C:
├── Dokumente/
│   └── Willkommen.txt
├── Downloads/
├── Bilder/
├── Musik/
└── README.md
```

## Verwendung

### Desktop-Integration

1. Doppelklick auf das **Datei-Explorer** Icon auf dem Desktop
2. Das Datei-Explorer-Fenster öffnet sich

### Navigation

- **Ordner öffnen**: Doppelklick auf einen Ordner
- **Zurück navigieren**: Klick auf den ⬆️ Button
- **Pfadanzeige**: Zeigt den aktuellen Pfad (z.B. "C: > Dokumente")

### Dateien und Ordner erstellen

**Methode 1 - Toolbar:**
- Klick auf 📁+ für neuen Ordner
- Klick auf 📄+ für neue Datei

**Methode 2 - Kontextmenü:**
- Rechtsklick in einen leeren Bereich
- "Neuer Ordner" oder "Neue Datei" wählen

### Dateien bearbeiten

1. Doppelklick auf eine Textdatei
2. Der Texteditor öffnet sich in einem neuen Fenster
3. Bearbeiten Sie den Inhalt
4. Speichern mit:
   - Klick auf "💾 Speichern"
   - **Strg+S** Tastaturkürzel
5. Änderungen verwerfen mit "↶ Rückgängig"

### Datei-Operationen

**Umbenennen:**
- Rechtsklick auf Datei/Ordner → "Umbenennen"
- Neuen Namen eingeben
- Enter drücken oder außerhalb klicken

**Kopieren/Ausschneiden/Einfügen:**
1. Rechtsklick auf Datei/Ordner
2. "Kopieren" oder "Ausschneiden" wählen
3. Zum Zielordner navigieren
4. Rechtsklick → "Einfügen"

**Löschen:**
- Rechtsklick auf Datei/Ordner → "Löschen"
- Bestätigung im Dialog

### Ansichten wechseln

- **Symbolansicht** ⊞: Grid-Layout mit großen Icons
- **Listenansicht** ☰: Tabelle mit Details (Name, Typ, Größe, Änderungsdatum)

## Technische Details

### Architektur

```
client/src/
├── types/
│   └── filesystem.ts          # TypeScript-Definitionen
├── contexts/
│   └── FileSystemContext.tsx  # State Management & Business Logic
└── components/
    ├── FileExplorer.tsx       # Hauptkomponente für Datei-Navigation
    ├── FileExplorer.css
    ├── TextEditor.tsx         # Texteditor für Dateien
    └── TextEditor.css
```

### Datenmodell

**FileSystemItem:**
```typescript
{
  id: string;               // Eindeutige ID
  name: string;             // Datei-/Ordnername
  type: 'file' | 'folder';  // Typ
  parentId: string | null;  // Parent-Ordner ID
  createdAt: Date;          // Erstellungsdatum
  modifiedAt: Date;         // Änderungsdatum
  size?: number;            // Größe in Bytes (nur Dateien)
  content?: string;         // Inhalt (nur Dateien)
  extension?: string;       // Dateierweiterung (nur Dateien)
  icon?: string;            // Custom Icon
}
```

### Context API

**FileSystemContext** bietet:

- `items: FileSystemItem[]` - Alle Dateisystem-Elemente
- `currentPath: string` - Aktueller Pfad
- `clipboard: ClipboardItem | null` - Zwischenablage

**Methoden:**
- Navigation: `navigateTo()`, `getCurrentItems()`, `getItemById()`, `getPathString()`
- CRUD: `createItem()`, `deleteItem()`, `renameItem()`, `moveItem()`, `updateFileContent()`
- Clipboard: `copyItem()`, `cutItem()`, `paste()`
- Suche: `searchItems()`

## Erweiterungsmöglichkeiten

### Geplante Features

- [ ] Drag & Drop für Dateien
- [ ] Mehrfachauswahl (Strg+Klick, Shift+Klick)
- [ ] Suchfunktion
- [ ] Sortierung (nach Name, Datum, Größe, Typ)
- [ ] Vorschau für Bilder und PDFs
- [ ] Dateityp-spezifische Editoren
- [ ] Dateiversionen/History
- [ ] Papierkorb-Funktion
- [ ] Cloud-Synchronisation
- [ ] ZIP-Komprimierung/-Entpackung

### Beispiel: Neue Dateitypen hinzufügen

```typescript
// In FileExplorer.tsx
const getFileIcon = (item: FileSystemItem): string => {
  const ext = item.extension?.toLowerCase();
  switch (ext) {
    case 'json': return '📋';
    case 'xml': return '📰';
    // Weitere Typen...
    default: return '📄';
  }
};
```

### Beispiel: Eigenen Editor registrieren

```typescript
// In FileExplorer.tsx
const handleItemDoubleClick = (item: FileSystemItem) => {
  if (item.type === 'file') {
    if (item.extension === 'md') {
      // Markdown-Editor öffnen
      addWindow({
        title: item.name,
        content: <MarkdownEditor fileId={item.id} />
      });
    } else {
      // Standard-Texteditor
      addWindow({
        title: item.name,
        content: <TextEditor fileId={item.id} />
      });
    }
  }
};
```

## Verwendete Technologien

- **React 18** mit TypeScript
- **Context API** für State Management
- **CSS Grid & Flexbox** für Layout
- Keine externen Bibliotheken (Pure React)

## Performance

- Effiziente Updates durch React.memo und useCallback
- Lazy Loading könnte für große Dateisysteme implementiert werden
- Virtualisierung für Listen bei >1000 Einträgen empfohlen

## Browser-Kompatibilität

- Chrome/Edge: ✅ Vollständig unterstützt
- Firefox: ✅ Vollständig unterstützt
- Safari: ✅ Vollständig unterstützt

---

**Viel Spaß mit dem virtuellen Dateisystem! 🚀**
