// A small seedable PRNG so draft pools / matches can be regenerated on demand.
// Pure logic, no engine imports — safe for verify.ts to import directly.
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let sharedSeed = 1;
/** Module-level RNG used by generators that don't care about reproducibility. */
export function nextSeed(): number {
  sharedSeed = (sharedSeed * 48271) % 2147483647;
  return sharedSeed;
}

export function makeRng(): Rng {
  return mulberry32((Date.now() ^ nextSeed()) >>> 0);
}

export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randFloat(rng: Rng, min: number, max: number): number {
  return rng() * (max - min) + min;
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
