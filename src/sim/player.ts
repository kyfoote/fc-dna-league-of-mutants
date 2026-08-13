// Footballer generation — the core data object. Everything about a player is
// data (stats + genome + personality); nothing is hardcoded per-player.
import { STAT_NAMES, STAT_MIN, STAT_MAX } from '../config.js';
import { type Rng, randInt, clamp, pick } from './rng.js';
import { generatePersonName, randomAge } from './names.js';
import { randomGenome, genomeMods, type Genome } from './genome.js';
import { rollPersonality, type Personality } from './personality.js';

export type StatName = typeof STAT_NAMES[number];
export type Stats = Record<StatName, number>;
export type Position = 'GK' | 'DF' | 'MF' | 'FW';
export const POSITIONS: readonly Position[] = ['GK', 'DF', 'MF', 'FW'];

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  position: Position;
  stats: Stats;
  genome: Genome;
  personality: Personality | null;
  parentage?: { a: string; b: string; sourceByStat: Record<StatName, 'A' | 'B' | 'mutation'> };
}

let idCounter = 1;
export function nextPlayerId(): string {
  return `p${idCounter++}`;
}

/** Position-biased base stat rolls — a GK naturally rolls higher goalkeeping, etc. */
const POSITION_BIAS: Record<Position, Partial<Record<StatName, number>>> = {
  GK: { goalkeeping: 35, strength: 8, intelligence: 5 },
  DF: { tackling: 20, strength: 12, aggression: 6 },
  MF: { passing: 18, intelligence: 14, stamina: 8, dribbling: 6 },
  FW: { shooting: 22, speed: 12, dribbling: 8 },
};

export function randomStats(rng: Rng, position: Position): Stats {
  const bias = POSITION_BIAS[position];
  const stats = {} as Stats;
  for (const name of STAT_NAMES) {
    const base = randInt(rng, 20, 70);
    const boost = bias[name] ?? 0;
    stats[name] = clamp(base + boost + randInt(rng, -8, 8), STAT_MIN, STAT_MAX);
  }
  // Non-keepers are terrible in goal unless generously rolled; keepers are shaky outfield.
  if (position !== 'GK') stats.goalkeeping = clamp(randInt(rng, 1, 25), STAT_MIN, STAT_MAX);
  return stats;
}

export function overallRating(stats: Stats, position: Position): number {
  const w: Partial<Record<StatName, number>> = position === 'GK'
    ? { goalkeeping: 3, strength: 1, intelligence: 1 }
    : position === 'DF'
    ? { tackling: 2, strength: 1.5, speed: 1, intelligence: 1, aggression: 1 }
    : position === 'MF'
    ? { passing: 2, intelligence: 1.5, stamina: 1, dribbling: 1, tackling: 1 }
    : { shooting: 2, speed: 1.5, dribbling: 1.5, intelligence: 1 };
  let total = 0, weight = 0;
  for (const name of STAT_NAMES) {
    const ww = w[name] ?? 0.3;
    total += stats[name] * ww;
    weight += ww;
  }
  return Math.round(total / weight);
}

export function generatePlayer(rng: Rng, position?: Position): Player {
  const pos = position ?? pick(rng, POSITIONS);
  const { first, last } = generatePersonName(rng);
  return {
    id: nextPlayerId(),
    firstName: first,
    lastName: last,
    age: randomAge(rng),
    position: pos,
    stats: randomStats(rng, pos),
    genome: randomGenome(rng),
    personality: rollPersonality(rng),
  };
}

export function fullName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}

export { genomeMods };
