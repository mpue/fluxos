import React, { useState, useRef, useCallback, useEffect } from 'react';
import './VectorEditor.css';

// ─── Types ───
type Tool = 'select' | 'rect' | 'ellipse' | 'line' | 'polygon' | 'path' | 'text';

interface VShape {
  id: string;
  type: 'rect' | 'ellipse' | 'line' | 'polygon' | 'path' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  points?: { x: number; y: number }[];
  d?: string;
  text?: string;
  fontSize?: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
}

interface HistoryState {
  shapes: VShape[];
}

const uid = () => `s${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_FILL = '#4a9eff';
const DEFAULT_STROKE = '#1a1a2e';
const DEFAULT_STROKE_WIDTH = 2;

// ─── Component ───
const VectorEditor: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shapes, setShapes] = useState<VShape[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [fill, setFill] = useState(DEFAULT_FILL);
  const [stroke, setStroke] = useState(DEFAULT_STROKE);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const [opacity, setOpacity] = useState(1);
  const [fontSize] = useState(24);
  const [gridOn, setGridOn] = useState(true);
  const [snapOn, setSnapOn] = useState(false);

  // Drawing state
  const drawRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    shape: VShape | null;
    pathPoints: { x: number; y: number }[];
    polyPoints: { x: number; y: number }[];
    dragOffset: { x: number; y: number } | null;
    resizeHandle: string | null;
    origShape: VShape | null;
  }>({
    active: false, startX: 0, startY: 0, shape: null,
    pathPoints: [], polyPoints: [],
    dragOffset: null, resizeHandle: null, origShape: null,
  });

  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([{ shapes: [] }]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const pushHistory = useCallback((newShapes: VShape[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIdx + 1);
      return [...trimmed, { shapes: newShapes }];
    });
    setHistoryIdx(prev => prev + 1);
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx > 0) {
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      setShapes(history[newIdx].shapes);
      setSelected(null);
    }
  }, [historyIdx, history]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const newIdx = historyIdx + 1;
      setHistoryIdx(newIdx);
      setShapes(history[newIdx].shapes);
      setSelected(null);
    }
  }, [historyIdx, history]);

  const updateShapes = useCallback((newShapes: VShape[]) => {
    setShapes(newShapes);
    pushHistory(newShapes);
  }, [pushHistory]);

  const snap = (v: number) => snapOn ? Math.round(v / 10) * 10 : v;

  const getSvgPoint = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: snap(e.clientX - rect.left),
      y: snap(e.clientY - rect.top),
    };
  }, [snapOn]);

  const selectedShape = shapes.find(s => s.id === selected) || null;

  // ─── Mouse Handlers ───
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pt = getSvgPoint(e);
    const d = drawRef.current;

    if (tool === 'select') {
      // Check if clicking a resize handle
      // (handled by handle mousedown, not here)
      return;
    }

    if (tool === 'polygon') {
      // Polygon: click to add points, double-click to finish
      if (!d.active) {
        d.active = true;
        d.polyPoints = [pt];
        d.shape = {
          id: uid(), type: 'polygon',
          x: 0, y: 0,
          points: [pt],
          fill, stroke, strokeWidth, opacity, rotation: 0,
        };
        setShapes(prev => [...prev, d.shape!]);
      } else {
        d.polyPoints.push(pt);
        d.shape!.points = [...d.polyPoints];
        setShapes(prev => prev.map(s => s.id === d.shape!.id ? { ...d.shape! } : s));
      }
      return;
    }

    if (tool === 'text') {
      const textVal = prompt('Text eingeben:');
      if (textVal) {
        const shape: VShape = {
          id: uid(), type: 'text',
          x: pt.x, y: pt.y,
          text: textVal, fontSize,
          fill, stroke: 'none', strokeWidth: 0, opacity, rotation: 0,
        };
        const newShapes = [...shapes, shape];
        updateShapes(newShapes);
        setSelected(shape.id);
      }
      return;
    }

    d.active = true;
    d.startX = pt.x;
    d.startY = pt.y;

    let shape: VShape;
    switch (tool) {
      case 'rect':
        shape = { id: uid(), type: 'rect', x: pt.x, y: pt.y, width: 0, height: 0, fill, stroke, strokeWidth, opacity, rotation: 0 };
        break;
      case 'ellipse':
        shape = { id: uid(), type: 'ellipse', x: pt.x, y: pt.y, width: 0, height: 0, fill, stroke, strokeWidth, opacity, rotation: 0 };
        break;
      case 'line':
        shape = { id: uid(), type: 'line', x: pt.x, y: pt.y, x2: pt.x, y2: pt.y, fill: 'none', stroke, strokeWidth, opacity, rotation: 0 };
        break;
      case 'path':
        d.pathPoints = [pt];
        shape = { id: uid(), type: 'path', x: 0, y: 0, d: `M${pt.x},${pt.y}`, fill: 'none', stroke, strokeWidth, opacity, rotation: 0 };
        break;
      default:
        return;
    }
    d.shape = shape;
    setShapes(prev => [...prev, shape]);
    setSelected(null);
  }, [tool, fill, stroke, strokeWidth, opacity, fontSize, shapes, getSvgPoint, updateShapes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const d = drawRef.current;

    // Dragging selected shape
    if (d.dragOffset && selected) {
      const pt = getSvgPoint(e);
      setShapes(prev => prev.map(s => {
        if (s.id !== selected) return s;
        const dx = pt.x - d.dragOffset!.x;
        const dy = pt.y - d.dragOffset!.y;
        d.dragOffset = { x: pt.x, y: pt.y };
        if (s.type === 'line') {
          return { ...s, x: s.x + dx, y: s.y + dy, x2: (s.x2 || 0) + dx, y2: (s.y2 || 0) + dy };
        }
        if (s.type === 'polygon' && s.points) {
          return { ...s, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        }
        return { ...s, x: s.x + dx, y: s.y + dy };
      }));
      return;
    }

    // Resizing
    if (d.resizeHandle && d.origShape && selected) {
      const pt = getSvgPoint(e);
      const os = d.origShape;
      setShapes(prev => prev.map(s => {
        if (s.id !== selected) return s;
        const handle = d.resizeHandle!;
        let nx = os.x, ny = os.y, nw = os.width || 0, nh = os.height || 0;
        if (handle.includes('e')) { nw = Math.max(5, pt.x - os.x); }
        if (handle.includes('w')) { nx = Math.min(pt.x, os.x + nw - 5); nw = os.x + (os.width || 0) - nx; }
        if (handle.includes('s')) { nh = Math.max(5, pt.y - os.y); }
        if (handle.includes('n')) { ny = Math.min(pt.y, os.y + nh - 5); nh = os.y + (os.height || 0) - ny; }
        return { ...s, x: nx, y: ny, width: nw, height: nh };
      }));
      return;
    }

    if (!d.active || !d.shape) return;
    const pt = getSvgPoint(e);

    if (tool === 'rect' || tool === 'ellipse') {
      const x = Math.min(d.startX, pt.x);
      const y = Math.min(d.startY, pt.y);
      const w = Math.abs(pt.x - d.startX);
      const h = Math.abs(pt.y - d.startY);
      d.shape = { ...d.shape, x, y, width: w, height: h };
    } else if (tool === 'line') {
      d.shape = { ...d.shape, x2: pt.x, y2: pt.y };
    } else if (tool === 'path') {
      d.pathPoints.push(pt);
      d.shape = { ...d.shape, d: d.pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') };
    }

    setShapes(prev => prev.map(s => s.id === d.shape!.id ? { ...d.shape! } : s));
  }, [tool, selected, getSvgPoint]);

  const handleMouseUp = useCallback(() => {
    const d = drawRef.current;

    if (d.dragOffset) {
      d.dragOffset = null;
      pushHistory(shapes);
      return;
    }

    if (d.resizeHandle) {
      d.resizeHandle = null;
      d.origShape = null;
      pushHistory(shapes);
      return;
    }

    if (!d.active || !d.shape) return;

    if (tool === 'polygon') return; // polygon finishes on double-click

    d.active = false;
    const finalShape = { ...d.shape };
    d.shape = null;

    // Discard tiny shapes
    if ((tool === 'rect' || tool === 'ellipse') && (finalShape.width || 0) < 3 && (finalShape.height || 0) < 3) {
      setShapes(prev => prev.filter(s => s.id !== finalShape.id));
      return;
    }

    pushHistory(shapes);
    setSelected(finalShape.id);
  }, [tool, shapes, pushHistory]);

  const handleDoubleClick = useCallback((_e: React.MouseEvent) => {
    const d = drawRef.current;
    if (tool === 'polygon' && d.active && d.shape) {
      d.active = false;
      d.shape = { ...d.shape, points: [...d.polyPoints] };
      setShapes(prev => prev.map(s => s.id === d.shape!.id ? { ...d.shape! } : s));
      pushHistory(shapes.map(s => s.id === d.shape!.id ? { ...d.shape! } : s));
      setSelected(d.shape.id);
      d.shape = null;
      d.polyPoints = [];
    }
  }, [tool, shapes, pushHistory]);

  // ─── Shape selection (click on shape) ───
  const handleShapeClick = useCallback((e: React.MouseEvent, id: string) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    setSelected(id);
    const d = drawRef.current;
    const pt = getSvgPoint(e);
    d.dragOffset = { x: pt.x, y: pt.y };
  }, [tool, getSvgPoint]);

  const handleBgClick = useCallback((e: React.MouseEvent) => {
    if (tool === 'select' && e.target === svgRef.current) {
      setSelected(null);
    }
  }, [tool]);

  // Resize handles
  const handleResizeStart = useCallback((handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedShape) return;
    const d = drawRef.current;
    d.resizeHandle = handle;
    d.origShape = { ...selectedShape };
  }, [selectedShape]);

  // ─── Key handler ───
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected) {
          const newShapes = shapes.filter(s => s.id !== selected);
          updateShapes(newShapes);
          setSelected(null);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedShape) {
          const clone = { ...selectedShape, id: uid(), x: selectedShape.x + 15, y: selectedShape.y + 15 };
          if (clone.points) clone.points = clone.points.map(p => ({ x: p.x + 15, y: p.y + 15 }));
          if (clone.type === 'line') { clone.x2 = (clone.x2 || 0) + 15; clone.y2 = (clone.y2 || 0) + 15; }
          const newShapes = [...shapes, clone];
          updateShapes(newShapes);
          setSelected(clone.id);
        }
      }
      // Arrow keys to nudge
      if (selected && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        setShapes(prev => prev.map(s => {
          if (s.id !== selected) return s;
          if (s.type === 'line') return { ...s, x: s.x + dx, y: s.y + dy, x2: (s.x2 || 0) + dx, y2: (s.y2 || 0) + dy };
          if (s.type === 'polygon' && s.points) return { ...s, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
          return { ...s, x: s.x + dx, y: s.y + dy };
        }));
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [selected, shapes, selectedShape, undo, redo, updateShapes]);

  // ─── Z-order ───
  const bringForward = () => {
    if (!selected) return;
    const idx = shapes.findIndex(s => s.id === selected);
    if (idx < shapes.length - 1) {
      const ns = [...shapes];
      [ns[idx], ns[idx + 1]] = [ns[idx + 1], ns[idx]];
      updateShapes(ns);
    }
  };
  const sendBackward = () => {
    if (!selected) return;
    const idx = shapes.findIndex(s => s.id === selected);
    if (idx > 0) {
      const ns = [...shapes];
      [ns[idx], ns[idx - 1]] = [ns[idx - 1], ns[idx]];
      updateShapes(ns);
    }
  };

  // ─── SVG Export ───
  const exportSVG = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // Clone and clean up
    const clone = svg.cloneNode(true) as SVGSVGElement;
    // Remove selection handles
    clone.querySelectorAll('.ve-handle, .ve-selection-rect').forEach(el => el.remove());
    // Remove grid
    clone.querySelectorAll('.ve-grid').forEach(el => el.remove());

    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(clone);
    svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgStr;

    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zeichnung.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ─── SVG Import ───
  const importSVG = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) return;

      const imported: VShape[] = [];

      svgEl.querySelectorAll('rect').forEach(el => {
        imported.push({
          id: uid(), type: 'rect',
          x: parseFloat(el.getAttribute('x') || '0'),
          y: parseFloat(el.getAttribute('y') || '0'),
          width: parseFloat(el.getAttribute('width') || '100'),
          height: parseFloat(el.getAttribute('height') || '100'),
          fill: el.getAttribute('fill') || DEFAULT_FILL,
          stroke: el.getAttribute('stroke') || 'none',
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || '0'),
          opacity: parseFloat(el.getAttribute('opacity') || '1'),
          rotation: 0,
        });
      });

      svgEl.querySelectorAll('ellipse').forEach(el => {
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const rx = parseFloat(el.getAttribute('rx') || '50');
        const ry = parseFloat(el.getAttribute('ry') || '50');
        imported.push({
          id: uid(), type: 'ellipse',
          x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2,
          fill: el.getAttribute('fill') || DEFAULT_FILL,
          stroke: el.getAttribute('stroke') || 'none',
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || '0'),
          opacity: parseFloat(el.getAttribute('opacity') || '1'),
          rotation: 0,
        });
      });

      svgEl.querySelectorAll('circle').forEach(el => {
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const r = parseFloat(el.getAttribute('r') || '50');
        imported.push({
          id: uid(), type: 'ellipse',
          x: cx - r, y: cy - r, width: r * 2, height: r * 2,
          fill: el.getAttribute('fill') || DEFAULT_FILL,
          stroke: el.getAttribute('stroke') || 'none',
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || '0'),
          opacity: parseFloat(el.getAttribute('opacity') || '1'),
          rotation: 0,
        });
      });

      svgEl.querySelectorAll('line').forEach(el => {
        imported.push({
          id: uid(), type: 'line',
          x: parseFloat(el.getAttribute('x1') || '0'),
          y: parseFloat(el.getAttribute('y1') || '0'),
          x2: parseFloat(el.getAttribute('x2') || '100'),
          y2: parseFloat(el.getAttribute('y2') || '100'),
          fill: 'none',
          stroke: el.getAttribute('stroke') || DEFAULT_STROKE,
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || '2'),
          opacity: parseFloat(el.getAttribute('opacity') || '1'),
          rotation: 0,
        });
      });

      svgEl.querySelectorAll('polygon').forEach(el => {
        const pStr = el.getAttribute('points') || '';
        const points = pStr.trim().split(/\s+/).map(p => {
          const [x, y] = p.split(',').map(Number);
          return { x: x || 0, y: y || 0 };
        });
        imported.push({
          id: uid(), type: 'polygon',
          x: 0, y: 0, points,
          fill: el.getAttribute('fill') || DEFAULT_FILL,
          stroke: el.getAttribute('stroke') || 'none',
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || '0'),
          opacity: parseFloat(el.getAttribute('opacity') || '1'),
          rotation: 0,
        });
      });

      svgEl.querySelectorAll('polyline').forEach(el => {
        const pStr = el.getAttribute('points') || '';
        const points = pStr.trim().split(/\s+/).map(p => {
          const [x, y] = p.split(',').map(Number);
          return { x: x || 0, y: y || 0 };
        });
        imported.push({
          id: uid(), type: 'polygon',
          x: 0, y: 0, points,
          fill: el.getAttribute('fill') || 'none',
          stroke: el.getAttribute('stroke') || DEFAULT_STROKE,
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || '2'),
          opacity: parseFloat(el.getAttribute('opacity') || '1'),
          rotation: 0,
        });
      });

      svgEl.querySelectorAll('path').forEach(el => {
        imported.push({
          id: uid(), type: 'path',
          x: 0, y: 0,
          d: el.getAttribute('d') || '',
          fill: el.getAttribute('fill') || 'none',
          stroke: el.getAttribute('stroke') || DEFAULT_STROKE,
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || '2'),
          opacity: parseFloat(el.getAttribute('opacity') || '1'),
          rotation: 0,
        });
      });

      svgEl.querySelectorAll('text').forEach(el => {
        imported.push({
          id: uid(), type: 'text',
          x: parseFloat(el.getAttribute('x') || '0'),
          y: parseFloat(el.getAttribute('y') || '0'),
          text: el.textContent || '',
          fontSize: parseFloat(el.getAttribute('font-size') || '24'),
          fill: el.getAttribute('fill') || '#000',
          stroke: 'none', strokeWidth: 0,
          opacity: parseFloat(el.getAttribute('opacity') || '1'),
          rotation: 0,
        });
      });

      const newShapes = [...shapes, ...imported];
      updateShapes(newShapes);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [shapes, updateShapes]);

  // ─── Property updates ───
  const updateSelectedProp = useCallback((props: Partial<VShape>) => {
    if (!selected) return;
    const newShapes = shapes.map(s => s.id === selected ? { ...s, ...props } : s);
    updateShapes(newShapes);
  }, [selected, shapes, updateShapes]);

  // Sync colors from selected shape
  useEffect(() => {
    if (selectedShape) {
      if (selectedShape.fill !== 'none') setFill(selectedShape.fill);
      if (selectedShape.stroke !== 'none') setStroke(selectedShape.stroke);
      setStrokeWidth(selectedShape.strokeWidth);
      setOpacity(selectedShape.opacity);
    }
  }, [selected]);

  // ─── Render shape as SVG ───
  const renderShape = (shape: VShape) => {
    const common = {
      key: shape.id,
      fill: shape.fill,
      stroke: shape.stroke,
      strokeWidth: shape.strokeWidth,
      opacity: shape.opacity,
      transform: shape.rotation ? `rotate(${shape.rotation} ${shape.x + (shape.width || 0) / 2} ${shape.y + (shape.height || 0) / 2})` : undefined,
      onMouseDown: (e: React.MouseEvent) => handleShapeClick(e, shape.id),
      style: { cursor: tool === 'select' ? 'move' : 'crosshair' } as React.CSSProperties,
    };

    switch (shape.type) {
      case 'rect':
        return <rect {...common} x={shape.x} y={shape.y} width={shape.width} height={shape.height} />;
      case 'ellipse':
        return (
          <ellipse
            {...common}
            cx={shape.x + (shape.width || 0) / 2}
            cy={shape.y + (shape.height || 0) / 2}
            rx={(shape.width || 0) / 2}
            ry={(shape.height || 0) / 2}
          />
        );
      case 'line':
        return <line {...common} x1={shape.x} y1={shape.y} x2={shape.x2} y2={shape.y2} />;
      case 'polygon':
        return (
          <polygon
            {...common}
            points={shape.points?.map(p => `${p.x},${p.y}`).join(' ')}
          />
        );
      case 'path':
        return <path {...common} d={shape.d} />;
      case 'text':
        return (
          <text
            {...common}
            x={shape.x}
            y={shape.y}
            fontSize={shape.fontSize || 24}
            fontFamily="sans-serif"
          >
            {shape.text}
          </text>
        );
      default:
        return null;
    }
  };

  // ─── Selection handles ───
  const renderHandles = () => {
    if (!selectedShape || tool !== 'select') return null;
    const s = selectedShape;

    if (s.type === 'rect' || s.type === 'ellipse') {
      const x = s.x;
      const y = s.y;
      const w = s.width || 0;
      const h = s.height || 0;
      const handles = [
        { cx: x, cy: y, cursor: 'nw-resize', pos: 'nw' },
        { cx: x + w / 2, cy: y, cursor: 'n-resize', pos: 'n' },
        { cx: x + w, cy: y, cursor: 'ne-resize', pos: 'ne' },
        { cx: x + w, cy: y + h / 2, cursor: 'e-resize', pos: 'e' },
        { cx: x + w, cy: y + h, cursor: 'se-resize', pos: 'se' },
        { cx: x + w / 2, cy: y + h, cursor: 's-resize', pos: 's' },
        { cx: x, cy: y + h, cursor: 'sw-resize', pos: 'sw' },
        { cx: x, cy: y + h / 2, cursor: 'w-resize', pos: 'w' },
      ];
      return (
        <g>
          <rect
            className="ve-selection-rect"
            x={x - 1} y={y - 1} width={w + 2} height={h + 2}
            fill="none" stroke="#007acc" strokeWidth={1} strokeDasharray="4 2"
          />
          {handles.map(h => (
            <rect
              key={h.pos}
              className="ve-handle"
              x={h.cx - 4} y={h.cy - 4}
              width={8} height={8}
              fill="#fff" stroke="#007acc" strokeWidth={1}
              style={{ cursor: h.cursor }}
              onMouseDown={e => handleResizeStart(h.pos, e)}
            />
          ))}
        </g>
      );
    }

    // Simple bounding rect for other shapes
    if (s.type === 'line') {
      return (
        <g>
          <circle className="ve-handle" cx={s.x} cy={s.y} r={5} fill="#fff" stroke="#007acc" strokeWidth={1} />
          <circle className="ve-handle" cx={s.x2} cy={s.y2} r={5} fill="#fff" stroke="#007acc" strokeWidth={1} />
        </g>
      );
    }

    return null;
  };

  // ─── Grid ───
  const renderGrid = () => {
    if (!gridOn) return null;
    return (
      <g className="ve-grid" opacity={0.15}>
        <defs>
          <pattern id="ve-grid-sm" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#888" strokeWidth="0.3" />
          </pattern>
          <pattern id="ve-grid-lg" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#ve-grid-sm)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#888" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ve-grid-lg)" />
      </g>
    );
  };

  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: 'select', icon: '⬚', label: 'Auswahl' },
    { id: 'rect', icon: '▭', label: 'Rechteck' },
    { id: 'ellipse', icon: '⬭', label: 'Ellipse' },
    { id: 'line', icon: '╱', label: 'Linie' },
    { id: 'polygon', icon: '⬠', label: 'Polygon' },
    { id: 'path', icon: '✎', label: 'Freihand' },
    { id: 'text', icon: 'T', label: 'Text' },
  ];

  return (
    <div className="vector-editor" ref={containerRef} tabIndex={0}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg"
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />

      {/* Top toolbar */}
      <div className="ve-toolbar">
        <div className="ve-toolbar-group">
          <button className="ve-tb-btn" onClick={importSVG} title="SVG importieren">📂 Import</button>
          <button className="ve-tb-btn" onClick={exportSVG} title="SVG exportieren">💾 Export</button>
        </div>
        <div className="ve-sep" />
        <div className="ve-toolbar-group">
          <button className="ve-tb-btn" onClick={undo} disabled={historyIdx <= 0} title="Rückgängig (Ctrl+Z)">↩</button>
          <button className="ve-tb-btn" onClick={redo} disabled={historyIdx >= history.length - 1} title="Wiederholen (Ctrl+Y)">↪</button>
        </div>
        <div className="ve-sep" />
        <div className="ve-toolbar-group">
          <button className="ve-tb-btn" onClick={bringForward} disabled={!selected} title="Nach vorne">⬆</button>
          <button className="ve-tb-btn" onClick={sendBackward} disabled={!selected} title="Nach hinten">⬇</button>
        </div>
        <div className="ve-sep" />
        <div className="ve-toolbar-group">
          <label className="ve-tb-check">
            <input type="checkbox" checked={gridOn} onChange={e => setGridOn(e.target.checked)} />
            Raster
          </label>
          <label className="ve-tb-check">
            <input type="checkbox" checked={snapOn} onChange={e => setSnapOn(e.target.checked)} />
            Fangen
          </label>
        </div>
        <div className="ve-sep" />
        {selected && (
          <div className="ve-toolbar-group">
            <button className="ve-tb-btn ve-delete-btn" onClick={() => {
              updateShapes(shapes.filter(s => s.id !== selected));
              setSelected(null);
            }} title="Löschen (Del)">🗑️</button>
          </div>
        )}
      </div>

      <div className="ve-main">
        {/* Tool sidebar */}
        <div className="ve-sidebar">
          <div className="ve-tools">
            {tools.map(t => (
              <button
                key={t.id}
                className={`ve-tool-btn${tool === t.id ? ' active' : ''}`}
                onClick={() => { setTool(t.id); setSelected(null); }}
                title={t.label}
              >
                <span className="ve-tool-icon">{t.icon}</span>
                <span className="ve-tool-label">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Properties */}
          <div className="ve-props">
            <div className="ve-prop-section">Farben</div>
            <div className="ve-prop-row">
              <label className="ve-prop-label">Füllung</label>
              <div className="ve-prop-color-row">
                <input type="color" value={fill} onChange={e => {
                  setFill(e.target.value);
                  if (selected) updateSelectedProp({ fill: e.target.value });
                }} />
                <button className="ve-color-none" onClick={() => {
                  if (selected) updateSelectedProp({ fill: 'none' });
                }} title="Keine Füllung">∅</button>
              </div>
            </div>
            <div className="ve-prop-row">
              <label className="ve-prop-label">Kontur</label>
              <div className="ve-prop-color-row">
                <input type="color" value={stroke} onChange={e => {
                  setStroke(e.target.value);
                  if (selected) updateSelectedProp({ stroke: e.target.value });
                }} />
                <button className="ve-color-none" onClick={() => {
                  setStroke('none');
                  if (selected) updateSelectedProp({ stroke: 'none' });
                }} title="Keine Kontur">∅</button>
              </div>
            </div>
            <div className="ve-prop-row">
              <label className="ve-prop-label">Stärke</label>
              <input
                type="range" min="0" max="20" step="0.5"
                value={strokeWidth}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setStrokeWidth(v);
                  if (selected) updateSelectedProp({ strokeWidth: v });
                }}
              />
              <span className="ve-prop-val">{strokeWidth}</span>
            </div>
            <div className="ve-prop-row">
              <label className="ve-prop-label">Deckkraft</label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={opacity}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setOpacity(v);
                  if (selected) updateSelectedProp({ opacity: v });
                }}
              />
              <span className="ve-prop-val">{Math.round(opacity * 100)}%</span>
            </div>

            {selectedShape && (selectedShape.type === 'rect' || selectedShape.type === 'ellipse') && (
              <>
                <div className="ve-prop-section">Abmessungen</div>
                <div className="ve-prop-row">
                  <label className="ve-prop-label">X</label>
                  <input type="number" className="ve-num-input" value={Math.round(selectedShape.x)}
                    onChange={e => updateSelectedProp({ x: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="ve-prop-row">
                  <label className="ve-prop-label">Y</label>
                  <input type="number" className="ve-num-input" value={Math.round(selectedShape.y)}
                    onChange={e => updateSelectedProp({ y: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="ve-prop-row">
                  <label className="ve-prop-label">B</label>
                  <input type="number" className="ve-num-input" value={Math.round(selectedShape.width || 0)}
                    onChange={e => updateSelectedProp({ width: Math.max(1, parseFloat(e.target.value) || 0) })} />
                </div>
                <div className="ve-prop-row">
                  <label className="ve-prop-label">H</label>
                  <input type="number" className="ve-num-input" value={Math.round(selectedShape.height || 0)}
                    onChange={e => updateSelectedProp({ height: Math.max(1, parseFloat(e.target.value) || 0) })} />
                </div>
                <div className="ve-prop-row">
                  <label className="ve-prop-label">Rotation</label>
                  <input
                    type="range" min="0" max="360" step="1"
                    value={selectedShape.rotation}
                    onChange={e => updateSelectedProp({ rotation: parseFloat(e.target.value) })}
                  />
                  <span className="ve-prop-val">{selectedShape.rotation}°</span>
                </div>
              </>
            )}

            {selectedShape?.type === 'text' && (
              <>
                <div className="ve-prop-section">Text</div>
                <div className="ve-prop-row">
                  <label className="ve-prop-label">Größe</label>
                  <input type="number" className="ve-num-input" value={selectedShape.fontSize || 24}
                    onChange={e => updateSelectedProp({ fontSize: Math.max(8, parseFloat(e.target.value) || 24) })} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="ve-canvas-wrapper">
          <svg
            ref={svgRef}
            className="ve-svg"
            xmlns="http://www.w3.org/2000/svg"
            onMouseDown={(e) => { handleMouseDown(e); handleBgClick(e); }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
          >
            {renderGrid()}
            {shapes.map(renderShape)}
            {renderHandles()}
          </svg>
        </div>
      </div>

      {/* Status bar */}
      <div className="ve-statusbar">
        <span>Objekte: {shapes.length}</span>
        {selectedShape && <span>Ausgewählt: {selectedShape.type}</span>}
        <span className="ve-status-right">Werkzeug: {tools.find(t => t.id === tool)?.label}</span>
      </div>
    </div>
  );
};

export default VectorEditor;
