// ─── Shared constants & types for FluxiRun ───

export const W = 640;
export const H = 400;
export const GROUND_Y = H - 40;
export const LEVEL_WIDTH_MULT = 10;

export interface Entity { x: number; y: number; w: number; h: number; }
export interface Folder extends Entity { vx: number; vy: number; hp: number; type: 'folder' | 'virus' | 'boss' | 'trojan' | 'worm' | 'firewall'; onGround: boolean; shootTimer: number; }
export interface Platform extends Entity {}
export interface MovingPlatform extends Platform { vx: number; vy: number; origX: number; origY: number; rangeX: number; rangeY: number; }
export interface FinishZone extends Entity {}
export interface HddPiece extends Entity { collected: boolean; }

export type LevelTheme = 'city' | 'caves' | 'sky' | 'factory' | 'digital';
export const LEVEL_THEMES: LevelTheme[] = ['city', 'caves', 'sky', 'factory', 'digital'];

export interface LevelData {
  platforms: Platform[];
  movingPlatforms: MovingPlatform[];
  enemies: Folder[];
  pieces: HddPiece[];
  finishZone: FinishZone;
  theme: LevelTheme;
}
