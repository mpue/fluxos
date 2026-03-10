import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDesktop } from '../contexts/DesktopContext';
import { getColorScheme } from '../utils/colorSchemes';
import './Game2048.css';

const SIZE = 4;

/* ── Tile tracking ─────────────────────────────────────────── */
interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
}

let nextTileId = 1;
function genId() { return nextTileId++; }

function spawnTile(tiles: Tile[]): Tile[] {
  const occupied = new Set(tiles.map(t => `${t.row},${t.col}`));
  const empty: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!occupied.has(`${r},${c}`)) empty.push([r, c]);
  if (empty.length === 0) return tiles;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  return [...tiles, { id: genId(), value: Math.random() < 0.9 ? 2 : 4, row: r, col: c, isNew: true }];
}

function buildGrid(tiles: Tile[]): (Tile | null)[][] {
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (const t of tiles) grid[t.row][t.col] = t;
  return grid;
}

function slideTiles(tiles: Tile[], direction: 'left' | 'right' | 'up' | 'down'): { tiles: Tile[]; score: number; moved: boolean } {
  const grid = buildGrid(tiles);
  const result: Tile[] = [];
  let score = 0;
  let moved = false;

  const isHoriz = direction === 'left' || direction === 'right';
  const reverse = direction === 'right' || direction === 'down';

  for (let major = 0; major < SIZE; major++) {
    // Collect tiles in this row/col
    const line: Tile[] = [];
    for (let minor = 0; minor < SIZE; minor++) {
      const r = isHoriz ? major : minor;
      const c = isHoriz ? minor : major;
      const t = grid[r][c];
      if (t) line.push(t);
    }
    if (reverse) line.reverse();

    // Merge pass
    const merged: { value: number; sources: Tile[]; wasMerged: boolean }[] = [];
    let i = 0;
    while (i < line.length) {
      if (i + 1 < line.length && line[i].value === line[i + 1].value) {
        const val = line[i].value * 2;
        merged.push({ value: val, sources: [line[i], line[i + 1]], wasMerged: true });
        score += val;
        i += 2;
      } else {
        merged.push({ value: line[i].value, sources: [line[i]], wasMerged: false });
        i++;
      }
    }

    // Place tiles
    const indices = reverse
      ? Array.from({ length: merged.length }, (_, k) => SIZE - 1 - k)
      : Array.from({ length: merged.length }, (_, k) => k);

    for (let k = 0; k < merged.length; k++) {
      const pos = indices[k];
      const r = isHoriz ? major : pos;
      const c = isHoriz ? pos : major;
      const src = merged[k].sources[0];

      if (src.row !== r || src.col !== c) moved = true;
      if (merged[k].wasMerged) moved = true;

      result.push({
        id: merged[k].wasMerged ? genId() : src.id,
        value: merged[k].value,
        row: r,
        col: c,
        isMerged: merged[k].wasMerged,
      });
    }
  }

  return { tiles: result, score, moved };
}

function canMove(tiles: Tile[]): boolean {
  const grid = buildGrid(tiles);
  if (tiles.length < SIZE * SIZE) return true;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c]?.value;
      if (c + 1 < SIZE && grid[r][c + 1]?.value === v) return true;
      if (r + 1 < SIZE && grid[r + 1][c]?.value === v) return true;
    }
  return false;
}

function hasWon(tiles: Tile[]): boolean {
  return tiles.some(t => t.value === 2048);
}

/* ── Tile colors ───────────────────────────────────────────── */
const TILE_COLORS: Record<number, { bg: string; color: string }> = {
  2:    { bg: '#eee4da', color: '#776e65' },
  4:    { bg: '#ede0c8', color: '#776e65' },
  8:    { bg: '#f2b179', color: '#f9f6f2' },
  16:   { bg: '#f59563', color: '#f9f6f2' },
  32:   { bg: '#f67c5f', color: '#f9f6f2' },
  64:   { bg: '#f65e3b', color: '#f9f6f2' },
  128:  { bg: '#edcf72', color: '#f9f6f2' },
  256:  { bg: '#edcc61', color: '#f9f6f2' },
  512:  { bg: '#edc850', color: '#f9f6f2' },
  1024: { bg: '#edc53f', color: '#f9f6f2' },
  2048: { bg: '#edc22e', color: '#f9f6f2' },
};

function getTileStyle(value: number): { backgroundColor: string; color: string } {
  const entry = TILE_COLORS[value] || { bg: '#3c3a32', color: '#f9f6f2' };
  return { backgroundColor: entry.bg, color: entry.color };
}

/* ── Component ─────────────────────────────────────────────── */
const ANIM_DURATION = 150; // ms – slide transition

