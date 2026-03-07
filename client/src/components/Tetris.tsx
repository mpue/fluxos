import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Tetris.css';

const COLS = 10;
const ROWS = 20;
const TICK_MS = 500;

type Cell = string | null;
type Board = Cell[][];

interface Piece {
  shape: number[][];
  color: string;
  x: number;
  y: number;
}

const PIECES: { shape: number[][]; color: string }[] = [
  { shape: [[1, 1, 1, 1]], color: '#00f0f0' },                    // I
  { shape: [[1, 0, 0], [1, 1, 1]], color: '#0000f0' },            // J
  { shape: [[0, 0, 1], [1, 1, 1]], color: '#f0a000' },            // L
  { shape: [[1, 1], [1, 1]], color: '#f0f000' },                   // O
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#00f000' },            // S
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#a000f0' },            // T
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' },            // Z
];

const createBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

const randomPiece = (): Piece => {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    shape: p.shape.map(r => [...r]),
    color: p.color,
    x: Math.floor((COLS - p.shape[0].length) / 2),
    y: 0,
  };
};

const rotate = (shape: number[][]): number[][] => {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = shape[r][c];
    }
  }
  return rotated;
};

const collides = (board: Board, piece: Piece): boolean => {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const nx = piece.x + c;
      const ny = piece.y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
};

const merge = (board: Board, piece: Piece): Board => {
  const newBoard = board.map(row => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const ny = piece.y + r;
      const nx = piece.x + c;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        newBoard[ny][nx] = piece.color;
      }
    }
  }
  return newBoard;
};

const clearLines = (board: Board): { board: Board; cleared: number } => {
  const remaining = board.filter(row => row.some(cell => !cell));
  const cleared = ROWS - remaining.length;
  const emptyRows: Board = Array.from({ length: cleared }, () => Array(COLS).fill(null));
  return { board: [...emptyRows, ...remaining], cleared };
};

