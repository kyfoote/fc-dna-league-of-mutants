// Scene: Hub ("Team HQ") — squad management, tactics, THE LAB and the league
// table live here as tabs between fixtures. "PLAY MATCH" simulates every other
// fixture in the round instantly, then hands the user's fixture to Play.
import { Scene, type Draw } from '../../engine/webgpu.js';
import { COLORS } from '../config.js';
import { loadFonts, applyTheme, type Fonts } from '../render/theme.js';
import { drawPlayerRow, drawPlayerCard } from '../render/playerCard.js';
import { fullName } from '../sim/player.js';
import { playerById, autoFillLineup, type Team } from '../sim/team.js';
import { FORMATION_NAMES, formationSlots, type FormationName } from '../sim/formations.js';
import { MENTALITY_OPTIONS, PASSING_OPTIONS, PRESSING_OPTIONS, TEMPO_OPTIONS } from '../sim/tactics.js';
import { standings } from '../sim/league.js';
import { combine, type GeneticsResult, type Source } from '../sim/genetics.js';
import { PERSONALITY_LABEL } from '../sim/personality.js';
import { STAT_NAMES } from '../config.js';
import { getCareer, userFixtureThisRound, simulateNonUserFixtures, teamById, isSeasonComplete } from '../state.js';

type Tab = 'squad' | 'tactics' | 'lab' | 'league';

export class Hub extends Scene {
  private fonts!: Fonts;
  private tab: Tab = 'squad';
  private selectedId: string | null = null;
  private labA: string | null = null;
  private labB: string | null = null;
  private labReveal: GeneticsResult | null = null;

  override async setup(): Promise<void> {
    this.fonts = await loadFonts(this.game);
    applyTheme(this.game.hud.ui, this.fonts);
  }

  override update(dt: number): void { super.update(dt); }

  override drawHud(d: Draw): void {
    d.rect(0, 0, d.w, d.h, COLORS.ink);
    const c = getCareer();
    const team = c.userTeam;

    d.ui.label(24, 16, `${team.name}`, { size: 24, color: COLORS.gold, bold: true });
    d.ui.label(24, 44, `Season ${c.seasonNumber} · Round ${c.round}/${c.schedule.reduce((m, f) => Math.max(m, f.round), 0)}`, { size: 12, color: COLORS.chalk });

    const tabs: [Tab, string][] = [['squad', 'SQUAD'], ['tactics', 'TACTICS'], ['lab', 'THE LAB'], ['league', 'LEAGUE']];
    tabs.forEach(([key, label], i) => {
      const x = 24 + i * 150;
      if (d.panel(x, 66, 140, 34, { base: this.tab === key ? 'glossy' : 'panel', hover: true, pressed: true, interactive: true }, { label }).clicked) this.tab = key;
    });

    const bodyY = 116;
    if (this.tab === 'squad') this.drawSquad(d, team, bodyY);
    else if (this.tab === 'tactics') this.drawTactics(d, team, bodyY);
    else if (this.tab === 'lab') this.drawLab(d, team, bodyY);
    else this.drawLeague(d, bodyY);

    this.drawPlayBar(d);
  }

  private drawPlayBar(d: Draw): void {
    const c = getCareer();
    const fixture = userFixtureThisRound();
    const barY = d.h - 64;
    d.panel(0, barY, d.w, 64, 'panel');
    if (isSeasonComplete() || !fixture) {
      d.ui.label(24, barY + 22, 'Season complete.', { size: 14, color: COLORS.chalk });
      return;
    }
    const oppId = fixture.home === c.userTeam.id ? fixture.away : fixture.home;
    const opp = teamById(oppId);
    const venue = fixture.home === c.userTeam.id ? 'HOME' : 'AWAY';
    d.ui.label(24, barY + 12, `Next: vs ${opp?.name ?? '?'} (${venue})`, { size: 14, color: COLORS.chalk });
    d.ui.label(24, barY + 32, `Formation ${c.userTeam.formation} · ${c.userTeam.tactics.mentality} / ${c.userTeam.tactics.passing} / ${c.userTeam.tactics.pressing} press / ${c.userTeam.tactics.tempo} tempo`, { size: 11, color: COLORS.runeGreen });
    const bw = 200, bh = 44;
    if (d.panel(d.w - bw - 24, barY + 10, bw, bh, { base: 'glossy', hover: true, pressed: true, fill: COLORS.magenta, fillTo: '#7a1560' }, { label: 'PLAY MATCH ▶' }).clicked) {
      simulateNonUserFixtures();
      const home = teamById(fixture.home)!, away = teamById(fixture.away)!;
      this.game.go('play', { fixture, home, away });
    }
  }

