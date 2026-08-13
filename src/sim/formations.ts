// Formation templates — 11 positional slots as fractions of the pitch.
// x: 0 = own goal line, 1 = opponent's goal line. y: 0..1 across the width.
// Mirrored for the away team by the match sim (it always attacks toward x=1
// in its own frame, then the renderer flips one side for display).
import type { Position } from './player.js';

export interface Slot {
  role: string;
  group: Position;
  x: number;
  y: number;
}

export type FormationName = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1';
export const FORMATION_NAMES: readonly FormationName[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'];

const F442: Slot[] = [
  { role: 'GK', group: 'GK', x: 0.04, y: 0.50 },
  { role: 'LB', group: 'DF', x: 0.18, y: 0.15 },
  { role: 'CB', group: 'DF', x: 0.16, y: 0.38 },
  { role: 'CB', group: 'DF', x: 0.16, y: 0.62 },
  { role: 'RB', group: 'DF', x: 0.18, y: 0.85 },
  { role: 'LM', group: 'MF', x: 0.45, y: 0.15 },
  { role: 'CM', group: 'MF', x: 0.45, y: 0.38 },
  { role: 'CM', group: 'MF', x: 0.45, y: 0.62 },
  { role: 'RM', group: 'MF', x: 0.45, y: 0.85 },
  { role: 'ST', group: 'FW', x: 0.75, y: 0.38 },
  { role: 'ST', group: 'FW', x: 0.75, y: 0.62 },
];

const F433: Slot[] = [
  { role: 'GK', group: 'GK', x: 0.04, y: 0.50 },
  { role: 'LB', group: 'DF', x: 0.18, y: 0.15 },
  { role: 'CB', group: 'DF', x: 0.16, y: 0.38 },
  { role: 'CB', group: 'DF', x: 0.16, y: 0.62 },
  { role: 'RB', group: 'DF', x: 0.18, y: 0.85 },
  { role: 'CM', group: 'MF', x: 0.42, y: 0.30 },
  { role: 'CM', group: 'MF', x: 0.40, y: 0.50 },
  { role: 'CM', group: 'MF', x: 0.42, y: 0.70 },
  { role: 'LW', group: 'FW', x: 0.75, y: 0.18 },
  { role: 'ST', group: 'FW', x: 0.80, y: 0.50 },
  { role: 'RW', group: 'FW', x: 0.75, y: 0.82 },
];

const F352: Slot[] = [
  { role: 'GK', group: 'GK', x: 0.04, y: 0.50 },
  { role: 'CB', group: 'DF', x: 0.16, y: 0.25 },
  { role: 'CB', group: 'DF', x: 0.14, y: 0.50 },
  { role: 'CB', group: 'DF', x: 0.16, y: 0.75 },
  { role: 'LWB', group: 'MF', x: 0.45, y: 0.08 },
  { role: 'CM', group: 'MF', x: 0.42, y: 0.32 },
  { role: 'CM', group: 'MF', x: 0.40, y: 0.50 },
  { role: 'CM', group: 'MF', x: 0.42, y: 0.68 },
  { role: 'RWB', group: 'MF', x: 0.45, y: 0.92 },
  { role: 'ST', group: 'FW', x: 0.75, y: 0.38 },
  { role: 'ST', group: 'FW', x: 0.75, y: 0.62 },
];

const F4231: Slot[] = [
  { role: 'GK', group: 'GK', x: 0.04, y: 0.50 },
  { role: 'LB', group: 'DF', x: 0.18, y: 0.15 },
  { role: 'CB', group: 'DF', x: 0.16, y: 0.38 },
  { role: 'CB', group: 'DF', x: 0.16, y: 0.62 },
  { role: 'RB', group: 'DF', x: 0.18, y: 0.85 },
  { role: 'CDM', group: 'MF', x: 0.35, y: 0.38 },
  { role: 'CDM', group: 'MF', x: 0.35, y: 0.62 },
  { role: 'LAM', group: 'MF', x: 0.60, y: 0.20 },
  { role: 'CAM', group: 'MF', x: 0.62, y: 0.50 },
  { role: 'RAM', group: 'MF', x: 0.60, y: 0.80 },
  { role: 'ST', group: 'FW', x: 0.82, y: 0.50 },
];

export const FORMATIONS: Record<FormationName, readonly Slot[]> = {
  '4-4-2': F442, '4-3-3': F433, '3-5-2': F352, '4-2-3-1': F4231,
};

export function formationSlots(name: FormationName): readonly Slot[] {
  return FORMATIONS[name];
}
