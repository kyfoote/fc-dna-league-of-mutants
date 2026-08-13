// Scene: Title — the marquee. Loads the shared fonts once, then waits for a
// click/tap/Space to begin the (already-generated) season's draft.
import { Scene, type Draw, type MsdfText } from '../../engine/webgpu.js';
import { COLORS } from '../config.js';
import { loadFonts, applyTheme, type Fonts } from '../render/theme.js';
import { getCareer } from '../state.js';

export class Title extends Scene {
  private fonts!: Fonts;
  private title!: MsdfText;
  private sub!: MsdfText;
  private t = 0;

  override async setup(): Promise<void> {
    this.fonts = await loadFonts(this.game);
    applyTheme(this.game.hud.ui, this.fonts);
    this.title = this.game.assets.msdfText(this.fonts.display, 'FC DNA', {
      fontSize: 88, align: 'center',
      color: { top: '#ffe9a8', bottom: COLORS.gold },
      outline: { width: 0.14, color: '#3a1550' },
      shadow: { x: 0, y: 6, color: '#000', alpha: 0.5, softness: 0.3 },
    });
    this.sub = this.game.assets.msdfText(this.fonts.display, 'LEAGUE OF MUTANTS', {
      fontSize: 30, align: 'center', color: COLORS.cyan,
      outline: { width: 0.12, color: '#0b0e1a' },
    });
    this.input.bind({ start: ['Space', 'Enter'] });
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.input.keys.start.pressed) this.begin();
  }

  private begin(): void {
    getCareer(); // ensures a season (with its draft) exists
    this.game.go('draft');
  }

  override drawHud(d: Draw): void {
    const cx = d.w / 2;
    d.rect(0, 0, d.w, d.h, COLORS.ink);
    // a few drifting rune-glow motes for the fantasy-arcade vibe
    for (let i = 0; i < 14; i++) {
      const s = Math.sin(this.t * 0.6 + i * 1.7) * 0.5 + 0.5;
      const x = ((i * 137) % d.w);
      const y = ((i * 71 + this.t * 12) % (d.h + 40)) - 20;
      d.circle(x, y, 2 + s * 2, i % 2 ? COLORS.cyan : COLORS.violet, 0.25 + s * 0.25);
    }
    d.msdfText(this.title, cx, d.h * 0.30, { origin: { x: 0.5 } });
    d.msdfText(this.sub, cx, d.h * 0.30 + 62, { origin: { x: 0.5 } });

    const bw = 260, bh = 56;
    if (d.panel(cx - bw / 2, d.h * 0.58, bw, bh, { base: 'glossy', hover: true, pressed: true, fill: COLORS.potion, fillTo: '#3f7a2c' }, { label: 'TAP TO BEGIN' }).clicked) {
      this.begin();
    }
    d.ui.label(cx, d.h * 0.58 + bh + 26, 'Draft mutant footballers. Watch them play. Splice the best of them in THE LAB.', {
      size: 13, color: COLORS.chalk, align: 'center', wrap: Math.min(560, d.w - 40),
    });
    d.ui.label(cx, d.h - 22, 'made by kyfoote@gmail.com', { size: 11, color: '#7f8bb0', align: 'center' });
  }
}