  // ── SQUAD ──────────────────────────────────────────────────────────────────
  private drawSquad(d: Draw, team: Team, top: number): void {
    d.ui.label(24, top, 'Formation', { size: 12, color: COLORS.chalk });
    const newFormation = d.ui.select(120, top - 4, 120, 26, team.formation, FORMATION_NAMES);
    if (newFormation !== team.formation) {
      team.formation = newFormation;
      team.lineup = new Array(formationSlots(newFormation).length).fill(null);
      autoFillLineup(team);
      this.selectedId = null;
    }
    d.ui.label(260, top, 'Click a player, then click another to swap them.', { size: 11, color: '#9aa4c8' });

    const colW = (d.w - 72) / 2;
    const listTop = top + 32;
    const rowH = 52, gap = 6;
    const slots = formationSlots(team.formation);

    d.ui.label(24, listTop, 'STARTING XI', { size: 13, color: COLORS.gold, bold: true });
    slots.forEach((slot, i) => {
      const y = listTop + 22 + i * (rowH + gap);
      const p = playerById(team, team.lineup[i]);
      if (!p) {
        d.panel(24, y, colW, rowH, 'inset');
        d.ui.label(24 + 10, y + rowH / 2 - 6, `${slot.role} — empty`, { size: 12, color: '#7f8bb0' });
        return;
      }
      const clicked = drawPlayerRow(d, 24, y, colW, rowH, p, { jerseyColor: team.primaryColor, selected: this.selectedId === p.id });
      d.ui.label(24 + colW - 34, y + 6, slot.role, { size: 11, color: COLORS.cyan });
      if (clicked) this.onPick(team, p.id);
    });

    const benchX = 24 + colW + 24;
    d.ui.label(benchX, listTop, 'BENCH', { size: 13, color: COLORS.gold, bold: true });
    const bench = team.squad.filter((p) => !team.lineup.includes(p.id));
    const areaTop = listTop + 22;
    const areaH = Math.max(rowH, d.h - 90 - areaTop);
    d.ui.list(benchX, areaTop, colW, areaH, bench.length * (rowH + gap), (lx, ly, lw) => {
      bench.forEach((p, i) => {
        const y = ly + i * (rowH + gap);
        if (!d.visible(lx, y, lw, rowH)) return;
        const clicked = drawPlayerRow(d, lx, y, lw, rowH, p, { jerseyColor: team.primaryColor, selected: this.selectedId === p.id });
        if (clicked) this.onPick(team, p.id);
      });
    });
  }

  private onPick(team: Team, id: string): void {
    if (!this.selectedId) { this.selectedId = id; return; }
    if (this.selectedId === id) { this.selectedId = null; return; }
    const iA = team.lineup.indexOf(this.selectedId);
    const iB = team.lineup.indexOf(id);
    if (iA >= 0 && iB >= 0) { team.lineup[iA] = id; team.lineup[iB] = this.selectedId; }
    else if (iA >= 0 && iB < 0) { team.lineup[iA] = id; }
    else if (iA < 0 && iB >= 0) { team.lineup[iB] = this.selectedId; }
    this.selectedId = null;
  }

