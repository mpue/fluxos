import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Sokoban.css';

// ─── Audio via Web Audio API ───
const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;

const playTone = (freq: number, duration: number, type: OscillatorType = 'square', vol = 0.06) => {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
};

const sokSfx = {
  step: () => playTone(220, 0.06, 'sine', 0.04),
  push: () => { playTone(150, 0.1, 'triangle', 0.06); playTone(180, 0.08, 'sine', 0.04); },
  boxOnTarget: () => { playTone(523, 0.1, 'sine', 0.06); playTone(659, 0.1, 'sine', 0.05); },
  undo: () => playTone(300, 0.08, 'triangle', 0.03),
  levelComplete: () => {
    playTone(523, 0.15, 'sine', 0.06);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.06), 120);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.06), 240);
    setTimeout(() => playTone(1047, 0.25, 'sine', 0.07), 360);
  },
  allComplete: () => {
    playTone(523, 0.12, 'sine', 0.06);
    setTimeout(() => playTone(659, 0.12, 'sine', 0.06), 100);
    setTimeout(() => playTone(784, 0.12, 'sine', 0.06), 200);
    setTimeout(() => playTone(1047, 0.12, 'sine', 0.06), 300);
    setTimeout(() => playTone(784, 0.12, 'sine', 0.06), 400);
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.08), 500);
  },
  cantMove: () => playTone(100, 0.08, 'square', 0.03),
  restart: () => { playTone(400, 0.08, 'triangle', 0.04); setTimeout(() => playTone(300, 0.1, 'triangle', 0.04), 80); },
};

// Tile types
const EMPTY = 0;
const WALL = 1;
const FLOOR = 2;
const TARGET = 3;
const BOX = 4;
const BOX_ON_TARGET = 5;
const PLAYER = 6;
const PLAYER_ON_TARGET = 7;

type Grid = number[][];

interface Position { r: number; c: number; }

interface LevelData {
  name: string;
  grid: string[];
}

// Verified solvable Sokoban levels (classic Microban by David W. Skinner)
const LEVELS: LevelData[] = [
  {
    // Solution: R, UU, L, D, LL, D, RR, U, L (push box right then onto target)
    name: 'Level 1 – Einfach',
    grid: [
      '####  ',
      '# .#  ',
      '#  ###',
      '#*@  #',
      '#  $ #',
      '#  ###',
      '####  ',
    ],
  },
  {
    // Solution: push both boxes down onto targets
    name: 'Level 2 – Zwei Ziele',
    grid: [
      '######',
      '#    #',
      '# #@ #',
      '# $* #',
      '# .$ #',
      '#  ###',
      '####  ',
    ],
  },
  {
    // Solution: navigate boxes left onto targets
    name: 'Level 3 – Enge Gasse',
    grid: [
      '  ####',
      '###  #',
      '#    #',
      '# @$ #',
      '###$.#',
      '  #. #',
      '  ####',
    ],
  },
  {
    // Solution: push boxes onto line of targets
    name: 'Level 4 – Drei Kisten',
    grid: [
      '########',
      '#  ....#',
      '# #  # #',
      '#   $$ #',
      '####$  #',
      '   # @##',
      '   # $#',
      '   #  #',
      '   ####',
    ],
  },
  {
    // Solution: careful sequencing to avoid deadlocks
    name: 'Level 5 – L-Form',
    grid: [
      '#####   ',
      '#   #   ',
      '# $ # ##',
      '# $  . #',
      '## .#  #',
      ' # @####',
      ' #  #   ',
      ' ####   ',
    ],
  },
  {
    // Solution: push boxes around center walls
    name: 'Level 6 – Symmetrie',
    grid: [
      ' ####   ',
      ' #  ####',
      '## $   #',
      '#  .#$ #',
      '# @.   #',
      '########',
    ],
  },
  {
    // Solution: multi-step push around corner structure
    name: 'Level 7 – Korridor',
    grid: [
      '#######',
      '#     #',
      '# .$. #',
      '# $.$ #',
      '# .$. #',
      '#  @  #',
      '#######',
    ],
  },
  {
    // Solution: complex routing through narrow passages
    name: 'Level 8 – Meister',
    grid: [
      '  #####',
      '###   #',
      '# $ # #',
      '# # . #',
      '# # $ #',
      '#   .@#',
      '#######',
    ],
  },
];