const Tetris: React.FC = () => {
  const [board, setBoard] = useState<Board>(createBoard);
  const [current, setCurrent] = useState<Piece>(randomPiece);
  const [next, setNext] = useState<Piece>(randomPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);

  const boardRef = useRef(board);
  const currentRef = useRef(current);
  const nextRef = useRef(next);
  const gameOverRef = useRef(gameOver);
  const pausedRef = useRef(paused);
  const containerRef = useRef<HTMLDivElement>(null);

  boardRef.current = board;
  currentRef.current = current;
  nextRef.current = next;
  gameOverRef.current = gameOver;
  pausedRef.current = paused;

  const lockPiece = useCallback(() => {
    const merged = merge(boardRef.current, currentRef.current);
    const { board: clearedBoard, cleared } = clearLines(merged);
    setBoard(clearedBoard);

    const points = [0, 100, 300, 500, 800];
    setScore(s => s + (points[cleared] || 0) * level);
    setLines(l => {
      const newLines = l + cleared;
      setLevel(Math.floor(newLines / 10) + 1);
      return newLines;
    });

    const np = nextRef.current;
    const spawned: Piece = { ...np, x: Math.floor((COLS - np.shape[0].length) / 2), y: 0 };
    if (collides(clearedBoard, spawned)) {
      setGameOver(true);
    } else {
      setCurrent(spawned);
      setNext(randomPiece());
    }
  }, [level]);

  const moveDown = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    const moved = { ...currentRef.current, y: currentRef.current.y + 1 };
    if (collides(boardRef.current, moved)) {
      lockPiece();
    } else {
      setCurrent(moved);
    }
  }, [lockPiece]);

  const moveLeft = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    const moved = { ...currentRef.current, x: currentRef.current.x - 1 };
    if (!collides(boardRef.current, moved)) setCurrent(moved);
  }, []);

  const moveRight = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    const moved = { ...currentRef.current, x: currentRef.current.x + 1 };
    if (!collides(boardRef.current, moved)) setCurrent(moved);
  }, []);

  const rotatePiece = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    const rotated = { ...currentRef.current, shape: rotate(currentRef.current.shape) };
    if (!collides(boardRef.current, rotated)) {
      setCurrent(rotated);
    } else {
      // Wall kick: try shifting left/right
      const kickLeft = { ...rotated, x: rotated.x - 1 };
      const kickRight = { ...rotated, x: rotated.x + 1 };
      if (!collides(boardRef.current, kickLeft)) setCurrent(kickLeft);
      else if (!collides(boardRef.current, kickRight)) setCurrent(kickRight);
    }
  }, []);

  const hardDrop = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    let p = { ...currentRef.current };
    while (!collides(boardRef.current, { ...p, y: p.y + 1 })) {
      p = { ...p, y: p.y + 1 };
    }
    setCurrent(p);
    // Lock immediately on next tick
    const merged = merge(boardRef.current, p);
    const { board: clearedBoard, cleared } = clearLines(merged);
    setBoard(clearedBoard);

    const points = [0, 100, 300, 500, 800];
    setScore(s => s + (points[cleared] || 0) * level);
    setLines(l => {
      const newLines = l + cleared;
      setLevel(Math.floor(newLines / 10) + 1);
      return newLines;
    });

    const np = nextRef.current;
    const spawned: Piece = { ...np, x: Math.floor((COLS - np.shape[0].length) / 2), y: 0 };
    if (collides(clearedBoard, spawned)) {
      setGameOver(true);
    } else {
      setCurrent(spawned);
      setNext(randomPiece());
    }
  }, [level]);

  const resetGame = useCallback(() => {
    setBoard(createBoard());
    const p = randomPiece();
    setCurrent(p);
    setNext(randomPiece());
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
    setStarted(true);
    containerRef.current?.focus();
  }, []);

  // Game tick
  useEffect(() => {
    if (!started || gameOver || paused) return;
    const speed = Math.max(100, TICK_MS - (level - 1) * 40);
    const timer = setInterval(moveDown, speed);
    return () => clearInterval(timer);
  }, [started, gameOver, paused, level, moveDown]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!started || gameOver) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveRight();
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotatePiece();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setPaused(p => !p);
          break;
      }
    };
    const el = containerRef.current;
    if (el) {
      el.addEventListener('keydown', handler);
      return () => el.removeEventListener('keydown', handler);
    }
  }, [started, gameOver, moveLeft, moveRight, moveDown, rotatePiece, hardDrop]);

  // Ghost piece (preview of where piece will land)
  const getGhostY = (): number => {
    let ghostY = current.y;
    while (!collides(board, { ...current, y: ghostY + 1 })) {
      ghostY++;
    }
    return ghostY;
  };

  // Render the display board (board + current piece + ghost)
  const renderBoard = (): Cell[][] => {
    const display = board.map(row => [...row]);
    // Ghost
    const ghostY = getGhostY();
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (!current.shape[r][c]) continue;
        const ny = ghostY + r;
        const nx = current.x + c;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && !display[ny][nx]) {
          display[ny][nx] = current.color + '40'; // translucent
        }
      }
    }
    // Current piece
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (!current.shape[r][c]) continue;
        const ny = current.y + r;
        const nx = current.x + c;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
          display[ny][nx] = current.color;
        }
      }
    }
    return display;
  };

  // Render next piece preview
  const renderNext = (): Cell[][] => {
    const grid: Cell[][] = Array.from({ length: 4 }, () => Array(4).fill(null));
    const offy = Math.floor((4 - next.shape.length) / 2);
    const offx = Math.floor((4 - next.shape[0].length) / 2);
    for (let r = 0; r < next.shape.length; r++) {
      for (let c = 0; c < next.shape[r].length; c++) {
        if (next.shape[r][c]) {
          grid[offy + r][offx + c] = next.color;
        }
      }
    }
    return grid;
  };

  const display = started ? renderBoard() : board;

  return (
    <div className="tetris" ref={containerRef} tabIndex={0}>
      <div className="tetris-main">
        <div className="tetris-board">
          {display.map((row, ri) => (
            <div key={ri} className="tetris-row">
              {row.map((cell, ci) => (
                <div
                  key={ci}
                  className={`tetris-cell ${cell ? 'filled' : ''}`}
                  style={cell ? { background: cell, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.2), 0 0 4px ${cell}` } : undefined}
                />
              ))}
            </div>
          ))}
          {!started && !gameOver && (
            <div className="tetris-overlay">
              <div className="tetris-overlay-content">
                <div className="tetris-logo">🎮 TETRIS</div>
                <button className="tetris-start-btn" onClick={resetGame}>Spiel starten</button>
                <div className="tetris-controls-hint">
                  ← → Bewegen · ↑ Drehen · ↓ Schneller · Leertaste Drop · P Pause
                </div>
              </div>
            </div>
          )}
          {gameOver && (
            <div className="tetris-overlay">
              <div className="tetris-overlay-content">
                <div className="tetris-game-over">GAME OVER</div>
                <div className="tetris-final-score">Punkte: {score}</div>
                <button className="tetris-start-btn" onClick={resetGame}>Nochmal spielen</button>
              </div>
            </div>
          )}
          {paused && !gameOver && (
            <div className="tetris-overlay">
              <div className="tetris-overlay-content">
                <div className="tetris-paused">⏸ PAUSE</div>
                <button className="tetris-start-btn" onClick={() => { setPaused(false); containerRef.current?.focus(); }}>
                  Weiterspielen
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="tetris-sidebar">
          <div className="tetris-panel">
            <div className="tetris-panel-title">Nächstes</div>
            <div className="tetris-next-grid">
              {renderNext().map((row, ri) => (
                <div key={ri} className="tetris-next-row">
                  {row.map((cell, ci) => (
                    <div
                      key={ci}
                      className={`tetris-next-cell ${cell ? 'filled' : ''}`}
                      style={cell ? { background: cell } : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="tetris-panel">
            <div className="tetris-panel-title">Punkte</div>
            <div className="tetris-stat">{score}</div>
          </div>
          <div className="tetris-panel">
            <div className="tetris-panel-title">Reihen</div>
            <div className="tetris-stat">{lines}</div>
          </div>
          <div className="tetris-panel">
            <div className="tetris-panel-title">Level</div>
            <div className="tetris-stat">{level}</div>
          </div>
          <div className="tetris-panel tetris-controls">
            <div className="tetris-panel-title">Steuerung</div>
            <div className="tetris-control-row">← → Bewegen</div>
            <div className="tetris-control-row">↑ Drehen</div>
            <div className="tetris-control-row">↓ Schneller</div>
            <div className="tetris-control-row">⎵ Hard Drop</div>
            <div className="tetris-control-row">P Pause</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tetris;
