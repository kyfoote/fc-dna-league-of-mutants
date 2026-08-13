// Scene: Game Over — the season's final table. "NEW SEASON" regenerates a
// fresh draft pool and starts the whole loop again.
import { Scene, type Draw } from '../../engine/webgpu.js';
import { COLORS } from '../config.js';
import { loadFonts, applyTheme, type Fonts } from '../render/theme.js';
import { standings } from '../sim/league.js';
import { getCareer, startNewSeason } from '../state.js';

export class GameOver extends Scene {
  private fonts!: Fonts;

  override async setup(_result?: unknown): Promise<void> {
    this.fonts = await loadFonts(this.game);
    applyTheme(this.game.hud.ui, this.fonts);
  }

  override update(dt: number): void { super.update(dt); }

  override drawHud(d: Draw): void {
    d.rect(0, 0, d.w, d.h, COLORS.ink);
    const c = getCareer();
    const table = standings(c.teams);
    const userPos = table.findIndex((t) => t.isUser) + 1;
    const cx = d.w / 2;

    d.ui.label(cx, 40, `SEASON ${c.seasonNumber} COMPLETE`, { size: 24, color: COLORS.gold, align: 'center', bold: true });
    d.ui.label(cx, 74, `${c.userTeam.name} finished ${ordinal(userPos)} of ${table.length}`, { size: 15, color: COLORS.cyan, align: 'center' });

    const top = 110;
    const cols = [cx - 260, cx - 40, cx + 20, cx + 80, cx + 140, cx + 200];
    ['Club', 'P', 'W', 'D', 'L', 'PTS'].forEach((h, i) => d.ui.label(cols[i], top, h, { size: 11, color: '#9aa4c8' }));
    table.forEach((t, i) => {
      const y = top + 26 + i * 26;
      if (t.isUser) d.panel(cx - 270, y - 4, 540, 24, { base: 'flat', fill: '#20304a' });
      d.ui.label(cols[0], y, `${i + 1}. ${t.name}`, { size: 12, color: t.isUser ? COLORS.gold : COLORS.chalk });
      const vals = [t.record.played, t.record.won, t.record.drawn, t.record.lost, t.record.won * 3 + t.record.drawn];
      vals.forEach((v, j) => d.ui.label(cols[j + 1], y, String(v), { size: 12, color: COLORS.chalk }));
    });

    if (d.ui.button(cx - 120, d.h - 90, 240, 52, 'NEW SEASON')) {
      startNewSeason();
      this.gotoTitle();
    }
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