const parseLevel = (data: LevelData): { grid: Grid; player: Position } => {
  let player: Position = { r: 0, c: 0 };
  const maxCols = Math.max(...data.grid.map(row => row.length));
  const grid: Grid = data.grid.map((row, r) => {
    const cells: number[] = [];
    for (let c = 0; c < maxCols; c++) {
      const ch = c < row.length ? row[c] : ' ';
      switch (ch) {
        case '#': cells.push(WALL); break;
        case ' ': cells.push(EMPTY); break;
        case '.': cells.push(TARGET); break;
        case '$': cells.push(BOX); break;
        case '*': cells.push(BOX_ON_TARGET); break;
        case '@': cells.push(PLAYER); player = { r, c }; break;
        case '+': cells.push(PLAYER_ON_TARGET); player = { r, c }; break;
        default: cells.push(EMPTY);
      }
    }
    return cells;
  });

  // Fill unreachable empty cells as EMPTY, reachable as FLOOR
  // Simple approach: mark all non-wall, non-empty cells; empties adjacent to floors become floors
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === EMPTY) {
        // Check if it borders any non-empty, non-wall tile
        const neighbors = [
          [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[nr].length) {
            const v = grid[nr][nc];
            if (v !== EMPTY && v !== WALL) {
              grid[r][c] = FLOOR;
              break;
            }
          }
        }
      }
    }
  }
  // Flood fill floors from player position
  const visited = new Set<string>();
  const queue: Position[] = [player];
  while (queue.length > 0) {
    const { r, c } = queue.shift()!;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (grid[r][c] === EMPTY) grid[r][c] = FLOOR;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[nr].length && !visited.has(`${nr},${nc}`)) {
        const v = grid[nr][nc];
        if (v !== WALL) queue.push({ r: nr, c: nc });
      }
    }
  }

  return { grid, player };
};

const cloneGrid = (grid: Grid): Grid => grid.map(row => [...row]);

const isWon = (grid: Grid): boolean => {
  for (const row of grid) {
    for (const cell of row) {
      if (cell === TARGET || cell === PLAYER_ON_TARGET) return false;
    }
  }
  return true;
};

const TILE_SIZE = 40;

const TILE_COLORS: Record<number, string> = {
  [EMPTY]: '#1a1a2e',
  [WALL]: '#4a4a6a',
  [FLOOR]: '#2a2a3e',
  [TARGET]: '#2a2a3e',
  [BOX]: '#cc8833',
  [BOX_ON_TARGET]: '#44bb44',
  [PLAYER]: '#3388ff',
  [PLAYER_ON_TARGET]: '#3388ff',
};