const Game2048: React.FC = () => {
  const { colorScheme } = useDesktop();
  const scheme = getColorScheme(colorScheme);
  const containerRef = useRef<HTMLDivElement>(null);
  const movingRef = useRef(false);

  const [tiles, setTiles] = useState<Tile[]>(() => {
    nextTileId = 1;
    let t: Tile[] = [];
    t = spawnTile(t);
    t = spawnTile(t);
    return t;
  });
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    const saved = localStorage.getItem('fluxos-2048-best');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { containerRef.current?.focus(); }, []);

  const handleMove = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (gameOver || movingRef.current) return;

    setTiles(prev => {
      // Strip animation flags from previous render
      const clean = prev.map(t => ({ ...t, isNew: false, isMerged: false }));
      const result = slideTiles(clean, direction);
      if (!result.moved) return prev;

      movingRef.current = true;

      // Update score
      setScore(s => {
        const ns = s + result.score;
        if (ns > bestScore) {
          setBestScore(ns);
          localStorage.setItem('fluxos-2048-best', String(ns));
        }
        return ns;
      });

      // After slide animation, spawn new tile
      setTimeout(() => {
        setTiles(current => {
          const withNew = spawnTile(current);
          if (!keepPlaying && hasWon(withNew)) setWon(true);
          if (!canMove(withNew)) setGameOver(true);
          return withNew;
        });
        movingRef.current = false;
      }, ANIM_DURATION);

      return result.tiles;
    });
  }, [gameOver, bestScore, keepPlaying]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const keyMap: Record<string, 'left' | 'right' | 'up' | 'down'> = {
      ArrowLeft: 'left', ArrowRight: 'right',
      ArrowUp: 'up', ArrowDown: 'down',
      a: 'left', d: 'right', w: 'up', s: 'down',
    };
    const dir = keyMap[e.key];
    if (dir) { e.preventDefault(); handleMove(dir); }
  }, [handleMove]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) handleMove(dx > 0 ? 'right' : 'left');
    } else {
      if (Math.abs(dy) > 30) handleMove(dy > 0 ? 'down' : 'up');
    }
  }, [handleMove]);

  const resetGame = useCallback(() => {
    nextTileId = 1;
    let t: Tile[] = [];
    t = spawnTile(t);
    t = spawnTile(t);
    setTiles(t);
    setScore(0);
    setGameOver(false);
    setWon(false);
    setKeepPlaying(false);
    movingRef.current = false;
    containerRef.current?.focus();
  }, []);

  const continueAfterWin = useCallback(() => {
    setWon(false);
    setKeepPlaying(true);
    containerRef.current?.focus();
  }, []);

  // Board size constants for positioning (percentage-based)
  const gap = 2.4; // % gap between cells
  const cellSize = (100 - gap * 5) / 4; // % width/height of each cell

  return (
    <div
      className="game-2048"
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ '--accent': scheme.primary, '--accent-gradient': scheme.gradient } as React.CSSProperties}
    >
      <div className="g2048-header">
        <div className="g2048-title">2048</div>
        <div className="g2048-scores">
          <div className="g2048-score-box">
            <span className="g2048-score-label">Punkte</span>
            <span className="g2048-score-value">{score}</span>
          </div>
          <div className="g2048-score-box">
            <span className="g2048-score-label">Bestleistung</span>
            <span className="g2048-score-value">{bestScore}</span>
          </div>
        </div>
      </div>

      <div className="g2048-controls">
        <button className="g2048-btn" onClick={resetGame}>Neues Spiel</button>
        <span className="g2048-hint">Pfeiltasten / WASD zum Spielen</span>
      </div>

      <div className="g2048-board-wrapper">
        <div className="g2048-board">
          {/* Static background cells */}
          {Array.from({ length: SIZE * SIZE }).map((_, i) => (
            <div key={`cell-${i}`} className="g2048-cell" />
          ))}

          {/* Animated tiles */}
          {tiles.map(tile => {
            const style = getTileStyle(tile.value);
            const left = gap + tile.col * (cellSize + gap);
            const top = gap + tile.row * (cellSize + gap);
            return (
              <div
                key={tile.id}
                className={
                  'g2048-tile' +
                  (tile.isNew ? ' g2048-tile-new' : '') +
                  (tile.isMerged ? ' g2048-tile-merged' : '') +
                  (tile.value >= 128 ? ' g2048-tile-large' : '') +
                  (tile.value >= 1024 ? ' g2048-tile-xlarge' : '')
                }
                style={{
                  ...style,
                  width: `${cellSize}%`,
                  height: `${cellSize}%`,
                  left: `${left}%`,
                  top: `${top}%`,
                }}
              >
                {tile.value}
              </div>
            );
          })}
        </div>

        {won && !keepPlaying && (
          <div className="g2048-overlay g2048-won">
            <div className="g2048-overlay-content">
              <div className="g2048-overlay-title">🎉 Du hast gewonnen!</div>
              <div className="g2048-overlay-subtitle">2048 erreicht!</div>
              <div className="g2048-overlay-buttons">
                <button className="g2048-btn" onClick={continueAfterWin}>Weiterspielen</button>
                <button className="g2048-btn" onClick={resetGame}>Neues Spiel</button>
              </div>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="g2048-overlay g2048-lost">
            <div className="g2048-overlay-content">
              <div className="g2048-overlay-title">Spiel vorbei!</div>
              <div className="g2048-overlay-subtitle">Punkte: {score}</div>
              <button className="g2048-btn" onClick={resetGame}>Nochmal spielen</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Game2048;
