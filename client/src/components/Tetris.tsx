import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Tetris.css';

// ─── Chiptune Audio Engine ──────────────────────────────────────────────────

class TetrisAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private playing = false;
  private _muted = false;
  private melodyIdx = 0;
  private bassIdx = 0;
  private melodyTime = 0;
  private bassTime = 0;
  private schedulerTimer: ReturnType<typeof setTimeout> | null = null;

  private static FREQ: Record<string, number> = {
    'C2':65.41,'D2':73.42,'E2':82.41,'F2':87.31,'G2':98.00,'A2':110.00,'B2':123.47,
    'C3':130.81,'D3':146.83,'E3':164.81,'F3':174.61,'Fs3':185.00,'G3':196.00,'A3':220.00,'B3':246.94,
    'C4':261.63,'D4':293.66,'E4':329.63,'F4':349.23,'Fs4':369.99,'G4':392.00,'A4':440.00,'B4':493.88,
    'C5':523.25,'D5':587.33,'E5':659.26,'G5':783.99,'A5':880.00,'C6':1046.50,
  };

  // Melody: [note, duration_in_8th_notes] — 64 eighth notes total
  private melody: [string, number][] = [
    ['E4',2],['B4',1],['A4',1],['G4',1],['A4',1],['B4',1],['E4',1],
    ['D4',1],['E4',1],['G4',2],['A4',1],['G4',1],['E4',2],
    ['D4',2],['A4',1],['G4',1],['Fs4',1],['G4',1],['A4',1],['D4',1],
    ['E4',2],['G4',1],['E4',1],['D4',1],['E4',1],['G4',2],
    ['E4',2],['B4',1],['A4',1],['G4',1],['A4',1],['B4',2],
    ['C5',1],['B4',1],['A4',2],['G4',1],['A4',1],['B4',2],
    ['A4',2],['G4',1],['E4',1],['D4',1],['E4',1],['G4',1],['A4',1],
    ['E4',4],['E4',2],['D4',2],
  ];

  // Bass: [note, duration_in_8th_notes] — 64 eighth notes total
  private bass: [string, number][] = [
    ['E2',2],['E3',2],['E2',2],['E3',2],
    ['C3',2],['C2',2],['C3',2],['C2',2],
    ['D3',2],['D2',2],['D3',2],['D2',2],
    ['E2',2],['E3',2],['E2',2],['E3',2],
    ['E2',2],['E3',2],['E2',2],['E3',2],
    ['A2',2],['A3',2],['A2',2],['A3',2],
    ['A2',2],['A3',2],['D3',2],['D2',2],
    ['E2',4],['E3',4],
  ];

  private eighthNote = 60 / 150 / 2; // 150 BPM → 0.2s per 8th note

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._muted ? 0 : 0.5;
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.4;
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(this.masterGain);
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, dest: GainNode, vol = 0.3) {
    if (!this.ctx || freq <= 0) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur * 0.95);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur);
  }

  private scheduleNotes() {
    if (!this.ctx || !this.musicGain) return;
    const ahead = 0.2;
    const now = this.ctx.currentTime;

    while (this.melodyTime < now + ahead) {
      const [note, dur] = this.melody[this.melodyIdx % this.melody.length];
      const freq = TetrisAudio.FREQ[note] || 0;
      const len = dur * this.eighthNote;
      if (freq > 0) {
        this.tone(freq, this.melodyTime, len * 0.85, 'square', this.musicGain, 0.18);
        this.tone(freq * 1.005, this.melodyTime, len * 0.85, 'square', this.musicGain, 0.07);
      }
      this.melodyTime += len;
      this.melodyIdx++;
    }

    while (this.bassTime < now + ahead) {
      const [note, dur] = this.bass[this.bassIdx % this.bass.length];
      const freq = TetrisAudio.FREQ[note] || 0;
      const len = dur * this.eighthNote;
      if (freq > 0) {
        this.tone(freq, this.bassTime, len * 0.9, 'triangle', this.musicGain, 0.25);
      }
      this.bassTime += len;
      this.bassIdx++;
    }
  }

  private scheduler = () => {
    if (!this.playing) return;
    this.scheduleNotes();
    this.schedulerTimer = setTimeout(this.scheduler, 50);
  };

  startMusic() {
    if (this.playing) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.playing = true;
    this.melodyIdx = 0;
    this.bassIdx = 0;
    this.melodyTime = this.ctx.currentTime + 0.1;
    this.bassTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  stopMusic() {
    this.playing = false;
    if (this.schedulerTimer) { clearTimeout(this.schedulerTimer); this.schedulerTimer = null; }
  }

  pauseMusic() { this.stopMusic(); }

  resumeMusic() {
    if (!this.ctx) return;
    this.playing = true;
    this.melodyTime = this.ctx.currentTime + 0.1;
    this.bassTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  get muted() { return this._muted; }
  setMuted(m: boolean) {
    this._muted = m;
    if (this.masterGain) this.masterGain.gain.value = m ? 0 : 0.5;
  }

  // ── Sound Effects ──

  playMove() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    this.tone(180, this.ctx.currentTime, 0.05, 'square', this.sfxGain, 0.15);
  }

  playRotate() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    this.tone(350, t, 0.06, 'square', this.sfxGain, 0.15);
    this.tone(440, t + 0.03, 0.06, 'square', this.sfxGain, 0.12);
  }

  playDrop() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playLineClear(count: number) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    if (count >= 4) {
      [523.25, 659.26, 783.99, 1046.50, 1318.51].forEach((f, i) =>
        this.tone(f, t + i * 0.08, 0.2, 'square', this.sfxGain!, 0.2));
    } else {
      [440, 554.37, 659.26].slice(0, count + 1).forEach((f, i) =>
        this.tone(f, t + i * 0.06, 0.15, 'square', this.sfxGain!, 0.18));
    }
  }

  playLevelUp() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [523.25, 659.26, 783.99, 1046.50].forEach((f, i) =>
      this.tone(f, t + i * 0.1, 0.15, 'square', this.sfxGain!, 0.2));
  }

  playGameOver() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [440, 392, 349.23, 293.66, 261.63, 220, 196, 174.61].forEach((f, i) =>
      this.tone(f, t + i * 0.15, 0.25, 'square', this.sfxGain!, 0.2));
  }

  destroy() {
    this.stopMusic();
    this.ctx?.close();
    this.ctx = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const audioRef = useRef(new TetrisAudio());
  const [muted, setMuted] = useState(false);

  boardRef.current = board;
  currentRef.current = current;
  nextRef.current = next;
  gameOverRef.current = gameOver;
  pausedRef.current = paused;

  const lockPiece = useCallback(() => {
    const merged = merge(boardRef.current, currentRef.current);
    const { board: clearedBoard, cleared } = clearLines(merged);
    setBoard(clearedBoard);
    if (cleared > 0) audioRef.current?.playLineClear(cleared);

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
      audioRef.current?.stopMusic();
      audioRef.current?.playGameOver();
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
    if (!collides(boardRef.current, moved)) { setCurrent(moved); audioRef.current?.playMove(); }
  }, []);

  const moveRight = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    const moved = { ...currentRef.current, x: currentRef.current.x + 1 };
    if (!collides(boardRef.current, moved)) { setCurrent(moved); audioRef.current?.playMove(); }
  }, []);

  const rotatePiece = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    const rotated = { ...currentRef.current, shape: rotate(currentRef.current.shape) };
    if (!collides(boardRef.current, rotated)) {
      setCurrent(rotated);
      audioRef.current?.playRotate();
    } else {
      // Wall kick: try shifting left/right
      const kickLeft = { ...rotated, x: rotated.x - 1 };
      const kickRight = { ...rotated, x: rotated.x + 1 };
      if (!collides(boardRef.current, kickLeft)) { setCurrent(kickLeft); audioRef.current?.playRotate(); }
      else if (!collides(boardRef.current, kickRight)) { setCurrent(kickRight); audioRef.current?.playRotate(); }
    }
  }, []);

  const hardDrop = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    audioRef.current?.playDrop();
    let p = { ...currentRef.current };
    while (!collides(boardRef.current, { ...p, y: p.y + 1 })) {
      p = { ...p, y: p.y + 1 };
    }
    setCurrent(p);
    // Lock immediately on next tick
    const merged = merge(boardRef.current, p);
    const { board: clearedBoard, cleared } = clearLines(merged);
    setBoard(clearedBoard);
    if (cleared > 0) audioRef.current?.playLineClear(cleared);

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
      audioRef.current?.stopMusic();
      audioRef.current?.playGameOver();
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
    audioRef.current?.stopMusic();
    audioRef.current?.startMusic();
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
          setPaused(p => {
            if (!p) audioRef.current?.pauseMusic();
            else audioRef.current?.resumeMusic();
            return !p;
          });
          break;
      }
    };
    const el = containerRef.current;
    if (el) {
      el.addEventListener('keydown', handler);
      return () => el.removeEventListener('keydown', handler);
    }
  }, [started, gameOver, moveLeft, moveRight, moveDown, rotatePiece, hardDrop]);

  // Audio cleanup
  useEffect(() => {
    const audio = audioRef.current;
    return () => { audio?.destroy(); };
  }, []);

  // Level up SFX
  useEffect(() => {
    if (level > 1 && started && !gameOver) {
      audioRef.current?.playLevelUp();
    }
  }, [level, started, gameOver]);

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
                <button className="tetris-start-btn" onClick={() => { setPaused(false); audioRef.current?.resumeMusic(); containerRef.current?.focus(); }}>
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
          <div className="tetris-panel">
            <div className="tetris-panel-title">Sound</div>
            <button
              className="tetris-mute-btn"
              onClick={() => { const m = !muted; setMuted(m); audioRef.current?.setMuted(m); }}
            >
              {muted ? '🔇 Stumm' : '🔊 An'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tetris;
