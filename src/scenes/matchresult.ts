// Scene: Match Result — the box score after a played (user) fixture.
import { Scene, type Draw } from '../../engine/webgpu.js';
import { COLORS } from '../config.js';
import { loadFonts, applyTheme, type Fonts } from '../render/theme.js';
import { possessionPct, type MatchState } from '../sim/matchSim.js';
import { advanceRound, isSeasonComplete } from '../state.js';

export class MatchResult extends Scene {
  private fonts!: Fonts;
  private match!: MatchState;

  override async setup(data?: unknown): Promise<void> {
    this.fonts = await loadFonts(this.game);
    applyTheme(this.game.hud.ui, this.fonts);
    this.match = (data as { match: MatchState }).match;
  }

  override update(dt: number): void { super.update(dt); }

  override drawHud(d: Draw): void {
    d.rect(0, 0, d.w, d.h, COLORS.ink);
    const m = this.match;
    const cx = d.w / 2;

    d.ui.label(cx, 60, 'FULL TIME', { size: 16, color: COLORS.cyan, align: 'center' });
    d.ui.label(cx, 90, `${m.home.name}   ${m.score[0]} — ${m.score[1]}   ${m.away.name}`, { size: 26, color: COLORS.gold, align: 'center', bold: true });

    const goals = m.events.filter((e) => e.type === 'goal');
    let y = 150;
    d.ui.label(cx, y, 'Goals', { size: 13, color: COLORS.chalk, align: 'center' });
    y += 22;
    if (goals.length === 0) d.ui.label(cx, y, 'A goalless stalemate.', { size: 12, color: '#9aa4c8', align: 'center' });
    for (const g of goals) {
      const team = g.side === 0 ? m.home : m.away;
      d.ui.label(cx, y, `${Math.floor(g.clockSec / 60)}' ${g.playerName} (${team.name})`, { size: 12, color: COLORS.chalk, align: 'center' });
      y += 18;
    }

    y += 20;
    const [ph, pa] = possessionPct(m);
    const stat = (label: string, h: number, a: number) => {
      d.ui.label(cx - 160, y, String(h), { size: 13, color: COLORS.chalk, align: 'right' });
      d.ui.label(cx, y, label, { size: 12, color: '#9aa4c8', align: 'center' });
      d.ui.label(cx + 160, y, String(a), { size: 13, color: COLORS.chalk, align: 'left' });
      y += 20;
    };
    stat('Possession %', ph, pa);
    stat('Shots', m.stats.shots[0], m.stats.shots[1]);
    stat('On Target', m.stats.onTarget[0], m.stats.onTarget[1]);
    stat('Passes', m.stats.passes[0], m.stats.passes[1]);
    stat('Tackles', m.stats.tackles[0], m.stats.tackles[1]);
    stat('Corners', m.stats.corners[0], m.stats.corners[1]);

    if (d.ui.button(cx - 110, d.h - 90, 220, 50, 'CONTINUE')) {
      advanceRound();
      if (isSeasonComplete()) this.game.go('gameOver');
      else this.game.go('hub');
    }
  }
}
