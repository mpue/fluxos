import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import './Spreadsheet.css';

// ─── Utils ───
const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const colLabel = (c: number): string => {
  if (c < 26) return COL_LETTERS[c];
  return COL_LETTERS[Math.floor(c / 26) - 1] + COL_LETTERS[c % 26];
};

const cellId = (r: number, c: number) => `${colLabel(c)}${r + 1}`;

const parseRef = (ref: string): [number, number] | null => {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (let i = 0; i < m[1].length; i++) {
    col = col * 26 + (m[1].charCodeAt(i) - 64);
  }
  return [parseInt(m[2]) - 1, col - 1];
};

interface CellData {
  raw: string;       // what the user typed
  value: string;     // computed display value
  format?: 'text' | 'number' | 'currency' | 'percent';
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  bg?: string;
  color?: string;
}

type Sheet = Record<string, CellData>;

const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26;
const DEFAULT_COL_WIDTH = 90;
const ROW_HEIGHT = 26;

const EMPTY_CELL: CellData = { raw: '', value: '' };

const getCell = (sheet: Sheet, key: string): CellData => sheet[key] || EMPTY_CELL;

// ─── Formula evaluation ───
const evaluateFormula = (formula: string, sheet: Sheet, visited: Set<string> = new Set()): string => {
  const expr = formula.slice(1).trim();

  // Function calls: SUM, AVG/AVERAGE, MIN, MAX, COUNT, IF
  const fnMatch = expr.match(/^(SUM|AVERAGE|AVG|MIN|MAX|COUNT|IF|ROUND|ABS|SQRT|POW)\((.+)\)$/i);
  if (fnMatch) {
    const fn = fnMatch[1].toUpperCase();
    const args = fnMatch[2];

    if (fn === 'IF') {
      // =IF(condition, trueVal, falseVal)
      const parts = splitArgs(args);
      if (parts.length < 3) return '#ARGS!';
      const cond = evalExpr(parts[0].trim(), sheet, visited);
      const condNum = parseFloat(cond);
      if (condNum && condNum !== 0) {
        return evalExpr(parts[1].trim(), sheet, visited);
      }
      return evalExpr(parts[2].trim(), sheet, visited);
    }

    if (fn === 'ROUND') {
      const parts = splitArgs(args);
      const val = parseFloat(evalExpr(parts[0].trim(), sheet, visited));
      const dec = parts.length > 1 ? parseInt(evalExpr(parts[1].trim(), sheet, visited)) : 0;
      if (isNaN(val)) return '#VALUE!';
      return val.toFixed(dec);
    }

    if (fn === 'ABS') {
      const val = parseFloat(evalExpr(args.trim(), sheet, visited));
      return isNaN(val) ? '#VALUE!' : Math.abs(val).toString();
    }

    if (fn === 'SQRT') {
      const val = parseFloat(evalExpr(args.trim(), sheet, visited));
      return isNaN(val) || val < 0 ? '#VALUE!' : Math.sqrt(val).toString();
    }

    if (fn === 'POW') {
      const parts = splitArgs(args);
      if (parts.length < 2) return '#ARGS!';
      const base = parseFloat(evalExpr(parts[0].trim(), sheet, visited));
      const exp = parseFloat(evalExpr(parts[1].trim(), sheet, visited));
      if (isNaN(base) || isNaN(exp)) return '#VALUE!';
      return Math.pow(base, exp).toString();
    }

    // Range functions
    const values = resolveRange(args, sheet, visited);
    const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));

    switch (fn) {
      case 'SUM': return nums.reduce((a, b) => a + b, 0).toString();
      case 'AVG':
      case 'AVERAGE': return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toString() : '0';
      case 'MIN': return nums.length ? Math.min(...nums).toString() : '0';
      case 'MAX': return nums.length ? Math.max(...nums).toString() : '0';
      case 'COUNT': return nums.length.toString();
      default: return '#FN!';
    }
  }

  // Simple expression (arithmetic with cell refs)
  return evalExpr(expr, sheet, visited);
};

const splitArgs = (s: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
};