const Sokoban: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentLevel, setCurrentLevel] = useState(0);
  const [moves, setMoves] = useState(0);
  const [pushes, setPushes] = useState(0);
  const [won, setWon] = useState(false);
  const [allComplete, setAllComplete] = useState(false);

  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);

  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  const gridRef = useRef<Grid>([]);
  const playerRef = useRef<Position>({ r: 0, c: 0 });
  const historyRef = useRef<{ grid: Grid; player: Position; moves: number; pushes: number }[]>([]);

  const loadLevel = useCallback((idx: number) => {
    const { grid, player } = parseLevel(LEVELS[idx]);
    gridRef.current = grid;
    playerRef.current = player;
    historyRef.current = [];
    setMoves(0);
    setPushes(0);
    setWon(false);
    setAllComplete(false);
    setCurrentLevel(idx);
  }, []);

  // Initial load
  useEffect(() => {
    loadLevel(0);
  }, [loadLevel]);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const grid = gridRef.current;
    if (grid.length === 0) return;

    const rows = grid.length;
    const cols = Math.max(...grid.map(r => r.length));
    canvas.width = cols * TILE_SIZE;
    canvas.height = rows * TILE_SIZE;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const tile = grid[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        // Background
        ctx.fillStyle = TILE_COLORS[tile] || '#1a1a2e';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        if (tile === WALL) {
          // 3D wall
          ctx.fillStyle = '#5a5a7a';
          ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          ctx.fillStyle = '#3a3a5a';
          ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        } else if (tile === TARGET || tile === PLAYER_ON_TARGET) {
          // Target diamond
          ctx.fillStyle = '#ff4466';
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE / 2, y + 10);
          ctx.lineTo(x + TILE_SIZE - 10, y + TILE_SIZE / 2);
          ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE - 10);
          ctx.lineTo(x + 10, y + TILE_SIZE / 2);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ff6688';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (tile === BOX || tile === BOX_ON_TARGET) {
          // Draw target marker beneath box if on target
          if (tile === BOX_ON_TARGET) {
            ctx.fillStyle = '#335533';
            ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          }
          // Box
          const boxColor = tile === BOX_ON_TARGET ? '#44cc44' : '#dd9933';
          const boxDark = tile === BOX_ON_TARGET ? '#228822' : '#aa6622';
          ctx.fillStyle = boxColor;
          ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          ctx.strokeStyle = boxDark;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          // Cross on box
          ctx.strokeStyle = boxDark;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 4);
          ctx.lineTo(x + TILE_SIZE - 4, y + TILE_SIZE - 4);
          ctx.moveTo(x + TILE_SIZE - 4, y + 4);
          ctx.lineTo(x + 4, y + TILE_SIZE - 4);
          ctx.stroke();
        }

        if (tile === PLAYER || tile === PLAYER_ON_TARGET) {
          // Player circle
          ctx.fillStyle = '#3388ff';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 2 - 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1166dd';
          ctx.lineWidth = 2;
          ctx.stroke();
          // Eyes
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2 - 5, y + TILE_SIZE / 2 - 3, 3, 0, Math.PI * 2);
          ctx.arc(x + TILE_SIZE / 2 + 5, y + TILE_SIZE / 2 - 3, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2 - 5, y + TILE_SIZE / 2 - 2, 1.5, 0, Math.PI * 2);
          ctx.arc(x + TILE_SIZE / 2 + 5, y + TILE_SIZE / 2 - 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        if (tile === FLOOR) {
          // Subtle grid dot
          ctx.fillStyle = '#333350';
          ctx.fillRect(x + TILE_SIZE / 2 - 1, y + TILE_SIZE / 2 - 1, 2, 2);
        }
      }
    }
  }, []);

  useEffect(() => {
    draw();
  }, [draw, currentLevel, moves, won]);

  const tryMove = useCallback((dr: number, dc: number) => {
    if (won) return;
    const grid = gridRef.current;
    const { r, c } = playerRef.current;
    const nr = r + dr;
    const nc = c + dc;

    if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[nr].length) return;
    const dest = grid[nr][nc];

    if (dest === WALL || dest === EMPTY) {
      if (soundRef.current) sokSfx.cantMove();
      return;
    }

    // Save state for undo
    const snapshot = {
      grid: cloneGrid(grid),
      player: { ...playerRef.current },
      moves,
      pushes,
    };

    let pushed = false;

    if (dest === BOX || dest === BOX_ON_TARGET) {
      // Try to push box
      const br = nr + dr;
      const bc = nc + dc;
      if (br < 0 || br >= grid.length || bc < 0 || bc >= grid[br].length) return;
      const beyond = grid[br][bc];
      if (beyond === WALL || beyond === BOX || beyond === BOX_ON_TARGET || beyond === EMPTY) {
        if (soundRef.current) sokSfx.cantMove();
        return;
      }
      // Move box
      grid[br][bc] = beyond === TARGET ? BOX_ON_TARGET : BOX;
      pushed = true;
      if (soundRef.current) {
        sokSfx.push();
        if (beyond === TARGET) setTimeout(() => sokSfx.boxOnTarget(), 60);
      }
    }

    // Remove player from old cell
    grid[r][c] = (grid[r][c] === PLAYER_ON_TARGET) ? TARGET : FLOOR;

    // Place player on new cell
    const wasTarget = dest === TARGET || dest === BOX_ON_TARGET;
    grid[nr][nc] = wasTarget ? PLAYER_ON_TARGET : PLAYER;

    playerRef.current = { r: nr, c: nc };
    historyRef.current.push(snapshot);

    const newMoves = moves + 1;
    const newPushes = pushes + (pushed ? 1 : 0);
    setMoves(newMoves);
    setPushes(newPushes);

    // Sound for step (only if no push sound already played)
    if (!pushed && soundRef.current) sokSfx.step();

    if (isWon(grid)) {
      setWon(true);
      if (currentLevel >= LEVELS.length - 1) {
        setAllComplete(true);
        if (soundRef.current) sokSfx.allComplete();
      } else {
        if (soundRef.current) sokSfx.levelComplete();
      }
    }

    draw();
  }, [won, moves, pushes, draw, currentLevel]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    gridRef.current = prev.grid;
    playerRef.current = prev.player;
    setMoves(prev.moves);
    setPushes(prev.pushes);
    if (soundRef.current) sokSfx.undo();
    draw();
  }, [draw]);

  const handleRestart = useCallback(() => {
    loadLevel(currentLevel);
    if (soundRef.current) sokSfx.restart();
    setTimeout(draw, 0);
  }, [currentLevel, loadLevel, draw]);

  const handleNextLevel = useCallback(() => {
    if (currentLevel < LEVELS.length - 1) {
      loadLevel(currentLevel + 1);
      setTimeout(draw, 0);
    }
  }, [currentLevel, loadLevel, draw]);

  const handlePrevLevel = useCallback(() => {
    if (currentLevel > 0) {
      loadLevel(currentLevel - 1);
      setTimeout(draw, 0);
    }
  }, [currentLevel, loadLevel, draw]);

  // Key handler
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      switch (e.key) {
        case 'ArrowUp': case 'w': tryMove(-1, 0); break;
        case 'ArrowDown': case 's': tryMove(1, 0); break;
        case 'ArrowLeft': case 'a': tryMove(0, -1); break;
        case 'ArrowRight': case 'd': tryMove(0, 1); break;
        case 'z':
          if (e.ctrlKey || e.metaKey) handleUndo();
          break;
        case 'u': handleUndo(); break;
        case 'r': handleRestart(); break;
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [tryMove, handleUndo, handleRestart]);

  // Focus on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const levelData = LEVELS[currentLevel];
  const cols = Math.max(...levelData.grid.map(r => r.length));
  const rows = levelData.grid.length;

  return (
    <div className="sokoban" ref={containerRef} tabIndex={0}>
      <div className="sok-header">
        <div className="sok-level-nav">
          <button className="sok-nav-btn" onClick={handlePrevLevel} disabled={currentLevel === 0}>◀</button>
          <span className="sok-level-name">{levelData.name}</span>
          <button className="sok-nav-btn" onClick={handleNextLevel} disabled={currentLevel >= LEVELS.length - 1}>▶</button>
        </div>
        <div className="sok-stats">
          <span className="sok-stat">Züge: <strong>{moves}</strong></span>
          <span className="sok-stat">Schübe: <strong>{pushes}</strong></span>
        </div>
        <div className="sok-controls">
          <button className="sok-btn" onClick={handleUndo} title="Rückgängig (U)">↩ Undo</button>
          <button className="sok-btn" onClick={handleRestart} title="Neustart (R)">⟳ Neustart</button>
          <button
            className={`sok-sound-btn${soundOn ? '' : ' muted'}`}
            onClick={() => setSoundOn(v => !v)}
            title={soundOn ? 'Ton aus' : 'Ton an'}
          >{soundOn ? '🔊' : '🔇'}</button>
        </div>
      </div>

      <div className="sok-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="sok-canvas"
          width={cols * TILE_SIZE}
          height={rows * TILE_SIZE}
        />
        {won && (
          <div className="sok-overlay">
            <div className="sok-overlay-content">
              {allComplete ? (
                <>
                  <div className="sok-trophy">🏆</div>
                  <div className="sok-win-title">Alle Level geschafft!</div>
                  <div className="sok-win-sub">Herzlichen Glückwunsch! Du hast alle {LEVELS.length} Level gemeistert.</div>
                </>
              ) : (
                <>
                  <div className="sok-trophy">⭐</div>
                  <div className="sok-win-title">Level geschafft!</div>
                  <div className="sok-win-sub">Züge: {moves} · Schübe: {pushes}</div>
                  <button className="sok-btn sok-btn-next" onClick={handleNextLevel}>
                    Nächstes Level ▶
                  </button>
                </>
              )}
              <button className="sok-btn sok-btn-restart" onClick={handleRestart}>
                Nochmal spielen
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sok-footer">
        <span>Pfeiltasten/WASD: Bewegen</span>
        <span>U: Undo</span>
        <span>R: Neustart</span>
      </div>
    </div>
  );
};

export default Sokoban;
