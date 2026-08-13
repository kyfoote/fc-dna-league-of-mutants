// Scene: Play — the match. The user never controls a player: this renders an
// AI-vs-AI simulation the player watches, with pause + speed controls.
import { Scene, type Draw } from '../../engine/webgpu.js';
import { COLORS, SIM_SECONDS_PER_REAL_SECOND } from '../config.js';
import { loadFonts, applyTheme, type Fonts } from '../render/theme.js';
import { fitPitch, drawPitch, drawBall, toScreen, pitchScale, type PitchRect } from '../render/pitch.js';
import { drawPlayerFigure } from '../render/playerArt.js';
import { createMatch, stepMatch, isFullTime, possessionPct, type MatchState } from '../sim/matchSim.js';
import type { Fixture } from '../sim/league.js';
import type { Team } from '../sim/team.js';
import { getCareer, recordUserFixtureResult } from '../state.js';

interface PlayData { fixture: Fixture; home: Team; away: Team; }

export class Play extends Scene {
  private fonts!: Fonts;
  private match!: MatchState;
  private fixture!: Fixture;
  private paused = false;
  private speed: 1 | 2 | 4 = 2;
  private reported = false;

  override async setup(data?: unknown): Promise<void> {
    this.fonts = await loadFonts(this.game);
    applyTheme(this.game.hud.ui, this.fonts);
    const { fixture, home, away } = data as PlayData;
    this.fixture = fixture;
    this.match = createMatch(home, away, getCareer().rng);
  }

  override update(dt: number): void {
    super.update(dt);
    if (this.paused || this.reported) return;
    const dtSim = Math.min(dt, 0.05) * this.speed * SIM_SECONDS_PER_REAL_SECOND;
    stepMatch(this.match, dtSim);
    if (isFullTime(this.match) && !this.reported) {
      this.reported = true;
      recordUserFixtureResult(this.fixture, this.match);
      this.game.go('matchresult', { match: this.match });
    }
  }

  private pitchRect(d: Draw): PitchRect {
    return fitPitch(16, 96, d.w - 32, d.h - 96 - 96);
  }

  override drawHud(d: Draw): void {
    d.rect(0, 0, d.w, d.h, COLORS.ink);
    const m = this.match;
    const rect = this.pitchRect(d);
    drawPitch(d, rect);

    const ownerId = m.ball.ownerId;
    for (const mp of m.players) {
      const { x, y } = toScreen(rect, mp.pos.x, mp.pos.y);
      const jersey = mp.side === 0 ? m.home.primaryColor : m.away.secondaryColor;
      drawPlayerFigure(d, x, y, jersey, mp.player.genome, { scale: pitchScale(rect) * 1.1, glow: mp.player.id === ownerId });
    }
    drawBall(d, rect, m.ball.pos.x, m.ball.pos.y);

    // top bar: score + clock
    d.panel(0, 0, d.w, 64, 'panel');
    const mins = Math.floor(m.clockSec / 60);
    const secs = Math.floor(m.clockSec % 60);
    d.ui.label(24, 14, m.home.name, { size: 16, color: COLORS.chalk, bold: true });
    d.ui.label(d.w - 24, 14, m.away.name, { size: 16, color: COLORS.chalk, align: 'right', bold: true });
    d.ui.label(d.w / 2, 10, `${m.score[0]} — ${m.score[1]}`, { size: 26, color: COLORS.gold, align: 'center', bold: true });
    d.ui.label(d.w / 2, 38, `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}  H${m.half}  ${phaseLabel(m.phase)}`, { size: 12, color: COLORS.cyan, align: 'center' });
    const [ph, pa] = possessionPct(m);
    d.ui.label(d.w / 2, 52, `Possession ${ph}% — ${pa}%`, { size: 10, color: '#9aa4c8', align: 'center' });

    // bottom bar: pause + speed
    const barY = d.h - 56;
    d.panel(0, barY, d.w, 56, 'panel');
    if (d.panel(16, barY + 8, 100, 40, { base: this.paused ? 'glossy' : 'panel', hover: true, pressed: true, interactive: true }, { label: this.paused ? 'RESUME' : 'PAUSE' }).clicked) this.paused = !this.paused;
    ([1, 2, 4] as const).forEach((s, i) => {
      const x = 130 + i * 70;
      if (d.panel(x, barY + 8, 60, 40, { base: this.speed === s ? 'glossy' : 'panel', hover: true, pressed: true, interactive: true }, { label: `${s}x` }).clicked) this.speed = s;
    });
    d.ui.label(d.w - 200, barY + 22, `Shots ${m.stats.shots[0]}-${m.stats.shots[1]} · Corners ${m.stats.corners[0]}-${m.stats.corners[1]}`, { size: 11, color: '#9aa4c8' });
  }
}

function phaseLabel(phase: MatchState['phase']): string {
  switch (phase) {
    case 'kickoff': return 'KICK OFF';
    case 'throwin': return 'THROW-IN';
    case 'goalkick': return 'GOAL KICK';
    case 'corner': return 'CORNER';
    case 'halftime': return 'HALF TIME';
    case 'fulltime': return 'FULL TIME';
    default: return '';
  }
}