const resolveRange = (arg: string, sheet: Sheet, visited: Set<string>): string[] => {
  // Handle comma-separated args and ranges like A1:B3
  const parts = splitArgs(arg);
  const values: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const rangeMatch = trimmed.match(/^([A-Z]+\d+):([A-Z]+\d+)$/i);
    if (rangeMatch) {
      const start = parseRef(rangeMatch[1].toUpperCase());
      const end = parseRef(rangeMatch[2].toUpperCase());
      if (start && end) {
        const r1 = Math.min(start[0], end[0]);
        const r2 = Math.max(start[0], end[0]);
        const c1 = Math.min(start[1], end[1]);
        const c2 = Math.max(start[1], end[1]);
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            const key = cellId(r, c);
            values.push(getCellValue(sheet, key, visited));
          }
        }
      }
    } else {
      values.push(evalExpr(trimmed, sheet, visited));
    }
  }
  return values;
};

const getCellValue = (sheet: Sheet, key: string, visited: Set<string>): string => {
  if (visited.has(key)) return '#CIRC!';
  const cell = getCell(sheet, key);
  if (cell.raw.startsWith('=')) {
    const newVisited = new Set(visited);
    newVisited.add(key);
    return evaluateFormula(cell.raw, sheet, newVisited);
  }
  return cell.raw;
};

const evalExpr = (expr: string, sheet: Sheet, visited: Set<string>): string => {
  // Replace cell references with their values
  let resolved = expr.replace(/\b([A-Z]+\d+)\b/gi, (match) => {
    const key = match.toUpperCase();
    const val = getCellValue(sheet, key, visited);
    const num = parseFloat(val);
    return isNaN(num) ? '0' : num.toString();
  });

  // Evaluate simple arithmetic
  try {
    // Only allow safe chars: digits, operators, parens, dots, spaces, minus
    if (/^[\d+\-*/().%\s]+$/.test(resolved)) {
      // Use Function constructor for safe math eval
      const fn = new Function(`"use strict"; return (${resolved});`);
      const result = fn();
      if (typeof result === 'number') {
        return isNaN(result) || !isFinite(result) ? '#ERR!' : result.toString();
      }
    }
    return resolved;
  } catch {
    return '#ERR!';
  }
};

const computeCell = (raw: string, sheet: Sheet): string => {
  if (!raw) return '';
  if (raw.startsWith('=')) {
    try {
      return evaluateFormula(raw, sheet, new Set());
    } catch {
      return '#ERR!';
    }
  }
  return raw;
};

