// Career state — persists across scene transitions as a module-level object
// (scenes are disposable; this is not). One career = one season in progress.
import { LEAGUE_CLUBS } from './config.js';
import { type Rng, makeRng } from './sim/rng.js';
import { type Team, generateTeam, autoFillLineup } from './sim/team.js';
import { generateDraftPool, startDraft, finalizeSquads, type DraftState } from './sim/draft.js';
import { generateSchedule, type Fixture, applyResult } from './sim/league.js';
import { createMatch, stepMatch, type MatchState } from './sim/matchSim.js';
import { MATCH_SIM_MINUTES } from './config.js';
import type { GeneticsResult } from './sim/genetics.js';

export interface Career {
  rng: Rng;
  seasonNumber: number;
  teams: Team[];
  userTeam: Team;
  draft: DraftState | null;
  schedule: Fixture[];
  round: number; // next round to play
  lastMatch: { fixture: Fixture; match: MatchState } | null;
  lastLabResult: GeneticsResult | null;
}

let career: Career | null = null;

export function getCareer(): Career {
  if (!career) career = beginSeason(1);
  return career;
}

function beginSeason(seasonNumber: number): Career {
  const rng = makeRng();
  const teams: Team[] = [];
  const userTeam = generateTeam(rng, true);
  teams.push(userTeam);
  for (let i = 1; i < LEAGUE_CLUBS; i++) teams.push(generateTeam(rng, false));
  const pool = generateDraftPool(rng);
  const draft = startDraft(teams, pool);
  return {
    rng, seasonNumber, teams, userTeam, draft,
    schedule: [], round: 1, lastMatch: null, lastLabResult: null,
  };
}

export function startNewSeason(): Career {
  const seasonNumber = career ? career.seasonNumber + 1 : 1;
  career = beginSeason(seasonNumber);
  return career;
}

/** Called once the draft is complete: top up squads, build the schedule. */
export function finishDraftAndScheduleSeason(): void {
  const c = getCareer();
  finalizeSquads(c.rng, c.teams);
  for (const t of c.teams) autoFillLineup(t);
  c.schedule = generateSchedule(c.teams.map((t) => t.id));
  c.draft = null;
  c.round = 1;
}

export function currentRoundFixtures(): Fixture[] {
  const c = getCareer();
  return c.schedule.filter((f) => f.round === c.round);
}

export function userFixtureThisRound(): Fixture | undefined {
  const c = getCareer();
  return currentRoundFixtures().find((f) => f.home === c.userTeam.id || f.away === c.userTeam.id);
}

export function teamById(id: string): Team | undefined {
  return getCareer().teams.find((t) => t.id === id);
}

/** Instantly resolve every fixture in the current round EXCEPT the user's — full sim, just not rendered. */
export function simulateNonUserFixtures(): void {
  const c = getCareer();
  const teamMap = new Map(c.teams.map((t) => [t.id, t]));
  for (const fixture of currentRoundFixtures()) {
    if (fixture.home === c.userTeam.id || fixture.away === c.userTeam.id) continue;
    const home = teamMap.get(fixture.home)!;
    const away = teamMap.get(fixture.away)!;
    const match = createMatch(home, away, c.rng);
    stepMatch(match, MATCH_SIM_MINUTES * 60 + 5);
    applyResult(fixture, teamMap, match.score[0], match.score[1]);
  }
}

export function recordUserFixtureResult(fixture: Fixture, match: MatchState): void {
  const c = getCareer();
  const teamMap = new Map(c.teams.map((t) => [t.id, t]));
  applyResult(fixture, teamMap, match.score[0], match.score[1]);
  c.lastMatch = { fixture, match };
}

export function advanceRound(): void {
  const c = getCareer();
  c.round++;
}

export function isSeasonComplete(): boolean {
  const c = getCareer();
  return c.round > c.schedule.reduce((m, f) => Math.max(m, f.round), 0);
}
