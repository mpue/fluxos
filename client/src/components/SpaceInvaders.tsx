import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SpaceInvaders.css';

// ─── Audio via Web Audio API ───
const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;

const playTone = (freq: number, duration: number, type: OscillatorType = 'square', vol = 0.08) => {
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

const sfx = {
  shoot: () => playTone(880, 0.1, 'square', 0.06),
  hit: () => { playTone(200, 0.15, 'sawtooth', 0.08); playTone(120, 0.2, 'square', 0.06); },
  explode: () => { playTone(80, 0.3, 'sawtooth', 0.1); playTone(60, 0.4, 'square', 0.08); },
  playerHit: () => { playTone(300, 0.1, 'sawtooth', 0.1); setTimeout(() => playTone(150, 0.3, 'sawtooth', 0.1), 100); },
  levelUp: () => { playTone(523, 0.1, 'square', 0.06); setTimeout(() => playTone(659, 0.1, 'square', 0.06), 100); setTimeout(() => playTone(784, 0.15, 'square', 0.06), 200); },
  gameOver: () => { playTone(400, 0.2, 'sawtooth', 0.1); setTimeout(() => playTone(300, 0.2, 'sawtooth', 0.1), 200); setTimeout(() => playTone(200, 0.4, 'sawtooth', 0.1), 400); },
  march: (step: number) => playTone(step % 2 === 0 ? 100 : 80, 0.05, 'square', 0.04),
};

// ─── Game constants ───
const W = 400;
const H = 500;
const PLAYER_W = 40;
const PLAYER_H = 20;
const PLAYER_Y = H - 40;
const BULLET_SPEED = 6;
const ENEMY_BULLET_SPEED = 3;
const PLAYER_SPEED = 5;
const INVADER_W = 30;
const INVADER_H = 20;
const INVADER_COLS = 8;
const INVADER_ROWS = 4;
const INVADER_GAP_X = 10;
const INVADER_GAP_Y = 10;

interface Bullet { x: number; y: number; }
interface Invader { x: number; y: number; alive: boolean; type: number; }

const createInvaders = (offsetY: number = 40): Invader[] => {
  const invaders: Invader[] = [];
  const totalW = INVADER_COLS * (INVADER_W + INVADER_GAP_X) - INVADER_GAP_X;
  const startX = (W - totalW) / 2;
  for (let r = 0; r < INVADER_ROWS; r++) {
    for (let c = 0; c < INVADER_COLS; c++) {
      invaders.push({
        x: startX + c * (INVADER_W + INVADER_GAP_X),
        y: offsetY + r * (INVADER_H + INVADER_GAP_Y),
        alive: true,
        type: r,
      });
    }
  }
  return invaders;
};

const SpaceInvaders: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [highScore, setHighScore] = useState(0);
  const [soundOn, setSoundOn] = useState(true);

  // Refs for game state accessed in animation loop
  const stateRef = useRef({
    playerX: W / 2 - PLAYER_W / 2,
    bullets: [] as Bullet[],
    enemyBullets: [] as Bullet[],
    invaders: createInvaders(),
    invaderDx: 1,
    invaderSpeed: 0.15,
    moveTimer: 0,
    shootTimer: 0,
    marchStep: 0,
    keys: {} as Record<string, boolean>,
    score: 0,
    lives: 3,
    level: 1,
    gameState: 'menu' as string,
    soundOn: true,
    explosions: [] as { x: number; y: number; frame: number }[],
  });

  // Sync React state → ref
  useEffect(() => { stateRef.current.gameState = gameState; }, [gameState]);
  useEffect(() => { stateRef.current.soundOn = soundOn; }, [soundOn]);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.playerX = W / 2 - PLAYER_W / 2;
    s.bullets = [];
    s.enemyBullets = [];
    s.invaders = createInvaders();
    s.invaderDx = 1;
    s.invaderSpeed = 0.15;
    s.moveTimer = 0;
    s.shootTimer = 0;
    s.marchStep = 0;
    s.score = 0;
    s.lives = 3;
    s.level = 1;
    s.explosions = [];
    setScore(0);
    setLives(3);
    setLevel(1);
    setGameState('playing');
    containerRef.current?.focus();
  }, []);

  const nextLevel = useCallback(() => {
    const s = stateRef.current;
    s.level++;
    s.bullets = [];
    s.enemyBullets = [];
    s.invaders = createInvaders();
    s.invaderDx = 1;
    s.invaderSpeed = 0.15 + s.level * 0.06;
    s.moveTimer = 0;
    s.shootTimer = 0;
    s.explosions = [];
    setLevel(s.level);
    if (s.soundOn) sfx.levelUp();
  }, []);

  // Key handlers
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const down = (e: KeyboardEvent) => {
      e.preventDefault();
      stateRef.current.keys[e.key] = true;
    };
    const up = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key] = false;
    };
    el.addEventListener('keydown', down);
    el.addEventListener('keyup', up);
    return () => { el.removeEventListener('keydown', down); el.removeEventListener('keyup', up); };
  }, []);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let lastShot = 0;

    const loop = () => {
      const s = stateRef.current;
      animRef.current = requestAnimationFrame(loop);

      // Clear
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      if (s.gameState !== 'playing') return;

      // ─── Input ───
      if (s.keys['ArrowLeft'] || s.keys['a']) s.playerX = Math.max(0, s.playerX - PLAYER_SPEED);
      if (s.keys['ArrowRight'] || s.keys['d']) s.playerX = Math.min(W - PLAYER_W, s.playerX + PLAYER_SPEED);
      if (s.keys[' '] || s.keys['ArrowUp']) {
        const now = Date.now();
        if (now - lastShot > 300) {
          s.bullets.push({ x: s.playerX + PLAYER_W / 2 - 2, y: PLAYER_Y - 5 });
          if (s.soundOn) sfx.shoot();
          lastShot = now;
        }
      }

      // ─── Invader movement ───
      s.moveTimer += s.invaderSpeed;
      if (s.moveTimer >= 1) {
        s.moveTimer = 0;
        let hitEdge = false;
        const alive = s.invaders.filter(i => i.alive);
        for (const inv of alive) {
          inv.x += s.invaderDx * 10;
          if (inv.x <= 0 || inv.x + INVADER_W >= W) hitEdge = true;
        }
        if (hitEdge) {
          s.invaderDx *= -1;
          for (const inv of alive) inv.y += 15;
        }
        s.marchStep++;
        if (s.soundOn) sfx.march(s.marchStep);

        // Check if invaders reached player
        for (const inv of alive) {
          if (inv.y + INVADER_H >= PLAYER_Y) {
            s.gameState = 'gameover';
            setGameState('gameover');
            if (s.soundOn) sfx.gameOver();
            if (s.score > highScore) setHighScore(s.score);
            return;
          }
        }
      }

      // ─── Enemy shooting ───
      s.shootTimer++;
      const shootInterval = Math.max(30, 80 - s.level * 5);
      if (s.shootTimer >= shootInterval) {
        s.shootTimer = 0;
        const alive = s.invaders.filter(i => i.alive);
        if (alive.length > 0) {
          const shooter = alive[Math.floor(Math.random() * alive.length)];
          s.enemyBullets.push({ x: shooter.x + INVADER_W / 2, y: shooter.y + INVADER_H });
        }
      }

      // ─── Update bullets ───
      s.bullets = s.bullets.filter(b => { b.y -= BULLET_SPEED; return b.y > -10; });
      s.enemyBullets = s.enemyBullets.filter(b => { b.y += ENEMY_BULLET_SPEED; return b.y < H + 10; });

      // ─── Collision: player bullets → invaders ───
      for (let bi = s.bullets.length - 1; bi >= 0; bi--) {
        const b = s.bullets[bi];
        for (const inv of s.invaders) {
          if (!inv.alive) continue;
          if (b.x >= inv.x && b.x <= inv.x + INVADER_W && b.y >= inv.y && b.y <= inv.y + INVADER_H) {
            inv.alive = false;
            s.bullets.splice(bi, 1);
            const pts = (INVADER_ROWS - inv.type) * 10;
            s.score += pts;
            setScore(s.score);
            s.explosions.push({ x: inv.x + INVADER_W / 2, y: inv.y + INVADER_H / 2, frame: 0 });
            if (s.soundOn) sfx.hit();
            break;
          }
        }
      }

      // ─── Collision: enemy bullets → player ───
      for (let bi = s.enemyBullets.length - 1; bi >= 0; bi--) {
        const b = s.enemyBullets[bi];
        if (b.x >= s.playerX && b.x <= s.playerX + PLAYER_W && b.y >= PLAYER_Y && b.y <= PLAYER_Y + PLAYER_H) {
          s.enemyBullets.splice(bi, 1);
          s.lives--;
          setLives(s.lives);
          if (s.soundOn) sfx.playerHit();
          if (s.lives <= 0) {
            s.gameState = 'gameover';
            setGameState('gameover');
            if (s.soundOn) sfx.gameOver();
            if (s.score > highScore) setHighScore(s.score);
            return;
          }
        }
      }

      // ─── Check level complete ───
      if (s.invaders.every(i => !i.alive)) {
        nextLevel();
      }

      // ─── Draw ───

      // Stars background
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 50; i++) {
        const sx = (i * 97 + s.marchStep * 0.3) % W;
        const sy = (i * 53 + i * i * 7) % H;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Player ship
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.moveTo(s.playerX + PLAYER_W / 2, PLAYER_Y - 5);
      ctx.lineTo(s.playerX, PLAYER_Y + PLAYER_H);
      ctx.lineTo(s.playerX + PLAYER_W, PLAYER_Y + PLAYER_H);
      ctx.closePath();
      ctx.fill();
      // Cockpit
      ctx.fillStyle = '#00cc00';
      ctx.fillRect(s.playerX + PLAYER_W / 2 - 3, PLAYER_Y + 2, 6, 8);

      // Player bullets
      ctx.fillStyle = '#ffff00';
      for (const b of s.bullets) {
        ctx.fillRect(b.x, b.y, 4, 10);
      }

      // Enemy bullets
      ctx.fillStyle = '#ff4444';
      for (const b of s.enemyBullets) {
        ctx.fillRect(b.x - 1, b.y, 3, 8);
      }

      // Invaders
      const invColors = ['#ff4444', '#ff8800', '#ffcc00', '#44ff44'];
      for (const inv of s.invaders) {
        if (!inv.alive) continue;
        ctx.fillStyle = invColors[inv.type % invColors.length];
        // Body
        ctx.fillRect(inv.x + 4, inv.y + 2, INVADER_W - 8, INVADER_H - 6);
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(inv.x + 8, inv.y + 5, 4, 4);
        ctx.fillRect(inv.x + INVADER_W - 12, inv.y + 5, 4, 4);
        // Arms (alternate based on march step)
        ctx.fillStyle = invColors[inv.type % invColors.length];
        if (s.marchStep % 2 === 0) {
          ctx.fillRect(inv.x, inv.y + 4, 4, 6);
          ctx.fillRect(inv.x + INVADER_W - 4, inv.y + 4, 4, 6);
        } else {
          ctx.fillRect(inv.x, inv.y + 8, 4, 6);
          ctx.fillRect(inv.x + INVADER_W - 4, inv.y, 4, 6);
        }
      }

      // Explosions
      for (let i = s.explosions.length - 1; i >= 0; i--) {
        const ex = s.explosions[i];
        ex.frame++;
        const r = ex.frame * 2;
        ctx.strokeStyle = `rgba(255, ${200 - ex.frame * 20}, 0, ${1 - ex.frame / 10})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.stroke();
        // Particles
        for (let p = 0; p < 6; p++) {
          const angle = (p / 6) * Math.PI * 2;
          const px = ex.x + Math.cos(angle) * r * 1.5;
          const py = ex.y + Math.sin(angle) * r * 1.5;
          ctx.fillStyle = `rgba(255, ${150 + p * 20}, 0, ${1 - ex.frame / 10})`;
          ctx.fillRect(px - 1, py - 1, 2, 2);
        }
        if (ex.frame > 10) s.explosions.splice(i, 1);
      }

      // HUD line
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H - 15);
      ctx.lineTo(W, H - 15);
      ctx.stroke();
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, highScore, nextLevel]);

  return (
    <div className="space-invaders" ref={containerRef} tabIndex={0}>
      <div className="si-hud">
        <div className="si-hud-item">
          <span className="si-hud-label">PUNKTE</span>
          <span className="si-hud-value">{score}</span>
        </div>
        <div className="si-hud-item">
          <span className="si-hud-label">LEVEL</span>
          <span className="si-hud-value">{level}</span>
        </div>
        <div className="si-hud-item">
          <span className="si-hud-label">LEBEN</span>
          <span className="si-hud-value si-lives">{'❤️'.repeat(lives)}</span>
        </div>
        <div className="si-hud-item">
          <span className="si-hud-label">HI-SCORE</span>
          <span className="si-hud-value">{highScore}</span>
        </div>
        <button
          className={`si-sound-btn ${soundOn ? '' : 'muted'}`}
          onClick={() => setSoundOn(!soundOn)}
          title={soundOn ? 'Ton aus' : 'Ton ein'}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>

      <div className="si-canvas-wrapper">
        <canvas ref={canvasRef} width={W} height={H} className="si-canvas" />
        {gameState === 'menu' && (
          <div className="si-overlay">
            <div className="si-overlay-content">
              <div className="si-title">👾 SPACE INVADERS</div>
              <button className="si-btn" onClick={startGame}>Spiel starten</button>
              <div className="si-hint">
                ← → / A D Bewegen · Leertaste / ↑ Schießen
              </div>
            </div>
          </div>
        )}
        {gameState === 'gameover' && (
          <div className="si-overlay">
            <div className="si-overlay-content">
              <div className="si-game-over">GAME OVER</div>
              <div className="si-final-score">Punkte: {score}</div>
              {score >= highScore && score > 0 && <div className="si-new-highscore">🏆 Neuer Highscore!</div>}
              <button className="si-btn" onClick={startGame}>Nochmal spielen</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpaceInvaders;
