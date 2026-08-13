// Physical genome — the weird-body-trait system. Pure data + pure functions,
// no engine imports, so verify.ts and the renderer both consume the same shape.
import { type Rng, pick, chance } from './rng.js';

export type Height = 'tiny' | 'short' | 'normal' | 'tall' | 'enormous';
export type Body = 'skinny' | 'normal' | 'chunky' | 'huge' | 'round';
export type Legs = 'normal' | 'short' | 'long' | 'four' | 'oneGiant';
export type Head = 'normal' | 'giant' | 'tiny';
export type Arms = 'normal' | 'long';
export type Neck = 'normal' | 'none';
export type Feet = 'normal' | 'massive' | 'tiny';
export type Hair = 'none' | 'mohawk' | 'afro' | 'spiky' | 'long' | 'bald';

export interface Genome {
  height: Height;
  body: Body;
  legs: Legs;
  head: Head;
  arms: Arms;
  neck: Neck;
  feet: Feet;
  hair: Hair;
  skinColor: string;
  hairColor: string;
  horns: boolean;
  tail: boolean;
  cyclops: boolean;
}

export const HEIGHTS: readonly Height[] = ['tiny', 'short', 'normal', 'tall', 'enormous'];
export const BODIES: readonly Body[] = ['skinny', 'normal', 'chunky', 'huge', 'round'];
export const LEGS: readonly Legs[] = ['normal', 'short', 'long', 'four', 'oneGiant'];
export const HEADS: readonly Head[] = ['normal', 'giant', 'tiny'];
export const HAIRS: readonly Hair[] = ['none', 'mohawk', 'afro', 'spiky', 'long', 'bald'];

const SKIN_COLORS = [
  '#f0c39a', '#c68a5e', '#8a5a35', '#5a3a22', '#e8b98c', // human-ish
  '#7ac74f', '#38e1ff', '#ff8a3d', '#b98bff', '#ff2fb0', '#c9c9c9', // unusual
];
const HAIR_COLORS = ['#1c1c1c', '#5a3a22', '#e0473e', '#38e1ff', '#ffd147', '#b98bff', '#eef3ff', '#7ac74f'];

// Weighted picks: 'normal' options dominate so mutations feel special.
function weighted<T>(rng: Rng, options: readonly [T, number][]): T {
  const total = options.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of options) { if ((r -= w) <= 0) return v; }
  return options[options.length - 1][0];
}

export function randomGenome(rng: Rng): Genome {
  return {
    height: weighted(rng, [['tiny', 1], ['short', 2], ['normal', 5], ['tall', 2], ['enormous', 1]]),
    body: weighted(rng, [['skinny', 2], ['normal', 5], ['chunky', 2], ['huge', 1], ['round', 1]]),
    legs: weighted(rng, [['normal', 7], ['short', 2], ['long', 2], ['four', 1], ['oneGiant', 0.5]]),
    head: weighted(rng, [['normal', 8], ['giant', 1], ['tiny', 1]]),
    arms: weighted(rng, [['normal', 6], ['long', 1]]),
    neck: weighted(rng, [['normal', 6], ['none', 1]]),
    feet: weighted(rng, [['normal', 6], ['massive', 1], ['tiny', 1]]),
    hair: pick(rng, HAIRS),
    skinColor: pick(rng, SKIN_COLORS),
    hairColor: pick(rng, HAIR_COLORS),
    horns: chance(rng, 0.08),
    tail: chance(rng, 0.08),
    cyclops: chance(rng, 0.05),
  };
}

/** Gameplay modifiers derived from the genome — weird strengths and weaknesses, not perfectly balanced. */
export interface GenomeMods {
  speedMul: number;
  accelMul: number;
  strengthMul: number;
  dribbleMul: number;
  aerialBonus: number; // interception/heading radius add
  agilityMul: number; // affects reaction/turn quickness
  controlRadiusMul: number; // effective ball control footprint
}

export function genomeMods(g: Genome): GenomeMods {
  let speedMul = 1, accelMul = 1, strengthMul = 1, dribbleMul = 1, aerialBonus = 0, agilityMul = 1, controlRadiusMul = 1;

  switch (g.height) {
    case 'tiny': accelMul *= 1.12; agilityMul *= 1.2; strengthMul *= 0.8; aerialBonus -= 6; break;
    case 'short': accelMul *= 1.05; agilityMul *= 1.08; break;
    case 'tall': aerialBonus += 10; accelMul *= 0.94; break;
    case 'enormous': aerialBonus += 18; accelMul *= 0.85; speedMul *= 0.92; strengthMul *= 1.25; break;
  }
  switch (g.body) {
    case 'skinny': speedMul *= 1.06; strengthMul *= 0.85; break;
    case 'chunky': strengthMul *= 1.1; speedMul *= 0.96; break;
    case 'huge': strengthMul *= 1.3; speedMul *= 0.85; accelMul *= 0.88; break;
    case 'round': strengthMul *= 1.15; speedMul *= 0.9; controlRadiusMul *= 1.1; break;
  }
  switch (g.legs) {
    case 'short': accelMul *= 1.08; speedMul *= 0.94; break;
    case 'long': speedMul *= 1.1; accelMul *= 0.95; break;
    case 'four': accelMul *= 1.2; strengthMul *= 1.05; agilityMul *= 0.85; dribbleMul *= 0.85; controlRadiusMul *= 1.15; break;
    case 'oneGiant': speedMul *= 0.8; accelMul *= 0.75; strengthMul *= 1.1; agilityMul *= 0.7; break;
  }
  if (g.feet === 'massive') { controlRadiusMul *= 1.2; agilityMul *= 0.95; }
  if (g.feet === 'tiny') { controlRadiusMul *= 0.85; agilityMul *= 1.05; }
  if (g.arms === 'long') aerialBonus += 3; // goalkeeping reach flavor
  if (g.cyclops) agilityMul *= 0.95; // depth perception, played for laughs

  return { speedMul, accelMul, strengthMul, dribbleMul, aerialBonus, agilityMul, controlRadiusMul };
}

/** Rough relative visual height in world units — used by the renderer AND the aerial-duel sim. */
export function heightUnits(h: Height): number {
  return { tiny: 16, short: 20, normal: 26, tall: 32, enormous: 40 }[h];
}
