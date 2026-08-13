// Personality quirks — influence AI decisions in the match sim and are shown
// on the player card. Roughly 45% of generated players get one.
import { type Rng, pick, chance } from './rng.js';

export const PERSONALITIES = [
  'ballHog', 'coward', 'rocketLeg', 'playmaker', 'headlessChicken',
  'lazy', 'heroComplex', 'brickWall', 'speedDemon', 'goldenRetriever',
] as const;
export type Personality = typeof PERSONALITIES[number];

export const PERSONALITY_LABEL: Record<Personality, string> = {
  ballHog: 'Ball Hog',
  coward: 'Coward',
  rocketLeg: 'Rocket Leg',
  playmaker: 'Playmaker',
  headlessChicken: 'Headless Chicken',
  lazy: 'Lazy',
  heroComplex: 'Hero Complex',
  brickWall: 'Brick Wall',
  speedDemon: 'Speed Demon',
  goldenRetriever: 'Golden Retriever',
};

export const PERSONALITY_BLURB: Record<Personality, string> = {
  ballHog: 'Rarely passes — wants every shot themselves.',
  coward: 'Shies away from tackles and physical duels.',
  rocketLeg: 'Shoots like a cannon, from anywhere.',
  playmaker: 'Always looking for the killer pass.',
  headlessChicken: 'Moves unpredictably, chaos incarnate.',
  lazy: 'Conserves energy; jogs when others sprint.',
  heroComplex: 'Attempts absurdly difficult shots.',
  brickWall: 'An immovable, relentless defender.',
  speedDemon: 'Blistering pace, dubious decision-making.',
  goldenRetriever: 'Chases the ball no matter where it is.',
};

export function rollPersonality(rng: Rng): Personality | null {
  if (!chance(rng, 0.45)) return null;
  return pick(rng, PERSONALITIES);
}

/** Behavioral dials the match sim reads. All multipliers, 1 = no change. */
export interface PersonalityMods {
  passChance: number; // multiplier on willingness to pass vs dribble/shoot
  tackleWillingness: number;
  shotPower: number;
  shotChance: number; // willingness to shoot from range
  decisionNoise: number; // random deviation added to target position
  staminaDrain: number; // multiplier on fatigue accrual
  chaseBallBias: number; // how strongly they abandon position to chase the ball
}

const DEFAULT_MODS: PersonalityMods = {
  passChance: 1, tackleWillingness: 1, shotPower: 1, shotChance: 1,
  decisionNoise: 1, staminaDrain: 1, chaseBallBias: 1,
};

export function personalityMods(p: Personality | null): PersonalityMods {
  if (!p) return DEFAULT_MODS;
  switch (p) {
    case 'ballHog': return { ...DEFAULT_MODS, passChance: 0.25, shotChance: 1.4 };
    case 'coward': return { ...DEFAULT_MODS, tackleWillingness: 0.35 };
    case 'rocketLeg': return { ...DEFAULT_MODS, shotPower: 1.4 };
    case 'playmaker': return { ...DEFAULT_MODS, passChance: 1.6 };
    case 'headlessChicken': return { ...DEFAULT_MODS, decisionNoise: 2.4 };
    case 'lazy': return { ...DEFAULT_MODS, staminaDrain: 0.5, chaseBallBias: 0.5 };
    case 'heroComplex': return { ...DEFAULT_MODS, shotChance: 1.8, shotPower: 1.1 };
    case 'brickWall': return { ...DEFAULT_MODS, tackleWillingness: 1.6 };
    case 'speedDemon': return { ...DEFAULT_MODS, decisionNoise: 1.3 };
    case 'goldenRetriever': return { ...DEFAULT_MODS, chaseBallBias: 2.2, passChance: 0.8 };
  }
}
