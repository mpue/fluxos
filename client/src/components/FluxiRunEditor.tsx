import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  W, H, GROUND_Y, LEVEL_WIDTH_MULT,
  Entity, Platform, MovingPlatform, Folder, HddPiece, FinishZone,
  LevelData, LevelTheme, LEVEL_THEMES,
} from './FluxiRunTypes';
import './FluxiRunEditor.css';

// ─── Tool types ───
type Tool =
  | 'select' | 'platform' | 'ground' | 'moving'
  | 'enemy_folder' | 'enemy_virus' | 'enemy_trojan' | 'enemy_worm' | 'enemy_firewall' | 'enemy_boss'
  | 'coin' | 'finish' | 'erase';

interface EditorProps {
  onPlay: (level: LevelData) => void;
  onBack: () => void;
}

const GRID = 10;
const EDITOR_H = H;
const snap = (v: number) => Math.round(v / GRID) * GRID;

const ENEMY_DEFAULTS: Record<string, { w: number; h: number; hp: number; vx: number }> = {
  folder:   { w: 30, h: 30, hp: 1, vx: 1.5 },
  virus:    { w: 30, h: 30, hp: 2, vx: 1.2 },
  trojan:   { w: 32, h: 32, hp: 2, vx: 0.8 },
  worm:     { w: 22, h: 18, hp: 1, vx: 3 },
  firewall: { w: 20, h: 40, hp: 3, vx: 0 },
  boss:     { w: 50, h: 55, hp: 7, vx: 1 },
};

