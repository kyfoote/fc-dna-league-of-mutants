// A club — squad, colours, formation/tactics, and its season record.
import { type Rng } from './rng.js';
import { generateClubName, generateClubColors } from './names.js';
import { generatePlayer, type Player, type Position } from './player.js';
import { type FormationName, formationSlots } from './formations.js';
import { DEFAULT_TACTICS, type Tactics } from './tactics.js';

export interface Record_ {
  played: number; won: number; drawn: number; lost: number; gf: number; ga: number;
}
export function emptyRecord(): Record_ {
  return { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
}
export function points(r: Record_): number {
  return r.won * 3 + r.drawn * 1;
}
export function goalDiff(r: Record_): number {
  return r.gf - r.ga;
}

export interface Team {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  isUser: boolean;
  squad: Player[];
  bench: string[]; // player ids not in the lineup
  lineup: (string | null)[]; // parallel to formationSlots(formation)
  formation: FormationName;
  tactics: Tactics;
  record: Record_;
}

let teamIdCounter = 1;
export function generateTeam(rng: Rng, isUser: boolean): Team {
  const { primary, secondary } = generateClubColors(rng);
  return {
    id: `club${teamIdCounter++}`,
    name: generateClubName(rng),
    primaryColor: primary,
    secondaryColor: secondary,
    isUser,
    squad: [],
    bench: [],
    lineup: new Array(11).fill(null),
    formation: '4-4-2',
    tactics: { ...DEFAULT_TACTICS },
    record: emptyRecord(),
  };
}

/** Fill empty lineup slots with the best-fitting available squad player for each slot's group. */
export function autoFillLineup(team: Team): void {
  const slots = formationSlots(team.formation);
  const used = new Set(team.lineup.filter((id): id is string => !!id));
  for (let i = 0; i < slots.length; i++) {
    if (team.lineup[i]) continue;
    const group: Position = slots[i].group;
    const candidates = team.squad
      .filter((p) => !used.has(p.id))
      .sort((a, b) => {
        const aFit = a.position === group ? 1 : 0;
        const bFit = b.position === group ? 1 : 0;
        return bFit - aFit;
      });
    const pick = candidates[0];
    if (pick) { team.lineup[i] = pick.id; used.add(pick.id); }
  }
  team.bench = team.squad.map((p) => p.id).filter((id) => !used.has(id));
}

export function playerById(team: Team, id: string | null | undefined): Player | undefined {
  if (!id) return undefined;
  return team.squad.find((p) => p.id === id);
}
