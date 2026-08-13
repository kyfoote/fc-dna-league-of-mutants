// THE LAB — genetic combination of two footballers into one child. For every
// characteristic: ~40% chance near Parent A, ~40% chance near Parent B, ~20%
// chance of mutation/random variation. Stats never simply average.
import { STAT_NAMES, STAT_MIN, STAT_MAX, GENE_PARENT_A_CHANCE, GENE_PARENT_B_CHANCE, GENE_STAT_JITTER } from '../config.js';
import { type Rng, randInt, clamp, pick, chance } from './rng.js';
import { generatePersonName } from './names.js';
import {
  type Genome, HEIGHTS, BODIES, LEGS, HEADS, HAIRS,
} from './genome.js';
import { PERSONALITIES, rollPersonality, type Personality } from './personality.js';
import { type Player, type Stats, type StatName, type Position, POSITIONS, nextPlayerId, overallRating } from './player.js';

export type Source = 'A' | 'B' | 'mutation';

function rollSource(rng: Rng): Source {
  const r = rng();
  if (r < GENE_PARENT_A_CHANCE) return 'A';
  if (r < GENE_PARENT_A_CHANCE + GENE_PARENT_B_CHANCE) return 'B';
  return 'mutation';
}

/** Inherit a value from A/B (with jitter) or roll a fresh one on mutation. */
function inheritEnum<T>(rng: Rng, a: T, b: T, domain: readonly T[]): { value: T; source: Source } {
  const source = rollSource(rng);
  if (source === 'A') return { value: a, source };
  if (source === 'B') return { value: b, source };
  return { value: pick(rng, domain), source };
}

function inheritBool(rng: Rng, a: boolean, b: boolean): { value: boolean; source: Source } {
  const source = rollSource(rng);
  if (source === 'A') return { value: a, source };
  if (source === 'B') return { value: b, source };
  return { value: chance(rng, 0.5), source }; // mutation can spontaneously add/remove
}

function inheritStat(rng: Rng, a: number, b: number): { value: number; source: Source } {
  const source = rollSource(rng);
  if (source === 'A') return { value: clamp(a + randInt(rng, -GENE_STAT_JITTER, GENE_STAT_JITTER), STAT_MIN, STAT_MAX), source };
  if (source === 'B') return { value: clamp(b + randInt(rng, -GENE_STAT_JITTER, GENE_STAT_JITTER), STAT_MIN, STAT_MAX), source };
  return { value: randInt(rng, STAT_MIN, STAT_MAX), source }; // wild card — could be amazing or terrible
}

export interface GeneticsBreakdown {
  statSources: Record<StatName, Source>;
  genomeSources: Record<keyof Genome, Source>;
  positionSource: Source;
  personalitySource: Source;
}

export interface GeneticsResult {
  child: Player;
  breakdown: GeneticsBreakdown;
}

export function combine(rng: Rng, a: Player, b: Player): GeneticsResult {
  // Stats
  const stats = {} as Stats;
  const statSources = {} as Record<StatName, Source>;
  for (const name of STAT_NAMES) {
    const { value, source } = inheritStat(rng, a.stats[name], b.stats[name]);
    stats[name] = value;
    statSources[name] = source;
  }

  // Position
  const posRoll = inheritEnum(rng, a.position, b.position, POSITIONS);
  const position: Position = posRoll.value;

  // Genome, field by field
  const height = inheritEnum(rng, a.genome.height, b.genome.height, HEIGHTS);
  const body = inheritEnum(rng, a.genome.body, b.genome.body, BODIES);
  const legs = inheritEnum(rng, a.genome.legs, b.genome.legs, LEGS);
  const head = inheritEnum(rng, a.genome.head, b.genome.head, HEADS);
  const arms = inheritEnum(rng, a.genome.arms, b.genome.arms, ['normal', 'long'] as const);
  const neck = inheritEnum(rng, a.genome.neck, b.genome.neck, ['normal', 'none'] as const);
  const feet = inheritEnum(rng, a.genome.feet, b.genome.feet, ['normal', 'massive', 'tiny'] as const);
  const hair = inheritEnum(rng, a.genome.hair, b.genome.hair, HAIRS);
  const skinColor = inheritEnum(rng, a.genome.skinColor, b.genome.skinColor, [a.genome.skinColor, b.genome.skinColor]);
  const hairColor = inheritEnum(rng, a.genome.hairColor, b.genome.hairColor, [a.genome.hairColor, b.genome.hairColor]);
  const horns = inheritBool(rng, a.genome.horns, b.genome.horns);
  const tail = inheritBool(rng, a.genome.tail, b.genome.tail);
  const cyclops = inheritBool(rng, a.genome.cyclops, b.genome.cyclops);

  const genome: Genome = {
    height: height.value, body: body.value, legs: legs.value, head: head.value,
    arms: arms.value, neck: neck.value, feet: feet.value, hair: hair.value,
    skinColor: skinColor.value, hairColor: hairColor.value,
    horns: horns.value, tail: tail.value, cyclops: cyclops.value,
  };
  const genomeSources: Record<keyof Genome, Source> = {
    height: height.source, body: body.source, legs: legs.source, head: head.source,
    arms: arms.source, neck: neck.source, feet: feet.source, hair: hair.source,
    skinColor: skinColor.source, hairColor: hairColor.source,
    horns: horns.source, tail: tail.source, cyclops: cyclops.source,
  };

  // Personality
  const persSource = rollSource(rng);
  let personality: Personality | null;
  if (persSource === 'A') personality = a.personality;
  else if (persSource === 'B') personality = b.personality;
  else personality = rollPersonality(rng) ?? pick(rng, PERSONALITIES);

  const { first, last } = generatePersonName(rng);
  const child: Player = {
    id: nextPlayerId(),
    firstName: first,
    lastName: last,
    age: 16, // freshly "born" from the lab
    position,
    stats,
    genome,
    personality,
    parentage: { a: a.id, b: b.id, sourceByStat: statSources },
  };

  return {
    child,
    breakdown: { statSources, genomeSources, positionSource: posRoll.source, personalitySource: persSource },
  };
}

export function childOverall(child: Player): number {
  return overallRating(child.stats, child.position);
}
