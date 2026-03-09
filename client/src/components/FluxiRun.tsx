import React, { useEffect, useRef, useCallback, useState } from 'react';
import './FluxiRun.css';
import FluxiRunEditor from './FluxiRunEditor';

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
import {
  W, H, GROUND_Y, LEVEL_WIDTH_MULT,
  Entity, Folder, Platform, MovingPlatform, FinishZone, HddPiece,
  LevelData, LevelTheme, LEVEL_THEMES,
} from './FluxiRunTypes';

export { W, H, GROUND_Y, LEVEL_WIDTH_MULT, LEVEL_THEMES };
export type { Entity, Folder, Platform, MovingPlatform, FinishZone, HddPiece, LevelData, LevelTheme };

const GRAVITY = 0.45;
const JUMP_FORCE = -10.5;
const MOVE_SPEED = 4.5;
const BULLET_SPEED = 7;

interface Player extends Entity { vy: number; onGround: boolean; facing: number; hp: number; maxHp: number; invincible: number; shootCooldown: number; coyoteTime: number; jumpBuffered: boolean; canDoubleJump: boolean; jumpWasReleased: boolean; }
interface Bullet extends Entity { vx: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }

// ─── Level Generator ───
// ─── Level Themes ───

function getLevelTheme(level: number): LevelTheme {
  return LEVEL_THEMES[(level - 1) % LEVEL_THEMES.length];
}