  // ── TACTICS ────────────────────────────────────────────────────────────────
  private drawTactics(d: Draw, team: Team, top: number): void {
    d.ui.label(24, top, 'Four simple dials shape how your side plays — no spreadsheets.', { size: 13, color: COLORS.chalk });
    const rowY = top + 40;
    const col = (d.w - 72) / 4;
    d.ui.label(24, rowY, 'MENTALITY', { size: 12, color: COLORS.gold });
    team.tactics.mentality = d.ui.select(24, rowY + 20, col - 20, 32, team.tactics.mentality, MENTALITY_OPTIONS);
    d.ui.label(24 + col, rowY, 'PASSING', { size: 12, color: COLORS.gold });
    team.tactics.passing = d.ui.select(24 + col, rowY + 20, col - 20, 32, team.tactics.passing, PASSING_OPTIONS);
    d.ui.label(24 + col * 2, rowY, 'PRESSING', { size: 12, color: COLORS.gold });
    team.tactics.pressing = d.ui.select(24 + col * 2, rowY + 20, col - 20, 32, team.tactics.pressing, PRESSING_OPTIONS);
    d.ui.label(24 + col * 3, rowY, 'TEMPO', { size: 12, color: COLORS.gold });
    team.tactics.tempo = d.ui.select(24 + col * 3, rowY + 20, col - 20, 32, team.tactics.tempo, TEMPO_OPTIONS);
  }

  // ── THE LAB ────────────────────────────────────────────────────────────────
  private drawLab(d: Draw, team: Team, top: number): void {
    if (this.labReveal) { this.drawLabReveal(d, top); return; }

    d.ui.label(24, top, 'Pick two squad members to splice their genes into one new footballer.', { size: 13, color: COLORS.chalk });
    const cardW = 220, cardH = 240;
    const ax = 24, bx = 24 + cardW + 40;
    const py = top + 30;
    d.panel((ax + bx + cardW) / 2 - 30, py + cardH / 2 - 30, 60, 60, { base: 'glossy', fill: COLORS.violet, fillTo: '#3a1550', radius: 'pill' });
    d.ui.label((ax + bx + cardW) / 2, py + cardH / 2 + 4, '🧪', { size: 24, align: 'center' });

    const a = this.labA ? playerById(team, this.labA) : undefined;
    const b = this.labB ? playerById(team, this.labB) : undefined;
    if (a) drawPlayerCard(d, ax, py, cardW, cardH, a, { jerseyColor: team.primaryColor, selected: true });
    else { d.panel(ax, py, cardW, cardH, { base: 'inset', radius: 16 }); d.ui.label(ax + cardW / 2, py + cardH / 2, 'Parent A', { size: 13, color: '#7f8bb0', align: 'center' }); }
    if (b) drawPlayerCard(d, bx, py, cardW, cardH, b, { jerseyColor: team.primaryColor, selected: true });
    else { d.panel(bx, py, cardW, cardH, { base: 'inset', radius: 16 }); d.ui.label(bx + cardW / 2, py + cardH / 2, 'Parent B', { size: 13, color: '#7f8bb0', align: 'center' }); }

    const canCombine = !!(a && b);
    const btnX = bx + cardW + 40;
    if (canCombine && d.panel(btnX, py + cardH / 2 - 28, 180, 56, { base: 'glossy', hover: true, pressed: true, fill: COLORS.gold, fillTo: '#8a6a10' }, { label: 'COMBINE!' }).clicked) {
      const c = getCareer();
      const result = combine(c.rng, a!, b!);
      team.squad.push(result.child);
      this.labReveal = result;
      this.labA = null; this.labB = null;
    }

    const listY = py + cardH + 30;
    d.ui.label(24, listY, 'Squad', { size: 13, color: COLORS.gold, bold: true });
    const rowH = 48, gap = 6;
    const areaH = Math.max(rowH, d.h - 90 - (listY + 20));
    d.ui.list(24, listY + 20, d.w - 48, areaH, team.squad.length * (rowH + gap), (lx, ly, lw) => {
      team.squad.forEach((p, i) => {
        const y = ly + i * (rowH + gap);
        if (!d.visible(lx, y, lw, rowH)) return;
        const selected = p.id === this.labA || p.id === this.labB;
        if (drawPlayerRow(d, lx, y, lw, rowH, p, { jerseyColor: team.primaryColor, selected })) {
          if (selected) { if (this.labA === p.id) this.labA = null; else this.labB = null; }
          else if (!this.labA) this.labA = p.id;
          else if (!this.labB) this.labB = p.id;
        }
      });
    });
  }

