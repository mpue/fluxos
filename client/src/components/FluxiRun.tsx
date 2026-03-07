import React, { useEffect, useRef, useCallback, useState } from 'react';
import './FluxiRun.css';

// ─── Audio ───
const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
const playTone = (freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06) => {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
};

const sfx = {
  jump: () => { playTone(400, 0.08); playTone(600, 0.08); setTimeout(() => playTone(800, 0.1), 60); },
  shoot: () => playTone(1200, 0.06, 'sawtooth', 0.05),
  hitEnemy: () => { playTone(300, 0.1, 'sawtooth', 0.08); playTone(150, 0.15, 'square', 0.06); },
  playerHit: () => { playTone(200, 0.15, 'sawtooth', 0.1); setTimeout(() => playTone(100, 0.25, 'sawtooth', 0.08), 120); },
  coin: () => { playTone(988, 0.06, 'square', 0.05); setTimeout(() => playTone(1319, 0.1, 'square', 0.05), 60); },
  bossHit: () => { playTone(80, 0.2, 'sawtooth', 0.1); playTone(60, 0.3, 'square', 0.08); },
  levelUp: () => { playTone(523, 0.1); setTimeout(() => playTone(659, 0.1), 100); setTimeout(() => playTone(784, 0.15), 200); setTimeout(() => playTone(1047, 0.2), 300); },
  gameOver: () => { playTone(400, 0.2, 'sawtooth', 0.1); setTimeout(() => playTone(300, 0.2, 'sawtooth', 0.1), 200); setTimeout(() => playTone(200, 0.5, 'sawtooth', 0.1), 400); },
  win: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => setTimeout(() => playTone(f, 0.15, 'square', 0.06), i * 100)); },
};

// ─── Constants ───
const W = 640;
const H = 400;
const GRAVITY = 0.45;
const JUMP_FORCE = -10.5;
const MOVE_SPEED = 4.5;
const BULLET_SPEED = 7;
const GROUND_Y = H - 40;
const LEVEL_WIDTH_MULT = 10;

interface Entity { x: number; y: number; w: number; h: number; }
interface Player extends Entity { vy: number; onGround: boolean; facing: number; hp: number; maxHp: number; invincible: number; shootCooldown: number; coyoteTime: number; jumpBuffered: boolean; canDoubleJump: boolean; jumpWasReleased: boolean; }
interface Bullet extends Entity { vx: number; }
interface Folder extends Entity { vx: number; vy: number; hp: number; type: 'folder' | 'virus' | 'boss'; onGround: boolean; shootTimer: number; }
interface Platform extends Entity {}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }
interface HddPiece extends Entity { collected: boolean; }

// ─── Level Generator ───
function generateLevel(level: number): { platforms: Platform[]; enemies: Folder[]; pieces: HddPiece[] } {
  const platforms: Platform[] = [];
  const enemies: Folder[] = [];
  const pieces: HddPiece[] = [];

  const worldW = W * LEVEL_WIDTH_MULT;

  // Ground segments with gaps
  let gx = 0;
  while (gx < worldW) {
    const segLen = 200 + Math.random() * 400;
    platforms.push({ x: gx, y: GROUND_Y, w: segLen, h: 50 });
    gx += segLen;
    // Occasional gap (not at the very start)
    if (gx > 300 && Math.random() < 0.25) {
      gx += 60 + Math.random() * 60;
    }
  }

  const numPlats = 12 + level * 4;
  for (let i = 0; i < numPlats; i++) {
    const px = 150 + i * ((worldW - 300) / numPlats) + Math.random() * 60;
    const py = GROUND_Y - 60 - Math.random() * 200;
    const pw = 70 + Math.random() * 100;
    platforms.push({ x: px, y: py, w: pw, h: 14 });

    if (Math.random() < 0.55) {
      pieces.push({ x: px + pw / 2 - 10, y: py - 30, w: 20, h: 20, collected: false });
    }
  }

  // Scatter some ground-level collectibles
  for (let i = 0; i < 5 + level; i++) {
    const cx = 300 + Math.random() * (worldW - 400);
    pieces.push({ x: cx, y: GROUND_Y - 25, w: 20, h: 20, collected: false });
  }

  const numEnemies = 5 + level * 3;
  for (let i = 0; i < numEnemies; i++) {
    const ex = 300 + i * ((worldW - 500) / numEnemies) + Math.random() * 100;
    const isVirus = Math.random() < 0.2 + level * 0.05;
    enemies.push({
      x: ex, y: GROUND_Y - 32, w: 30, h: 30,
      vx: (1 + Math.random() * 1.5) * (Math.random() < 0.5 ? 1 : -1),
      vy: 0, hp: isVirus ? 2 : 1,
      type: isVirus ? 'virus' : 'folder',
      onGround: true, shootTimer: 0,
    });
  }

  // Boss every 3 levels
  if (level % 3 === 0 && level > 0) {
    enemies.push({
      x: worldW - 200, y: GROUND_Y - 60, w: 50, h: 55,
      vx: -1, vy: 0, hp: 5 + level * 2,
      type: 'boss', onGround: true, shootTimer: 0,
    });
  }

  return { platforms, enemies, pieces };
}