function generateLevel(level: number): { platforms: Platform[]; movingPlatforms: MovingPlatform[]; enemies: Folder[]; pieces: HddPiece[]; finishZone: FinishZone; theme: LevelTheme } {
  const platforms: Platform[] = [];
  const movingPlatforms: MovingPlatform[] = [];
  const enemies: Folder[] = [];
  const pieces: HddPiece[] = [];
  const theme = getLevelTheme(level);

  const worldW = W * LEVEL_WIDTH_MULT;

  // Finish zone at end of level
  const finishZone: FinishZone = { x: worldW - 100, y: GROUND_Y - 80, w: 40, h: 80 };

  // ── Ground with theme-based gap frequency ──
  const gapChance = theme === 'sky' ? 0.45 : theme === 'caves' ? 0.15 : theme === 'factory' ? 0.3 : 0.25;
  const gapSize = theme === 'sky' ? 80 + Math.random() * 80 : 60 + Math.random() * 60;
  let gx = 0;
  while (gx < worldW) {
    const segLen = theme === 'sky' ? (100 + Math.random() * 200) : (200 + Math.random() * 400);
    platforms.push({ x: gx, y: GROUND_Y, w: segLen, h: 50 });
    gx += segLen;
    if (gx > 300 && Math.random() < gapChance) {
      gx += gapSize;
    }
  }
  // Ensure ground under finish zone
  platforms.push({ x: worldW - 160, y: GROUND_Y, w: 200, h: 50 });

  // ── Static platforms with themed patterns ──
  const numPlats = 15 + level * 5;
  for (let i = 0; i < numPlats; i++) {
    const px = 150 + i * ((worldW - 300) / numPlats) + Math.random() * 60;
    let py: number, pw: number;

    if (theme === 'caves') {
      // Low ceilings, narrow platforms
      py = GROUND_Y - 40 - Math.random() * 120;
      pw = 50 + Math.random() * 80;
    } else if (theme === 'sky') {
      // High platforms, varied heights
      py = GROUND_Y - 100 - Math.random() * 220;
      pw = 60 + Math.random() * 70;
    } else if (theme === 'factory') {
      // Regular staircase-like patterns
      py = GROUND_Y - 50 - (i % 5) * 40 - Math.random() * 30;
      pw = 80 + Math.random() * 60;
    } else {
      py = GROUND_Y - 60 - Math.random() * 200;
      pw = 70 + Math.random() * 100;
    }

    platforms.push({ x: px, y: py, w: pw, h: 14 });

    if (Math.random() < 0.55) {
      pieces.push({ x: px + pw / 2 - 10, y: py - 30, w: 20, h: 20, collected: false });
    }
  }

  // ── Themed platform sections ──
  // Staircase section
  if (theme === 'factory' || theme === 'city') {
    const stairStart = worldW * 0.3 + Math.random() * worldW * 0.1;
    for (let s = 0; s < 6; s++) {
      platforms.push({ x: stairStart + s * 70, y: GROUND_Y - 50 - s * 35, w: 65, h: 14 });
      if (s === 5) pieces.push({ x: stairStart + s * 70 + 20, y: GROUND_Y - 50 - s * 35 - 30, w: 20, h: 20, collected: false });
    }
  }

  // Floating island cluster
  if (theme === 'sky' || theme === 'digital') {
    const clusterX = worldW * 0.5 + Math.random() * worldW * 0.15;
    const clusterY = GROUND_Y - 180;
    for (let c = 0; c < 5; c++) {
      const cx = clusterX + (Math.random() - 0.5) * 250;
      const cy = clusterY + (Math.random() - 0.5) * 80;
      platforms.push({ x: cx, y: cy, w: 60 + Math.random() * 50, h: 14 });
      pieces.push({ x: cx + 25, y: cy - 28, w: 20, h: 20, collected: false });
    }
  }

  // Tunnel section (tight corridor)
  if (theme === 'caves') {
    const tunStart = worldW * 0.4 + Math.random() * worldW * 0.1;
    for (let t = 0; t < 8; t++) {
      // Ceiling
      platforms.push({ x: tunStart + t * 80, y: GROUND_Y - 130, w: 80, h: 14 });
    }
  }

  // ── Moving platforms ──
  const numMoving = theme === 'sky' ? 10 + level : theme === 'factory' ? 8 + level : 5 + level;
  for (let i = 0; i < numMoving; i++) {
    const mx = 250 + i * ((worldW - 400) / numMoving) + Math.random() * 80;
    const my = GROUND_Y - 80 - Math.random() * 160;
    const mw = 80 + Math.random() * 60;
    const horizontal = theme === 'factory' ? Math.random() < 0.3 : Math.random() < 0.6;
    const speed = theme === 'sky' ? 1.5 + Math.random() * 2 : 1.2 + Math.random() * 1.5;
    movingPlatforms.push({
      x: mx, y: my, w: mw, h: 14,
      origX: mx, origY: my,
      vx: horizontal ? speed * (Math.random() < 0.5 ? 1 : -1) : 0,
      vy: horizontal ? 0 : (0.8 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1),
      rangeX: horizontal ? 80 + Math.random() * 140 : 0,
      rangeY: horizontal ? 0 : 40 + Math.random() * 100,
    });
    if (Math.random() < 0.5) {
      pieces.push({ x: mx + mw / 2 - 10, y: my - 30, w: 20, h: 20, collected: false });
    }
  }

  // ── Ground-level collectibles ──
  for (let i = 0; i < 8 + level * 2; i++) {
    const cx = 300 + Math.random() * (worldW - 400);
    pieces.push({ x: cx, y: GROUND_Y - 25, w: 20, h: 20, collected: false });
  }

  // ── Enemies with type variety based on level + theme ──
  const numEnemies = 10 + level * 4;
  for (let i = 0; i < numEnemies; i++) {
    const ex = 250 + i * ((worldW - 500) / numEnemies) + Math.random() * 80;
    const roll = Math.random();
    let etype: Folder['type'];
    let ehp: number;
    let ew = 30, eh = 30;
    let evx = (1 + Math.random() * 1.5) * (Math.random() < 0.5 ? 1 : -1);

    if (roll < 0.05 + level * 0.02) {
      // Firewall — stationary shield enemy, high HP
      etype = 'firewall';
      ehp = 3 + Math.floor(level / 2);
      ew = 20; eh = 40;
      evx = 0;
    } else if (roll < 0.15 + level * 0.03) {
      // Trojan — shoots at player
      etype = 'trojan';
      ehp = 2;
      ew = 32; eh = 32;
      evx = (0.5 + Math.random()) * (Math.random() < 0.5 ? 1 : -1);
    } else if (roll < 0.30 + level * 0.02) {
      // Worm — fast, small, jumps
      etype = 'worm';
      ehp = 1;
      ew = 22; eh = 18;
      evx = (2.5 + Math.random() * 2) * (Math.random() < 0.5 ? 1 : -1);
    } else if (roll < 0.50) {
      // Virus
      etype = 'virus';
      ehp = 2;
    } else {
      // Folder (basic)
      etype = 'folder';
      ehp = 1;
    }

    // Theme-based tweaks
    if (theme === 'caves' && etype === 'folder') evx *= 0.7; // slower in caves
    if (theme === 'sky' && etype === 'worm') evx *= 1.3; // faster in sky

    enemies.push({
      x: ex, y: GROUND_Y - eh - 2, w: ew, h: eh,
      vx: evx, vy: 0, hp: ehp,
      type: etype, onGround: true, shootTimer: 0,
    });
  }

  // Place some enemies on elevated platforms
  const elevatedPlats = platforms.filter(p => p.y < GROUND_Y - 30 && p.w > 70);
  const numElevated = Math.min(elevatedPlats.length, 3 + level);
  for (let i = 0; i < numElevated; i++) {
    const plat = elevatedPlats[Math.floor(Math.random() * elevatedPlats.length)];
    const roll = Math.random();
    const etype: Folder['type'] = roll < 0.3 ? 'trojan' : roll < 0.5 ? 'virus' : 'folder';
    enemies.push({
      x: plat.x + plat.w / 2 - 15, y: plat.y - 32, w: 30, h: 30,
      vx: (0.8 + Math.random()) * (Math.random() < 0.5 ? 1 : -1),
      vy: 0, hp: etype === 'virus' ? 2 : etype === 'trojan' ? 2 : 1,
      type: etype, onGround: true, shootTimer: 0,
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

  return { platforms, movingPlatforms, enemies, pieces, finishZone, theme };
}

// ─── Component ───
const FluxiRun: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover' | 'win' | 'editor'>('menu');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [muted, setMuted] = useState(false);
  const [customLevel, setCustomLevel] = useState<LevelData | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const bgMusic = useRef<HTMLAudioElement | null>(null);
  const gameRef = useRef<{
    player: Player; bullets: Bullet[]; enemies: Folder[];
    platforms: Platform[]; movingPlatforms: MovingPlatform[]; particles: Particle[]; pieces: HddPiece[];
    camera: number; score: number; level: number; running: boolean;
    enemyBullets: Bullet[]; bossDefeated: boolean;
    finishZone: FinishZone; theme: LevelTheme;
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

  const initGame = useCallback((lvl: number, prevScore: number, customData?: LevelData) => {
    const levelData = customData || generateLevel(lvl);
    const { platforms, movingPlatforms, enemies, pieces, finishZone, theme } = levelData;
    // Deep-clone enemies/pieces so replaying works
    const clonedEnemies = enemies.map(e => ({ ...e }));
    const clonedPieces = pieces.map(p => ({ ...p, collected: false }));
    const clonedMoving = movingPlatforms.map(m => ({ ...m }));
    gameRef.current = {
      player: {
        x: 40, y: GROUND_Y - 40, w: 24, h: 36,
        vy: 0, onGround: false, facing: 1,
        hp: 5, maxHp: 5, invincible: 0, shootCooldown: 0,
        coyoteTime: 0, jumpBuffered: false,
        canDoubleJump: true, jumpWasReleased: true,
      },
      bullets: [], enemies: clonedEnemies, platforms: [...platforms], movingPlatforms: clonedMoving, particles: [],
      pieces: clonedPieces, camera: 0, score: prevScore, level: lvl,
      running: true, enemyBullets: [], bossDefeated: false,
      finishZone: { ...finishZone }, theme,
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

      // Platform collision (static)
      for (const plat of g.platforms) {
        if (p.vy >= 0 && p.x + p.w > plat.x && p.x < plat.x + plat.w &&
            p.y + p.h >= plat.y && p.y + p.h - p.vy <= plat.y + 6) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
        }
      }

      // Moving platforms: update position and player collision
      for (const mp of g.movingPlatforms) {
        const prevX = mp.x;
        mp.x = mp.origX + Math.sin(Date.now() / 1000 * Math.abs(mp.vx) + mp.origX) * mp.rangeX;
        mp.y = mp.origY + Math.sin(Date.now() / 1000 * Math.abs(mp.vy || 1) + mp.origY) * mp.rangeY;
        const dx = mp.x - prevX;
        if (p.vy >= 0 && p.x + p.w > mp.x && p.x < mp.x + mp.w &&
            p.y + p.h >= mp.y && p.y + p.h <= mp.y + 14) {
          p.y = mp.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.x += dx; // ride the platform
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

        // Enemy type-specific AI
        if (e.type === 'boss') {
          e.vx = p.x > e.x ? 1.2 : -1.2;
          e.shootTimer++;
          if (e.shootTimer > 60) {
            e.shootTimer = 0;
            g.enemyBullets.push({ x: e.x, y: e.y + 20, w: 10, h: 6, vx: p.x > e.x ? 4 : -4 });
          }
        } else if (e.type === 'trojan') {
          // Trojan: patrols and shoots at player when in range
          if (e.x < 10 || e.x + e.w > W * LEVEL_WIDTH_MULT - 10) e.vx *= -1;
          const dist = Math.abs(p.x - e.x);
          if (dist < 300) {
            e.shootTimer++;
            if (e.shootTimer > 80) {
              e.shootTimer = 0;
              g.enemyBullets.push({ x: e.x + e.w / 2, y: e.y + 10, w: 8, h: 5, vx: p.x > e.x ? 3.5 : -3.5 });
            }
          }
        } else if (e.type === 'worm') {
          // Worm: fast, random jumps
          if (e.x < 10 || e.x + e.w > W * LEVEL_WIDTH_MULT - 10) e.vx *= -1;
          if (e.onGround && Math.random() < 0.02) {
            e.vy = -8 - Math.random() * 3;
          }
        } else if (e.type === 'firewall') {
          // Firewall: stationary, doesn't move
          e.vx = 0;
        } else {
          // Folder/Virus: standard patrol
          if (e.x < 10 || e.x + e.w > W * LEVEL_WIDTH_MULT - 10) e.vx *= -1;
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
              g.score += e.type === 'boss' ? 500 : e.type === 'virus' ? 200 : e.type === 'trojan' ? 250 : e.type === 'worm' ? 150 : e.type === 'firewall' ? 300 : 100;
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
              g.score += e.type === 'boss' ? 500 : e.type === 'virus' ? 200 : e.type === 'trojan' ? 250 : e.type === 'worm' ? 150 : e.type === 'firewall' ? 300 : 100;
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

      // Level complete: player reaches the finish zone
      if (collides(p, g.finishZone)) {
        g.running = false;
        if (customLevel) {
          // Custom level — just win
          if (!mutedRef.current) sfx.win();
          setGameState('win');
        } else if (g.level >= 9) {
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

      // Sky gradient — themed
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      if (g.theme === 'caves') {
        grad.addColorStop(0, '#1a1207'); grad.addColorStop(0.5, '#2d1f0e'); grad.addColorStop(1, '#3d2914');
      } else if (g.theme === 'sky') {
        grad.addColorStop(0, '#0c1445'); grad.addColorStop(0.5, '#1e3a6e'); grad.addColorStop(1, '#4a7ab5');
      } else if (g.theme === 'factory') {
        grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(0.5, '#2a2a3e'); grad.addColorStop(1, '#3a3a4e');
      } else if (g.theme === 'digital') {
        grad.addColorStop(0, '#0a0a1a'); grad.addColorStop(0.5, '#0d1b2a'); grad.addColorStop(1, '#1b2838');
      } else {
        grad.addColorStop(0, '#0f172a'); grad.addColorStop(0.5, '#1e293b'); grad.addColorStop(1, '#334155');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Stars / background elements
      if (g.theme === 'digital') {
        // Matrix-like falling characters
        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.font = '10px monospace';
        for (let i = 0; i < 30; i++) {
          const sx = ((i * 137 + 47) % W + (cam * 0.05 * ((i % 3) + 1)) % W + W) % W;
          const sy = ((i * 73 + 31 + Date.now() / 50 * ((i % 3) + 1)) % (H + 20));
          ctx.fillText(String.fromCharCode(0x30A0 + Math.floor(((i * 17 + Date.now() / 500) % 96))), sx, sy);
        }
      } else if (g.theme === 'caves') {
        // Stalactites in background
        ctx.fillStyle = 'rgba(139, 92, 42, 0.15)';
        for (let i = 0; i < 20; i++) {
          const sx = ((i * 173 + 23) % W + (cam * 0.08) % W + W) % W;
          const sh = 15 + (i * 37 % 30);
          ctx.fillRect(sx, 0, 4, sh);
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (let i = 0; i < 50; i++) {
          const sx = ((i * 137 + 47) % W + (cam * 0.1 * ((i % 3) + 1)) % W + W) % W;
          const sy = (i * 73 + 31) % (H * 0.6);
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
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

      // Moving platforms
      for (const mp of g.movingPlatforms) {
        if (mp.x + mp.w < cam - 20 || mp.x > cam + W + 20) continue;
        // Platform body with distinct look
        ctx.fillStyle = '#334155';
        ctx.fillRect(mp.x, mp.y, mp.w, mp.h);
        // Glowing top edge (orange/amber for moving)
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(mp.x, mp.y, mp.w, 3);
        // Animated chevron arrows to indicate movement
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.fillRect(mp.x + 4, mp.y + 4, mp.w - 8, mp.h - 5);
        // Direction indicators
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 8px monospace';
        if (mp.rangeX > 0) {
          ctx.fillText('◀▶', mp.x + mp.w / 2 - 7, mp.y + 11);
        } else {
          ctx.fillText('▲▼', mp.x + mp.w / 2 - 7, mp.y + 11);
        }
        // Glow underneath
        ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
        ctx.fillRect(mp.x, mp.y + mp.h, mp.w, 6);
      }

      // Finish zone
      const fz = g.finishZone;
      if (fz.x + fz.w > cam - 20 && fz.x < cam + W + 20) {
        // Portal glow
        const pulse = Math.sin(Date.now() / 300) * 0.15 + 0.35;
        ctx.fillStyle = `rgba(34, 197, 94, ${pulse})`;
        ctx.beginPath();
        ctx.arc(fz.x + fz.w / 2, fz.y + fz.h / 2, 50, 0, Math.PI * 2);
        ctx.fill();
        // Portal body
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(fz.x + 5, fz.y, fz.w - 10, fz.h);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(fz.x + 8, fz.y + 4, fz.w - 16, fz.h - 8);
        // Animated stripes
        const stripeOff = (Date.now() / 100) % 20;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        for (let sy = -20; sy < fz.h; sy += 20) {
          ctx.fillRect(fz.x + 8, fz.y + sy + stripeOff, fz.w - 16, 6);
        }
        // Flag pole
        ctx.fillStyle = '#a3a3a3';
        ctx.fillRect(fz.x + fz.w / 2 - 2, fz.y - 30, 4, 30);
        // Flag
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(fz.x + fz.w / 2 + 2, fz.y - 30, 20, 14);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('ZIEL', fz.x + fz.w / 2 + 3, fz.y - 20);
        // Checkered base
        ctx.fillStyle = '#000';
        for (let cx = 0; cx < fz.w; cx += 8) {
          for (let cy = 0; cy < 8; cy += 8) {
            if ((cx / 8 + cy / 8) % 2 === 0) {
              ctx.fillRect(fz.x + cx, fz.y + fz.h - 8 + cy, 8, 8);
            }
          }
        }
        ctx.fillStyle = '#fff';
        for (let cx = 0; cx < fz.w; cx += 8) {
          for (let cy = 0; cy < 8; cy += 8) {
            if ((cx / 8 + cy / 8) % 2 === 1) {
              ctx.fillRect(fz.x + cx, fz.y + fz.h - 8 + cy, 8, 8);
            }
          }
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
        } else if (e.type === 'trojan') {
          // Trojan — dark green armored folder with crosshair
          ctx.fillStyle = '#14532d';
          ctx.fillRect(e.x, e.y + 6, e.w, e.h - 6);
          ctx.fillStyle = '#166534';
          ctx.fillRect(e.x, e.y, e.w * 0.5, 8);
          ctx.fillRect(e.x, e.y + 6, e.w, 4);
          // Shield symbol
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(e.x + 8, e.y + 12, 16, 14);
          ctx.fillStyle = '#14532d';
          ctx.fillRect(e.x + 12, e.y + 14, 8, 4);
          ctx.fillRect(e.x + 14, e.y + 12, 4, 10);
          // Red targeting eye
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(e.x + 14, e.y + 14, 4, 4);
        } else if (e.type === 'worm') {
          // Worm — small, segmented, green
          const wave = Math.sin(Date.now() / 100 + e.x) * 2;
          ctx.fillStyle = '#84cc16';
          ctx.fillRect(e.x, e.y + wave, e.w * 0.35, e.h);
          ctx.fillStyle = '#65a30d';
          ctx.fillRect(e.x + e.w * 0.3, e.y - wave, e.w * 0.35, e.h);
          ctx.fillStyle = '#84cc16';
          ctx.fillRect(e.x + e.w * 0.6, e.y + wave, e.w * 0.4, e.h);
          // Eyes
          ctx.fillStyle = '#fff';
          ctx.fillRect(e.x + e.w - 8, e.y + wave + 2, 4, 4);
          ctx.fillStyle = '#000';
          ctx.fillRect(e.x + e.w - 7, e.y + wave + 3, 2, 2);
        } else if (e.type === 'firewall') {
          // Firewall — tall red/orange barrier with flame effect
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(e.x, e.y, e.w, e.h);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
          // Flame animation
          const flicker = Math.sin(Date.now() / 80 + e.x) * 3;
          ctx.fillStyle = '#f97316';
          ctx.fillRect(e.x + 3, e.y - 6 + flicker, 5, 8);
          ctx.fillRect(e.x + e.w - 8, e.y - 8 - flicker, 5, 10);
          ctx.fillRect(e.x + e.w / 2 - 3, e.y - 10 + flicker * 0.5, 6, 12);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(e.x + 4, e.y - 3 + flicker, 3, 5);
          ctx.fillRect(e.x + e.w - 7, e.y - 5 - flicker, 3, 6);
          // "FIREWALL" text
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 6px monospace';
          ctx.fillText('FW', e.x + 3, e.y + e.h / 2 + 2);
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

      // Finish zone direction indicator
      const fzScreen = g.finishZone.x - g.camera;
      if (fzScreen > W) {
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`ZIEL →`, W - 80, H - 20);
      } else if (fzScreen + g.finishZone.w < 0) {
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`← ZIEL`, 10, H - 20);
      }
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

  const startGame = () => { setCustomLevel(null); initGame(1, 0); };
  const playCustomLevel = (data: LevelData) => { setCustomLevel(data); initGame(1, 0, data); };

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
            <button className="fr-start-btn fr-editor-btn" onClick={() => setGameState('editor')}>🛠 Level Editor</button>
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
            <button className="fr-start-btn fr-editor-btn" onClick={() => setGameState('menu')}>🏠 Hauptmenü</button>
          </div>
        )}

        {gameState === 'win' && (
          <div className="fr-overlay">
            <div className="fr-title fr-win">🎉 GEWONNEN! 🎉</div>
            <div className="fr-subtitle">Fluxi hat die Festplatte gerettet!</div>
            <div className="fr-final-score">Endpunktzahl: {score}</div>
            <button className="fr-start-btn" onClick={startGame}>🔄 Nochmal spielen</button>
            <button className="fr-start-btn fr-editor-btn" onClick={() => setGameState('menu')}>🏠 Hauptmenü</button>
          </div>
        )}

        {gameState === 'editor' && (
          <FluxiRunEditor
            onPlay={playCustomLevel}
            onBack={() => setGameState('menu')}
          />
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
