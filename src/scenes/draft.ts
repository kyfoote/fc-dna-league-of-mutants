// Scene: Draft — prospects generated, snake-drafted by all 8 clubs. The user
// picks by clicking a card; CPU clubs auto-pick instantly in between turns.
import { Scene, type Draw } from '../../engine/webgpu.js';
import { COLORS } from '../config.js';
import { loadFonts, applyTheme, type Fonts } from '../render/theme.js';
import { drawPlayerCard } from '../render/playerCard.js';
import { overallRating } from '../sim/player.js';
import { isDraftComplete, isUserTurn, currentTeam, makePick, runUntilUserTurn } from '../sim/draft.js';
import { getCareer, finishDraftAndScheduleSeason } from '../state.js';

export class Draft extends Scene {
  private fonts!: Fonts;
  private scroll = 0;

  override async setup(): Promise<void> {
    this.fonts = await loadFonts(this.game);
    applyTheme(this.game.hud.ui, this.fonts);
    const c = getCareer();
    if (c.draft) runUntilUserTurn(c.draft, c.rng);
  }

  override update(dt: number): void { super.update(dt); }

  override drawHud(d: Draw): void {
    d.rect(0, 0, d.w, d.h, COLORS.ink);
    const c = getCareer();
    const state = c.draft;
    if (!state) { this.finishUp(); return; }

    d.ui.label(24, 20, 'THE DRAFT', { size: 26, color: COLORS.gold, bold: true });

    if (isDraftComplete(state)) {
      d.ui.label(24, 56, 'Every club has a squad. Time to pick your side.', { size: 14, color: COLORS.chalk });
      if (d.ui.button(24, 90, 240, 48, 'BUILD SQUADS →')) this.finishUp();
      return;
    }

    const team = currentTeam(state)!;
    d.ui.label(24, 56, `Round ${state.round}/${state.totalRounds} — On the clock: ${team.name}${team.isUser ? ' (YOU)' : ''}`, { size: 14, color: COLORS.cyan });
    d.ui.label(24, 78, `Your squad so far: ${c.userTeam.squad.length}   Prospects remaining: ${state.pool.length}`, { size: 12, color: COLORS.chalk });

    if (!isUserTurn(state)) {
      d.ui.label(24, 110, 'CPU clubs are picking…', { size: 13, color: '#9aa4c8' });
      runUntilUserTurn(state, c.rng);
      return;
    }

    const cardW = 190, cardH = 210, gap = 14;
    const top = 110;
    const cols = Math.max(1, Math.floor((d.w - 48) / (cardW + gap)));
    const pool = state.pool.slice().sort((a, b) => overallRating(b.stats, b.position) - overallRating(a.stats, a.position));
    const rows = Math.ceil(pool.length / cols);
    const contentH = rows * (cardH + gap);
    const areaH = d.h - top - 20;

    d.ui.list(24, top, d.w - 48, areaH, contentH, (lx, ly, lw) => {
      pool.forEach((p, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = lx + col * (cardW + gap);
        const y = ly + row * (cardH + gap);
        if (!d.visible(x, y, cardW, cardH)) return;
        if (drawPlayerCard(d, x, y, cardW, cardH, p, { jerseyColor: c.userTeam.primaryColor })) {
          makePick(state, p.id);
          runUntilUserTurn(state, c.rng);
        }
      });
      void lw;
    });
  }

  private finishUp(): void {
    finishDraftAndScheduleSeason();
    this.game.go('hub');
  }
}
