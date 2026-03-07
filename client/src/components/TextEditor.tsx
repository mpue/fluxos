import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFileSystem } from '../contexts/FileSystemContext';
import './TextEditor.css';

interface TextEditorProps {
  fileId: string;
}

const TextEditor: React.FC<TextEditorProps> = ({ fileId }) => {
  const { getItemById, updateFileContent } = useFileSystem();
  const file = getItemById(fileId);

  const [content, setContent] = useState(file?.content || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily] = useState("'Consolas', 'Courier New', monospace");
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [selectionLength, setSelectionLength] = useState(0);

  // Find & Replace
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);

  // Go to line
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [goToLineValue, setGoToLineValue] = useState('');

  // Menu
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const goToLineInputRef = useRef<HTMLInputElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (file?.content !== undefined) {
      setContent(file.content);
      setHasChanges(false);
    }
  }, [file?.content]);

  const lineCount = content.split('\n').length;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  const updateCursorPosition = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const textBefore = content.substring(0, pos);
    const line = textBefore.split('\n').length;
    const lastNewline = textBefore.lastIndexOf('\n');
    const col = pos - lastNewline;
    setCursorLine(line);
    setCursorCol(col);
    setSelectionLength(Math.abs(ta.selectionEnd - ta.selectionStart));
  }, [content]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setHasChanges(true);
  };

  const handleSave = useCallback(() => {
    if (file && hasChanges) {
      updateFileContent(fileId, content);
      setHasChanges(false);
    }
  }, [file, fileId, hasChanges, content, updateFileContent]);

  const handleRevert = () => {
    if (file?.content !== undefined) {
      setContent(file.content);
      setHasChanges(false);
    }
  };

  // Find logic
  useEffect(() => {
    if (!findText) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    const matches = content.match(regex);
    setMatchCount(matches ? matches.length : 0);
    if (!matches || matches.length === 0) setCurrentMatch(0);
    else if (currentMatch === 0 || currentMatch > matches.length) setCurrentMatch(1);
  }, [findText, content, caseSensitive]);

  const findNext = useCallback(() => {
    if (!findText || matchCount === 0) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    let match;
    const startPos = ta.selectionEnd;
    regex.lastIndex = startPos;
    match = regex.exec(content);
    if (!match) {
      regex.lastIndex = 0;
      match = regex.exec(content);
    }
    if (match) {
      ta.focus();
      ta.setSelectionRange(match.index, match.index + match[0].length);
      // Count which match this is
      const beforeRegex = new RegExp(escaped, flags);
      let count = 0;
      let m;
      while ((m = beforeRegex.exec(content)) !== null) {
        count++;
        if (m.index === match.index) { setCurrentMatch(count); break; }
      }
    }
  }, [findText, matchCount, caseSensitive, content]);

  const findPrev = useCallback(() => {
    if (!findText || matchCount === 0) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    const matches: { index: number; length: number }[] = [];
    let m;
    while ((m = regex.exec(content)) !== null) {
      matches.push({ index: m.index, length: m[0].length });
    }
    if (matches.length === 0) return;
    const curStart = ta.selectionStart;
    let target = matches[matches.length - 1];
    let targetIdx = matches.length;
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i].index < curStart) { target = matches[i]; targetIdx = i + 1; break; }
    }
    ta.focus();
    ta.setSelectionRange(target.index, target.index + target.length);
    setCurrentMatch(targetIdx);
  }, [findText, matchCount, caseSensitive, content]);

  const handleReplace = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || !findText) return;
    const selected = content.substring(ta.selectionStart, ta.selectionEnd);
    const isMatch = caseSensitive
      ? selected === findText
      : selected.toLowerCase() === findText.toLowerCase();
    if (isMatch) {
      const before = content.substring(0, ta.selectionStart);
      const after = content.substring(ta.selectionEnd);
      const newContent = before + replaceText + after;
      setContent(newContent);
      setHasChanges(true);
      ta.setSelectionRange(ta.selectionStart, ta.selectionStart + replaceText.length);
    }
    findNext();
  }, [findText, replaceText, caseSensitive, content, findNext]);

  const handleReplaceAll = useCallback(() => {
    if (!findText) return;
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    const newContent = content.replace(regex, replaceText);
    setContent(newContent);
    setHasChanges(true);
  }, [findText, replaceText, caseSensitive, content]);

  // Go to line
  const handleGoToLine = useCallback(() => {
    const lineNum = parseInt(goToLineValue);
    if (isNaN(lineNum) || lineNum < 1) return;
    const lines = content.split('\n');
    const targetLine = Math.min(lineNum, lines.length);
    let pos = 0;
    for (let i = 0; i < targetLine - 1; i++) {
      pos += lines[i].length + 1;
    }
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(pos, pos);
      setCursorLine(targetLine);
      setCursorCol(1);
    }
    setShowGoToLine(false);
    setGoToLineValue('');
  }, [goToLineValue, content]);

  // Select all
  const handleSelectAll = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(0, content.length);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (mod && e.key === 'f') {
        e.preventDefault();
        setShowFind(true);
        setShowGoToLine(false);
        setTimeout(() => findInputRef.current?.focus(), 50);
      } else if (mod && e.key === 'h') {
        e.preventDefault();
        setShowFind(true);
        setShowGoToLine(false);
        setTimeout(() => findInputRef.current?.focus(), 50);
      } else if (mod && e.key === 'g') {
        e.preventDefault();
        setShowGoToLine(true);
        setShowFind(false);
        setTimeout(() => goToLineInputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        setShowFind(false);
        setShowGoToLine(false);
        setOpenMenu(null);
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) findPrev();
        else findNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, findNext, findPrev]);

  // Sync line numbers scroll
  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const closeMenus = () => setOpenMenu(null);

  useEffect(() => {
    if (openMenu) {
      const handler = () => setTimeout(closeMenus, 0);
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [openMenu]);

  if (!file || file.type !== 'file') {
    return <div className="text-editor-error">Datei nicht gefunden</div>;
  }

  const menuItems: Record<string, { label: string; action: () => void; shortcut?: string; disabled?: boolean; checked?: boolean; divider?: boolean }[]> = {
    datei: [
      { label: 'Speichern', action: handleSave, shortcut: 'Strg+S', disabled: !hasChanges },
      { label: 'Änderungen verwerfen', action: handleRevert, disabled: !hasChanges },
    ],
    bearbeiten: [
      { label: 'Rückgängig', action: () => document.execCommand('undo'), shortcut: 'Strg+Z' },
      { label: 'Wiederholen', action: () => document.execCommand('redo'), shortcut: 'Strg+Y' },
      { label: '', action: () => {}, divider: true },
      { label: 'Ausschneiden', action: () => document.execCommand('cut'), shortcut: 'Strg+X' },
      { label: 'Kopieren', action: () => document.execCommand('copy'), shortcut: 'Strg+C' },
      { label: 'Einfügen', action: () => navigator.clipboard.readText().then(t => { const ta = textareaRef.current; if (ta) { const s = ta.selectionStart; const e = ta.selectionEnd; setContent(content.substring(0, s) + t + content.substring(e)); setHasChanges(true); } }), shortcut: 'Strg+V' },
      { label: '', action: () => {}, divider: true },
      { label: 'Alles auswählen', action: handleSelectAll, shortcut: 'Strg+A' },
      { label: '', action: () => {}, divider: true },
      { label: 'Suchen & Ersetzen', action: () => { setShowFind(true); setTimeout(() => findInputRef.current?.focus(), 50); }, shortcut: 'Strg+F' },
      { label: 'Gehe zu Zeile...', action: () => { setShowGoToLine(true); setTimeout(() => goToLineInputRef.current?.focus(), 50); }, shortcut: 'Strg+G' },
    ],
    format: [
      { label: 'Zeilenumbruch', action: () => setWordWrap(!wordWrap), checked: wordWrap },
      { label: 'Zeilennummern', action: () => setShowLineNumbers(!showLineNumbers), checked: showLineNumbers },
      { label: '', action: () => {}, divider: true },
      { label: 'Schrift vergrößern', action: () => setFontSize(Math.min(32, fontSize + 2)), shortcut: 'Strg+Plus' },
      { label: 'Schrift verkleinern', action: () => setFontSize(Math.max(8, fontSize - 2)), shortcut: 'Strg+Minus' },
      { label: 'Schriftgröße zurücksetzen', action: () => setFontSize(14) },
    ],
  };

  return (
    <div className="text-editor" onClick={() => setOpenMenu(null)}>
      {/* Menu Bar */}
      <div className="text-editor-menubar">
        {Object.entries(menuItems).map(([key, items]) => (
          <div key={key} className="menu-container" onClick={(e) => e.stopPropagation()}>
            <button
              className={`menu-title ${openMenu === key ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === key ? null : key)}
              onMouseEnter={() => openMenu && setOpenMenu(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
            {openMenu === key && (
              <div className="menu-dropdown">
                {items.map((item, i) =>
                  item.divider ? (
                    <div key={i} className="menu-divider" />
                  ) : (
                    <div
                      key={i}
                      className={`menu-item ${item.disabled ? 'disabled' : ''}`}
                      onClick={() => {
                        if (!item.disabled) {
                          item.action();
                          setOpenMenu(null);
                        }
                      }}
                    >
                      <span className="menu-item-check">{item.checked ? '✓' : ''}</span>
                      <span className="menu-item-label">{item.label}</span>
                      {item.shortcut && <span className="menu-item-shortcut">{item.shortcut}</span>}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
        <div className="text-editor-filename">
          {file.name}{hasChanges ? ' ●' : ''}
        </div>
      </div>

      {/* Find & Replace Bar */}
      {showFind && (
        <div className="find-bar">
          <div className="find-row">
            <input
              ref={findInputRef}
              type="text"
              className="find-input"
              placeholder="Suchen..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.shiftKey ? findPrev() : findNext();
                }
                if (e.key === 'Escape') setShowFind(false);
              }}
            />
            <span className="find-count">
              {findText ? `${currentMatch}/${matchCount}` : ''}
            </span>
            <button className="find-btn" onClick={findPrev} title="Vorheriger (Umschalt+F3)">▲</button>
            <button className="find-btn" onClick={findNext} title="Nächster (F3)">▼</button>
            <button
              className={`find-btn find-toggle ${caseSensitive ? 'active' : ''}`}
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="Groß-/Kleinschreibung"
            >
              Aa
            </button>
            <button className="find-btn find-close" onClick={() => setShowFind(false)}>✕</button>
          </div>
          <div className="find-row">
            <input
              type="text"
              className="find-input"
              placeholder="Ersetzen..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReplace();
                if (e.key === 'Escape') setShowFind(false);
              }}
            />
            <button className="find-btn" onClick={handleReplace} title="Ersetzen">⇄</button>
            <button className="find-btn" onClick={handleReplaceAll} title="Alle ersetzen">⇄*</button>
          </div>
        </div>
      )}

      {/* Go to Line */}
      {showGoToLine && (
        <div className="find-bar">
          <div className="find-row">
            <input
              ref={goToLineInputRef}
              type="number"
              className="find-input"
              placeholder={`Zeile (1-${lineCount})...`}
              value={goToLineValue}
              onChange={(e) => setGoToLineValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGoToLine();
                if (e.key === 'Escape') setShowGoToLine(false);
              }}
              min={1}
              max={lineCount}
            />
            <button className="find-btn" onClick={handleGoToLine}>↵ Gehe zu</button>
            <button className="find-btn find-close" onClick={() => setShowGoToLine(false)}>✕</button>
          </div>
        </div>
      )}

      {/* Editor Area */}
      <div className="text-editor-body">
        {showLineNumbers && (
          <div className="line-numbers" ref={lineNumbersRef} style={{ fontSize }}>
            {Array.from({ length: lineCount }, (_, i) => (
              <div
                key={i + 1}
                className={`line-number ${cursorLine === i + 1 ? 'active' : ''}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="text-editor-content"
          value={content}
          onChange={handleContentChange}
          onSelect={updateCursorPosition}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          onScroll={handleScroll}
          placeholder="Dateiinhalt hier eingeben..."
          spellCheck={false}
          style={{
            fontSize,
            fontFamily,
            whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
            overflowWrap: wordWrap ? 'break-word' : 'normal',
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="text-editor-statusbar">
        <span>Zeile {cursorLine}, Spalte {cursorCol}</span>
        {selectionLength > 0 && <span>({selectionLength} ausgewählt)</span>}
        <span>{lineCount} Zeilen</span>
        <span>{wordCount} Wörter</span>
        <span>{charCount} Zeichen</span>
        <span className="statusbar-right">
          {wordWrap ? 'Umbruch: An' : 'Umbruch: Aus'}
        </span>
        <span className="statusbar-right">
          {fontSize}px
        </span>
        {hasChanges && <span className="unsaved-indicator">● Nicht gespeichert</span>}
      </div>
    </div>
  );
};

export default TextEditor;
