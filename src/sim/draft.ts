// The draft — prospects are generated, teams pick in snake order (the user
// picks by hand, CPU clubs auto-pick), then every squad is topped up to full
// size so the season can start.
import { DRAFT_POOL_SIZE, SQUAD_SIZE } from '../config.js';
import { type Rng, pick as pickRandom } from './rng.js';
import { generatePlayer, overallRating, type Player, type Position } from './player.js';
import { type Team, autoFillLineup } from './team.js';

export function generateDraftPool(rng: Rng, size = DRAFT_POOL_SIZE): Player[] {
  const pool: Player[] = [];
  for (let i = 0; i < size; i++) pool.push(generatePlayer(rng));
  return pool;
}

export interface DraftState {
  pool: Player[];
  teams: Team[];
  order: string[]; // team id per pick, snake order
  pickIndex: number;
  round: number;
  totalRounds: number;
}

function buildSnakeOrder(teamIds: string[], rounds: number): string[] {
  const order: string[] = [];
  for (let r = 0; r < rounds; r++) {
    const row = r % 2 === 0 ? teamIds : teamIds.slice().reverse();
    order.push(...row);
  }
  return order;
}

export function startDraft(teams: Team[], pool: Player[]): DraftState {
  const rounds = Math.max(1, Math.floor(pool.length / teams.length));
  return {
    pool,
    teams,
    order: buildSnakeOrder(teams.map((t) => t.id), rounds),
    pickIndex: 0,
    round: 1,
    totalRounds: rounds,
  };
}

export function isDraftComplete(state: DraftState): boolean {
  return state.pickIndex >= state.order.length || state.pool.length === 0;
}

export function currentTeam(state: DraftState): Team | undefined {
  if (isDraftComplete(state)) return undefined;
  const id = state.order[state.pickIndex];
  return state.teams.find((t) => t.id === id);
}

export function isUserTurn(state: DraftState): boolean {
  const t = currentTeam(state);
  return !!t && t.isUser;
}

/** Commit a pick: remove the prospect from the pool, add it to the team on the clock. */
export function makePick(state: DraftState, playerId: string): void {
  const team = currentTeam(state);
  if (!team) return;
  const idx = state.pool.findIndex((p) => p.id === playerId);
  if (idx < 0) return;
  const [player] = state.pool.splice(idx, 1);
  team.squad.push(player);
  state.pickIndex++;
  state.round = Math.floor(state.pickIndex / state.teams.length) + 1;
}

const GROUP_TARGETS: Record<Position, number> = { GK: 2, DF: 5, MF: 5, FW: 3 };

function neediestGroup(team: Team): Position {
  const counts: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const p of team.squad) counts[p.position]++;
  let best: Position = 'MF';
  let bestDeficit = -Infinity;
  for (const g of Object.keys(GROUP_TARGETS) as Position[]) {
    const deficit = GROUP_TARGETS[g] - counts[g];
    if (deficit > bestDeficit) { bestDeficit = deficit; best = g; }
  }
  return best;
}

/** One CPU pick: best-rated prospect in the team's neediest group (or best overall if none fit). */
export function cpuAutoPick(state: DraftState, rng: Rng): void {
  const team = currentTeam(state);
  if (!team || state.pool.length === 0) return;
  const group = neediestGroup(team);
  const inGroup = state.pool.filter((p) => p.position === group);
  const candidates = inGroup.length > 0 ? inGroup : state.pool;
  candidates.sort((a, b) => overallRating(b.stats, b.position) - overallRating(a.stats, a.position));
  const topN = candidates.slice(0, Math.min(3, candidates.length));
  const chosen = pickRandom(rng, topN);
  makePick(state, chosen.id);
}

/** Advance the draft, auto-picking for every CPU team, until it's the user's turn or it's over. */
export function runUntilUserTurn(state: DraftState, rng: Rng): void {
  while (!isDraftComplete(state) && !isUserTurn(state)) {
    cpuAutoPick(state, rng);
  }
}

/** Once the draft ends, top every squad up to SQUAD_SIZE with freshly generated players. */
export function finalizeSquads(rng: Rng, teams: Team[]): void {
  for (const team of teams) {
    while (team.squad.length < SQUAD_SIZE) team.squad.push(generatePlayer(rng));
    autoFillLineup(team);
  }
}