const FluxiRunEditor: React.FC<EditorProps> = ({ onPlay, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldW = W * LEVEL_WIDTH_MULT;

  // ─── State ───
  const [tool, setTool] = useState<Tool>('select');
  const [theme, setTheme] = useState<LevelTheme>('city');
  const [platforms, setPlatforms] = useState<Platform[]>([
    { x: 0, y: GROUND_Y, w: worldW, h: 50 },
  ]);
  const [movingPlatforms, setMovingPlatforms] = useState<MovingPlatform[]>([]);
  const [enemies, setEnemies] = useState<Folder[]>([]);
  const [pieces, setPieces] = useState<HddPiece[]>([]);
  const [finishZone, setFinishZone] = useState<FinishZone>({ x: worldW - 100, y: GROUND_Y - 80, w: 40, h: 80 });

  const [camera, setCamera] = useState(0);
  const [selected, setSelected] = useState<{ type: string; index: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ex: 0, ey: 0 });
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, cam: 0 });


  // ─── Refs for animation ───
  const stateRef = useRef({ platforms, movingPlatforms, enemies, pieces, finishZone, camera, tool, selected, drawRect, theme });
  stateRef.current = { platforms, movingPlatforms, enemies, pieces, finishZone, camera, tool, selected, drawRect, theme };

  // ─── Canvas drawing ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const draw = () => {
      const s = stateRef.current;
      const cam = s.camera;

      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, EDITOR_H);
      if (s.theme === 'caves') {
        grad.addColorStop(0, '#1a1207'); grad.addColorStop(1, '#3d2914');
      } else if (s.theme === 'sky') {
        grad.addColorStop(0, '#0c1445'); grad.addColorStop(1, '#4a7ab5');
      } else if (s.theme === 'factory') {
        grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(1, '#3a3a4e');
      } else if (s.theme === 'digital') {
        grad.addColorStop(0, '#0a0a1a'); grad.addColorStop(1, '#1b2838');
      } else {
        grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#334155');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, EDITOR_H);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let gx = -cam % gridSize; gx < W; gx += gridSize) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, EDITOR_H); ctx.stroke();
      }
      for (let gy = 0; gy < EDITOR_H; gy += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      // Ground line indicator
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(W, GROUND_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.translate(-cam, 0);

      // ── Platforms ──
      for (const p of s.platforms) {
        if (p.x + p.w < cam - 20 || p.x > cam + W + 20) continue;
        if (p.y === GROUND_Y) {
          const grd = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 40);
          grd.addColorStop(0, '#475569'); grd.addColorStop(1, '#1e293b');
          ctx.fillStyle = grd;
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.strokeStyle = 'rgba(96,165,250,0.15)';
          ctx.lineWidth = 1;
          for (let gx = Math.floor(p.x / 30) * 30; gx < p.x + p.w; gx += 30) {
            ctx.beginPath(); ctx.moveTo(gx, GROUND_Y); ctx.lineTo(gx, GROUND_Y + 40); ctx.stroke();
          }
        } else {
          ctx.fillStyle = '#475569';
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = '#60a5fa';
          ctx.fillRect(p.x, p.y, p.w, 3);
        }
      }

      // ── Moving platforms ──
      for (const mp of s.movingPlatforms) {
        if (mp.x + mp.w < cam - 20 || mp.x > cam + W + 20) continue;
        ctx.fillStyle = '#334155';
        ctx.fillRect(mp.x, mp.y, mp.w, mp.h);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(mp.x, mp.y, mp.w, 3);
        // Range indicators
        ctx.strokeStyle = 'rgba(245,158,11,0.3)';
        ctx.setLineDash([4, 3]);
        if (mp.rangeX > 0) {
          ctx.beginPath();
          ctx.moveTo(mp.origX - mp.rangeX, mp.y + mp.h / 2);
          ctx.lineTo(mp.origX + mp.w + mp.rangeX, mp.y + mp.h / 2);
          ctx.stroke();
        }
        if (mp.rangeY > 0) {
          ctx.beginPath();
          ctx.moveTo(mp.x + mp.w / 2, mp.origY - mp.rangeY);
          ctx.lineTo(mp.x + mp.w / 2, mp.origY + mp.h + mp.rangeY);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 8px monospace';
        ctx.fillText(mp.rangeX > 0 ? '◀▶' : '▲▼', mp.x + mp.w / 2 - 7, mp.y + 11);
      }

      // ── Finish zone ──
      const fz = s.finishZone;
      if (fz.x + fz.w > cam - 20 && fz.x < cam + W + 20) {
        ctx.fillStyle = 'rgba(34,197,94,0.3)';
        ctx.fillRect(fz.x, fz.y, fz.w, fz.h);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(fz.x + 5, fz.y, fz.w - 10, fz.h);
        ctx.fillStyle = '#a3a3a3';
        ctx.fillRect(fz.x + fz.w / 2 - 2, fz.y - 30, 4, 30);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(fz.x + fz.w / 2 + 2, fz.y - 30, 20, 14);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('ZIEL', fz.x + fz.w / 2 + 3, fz.y - 20);
      }

      // ── Coins ──
      for (const piece of s.pieces) {
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(piece.x + 2, piece.y + 2, 16, 12);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(piece.x + 4, piece.y + 4, 4, 3);
        ctx.fillRect(piece.x + 10, piece.y + 4, 4, 3);
      }

      // ── Enemies ──
      for (const e of s.enemies) {
        if (e.x + e.w < cam - 20 || e.x > cam + W + 20) continue;
        const colors: Record<string, string> = {
          folder: '#f59e0b', virus: '#8b5cf6', trojan: '#166534',
          worm: '#84cc16', firewall: '#dc2626', boss: '#991b1b',
        };
        ctx.fillStyle = colors[e.type] || '#f59e0b';
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px monospace';
        const labels: Record<string, string> = {
          folder: '📂', virus: '☠', trojan: '🛡', worm: '🐛', firewall: '🔥', boss: '👑',
        };
        ctx.fillText(labels[e.type] || '?', e.x + 2, e.y + e.h - 4);
        // HP badge
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x + e.w - 14, e.y, 14, 12);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(String(e.hp), e.x + e.w - 11, e.y + 10);
      }

      // ── Selection highlight ──
      if (s.selected) {
        let rect: Entity | null = null;
        if (s.selected.type === 'platform') rect = s.platforms[s.selected.index];
        else if (s.selected.type === 'moving') rect = s.movingPlatforms[s.selected.index];
        else if (s.selected.type === 'enemy') rect = s.enemies[s.selected.index];
        else if (s.selected.type === 'coin') rect = s.pieces[s.selected.index];
        else if (s.selected.type === 'finish') rect = s.finishZone;
        if (rect) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          ctx.strokeRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
          ctx.setLineDash([]);
          // Resize handle
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(rect.x + rect.w - 4, rect.y + rect.h - 4, 8, 8);
        }
      }

      // ── Draw preview rect ──
      if (s.drawRect) {
        ctx.fillStyle = 'rgba(96,165,250,0.3)';
        ctx.fillRect(s.drawRect.x, s.drawRect.y, s.drawRect.w, s.drawRect.h);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1;
        ctx.strokeRect(s.drawRect.x, s.drawRect.y, s.drawRect.w, s.drawRect.h);
      }

      ctx.restore();

      // ── HUD ──
      // Minimap
      const mmW = 200, mmH = 20, mmX = W - mmW - 10, mmY = 8;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(mmX, mmY, mmW, mmH);
      const scale = mmW / worldW;
      // Platforms on minimap
      ctx.fillStyle = 'rgba(96,165,250,0.5)';
      for (const p of s.platforms) {
        ctx.fillRect(mmX + p.x * scale, mmY + (p.y / EDITOR_H) * mmH, Math.max(1, p.w * scale), Math.max(1, (p.h / EDITOR_H) * mmH));
      }
      // Camera viewport
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.strokeRect(mmX + cam * scale, mmY, W * scale, mmH);
      // Finish zone
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(mmX + fz.x * scale, mmY, Math.max(2, fz.w * scale), mmH);

      // Position info
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`Cam: ${Math.round(cam)} | World: ${worldW}px`, 10, EDITOR_H - 8);

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [worldW]);

  // ─── Mouse handlers ───
  const getWorldPos = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: 0, wy: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = EDITOR_H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    return { wx: cx + camera, wy: cy };
  }, [camera]);

  const hitTest = useCallback((wx: number, wy: number): { type: string; index: number } | null => {
    // Check finish zone
    if (wx >= finishZone.x && wx <= finishZone.x + finishZone.w && wy >= finishZone.y && wy <= finishZone.y + finishZone.h) {
      return { type: 'finish', index: 0 };
    }
    // Enemies (top priority for small items)
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (wx >= e.x && wx <= e.x + e.w && wy >= e.y && wy <= e.y + e.h) return { type: 'enemy', index: i };
    }
    // Coins
    for (let i = pieces.length - 1; i >= 0; i--) {
      const c = pieces[i];
      if (wx >= c.x && wx <= c.x + c.w && wy >= c.y && wy <= c.y + c.h) return { type: 'coin', index: i };
    }
    // Moving platforms
    for (let i = movingPlatforms.length - 1; i >= 0; i--) {
      const m = movingPlatforms[i];
      if (wx >= m.x && wx <= m.x + m.w && wy >= m.y && wy <= m.y + m.h) return { type: 'moving', index: i };
    }
    // Platforms
    for (let i = platforms.length - 1; i >= 0; i--) {
      const p = platforms[i];
      if (wx >= p.x && wx <= p.x + p.w && wy >= p.y && wy <= p.y + p.h) return { type: 'platform', index: i };
    }
    return null;
  }, [platforms, movingPlatforms, enemies, pieces, finishZone]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const { wx, wy } = getWorldPos(e);

    // Middle button or space+click = pan
    if (e.button === 1) {
      setPanning(true);
      setPanStart({ x: e.clientX, cam: camera });
      return;
    }

    if (e.button !== 0) return;

    if (tool === 'select') {
      const hit = hitTest(wx, wy);
      setSelected(hit);
      if (hit) {
        setDragging(true);
        let ent: Entity;
        if (hit.type === 'platform') ent = platforms[hit.index];
        else if (hit.type === 'moving') ent = movingPlatforms[hit.index];
        else if (hit.type === 'enemy') ent = enemies[hit.index];
        else if (hit.type === 'coin') ent = pieces[hit.index];
        else ent = finishZone;
        setDragStart({ x: wx, y: wy, ex: ent.x, ey: ent.y });
      }
    } else if (tool === 'erase') {
      const hit = hitTest(wx, wy);
      if (hit) {
        if (hit.type === 'platform') setPlatforms(prev => prev.filter((_, i) => i !== hit.index));
        else if (hit.type === 'moving') setMovingPlatforms(prev => prev.filter((_, i) => i !== hit.index));
        else if (hit.type === 'enemy') setEnemies(prev => prev.filter((_, i) => i !== hit.index));
        else if (hit.type === 'coin') setPieces(prev => prev.filter((_, i) => i !== hit.index));
        setSelected(null);
      }
    } else if (tool === 'platform' || tool === 'ground') {
      setDrawing(true);
      setDrawStart({ x: snap(wx), y: snap(wy) });
      setDrawRect({ x: snap(wx), y: snap(wy), w: 0, h: 0 });
    } else if (tool === 'moving') {
      setDrawing(true);
      setDrawStart({ x: snap(wx), y: snap(wy) });
      setDrawRect({ x: snap(wx), y: snap(wy), w: 0, h: 0 });
    } else if (tool.startsWith('enemy_')) {
      const etype = tool.replace('enemy_', '') as Folder['type'];
      const def = ENEMY_DEFAULTS[etype] || ENEMY_DEFAULTS.folder;
      const newEnemy: Folder = {
        x: snap(wx - def.w / 2), y: snap(wy - def.h / 2),
        w: def.w, h: def.h,
        vx: def.vx * (Math.random() < 0.5 ? 1 : -1),
        vy: 0, hp: def.hp, type: etype,
        onGround: true, shootTimer: 0,
      };
      setEnemies(prev => [...prev, newEnemy]);
      setSelected({ type: 'enemy', index: enemies.length });
    } else if (tool === 'coin') {
      const newPiece: HddPiece = {
        x: snap(wx - 10), y: snap(wy - 10),
        w: 20, h: 20, collected: false,
      };
      setPieces(prev => [...prev, newPiece]);
      setSelected({ type: 'coin', index: pieces.length });
    } else if (tool === 'finish') {
      setFinishZone({ x: snap(wx - 20), y: snap(wy - 40), w: 40, h: 80 });
      setSelected({ type: 'finish', index: 0 });
    }
  }, [tool, camera, getWorldPos, hitTest, platforms, movingPlatforms, enemies, pieces, finishZone]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning) {
      const dx = e.clientX - panStart.x;
      const canvas = canvasRef.current;
      const scaleX = canvas ? W / canvas.getBoundingClientRect().width : 1;
      setCamera(Math.max(0, Math.min(worldW - W, panStart.cam - dx * scaleX)));
      return;
    }

    const { wx, wy } = getWorldPos(e);

    if (dragging && selected) {
      const dx = wx - dragStart.x;
      const dy = wy - dragStart.y;
      const nx = snap(dragStart.ex + dx);
      const ny = snap(dragStart.ey + dy);

      if (selected.type === 'platform') {
        setPlatforms(prev => prev.map((p, i) => i === selected.index ? { ...p, x: nx, y: ny } : p));
      } else if (selected.type === 'moving') {
        setMovingPlatforms(prev => prev.map((m, i) => i === selected.index ? { ...m, x: nx, y: ny, origX: nx, origY: ny } : m));
      } else if (selected.type === 'enemy') {
        setEnemies(prev => prev.map((en, i) => i === selected.index ? { ...en, x: nx, y: ny } : en));
      } else if (selected.type === 'coin') {
        setPieces(prev => prev.map((c, i) => i === selected.index ? { ...c, x: nx, y: ny } : c));
      } else if (selected.type === 'finish') {
        setFinishZone(prev => ({ ...prev, x: nx, y: ny }));
      }
    } else if (drawing) {
      const x = Math.min(drawStart.x, snap(wx));
      const y = Math.min(drawStart.y, snap(wy));
      const w = Math.max(GRID, Math.abs(snap(wx) - drawStart.x));
      const h = Math.max(GRID, Math.abs(snap(wy) - drawStart.y));
      setDrawRect({ x, y, w, h });
    }
  }, [panning, panStart, dragging, selected, dragStart, drawing, drawStart, getWorldPos, worldW]);

  const onMouseUp = useCallback((_e: React.MouseEvent) => {
    if (panning) { setPanning(false); return; }

    if (drawing && drawRect) {
      if (drawRect.w >= GRID && drawRect.h >= GRID) {
        if (tool === 'platform') {
          setPlatforms(prev => [...prev, { x: drawRect.x, y: drawRect.y, w: drawRect.w, h: drawRect.h }]);
          setSelected({ type: 'platform', index: platforms.length });
        } else if (tool === 'ground') {
          setPlatforms(prev => [...prev, { x: drawRect.x, y: GROUND_Y, w: drawRect.w, h: 50 }]);
          setSelected({ type: 'platform', index: platforms.length });
        } else if (tool === 'moving') {
          const mp: MovingPlatform = {
            x: drawRect.x, y: drawRect.y, w: drawRect.w, h: Math.max(14, drawRect.h),
            origX: drawRect.x, origY: drawRect.y,
            vx: 1.5, vy: 0, rangeX: 100, rangeY: 0,
          };
          setMovingPlatforms(prev => [...prev, mp]);
          setSelected({ type: 'moving', index: movingPlatforms.length });
        }
      }
      setDrawing(false);
      setDrawRect(null);
    }

    setDragging(false);
  }, [drawing, drawRect, tool, platforms.length, movingPlatforms.length]);

  // ─── Scroll to pan ───
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCamera(prev => Math.max(0, Math.min(worldW - W, prev + e.deltaX + e.deltaY)));
  }, [worldW]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected) {
          if (selected.type === 'platform') setPlatforms(prev => prev.filter((_, i) => i !== selected.index));
          else if (selected.type === 'moving') setMovingPlatforms(prev => prev.filter((_, i) => i !== selected.index));
          else if (selected.type === 'enemy') setEnemies(prev => prev.filter((_, i) => i !== selected.index));
          else if (selected.type === 'coin') setPieces(prev => prev.filter((_, i) => i !== selected.index));
          setSelected(null);
          e.preventDefault();
        }
      }
      if (e.key === 'Escape') { setSelected(null); setTool('select'); }
      if (e.key === '1') setTool('select');
      if (e.key === '2') setTool('platform');
      if (e.key === '3') setTool('moving');
      if (e.key === '4') setTool('enemy_folder');
      if (e.key === '5') setTool('coin');
      if (e.key === '6') setTool('erase');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected]);

  // ─── Property editor ───
  const getSelectedEntity = (): Entity | null => {
    if (!selected) return null;
    if (selected.type === 'platform') return platforms[selected.index] || null;
    if (selected.type === 'moving') return movingPlatforms[selected.index] || null;
    if (selected.type === 'enemy') return enemies[selected.index] || null;
    if (selected.type === 'coin') return pieces[selected.index] || null;
    if (selected.type === 'finish') return finishZone;
    return null;
  };

  const updateProp = (key: string, val: number) => {
    if (!selected) return;
    if (selected.type === 'platform') {
      setPlatforms(prev => prev.map((p, i) => i === selected.index ? { ...p, [key]: val } : p));
    } else if (selected.type === 'moving') {
      setMovingPlatforms(prev => prev.map((m, i) => {
        if (i !== selected.index) return m;
        const updated = { ...m, [key]: val };
        if (key === 'x') updated.origX = val;
        if (key === 'y') updated.origY = val;
        return updated;
      }));
    } else if (selected.type === 'enemy') {
      setEnemies(prev => prev.map((en, i) => i === selected.index ? { ...en, [key]: val } : en));
    } else if (selected.type === 'coin') {
      setPieces(prev => prev.map((c, i) => i === selected.index ? { ...c, [key]: val } : c));
    } else if (selected.type === 'finish') {
      setFinishZone(prev => ({ ...prev, [key]: val }));
    }
  };

  // ─── Save / Load ───
  const buildLevelData = (): LevelData => ({
    platforms, movingPlatforms, enemies, pieces, finishZone, theme,
  });

  const handleSave = () => {
    const data = JSON.stringify(buildLevelData(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fluxi-level.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data: LevelData = JSON.parse(e.target?.result as string);
          if (data.platforms) setPlatforms(data.platforms);
          if (data.movingPlatforms) setMovingPlatforms(data.movingPlatforms);
          if (data.enemies) setEnemies(data.enemies);
          if (data.pieces) setPieces(data.pieces);
          if (data.finishZone) setFinishZone(data.finishZone);
          if (data.theme) setTheme(data.theme);
          setSelected(null);
          setCamera(0);
        } catch { /* ignore invalid */ }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handlePlay = () => onPlay(buildLevelData());

  const handleClear = () => {
    setPlatforms([{ x: 0, y: GROUND_Y, w: worldW, h: 50 }]);
    setMovingPlatforms([]);
    setEnemies([]);
    setPieces([]);
    setFinishZone({ x: worldW - 100, y: GROUND_Y - 80, w: 40, h: 80 });
    setSelected(null);
    setCamera(0);
  };

  const sel = getSelectedEntity();

  const TOOLS: { id: Tool; icon: string; label: string }[] = [
    { id: 'select', icon: '🖱', label: 'Auswahl (1)' },
    { id: 'platform', icon: '▬', label: 'Plattform (2)' },
    { id: 'ground', icon: '▬', label: 'Boden' },
    { id: 'moving', icon: '↔', label: 'Beweglich (3)' },
    { id: 'enemy_folder', icon: '📂', label: 'Ordner (4)' },
    { id: 'enemy_virus', icon: '☠', label: 'Virus' },
    { id: 'enemy_trojan', icon: '🛡', label: 'Trojaner' },
    { id: 'enemy_worm', icon: '🐛', label: 'Wurm' },
    { id: 'enemy_firewall', icon: '🔥', label: 'Firewall' },
    { id: 'enemy_boss', icon: '👑', label: 'Boss' },
    { id: 'coin', icon: '💎', label: 'Coin (5)' },
    { id: 'finish', icon: '🏁', label: 'Ziel' },
    { id: 'erase', icon: '🗑', label: 'Löschen (6)' },
  ];

  return (
    <div className="fre-editor">
      {/* Toolbar */}
      <div className="fre-toolbar">
        <div className="fre-toolbar-group">
          <button className="fre-btn fre-btn-back" onClick={onBack} title="Zurück">← Menü</button>
          <button className="fre-btn fre-btn-play" onClick={handlePlay} title="Level spielen">▶ Spielen</button>
        </div>
        <div className="fre-toolbar-group fre-tools">
          {TOOLS.map(t => (
            <button
              key={t.id}
              className={`fre-tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => { setTool(t.id); setSelected(null); }}
              title={t.label}
            >
              <span className="fre-tool-icon">{t.icon}</span>
              <span className="fre-tool-label">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="fre-toolbar-group">
          <select
            className="fre-theme-select"
            value={theme}
            onChange={e => setTheme(e.target.value as LevelTheme)}
            title="Level-Thema"
          >
            {LEVEL_THEMES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="fre-toolbar-group">
          <button className="fre-btn" onClick={handleSave} title="Speichern">💾 Speichern</button>
          <button className="fre-btn" onClick={handleLoad} title="Laden">📂 Laden</button>
          <button className="fre-btn fre-btn-danger" onClick={handleClear} title="Alles löschen">🗑 Leeren</button>
        </div>
      </div>

      {/* Canvas */}
      <div className="fre-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={W}
          height={EDITOR_H}
          className="fre-canvas"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { setDragging(false); setDrawing(false); setDrawRect(null); setPanning(false); }}
          onWheel={onWheel}
          onContextMenu={e => e.preventDefault()}
        />
      </div>

      {/* Properties Panel */}
      {selected && sel && (
        <div className="fre-props">
          <div className="fre-props-header">
            <span>{selected.type.toUpperCase()}</span>
            <button className="fre-props-close" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div className="fre-props-grid">
            <label>X</label>
            <input type="number" value={Math.round(sel.x)} onChange={e => updateProp('x', Number(e.target.value))} step={GRID} />
            <label>Y</label>
            <input type="number" value={Math.round(sel.y)} onChange={e => updateProp('y', Number(e.target.value))} step={GRID} />
            <label>W</label>
            <input type="number" value={Math.round(sel.w)} onChange={e => updateProp('w', Math.max(GRID, Number(e.target.value)))} step={GRID} />
            <label>H</label>
            <input type="number" value={Math.round(sel.h)} onChange={e => updateProp('h', Math.max(GRID, Number(e.target.value)))} step={GRID} />
            {selected.type === 'enemy' && (
              <>
                <label>HP</label>
                <input type="number" value={(sel as Folder).hp} onChange={e => updateProp('hp', Math.max(1, Number(e.target.value)))} min={1} />
                <label>Speed</label>
                <input type="number" value={Math.round((sel as Folder).vx * 10) / 10} onChange={e => updateProp('vx', Number(e.target.value))} step={0.5} />
              </>
            )}
            {selected.type === 'moving' && (
              <>
                <label>RangeX</label>
                <input type="number" value={Math.round((sel as MovingPlatform).rangeX)} onChange={e => updateProp('rangeX', Math.max(0, Number(e.target.value)))} step={10} />
                <label>RangeY</label>
                <input type="number" value={Math.round((sel as MovingPlatform).rangeY)} onChange={e => updateProp('rangeY', Math.max(0, Number(e.target.value)))} step={10} />
                <label>SpeedX</label>
                <input type="number" value={Math.round((sel as MovingPlatform).vx * 10) / 10} onChange={e => updateProp('vx', Number(e.target.value))} step={0.5} />
                <label>SpeedY</label>
                <input type="number" value={Math.round((sel as MovingPlatform).vy * 10) / 10} onChange={e => updateProp('vy', Number(e.target.value))} step={0.5} />
              </>
            )}
          </div>
          <button className="fre-btn fre-btn-danger fre-props-del" onClick={() => {
            if (selected.type === 'platform') setPlatforms(prev => prev.filter((_, i) => i !== selected.index));
            else if (selected.type === 'moving') setMovingPlatforms(prev => prev.filter((_, i) => i !== selected.index));
            else if (selected.type === 'enemy') setEnemies(prev => prev.filter((_, i) => i !== selected.index));
            else if (selected.type === 'coin') setPieces(prev => prev.filter((_, i) => i !== selected.index));
            setSelected(null);
          }}>🗑 Löschen</button>
        </div>
      )}

      {/* Status */}
      <div className="fre-status">
        <span>📐 Plattformen: {platforms.length}</span>
        <span>↔ Beweglich: {movingPlatforms.length}</span>
        <span>👾 Gegner: {enemies.length}</span>
        <span>💎 Coins: {pieces.length}</span>
        <span>🎨 {theme}</span>
        <span className="fre-hint">Scroll/Mausrad = Scrollen | Mitteltaste = Verschieben | Del = Löschen</span>
      </div>
    </div>
  );
};

export default FluxiRunEditor;
