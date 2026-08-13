// The season — a single round-robin schedule and the standings table.
import { WIN_POINTS, DRAW_POINTS, LOSS_POINTS } from '../config.js';
import { type Team, points, goalDiff, type Record_ } from './team.js';

export interface Fixture {
  round: number;
  home: string; // team id
  away: string; // team id
  played: boolean;
  homeScore?: number;
  awayScore?: number;
}

/** Circle-method single round-robin: n teams (n even) → n-1 rounds, n/2 fixtures each. */
export function generateSchedule(teamIds: string[]): Fixture[] {
  const ids = teamIds.slice();
  if (ids.length % 2 !== 0) ids.push('__bye__');
  const n = ids.length;
  const rounds = n - 1;
  const fixtures: Fixture[] = [];
  const arr = ids.slice();
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== '__bye__' && away !== '__bye__') {
        // Alternate home/away across rounds so it isn't always the same side at home.
        const swapped = r % 2 === 1;
        fixtures.push({ round: r + 1, home: swapped ? away : home, away: swapped ? home : away, played: false });
      }
    }
    // rotate all but the first element
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return fixtures;
}

export function applyResult(fixture: Fixture, teams: Map<string, Team>, homeScore: number, awayScore: number): void {
  fixture.played = true;
  fixture.homeScore = homeScore;
  fixture.awayScore = awayScore;
  const home = teams.get(fixture.home)!;
  const away = teams.get(fixture.away)!;
  home.record.played++; away.record.played++;
  home.record.gf += homeScore; home.record.ga += awayScore;
  away.record.gf += awayScore; away.record.ga += homeScore;
  if (homeScore > awayScore) { home.record.won++; away.record.lost++; }
  else if (homeScore < awayScore) { away.record.won++; home.record.lost++; }
  else { home.record.drawn++; away.record.drawn++; }
}

export function standings(teams: Team[]): Team[] {
  return teams.slice().sort((a, b) => {
    const pa = points(a.record), pb = points(b.record);
    if (pb !== pa) return pb - pa;
    const gda = goalDiff(a.record), gdb = goalDiff(b.record);
    if (gdb !== gda) return gdb - gda;
    if (b.record.gf !== a.record.gf) return b.record.gf - a.record.gf;
    return a.name.localeCompare(b.name);
  });
}

export function fixturesForRound(fixtures: Fixture[], round: number): Fixture[] {
  return fixtures.filter((f) => f.round === round);
}

export function totalRounds(fixtures: Fixture[]): number {
  return fixtures.reduce((m, f) => Math.max(m, f.round), 0);
}

export { WIN_POINTS, DRAW_POINTS, LOSS_POINTS };