// ─── Component ───
const Spreadsheet: React.FC = () => {
  const [sheet, setSheet] = useState<Sheet>({});
  const [selection, setSelection] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [rangeStart, setRangeStart] = useState<{ r: number; c: number } | null>(null);
  const [rangeEnd, setRangeEnd] = useState<{ r: number; c: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [colWidths, setColWidths] = useState<number[]>(Array(DEFAULT_COLS).fill(DEFAULT_COL_WIDTH));
  const [, setResizingCol] = useState<number | null>(null);
  const [formulaBarFocused, setFormulaBarFocused] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const formulaRef = useRef<HTMLInputElement>(null);

  const currentKey = cellId(selection.r, selection.c);
  const currentCell = getCell(sheet, currentKey);

  // Recompute all values when sheet changes
  const computed = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [key, cell] of Object.entries(sheet)) {
      result[key] = computeCell(cell.raw, sheet);
    }
    return result;
  }, [sheet]);

  const getDisplayValue = (key: string) => computed[key] || '';

  const updateCell = useCallback((key: string, raw: string, extraProps?: Partial<CellData>) => {
    setSheet(prev => {
      const existing = prev[key] || { ...EMPTY_CELL };
      const updated = { ...existing, raw, value: '', ...extraProps };
      if (!raw && !updated.bold && !updated.italic && !updated.bg && !updated.color && !updated.align) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: updated };
    });
  }, []);

  const commitEdit = useCallback(() => {
    if (editing) {
      updateCell(currentKey, editValue);
      setEditing(false);
    }
  }, [editing, editValue, currentKey, updateCell]);

  const startEdit = useCallback((value?: string) => {
    setEditing(true);
    setEditValue(value !== undefined ? value : currentCell.raw);
    setTimeout(() => editRef.current?.focus(), 0);
  }, [currentCell]);

  const moveTo = useCallback((r: number, c: number, keepRange = false) => {
    const nr = Math.max(0, Math.min(r, DEFAULT_ROWS - 1));
    const nc = Math.max(0, Math.min(c, DEFAULT_COLS - 1));
    setSelection({ r: nr, c: nc });
    if (!keepRange) {
      setRangeStart(null);
      setRangeEnd(null);
    }
  }, []);

  // Keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        moveTo(selection.r + 1, selection.c);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        moveTo(selection.r, selection.c + (e.shiftKey ? -1 : 1));
      } else if (e.key === 'Escape') {
        setEditing(false);
        setEditValue(currentCell.raw);
      }
      return;
    }

    const { r, c } = selection;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      // Delete selection range or current cell
      if (rangeStart && rangeEnd) {
        const r1 = Math.min(rangeStart.r, rangeEnd.r);
        const r2 = Math.max(rangeStart.r, rangeEnd.r);
        const c1 = Math.min(rangeStart.c, rangeEnd.c);
        const c2 = Math.max(rangeStart.c, rangeEnd.c);
        setSheet(prev => {
          const next = { ...prev };
          for (let ri = r1; ri <= r2; ri++) {
            for (let ci = c1; ci <= c2; ci++) {
              delete next[cellId(ri, ci)];
            }
          }
          return next;
        });
      } else {
        updateCell(currentKey, '');
      }
      return;
    }

    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); commitEdit(); moveTo(r - 1, c); break;
      case 'ArrowDown': e.preventDefault(); commitEdit(); moveTo(r + 1, c); break;
      case 'ArrowLeft': e.preventDefault(); commitEdit(); moveTo(r, c - 1); break;
      case 'ArrowRight': e.preventDefault(); commitEdit(); moveTo(r, c + 1); break;
      case 'Tab':
        e.preventDefault();
        commitEdit();
        moveTo(r, c + (e.shiftKey ? -1 : 1));
        break;
      case 'Enter':
        e.preventDefault();
        startEdit();
        break;
      case 'F2':
        e.preventDefault();
        startEdit();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          startEdit(e.key);
        }
        // Copy
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          copySelection();
        }
        // Paste
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          // handled by onPaste
        }
        // Bold
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
          e.preventDefault();
          toggleBold();
        }
        // Italic
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
          e.preventDefault();
          toggleItalic();
        }
        break;
    }
  }, [editing, selection, commitEdit, moveTo, startEdit, currentCell, currentKey, rangeStart, rangeEnd, updateCell]);

  const copySelection = useCallback(() => {
    const r1 = rangeStart ? Math.min(rangeStart.r, (rangeEnd || rangeStart).r) : selection.r;
    const r2 = rangeStart ? Math.max(rangeStart.r, (rangeEnd || rangeStart).r) : selection.r;
    const c1 = rangeStart ? Math.min(rangeStart.c, (rangeEnd || rangeStart).c) : selection.c;
    const c2 = rangeStart ? Math.max(rangeStart.c, (rangeEnd || rangeStart).c) : selection.c;

    const rows: string[] = [];
    for (let r = r1; r <= r2; r++) {
      const cells: string[] = [];
      for (let c = c1; c <= c2; c++) {
        cells.push(getDisplayValue(cellId(r, c)));
      }
      rows.push(cells.join('\t'));
    }
    navigator.clipboard.writeText(rows.join('\n'));
  }, [selection, rangeStart, rangeEnd, computed]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const rows = text.split('\n');
    setSheet(prev => {
      const next = { ...prev };
      rows.forEach((row, ri) => {
        const cells = row.split('\t');
        cells.forEach((val, ci) => {
          const key = cellId(selection.r + ri, selection.c + ci);
          if (selection.r + ri < DEFAULT_ROWS && selection.c + ci < DEFAULT_COLS) {
            next[key] = { raw: val.trim(), value: '' };
          }
        });
      });
      return next;
    });
  }, [selection]);

  const toggleBold = useCallback(() => {
    const cell = getCell(sheet, currentKey);
    updateCell(currentKey, cell.raw, { bold: !cell.bold });
  }, [sheet, currentKey, updateCell]);

  const toggleItalic = useCallback(() => {
    const cell = getCell(sheet, currentKey);
    updateCell(currentKey, cell.raw, { italic: !cell.italic });
  }, [sheet, currentKey, updateCell]);

  const setAlign = useCallback((align: 'left' | 'center' | 'right') => {
    const cell = getCell(sheet, currentKey);
    updateCell(currentKey, cell.raw, { align });
  }, [sheet, currentKey, updateCell]);

  const setCellBg = useCallback((bg: string) => {
    const cell = getCell(sheet, currentKey);
    updateCell(currentKey, cell.raw, { bg: bg || undefined });
  }, [sheet, currentKey, updateCell]);

  const setCellColor = useCallback((color: string) => {
    const cell = getCell(sheet, currentKey);
    updateCell(currentKey, cell.raw, { color: color || undefined });
  }, [sheet, currentKey, updateCell]);

  // Mouse cell click
  const handleCellMouseDown = useCallback((r: number, c: number, e: React.MouseEvent) => {
    if (editing) commitEdit();
    if (e.shiftKey) {
      setRangeEnd({ r, c });
      if (!rangeStart) setRangeStart({ ...selection });
    } else {
      moveTo(r, c);
      setRangeStart({ r, c });
      setRangeEnd(null);
    }
  }, [editing, commitEdit, moveTo, selection, rangeStart]);

  const handleCellMouseEnter = useCallback((r: number, c: number, e: React.MouseEvent) => {
    if (e.buttons === 1 && rangeStart) {
      setRangeEnd({ r, c });
    }
  }, [rangeStart]);

  const handleCellMouseUp = useCallback(() => {
    if (rangeStart && rangeEnd && rangeStart.r === rangeEnd.r && rangeStart.c === rangeEnd.c) {
      setRangeEnd(null);
      setRangeStart(null);
    }
  }, [rangeStart, rangeEnd]);

  const isInRange = useCallback((r: number, c: number) => {
    if (!rangeStart || !rangeEnd) return false;
    const r1 = Math.min(rangeStart.r, rangeEnd.r);
    const r2 = Math.max(rangeStart.r, rangeEnd.r);
    const c1 = Math.min(rangeStart.c, rangeEnd.c);
    const c2 = Math.max(rangeStart.c, rangeEnd.c);
    return r >= r1 && r <= r2 && c >= c1 && c <= c2;
  }, [rangeStart, rangeEnd]);

  // Column resize
  const handleColResizeStart = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colIdx);
    const startX = e.clientX;
    const startW = colWidths[colIdx];

    const onMove = (me: MouseEvent) => {
      const diff = me.clientX - startX;
      setColWidths(prev => {
        const next = [...prev];
        next[colIdx] = Math.max(40, startW + diff);
        return next;
      });
    };

    const onUp = () => {
      setResizingCol(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [colWidths]);

  // CSV Export
  const exportCSV = useCallback(() => {
    let maxR = 0, maxC = 0;
    for (const key of Object.keys(sheet)) {
      const parsed = parseRef(key);
      if (parsed) {
        maxR = Math.max(maxR, parsed[0]);
        maxC = Math.max(maxC, parsed[1]);
      }
    }
    const rows: string[] = [];
    for (let r = 0; r <= maxR; r++) {
      const cells: string[] = [];
      for (let c = 0; c <= maxC; c++) {
        const val = getDisplayValue(cellId(r, c));
        // Escape CSV
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          cells.push(`"${val.replace(/"/g, '""')}"`);
        } else {
          cells.push(val);
        }
      }
      rows.push(cells.join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tabelle.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [sheet, computed]);

  // CSV Import
  const importCSV = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;
        const newSheet: Sheet = {};
        const sep = text.includes('\t') ? '\t' : ',';
        const lines = text.split('\n');
        lines.forEach((line, r) => {
          if (!line.trim()) return;
          // Simple CSV parse (handles quoted fields)
          const cells: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
              if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
              } else if (ch === '"') {
                inQuotes = false;
              } else {
                current += ch;
              }
            } else {
              if (ch === '"') {
                inQuotes = true;
              } else if (ch === sep) {
                cells.push(current);
                current = '';
              } else {
                current += ch;
              }
            }
          }
          cells.push(current);
          cells.forEach((val, c) => {
            if (val.trim()) {
              newSheet[cellId(r, c)] = { raw: val.trim(), value: '' };
            }
          });
        });
        setSheet(newSheet);
        moveTo(0, 0);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [moveTo]);

  const clearAll = useCallback(() => {
    setSheet({});
    moveTo(0, 0);
  }, [moveTo]);

  // Scroll selected cell into view
  useEffect(() => {
    if (!gridRef.current) return;
    const cell = gridRef.current.querySelector('.ss-cell.selected');
    if (cell) {
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [selection]);

  // Focus grid
  useEffect(() => {
    gridRef.current?.focus();
  }, []);

  // Status bar info
  const statusInfo = useMemo(() => {
    if (rangeStart && rangeEnd) {
      const r1 = Math.min(rangeStart.r, rangeEnd.r);
      const r2 = Math.max(rangeStart.r, rangeEnd.r);
      const c1 = Math.min(rangeStart.c, rangeEnd.c);
      const c2 = Math.max(rangeStart.c, rangeEnd.c);
      const nums: number[] = [];
      let count = 0;
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          count++;
          const v = parseFloat(getDisplayValue(cellId(r, c)));
          if (!isNaN(v)) nums.push(v);
        }
      }
      const sum = nums.reduce((a, b) => a + b, 0);
      const avg = nums.length ? sum / nums.length : 0;
      return `Zellen: ${count}  |  Summe: ${sum}  |  Durchschnitt: ${avg.toFixed(2)}  |  Zahlen: ${nums.length}`;
    }
    const val = getDisplayValue(currentKey);
    return val ? `Wert: ${val}` : 'Bereit';
  }, [rangeStart, rangeEnd, currentKey, computed]);

  // Formula bar handler
  const handleFormulaBarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      updateCell(currentKey, editValue);
      setFormulaBarFocused(false);
      gridRef.current?.focus();
    } else if (e.key === 'Escape') {
      setEditValue(currentCell.raw);
      setFormulaBarFocused(false);
      gridRef.current?.focus();
    }
  };

  // Sync formula bar with selection
  useEffect(() => {
    if (!editing && !formulaBarFocused) {
      setEditValue(currentCell.raw);
    }
  }, [selection, currentCell, editing, formulaBarFocused]);

  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  return (
    <div className="spreadsheet" onKeyDown={handleKeyDown} onPaste={handlePaste} tabIndex={0}>
      {/* Toolbar */}
      <div className="ss-toolbar">
        <div className="ss-toolbar-group">
          <button className="ss-tb-btn" onClick={importCSV} title="CSV importieren">📂 Import</button>
          <button className="ss-tb-btn" onClick={exportCSV} title="CSV exportieren">💾 Export</button>
          <button className="ss-tb-btn" onClick={clearAll} title="Alles löschen">🗑️ Neu</button>
        </div>
        <div className="ss-toolbar-sep" />
        <div className="ss-toolbar-group">
          <button className={`ss-tb-btn${currentCell.bold ? ' active' : ''}`} onClick={toggleBold} title="Fett (Ctrl+B)"><b>F</b></button>
          <button className={`ss-tb-btn${currentCell.italic ? ' active' : ''}`} onClick={toggleItalic} title="Kursiv (Ctrl+I)"><i>K</i></button>
        </div>
        <div className="ss-toolbar-sep" />
        <div className="ss-toolbar-group">
          <button className={`ss-tb-btn${currentCell.align === 'left' || !currentCell.align ? ' active' : ''}`} onClick={() => setAlign('left')} title="Linksbündig">↤</button>
          <button className={`ss-tb-btn${currentCell.align === 'center' ? ' active' : ''}`} onClick={() => setAlign('center')} title="Zentriert">↔</button>
          <button className={`ss-tb-btn${currentCell.align === 'right' ? ' active' : ''}`} onClick={() => setAlign('right')} title="Rechtsbündig">↦</button>
        </div>
        <div className="ss-toolbar-sep" />
        <div className="ss-toolbar-group">
          <label className="ss-color-label" title="Hintergrundfarbe">
            🎨
            <input type="color" className="ss-color-input" value={currentCell.bg || '#1e1e1e'} onChange={e => setCellBg(e.target.value)} />
          </label>
          <label className="ss-color-label" title="Textfarbe">
            A
            <input type="color" className="ss-color-input" value={currentCell.color || '#d4d4d4'} onChange={e => setCellColor(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Formula bar */}
      <div className="ss-formula-bar">
        <span className="ss-cell-ref">{currentKey}</span>
        <span className="ss-fx">fx</span>
        <input
          ref={formulaRef}
          className="ss-formula-input"
          value={editing || formulaBarFocused ? editValue : currentCell.raw}
          onChange={e => setEditValue(e.target.value)}
          onFocus={() => {
            setFormulaBarFocused(true);
            setEditValue(currentCell.raw);
          }}
          onBlur={() => {
            if (formulaBarFocused) {
              updateCell(currentKey, editValue);
              setFormulaBarFocused(false);
            }
          }}
          onKeyDown={handleFormulaBarKeyDown}
        />
      </div>

      {/* Grid */}
      <div className="ss-grid-wrapper" ref={gridRef} tabIndex={-1}>
        <div className="ss-grid" style={{ width: totalWidth + 50 }}>
          {/* Header row */}
          <div className="ss-header-row" style={{ width: totalWidth + 50 }}>
            <div className="ss-corner" />
            {Array.from({ length: DEFAULT_COLS }, (_, c) => (
              <div
                key={c}
                className={`ss-col-header${selection.c === c ? ' active' : ''}`}
                style={{ width: colWidths[c] }}
              >
                {colLabel(c)}
                <div
                  className="ss-col-resize"
                  onMouseDown={e => handleColResizeStart(c, e)}
                />
              </div>
            ))}
          </div>

          {/* Data rows */}
          {Array.from({ length: DEFAULT_ROWS }, (_, r) => (
            <div key={r} className="ss-row" style={{ height: ROW_HEIGHT }}>
              <div className={`ss-row-header${selection.r === r ? ' active' : ''}`}>
                {r + 1}
              </div>
              {Array.from({ length: DEFAULT_COLS }, (_, c) => {
                const key = cellId(r, c);
                const cell = getCell(sheet, key);
                const isSelected = selection.r === r && selection.c === c;
                const inRange = isInRange(r, c);
                const displayVal = getDisplayValue(key);

                return (
                  <div
                    key={c}
                    className={`ss-cell${isSelected ? ' selected' : ''}${inRange ? ' in-range' : ''}`}
                    style={{
                      width: colWidths[c],
                      height: ROW_HEIGHT,
                      fontWeight: cell.bold ? 700 : undefined,
                      fontStyle: cell.italic ? 'italic' : undefined,
                      textAlign: cell.align || 'left',
                      backgroundColor: cell.bg || undefined,
                      color: cell.color || undefined,
                    }}
                    onMouseDown={e => handleCellMouseDown(r, c, e)}
                    onMouseEnter={e => handleCellMouseEnter(r, c, e)}
                    onMouseUp={handleCellMouseUp}
                    onDoubleClick={() => startEdit()}
                  >
                    {isSelected && editing ? (
                      <input
                        ref={editRef}
                        className="ss-cell-edit"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                      />
                    ) : (
                      <span className="ss-cell-text">{displayVal}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="ss-statusbar">
        <span>{statusInfo}</span>
      </div>
    </div>
  );
};

export default Spreadsheet;
