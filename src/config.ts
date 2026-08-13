// Shared constants & tuning. Imports only the engine TYPES (erased at runtime),
// so this leaf module pulls in no engine code. Keep ALL magic numbers in this
// one file.
import type { GameOptions } from '../engine/webgpu.js';

// ── THE CANVAS ───────────────────────────────────────────────────────────────
export const BACKGROUND = '#0b0e1a';
export const PIXEL_ART = false;
export const CONTAINER = '#game';

export const GAME_OPTIONS: GameOptions = {
  container: CONTAINER,
  background: BACKGROUND,
  pixelArt: PIXEL_ART,
};

// ── PALETTE ──────────────────────────────────────────────────────────────────
export const COLORS = {
  turf: '#1c6b3c',
  turfStripe: '#175a32',
  chalk: '#eef3ff',
  ink: '#0b0e1a',
  magenta: '#ff2fb0',
  cyan: '#38e1ff',
  gold: '#ffd147',
  violet: '#b98bff',
  runeGreen: '#7fd4c1',
  potion: '#7ac74f',
  panelBg: '#141a2e',
};

// ── FONT SLUGS (CDN, msdf.md/fonts.md) ───────────────────────────────────────
export const FONT_DISPLAY = 'titan-one';
export const FONT_UI = 'inter';
export const FONT_STAT = 'oswald';
const FONT_BASE = 'https://gameblocks.nyc3.cdn.digitaloceanspaces.com/gameblocks/fonts/';
export const fontUrl = (slug: string) => ({ png: `${FONT_BASE}${slug}.png`, json: `${FONT_BASE}${slug}.json` });

// ── STATS ────────────────────────────────────────────────────────────────────
export const STAT_NAMES = [
  'speed', 'acceleration', 'strength', 'passing', 'shooting',
  'tackling', 'dribbling', 'stamina', 'intelligence', 'aggression', 'goalkeeping',
] as const;
export const STAT_MIN = 1;
export const STAT_MAX = 99;

// ── SQUAD / DRAFT / LEAGUE ───────────────────────────────────────────────────
export const LEAGUE_CLUBS = 8;
export const FIXTURES_PER_CLUB = LEAGUE_CLUBS - 1; // single round robin
export const DRAFT_POOL_SIZE = 40;
export const SQUAD_SIZE = 15;
export const STARTING_XI = 11;
export const WIN_POINTS = 3;
export const DRAW_POINTS = 1;
export const LOSS_POINTS = 0;

// ── GENETICS ─────────────────────────────────────────────────────────────────
export const GENE_PARENT_A_CHANCE = 0.40;
export const GENE_PARENT_B_CHANCE = 0.40;
export const GENE_MUTATION_CHANCE = 0.20; // remainder
export const GENE_STAT_JITTER = 8; // +/- band applied even when inheriting

// ── MATCH SIMULATION ─────────────────────────────────────────────────────────
export const PITCH_W = 1000;
export const PITCH_H = 640;
export const GOAL_W = 120;
export const GOAL_DEPTH = 18;
export const BALL_CONTROL_RADIUS = 26;
export const MATCH_SIM_MINUTES = 90;
export const MATCH_REAL_SECONDS = 150; // wall clock at 1x for a played match
// The match clock runs in "sim-seconds" (0..MATCH_SIM_MINUTES*60) — familiar
// units for tuning speeds/drag. SIM_SECONDS_PER_REAL_SECOND converts a real
// playback second (at 1x) into sim-seconds of match time.
export const SIM_SECONDS_PER_REAL_SECOND = (MATCH_SIM_MINUTES * 60) / MATCH_REAL_SECONDS;
export const MAX_SUBSTEP_SIM_SECONDS = 0.5; // physics sub-stepping granularity
export const PASS_ERROR_BASE = 0.22;
export const SHOT_ERROR_BASE = 0.30;
export const PLAYER_RADIUS = 12;
export const BALL_RADIUS = 6;
