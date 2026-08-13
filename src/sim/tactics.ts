// Team tactics — four simple dials the match sim reads each tick.
export type Mentality = 'defensive' | 'balanced' | 'attacking';
export type Passing = 'short' | 'balanced' | 'direct';
export type Pressing = 'low' | 'normal' | 'high';
export type Tempo = 'slow' | 'normal' | 'fast';

export interface Tactics {
  mentality: Mentality;
  passing: Passing;
  pressing: Pressing;
  tempo: Tempo;
}

export const DEFAULT_TACTICS: Tactics = {
  mentality: 'balanced', passing: 'balanced', pressing: 'normal', tempo: 'normal',
};

export const MENTALITY_OPTIONS: readonly Mentality[] = ['defensive', 'balanced', 'attacking'];
export const PASSING_OPTIONS: readonly Passing[] = ['short', 'balanced', 'direct'];
export const PRESSING_OPTIONS: readonly Pressing[] = ['low', 'normal', 'high'];
export const TEMPO_OPTIONS: readonly Tempo[] = ['slow', 'normal', 'fast'];

/** How far a team's outfield line pushes up (0 = own box, 1 = halfway further). */
export function lineHeightBias(mentality: Mentality): number {
  return { defensive: -0.08, balanced: 0, attacking: 0.10 }[mentality];
}
/** Preferred pass distance bias (negative = shorter, positive = longer/direct). */
export function passDistanceBias(passing: Passing): number {
  return { short: -0.25, balanced: 0, direct: 0.35 }[passing];
}
/** How aggressively off-ball defenders close down the ball carrier. */
export function pressRadiusBias(pressing: Pressing): number {
  return { low: -40, normal: 0, high: 55 }[pressing];
}
/** Overall movement-speed multiplier for the whole team. */
export function tempoSpeedMul(tempo: Tempo): number {
  return { slow: 0.9, normal: 1.0, fast: 1.12 }[tempo];
}