  private drawLabReveal(d: Draw, top: number): void {
    const r = this.labReveal!;
    const team = getCareer().userTeam;
    d.ui.label(24, top, `${fullName(r.child)} is born!`, { size: 20, color: COLORS.gold, bold: true });
    const cardW = 220, cardH = 240;
    drawPlayerCard(d, 24, top + 30, cardW, cardH, r.child, { jerseyColor: team.primaryColor });

    const listX = 24 + cardW + 40;
    d.ui.label(listX, top + 30, 'Where it came from:', { size: 13, color: COLORS.chalk });
    const sourceLabel = (s: Source) => (s === 'A' ? 'Parent A' : s === 'B' ? 'Parent B' : 'MUTATION!');
    const sourceColor = (s: Source) => (s === 'A' ? COLORS.cyan : s === 'B' ? COLORS.magenta : COLORS.gold);
    let y = top + 54;
    for (const name of STAT_NAMES) {
      const src = r.breakdown.statSources[name];
      d.ui.label(listX, y, `${name}: ${r.child.stats[name]}`, { size: 11, color: COLORS.chalk });
      d.ui.label(listX + 160, y, sourceLabel(src), { size: 11, color: sourceColor(src) });
      y += 16;
    }
    y += 8;
    const genomeEntries: [string, Source][] = [
      ['height', r.breakdown.genomeSources.height], ['body', r.breakdown.genomeSources.body],
      ['legs', r.breakdown.genomeSources.legs], ['head', r.breakdown.genomeSources.head],
      ['horns', r.breakdown.genomeSources.horns], ['tail', r.breakdown.genomeSources.tail],
      ['cyclops', r.breakdown.genomeSources.cyclops],
    ];
    for (const [label, src] of genomeEntries) {
      d.ui.label(listX, y, label, { size: 11, color: COLORS.chalk });
      d.ui.label(listX + 160, y, sourceLabel(src), { size: 11, color: sourceColor(src) });
      y += 16;
    }
    d.ui.label(listX, y + 4, `Personality: ${r.child.personality ? PERSONALITY_LABEL[r.child.personality] : 'none'} (${sourceLabel(r.breakdown.personalitySource)})`, { size: 11, color: COLORS.chalk });

    if (d.ui.button(24, top + cardH + 44, 220, 44, 'BACK TO THE LAB')) this.labReveal = null;
  }

  // ── LEAGUE ─────────────────────────────────────────────────────────────────
  private drawLeague(d: Draw, top: number): void {
    const c = getCareer();
    const table = standings(c.teams);
    d.ui.label(24, top, 'LEAGUE TABLE', { size: 16, color: COLORS.gold, bold: true });
    const headerY = top + 28;
    const cols = [24, 240, 300, 340, 380, 420, 460, 500, 540];
    ['Club', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'PTS'].forEach((h, i) => d.ui.label(cols[i], headerY, h, { size: 11, color: '#9aa4c8' }));
    table.forEach((t, i) => {
      const y = headerY + 24 + i * 26;
      if (t.isUser) d.panel(20, y - 4, cols[8] + 60, 24, { base: 'flat', fill: '#20304a' });
      d.ui.label(cols[0], y, `${i + 1}. ${t.name}`, { size: 12, color: t.isUser ? COLORS.gold : COLORS.chalk });
      const r = t.record;
      const vals = [r.played, r.won, r.drawn, r.lost, r.gf, r.ga, r.gf - r.ga, r.won * 3 + r.drawn];
      vals.forEach((v, j) => d.ui.label(cols[j + 1], y, String(v), { size: 12, color: COLORS.chalk }));
    });
  }
}