// ─── Component ───
const FluxiRun: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover' | 'win'>('menu');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [muted, setMuted] = useState(false);
  const keys = useRef<Set<string>>(new Set());
  const bgMusic = useRef<HTMLAudioElement | null>(null);
  const gameRef = useRef<{
    player: Player; bullets: Bullet[]; enemies: Folder[];
    platforms: Platform[]; particles: Particle[]; pieces: HddPiece[];
    camera: number; score: number; level: number; running: boolean;
    enemyBullets: Bullet[]; bossDefeated: boolean;
    frameId: number;
  } | null>(null);

  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // ─── Background Music ───
  useEffect(() => {
    if (!bgMusic.current) {
      const audio = new Audio('/Schiebab.mp3');
      audio.loop = true;
      audio.volume = 0.3;
      bgMusic.current = audio;
    }
    return () => {
      if (bgMusic.current) {
        bgMusic.current.pause();
        bgMusic.current.currentTime = 0;
      }
    };
  }, []);

  // Play/pause music based on game state
  useEffect(() => {
    const audio = bgMusic.current;
    if (!audio) return;
    if (gameState === 'playing' && !muted) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
      if (gameState === 'menu') audio.currentTime = 0;
    }
  }, [gameState, muted]);

  const initGame = useCallback((lvl: number, prevScore: number) => {
    const { platforms, enemies, pieces } = generateLevel(lvl);
    gameRef.current = {
      player: {
        x: 40, y: GROUND_Y - 40, w: 24, h: 36,
        vy: 0, onGround: false, facing: 1,
        hp: 5, maxHp: 5, invincible: 0, shootCooldown: 0,
        coyoteTime: 0, jumpBuffered: false,
        canDoubleJump: true, jumpWasReleased: true,
      },
      bullets: [], enemies, platforms, particles: [],
      pieces, camera: 0, score: prevScore, level: lvl,
      running: true, enemyBullets: [], bossDefeated: false,
      frameId: 0,
    };
    setScore(prevScore);
    setLevel(lvl);
    setGameState('playing');
  }, []);

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    if (!gameRef.current) return;
    for (let i = 0; i < count; i++) {
      gameRef.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        life: 20 + Math.random() * 20,
        color, size: 2 + Math.random() * 4,
      });
    }
  };

  const collides = (a: Entity, b: Entity) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ─── Game Loop ───
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const update = () => {
      const g = gameRef.current;
      if (!g || !g.running) return;

      const k = keys.current;
      const p = g.player;

      // Movement
      if (k.has('arrowleft') || k.has('a')) { p.x -= MOVE_SPEED; p.facing = -1; }
      if (k.has('arrowright') || k.has('d')) { p.x += MOVE_SPEED; p.facing = 1; }

      // Jump with coyote time + jump buffering + double jump
      const wantsJump = k.has('arrowup') || k.has('w') || k.has(' ');
      if (wantsJump) p.jumpBuffered = true;
      if (!wantsJump) { p.jumpBuffered = false; p.jumpWasReleased = true; }
      if (p.onGround) { p.coyoteTime = 8; p.canDoubleJump = true; }
      else if (p.coyoteTime > 0) p.coyoteTime--;

      if ((wantsJump || p.jumpBuffered) && p.coyoteTime > 0) {
        p.vy = JUMP_FORCE;
        p.onGround = false;
        p.coyoteTime = 0;
        p.jumpBuffered = false;
        p.jumpWasReleased = false;
        if (!mutedRef.current) sfx.jump();
      } else if (wantsJump && p.jumpWasReleased && !p.onGround && p.coyoteTime <= 0 && p.canDoubleJump) {
        // Double jump
        p.vy = JUMP_FORCE * 0.85;
        p.canDoubleJump = false;
        p.jumpWasReleased = false;
        if (!mutedRef.current) sfx.jump();
      }

      // Variable jump height: release early = lower jump
      if (!wantsJump && p.vy < JUMP_FORCE * 0.4) {
        p.vy = JUMP_FORCE * 0.4;
      }

      // Shoot
      if (p.shootCooldown > 0) p.shootCooldown--;
      if ((k.has('f') || k.has('x') || k.has('arrowdown')) && p.shootCooldown <= 0) {
        g.bullets.push({ x: p.x + (p.facing > 0 ? p.w : -8), y: p.y + 12, w: 8, h: 4, vx: BULLET_SPEED * p.facing });
        p.shootCooldown = 12;
        if (!mutedRef.current) sfx.shoot();
      }

      // Physics
      p.vy += GRAVITY;
      p.y += p.vy;
      p.onGround = false;

      // Platform collision
      for (const plat of g.platforms) {
        if (p.vy >= 0 && p.x + p.w > plat.x && p.x < plat.x + plat.w &&
            p.y + p.h >= plat.y && p.y + p.h - p.vy <= plat.y + 6) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
        }
      }

      // Camera follows player
      g.camera = Math.max(0, p.x - W * 0.35);

      if (p.invincible > 0) p.invincible--;

      // Bullets movement
      g.bullets = g.bullets.filter(b => {
        b.x += b.vx;
        return b.x > g.camera - 50 && b.x < g.camera + W + 50;
      });

      // Enemy bullets
      g.enemyBullets = g.enemyBullets.filter(b => {
        b.x += b.vx;
        return b.x > g.camera - 50 && b.x < g.camera + W + 50;
      });

      // Enemy AI
      for (const e of g.enemies) {
        e.vy += GRAVITY;
        e.x += e.vx;
        e.y += e.vy;
        e.onGround = false;

        for (const plat of g.platforms) {
          if (e.vy >= 0 && e.x + e.w > plat.x && e.x < plat.x + plat.w &&
              e.y + e.h >= plat.y && e.y + e.h - e.vy <= plat.y + 6) {
            e.y = plat.y - e.h;
            e.vy = 0;
            e.onGround = true;
          }
        }

        // Reverse on edges or set bounds
        if (e.type !== 'boss') {
          if (e.x < 10 || e.x + e.w > W * LEVEL_WIDTH_MULT - 10) e.vx *= -1;
        } else {
          // Boss: move towards player
          e.vx = p.x > e.x ? 1.2 : -1.2;
          e.shootTimer++;
          if (e.shootTimer > 60) {
            e.shootTimer = 0;
            g.enemyBullets.push({ x: e.x, y: e.y + 20, w: 10, h: 6, vx: p.x > e.x ? 4 : -4 });
          }
        }

        // Player collision with enemy
        if (p.invincible <= 0 && collides(p, e)) {
          // Stomp from above?
          if (p.vy > 0 && p.y + p.h - 10 < e.y + e.h / 2) {
            e.hp--;
            p.vy = JUMP_FORCE * 0.6;
            if (!mutedRef.current) sfx.hitEnemy();
            if (e.hp <= 0) {
              spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.type === 'boss' ? '#ff0000' : '#f59e0b', e.type === 'boss' ? 30 : 12);
              g.score += e.type === 'boss' ? 500 : e.type === 'virus' ? 200 : 100;
              if (e.type === 'boss') {
                g.bossDefeated = true;
                if (!mutedRef.current) sfx.bossHit();
              }
            }
          } else {
            p.hp--;
            p.invincible = 60;
            if (!mutedRef.current) sfx.playerHit();
            p.vy = JUMP_FORCE * 0.5;
            p.x += p.facing * -30;
          }
        }
      }
      g.enemies = g.enemies.filter(e => e.hp > 0);

      // Bullet hits enemy
      for (const b of g.bullets) {
        for (const e of g.enemies) {
          if (collides(b, e)) {
            e.hp--;
            b.vx = 0; // mark for removal
            spawnParticles(b.x, b.y, '#60a5fa', 6);
            if (!mutedRef.current) sfx.hitEnemy();
            if (e.hp <= 0) {
              spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.type === 'boss' ? '#ff0000' : '#f59e0b', e.type === 'boss' ? 30 : 12);
              g.score += e.type === 'boss' ? 500 : e.type === 'virus' ? 200 : 100;
              if (e.type === 'boss') {
                g.bossDefeated = true;
                if (!mutedRef.current) sfx.bossHit();
              }
            }
            break;
          }
        }
      }
      g.bullets = g.bullets.filter(b => b.vx !== 0);
      g.enemies = g.enemies.filter(e => e.hp > 0);

      // Enemy bullets hit player
      if (p.invincible <= 0) {
        for (let i = g.enemyBullets.length - 1; i >= 0; i--) {
          if (collides(p, g.enemyBullets[i])) {
            p.hp--;
            p.invincible = 60;
            if (!mutedRef.current) sfx.playerHit();
            g.enemyBullets.splice(i, 1);
          }
        }
      }

      // Collect HDD pieces
      for (const piece of g.pieces) {
        if (!piece.collected && collides(p, piece)) {
          piece.collected = true;
          g.score += 50;
          if (!mutedRef.current) sfx.coin();
          spawnParticles(piece.x + 10, piece.y + 10, '#22d3ee', 8);
        }
      }

      // Particles
      g.particles = g.particles.filter(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.15;
        pt.life--;
        return pt.life > 0;
      });

      setScore(g.score);

      // Death
      if (p.hp <= 0 || p.y > H + 100) {
        g.running = false;
        if (!mutedRef.current) sfx.gameOver();
        setGameState('gameover');
        return;
      }

      // Level complete: all enemies dead
      if (g.enemies.length === 0) {
        g.running = false;
        if (g.level >= 9) {
          if (!mutedRef.current) sfx.win();
          setGameState('win');
        } else {
          if (!mutedRef.current) sfx.levelUp();
          setTimeout(() => initGame(g.level + 1, g.score), 1200);
        }
        return;
      }
    };

    // ─── Draw ───
    const draw = () => {
      const g = gameRef.current;
      if (!g) return;
      const cam = g.camera;

      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#334155');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 50; i++) {
        const sx = ((i * 137 + 47) % W + (cam * 0.1 * ((i % 3) + 1)) % W + W) % W;
        const sy = (i * 73 + 31) % (H * 0.6);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      ctx.save();
      ctx.translate(-cam, 0);

      // Platforms
      for (const plat of g.platforms) {
        if (plat.x + plat.w < cam - 20 || plat.x > cam + W + 20) continue;
        if (plat.y === GROUND_Y) {
          // Ground
          const grd = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 40);
          grd.addColorStop(0, '#475569');
          grd.addColorStop(1, '#1e293b');
          ctx.fillStyle = grd;
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          // Grid lines (like circuits)
          ctx.strokeStyle = 'rgba(96, 165, 250, 0.15)';
          ctx.lineWidth = 1;
          for (let gx = Math.floor(plat.x / 30) * 30; gx < plat.x + plat.w; gx += 30) {
            ctx.beginPath(); ctx.moveTo(gx, GROUND_Y); ctx.lineTo(gx, GROUND_Y + 40); ctx.stroke();
          }
          for (let gy = GROUND_Y; gy < GROUND_Y + 40; gy += 10) {
            ctx.beginPath(); ctx.moveTo(plat.x, gy); ctx.lineTo(plat.x + plat.w, gy); ctx.stroke();
          }
        } else {
          // Floating platform
          ctx.fillStyle = '#475569';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.fillStyle = '#60a5fa';
          ctx.fillRect(plat.x, plat.y, plat.w, 3);
          ctx.fillStyle = 'rgba(96, 165, 250, 0.1)';
          ctx.fillRect(plat.x + 4, plat.y + 4, plat.w - 8, plat.h - 5);
        }
      }

      // HDD pieces
      for (const piece of g.pieces) {
        if (piece.collected) continue;
        const px = piece.x, py = piece.y;
        const bob = Math.sin(Date.now() / 300 + px) * 3;
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(px + 2, py + bob + 2, 16, 12);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(px + 4, py + bob + 4, 4, 3);
        ctx.fillRect(px + 10, py + bob + 4, 4, 3);
        ctx.fillStyle = '#67e8f9';
        ctx.fillRect(px + 4, py + bob + 9, 12, 2);
        // Glow
        ctx.fillStyle = 'rgba(34, 211, 238, 0.15)';
        ctx.beginPath();
        ctx.arc(px + 10, py + bob + 8, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Enemies
      for (const e of g.enemies) {
        if (e.x + e.w < cam - 20 || e.x > cam + W + 20) continue;
        if (e.type === 'boss') {
          // Boss: Evil User
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(e.x, e.y, e.w, e.h);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(e.x + 3, e.y + 3, e.w - 6, 18);
          // Eyes
          ctx.fillStyle = '#fff';
          ctx.fillRect(e.x + 10, e.y + 8, 8, 8);
          ctx.fillRect(e.x + 30, e.y + 8, 8, 8);
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(e.x + 13, e.y + 10, 4, 4);
          ctx.fillRect(e.x + 33, e.y + 10, 4, 4);
          // Crown
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(e.x + 8, e.y - 10, e.w - 16, 10);
          ctx.fillRect(e.x + 10, e.y - 16, 5, 8);
          ctx.fillRect(e.x + 20, e.y - 18, 5, 10);
          ctx.fillRect(e.x + 32, e.y - 16, 5, 8);
          // HP bar
          ctx.fillStyle = '#333';
          ctx.fillRect(e.x, e.y - 24, e.w, 4);
          ctx.fillStyle = '#ef4444';
          const bossMaxHp = 5 + g.level * 2;
          ctx.fillRect(e.x, e.y - 24, (e.hp / bossMaxHp) * e.w, 4);
          // Label
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 9px monospace';
          ctx.fillText('BÖSER USER', e.x - 5, e.y - 28);
        } else if (e.type === 'virus') {
          // Virus folder (purple)
          ctx.fillStyle = '#7c3aed';
          ctx.fillRect(e.x, e.y + 6, e.w, e.h - 6);
          ctx.fillStyle = '#8b5cf6';
          ctx.fillRect(e.x, e.y, e.w * 0.5, 8);
          ctx.fillRect(e.x, e.y + 6, e.w, 4);
          // Skull symbol
          ctx.fillStyle = '#fff';
          ctx.font = '14px serif';
          ctx.fillText('☠', e.x + 7, e.y + 24);
        } else {
          // Normal evil folder (yellow/orange)
          ctx.fillStyle = '#d97706';
          ctx.fillRect(e.x, e.y + 6, e.w, e.h - 6);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(e.x, e.y, e.w * 0.5, 8);
          ctx.fillRect(e.x, e.y + 6, e.w, 4);
          // Angry eyes
          ctx.fillStyle = '#000';
          ctx.fillRect(e.x + 7, e.y + 15, 5, 4);
          ctx.fillRect(e.x + 18, e.y + 15, 5, 4);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(e.x + 8, e.y + 16, 3, 2);
          ctx.fillRect(e.x + 19, e.y + 16, 3, 2);
        }
      }

      // Enemy bullets
      ctx.fillStyle = '#ef4444';
      for (const b of g.enemyBullets) {
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.fillRect(b.x - 3, b.y - 2, b.w + 6, b.h + 4);
        ctx.fillStyle = '#ef4444';
      }

      // Player bullets
      ctx.fillStyle = '#60a5fa';
      for (const b of g.bullets) {
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = 'rgba(96, 165, 250, 0.4)';
        ctx.fillRect(b.x - 2, b.y - 1, b.w + 4, b.h + 2);
        ctx.fillStyle = '#60a5fa';
      }

      // Player (Fluxi)
      const p = g.player;
      const blink = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;
      if (!blink) {
        const fx = p.facing;
        // Body
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(p.x + 4, p.y + 10, 16, 20);
        // Head
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(p.x + 2, p.y, 20, 14);
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(p.x + (fx > 0 ? 12 : 5), p.y + 3, 6, 6);
        ctx.fillStyle = '#1e3a5f';
        ctx.fillRect(p.x + (fx > 0 ? 15 : 6), p.y + 4, 3, 4);
        // Mouth
        ctx.fillStyle = '#fff';
        ctx.fillRect(p.x + (fx > 0 ? 13 : 6), p.y + 11, 5, 2);
        // Legs
        ctx.fillStyle = '#2563eb';
        const legAnim = Math.sin(Date.now() / 100) * 3;
        ctx.fillRect(p.x + 5, p.y + 30, 5, 6 + (p.onGround ? legAnim : -2));
        ctx.fillRect(p.x + 14, p.y + 30, 5, 6 + (p.onGround ? -legAnim : -2));
        // Cape
        ctx.fillStyle = 'rgba(96, 165, 250, 0.5)';
        const capeW = 8 + Math.sin(Date.now() / 200) * 2;
        ctx.fillRect(p.x + (fx > 0 ? -2 : p.w - 2), p.y + 10, capeW * -fx, 16);
        // ⚡ on chest
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('⚡', p.x + 5, p.y + 24);
      }

      // Particles
      for (const pt of g.particles) {
        ctx.globalAlpha = Math.min(1, pt.life / 10);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      // ─── HUD ───
      // HP bar
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(10, 10, 104, 16);
      ctx.fillStyle = p.hp > 2 ? '#22c55e' : p.hp > 1 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(12, 12, (p.hp / p.maxHp) * 100, 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.strokeRect(10, 10, 104, 16);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`❤ ${p.hp}/${p.maxHp}`, 120, 23);

      // Score
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`★ ${g.score}`, W - 110, 23);

      // Level
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`Level ${g.level}`, W / 2 - 30, 23);

      // Enemies remaining
      ctx.fillStyle = '#f59e0b';
      ctx.font = '11px monospace';
      ctx.fillText(`📂 ${g.enemies.length}`, W - 110, 40);
    };

    const loop = () => {
      update();
      draw();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, initGame]);

  // ─── Input ───
  useEffect(() => {
    const container = canvasRef.current?.parentElement?.parentElement;
    const handleDown = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };
    const target = container || window;
    target.addEventListener('keydown', handleDown as EventListener);
    target.addEventListener('keyup', handleUp as EventListener);
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      target.removeEventListener('keydown', handleDown as EventListener);
      target.removeEventListener('keyup', handleUp as EventListener);
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  const startGame = () => initGame(1, 0);

  return (
    <div className="fluxi-run">
      <div className="fr-screen">
        <canvas ref={canvasRef} width={W} height={H} className="fr-canvas" />

        {gameState === 'menu' && (
          <div className="fr-overlay">
            <div className="fr-title">⚡ FLUXI RUN ⚡</div>
            <div className="fr-subtitle">Fluxi vs. Der Böse User</div>
            <div className="fr-story">
              Der böse User hat seine Ordner-Armee losgeschickt,<br />
              um die Festplatte zu zerstören!<br />
              Nur Fluxi kann sie aufhalten!
            </div>
            <button className="fr-start-btn" onClick={startGame}>▶ Spiel starten</button>
            <div className="fr-controls">
              <span>← → / A D — Bewegen</span>
              <span>↑ / W / Leertaste — Springen</span>
              <span>↓ / F / X — Schießen</span>
              <span>Springe auf Feinde um sie zu zertreten!</span>
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="fr-overlay">
            <div className="fr-title fr-gameover">GAME OVER</div>
            <div className="fr-subtitle">Die Ordner-Armee hat gewonnen...</div>
            <div className="fr-final-score">Punkte: {score}</div>
            <button className="fr-start-btn" onClick={startGame}>🔄 Nochmal spielen</button>
          </div>
        )}

        {gameState === 'win' && (
          <div className="fr-overlay">
            <div className="fr-title fr-win">🎉 GEWONNEN! 🎉</div>
            <div className="fr-subtitle">Fluxi hat die Festplatte gerettet!</div>
            <div className="fr-final-score">Endpunktzahl: {score}</div>
            <button className="fr-start-btn" onClick={startGame}>🔄 Nochmal spielen</button>
          </div>
        )}
      </div>
      <div className="fr-statusbar">
        <span>⚡ Fluxi Run — Level {level}</span>
        <span>Punkte: {score}</span>
        <button
          className="fr-mute-btn"
          onClick={() => setMuted(m => !m)}
          title={muted ? 'Ton an' : 'Stumm'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
};

export default FluxiRun;
