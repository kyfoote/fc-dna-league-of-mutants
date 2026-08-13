// Shared font loading + UI theme setup — called once per scene's setup() so
// every screen looks like the same arcade-cabinet-meets-fantasy cabinet.
import type { Game, MsdfFont } from '../../engine/webgpu.js';
import { fontUrl, FONT_DISPLAY, FONT_UI, COLORS } from '../config.js';

export interface Fonts {
  display: MsdfFont; // Titan One — marquee titles
  ui: MsdfFont;       // Inter — body/UI, also used for widget labels
}

let cached: Fonts | null = null;

export async function loadFonts(game: Game): Promise<Fonts> {
  if (cached) return cached;
  const d = fontUrl(FONT_DISPLAY), u = fontUrl(FONT_UI);
  const [display, ui] = await Promise.all([
    game.assets.msdfFont(d.png, d.json),
    game.assets.msdfFont(u.png, u.json),
  ]);
  cached = { display, ui };
  return cached;
}

/** Apply the game's compact arcade/fantasy theme to a surface's widget layer. */
export function applyTheme(surfaceUi: { setTheme(t: string, o?: { color?: string; text?: string; fontSize?: number }): unknown; setFont(f: MsdfFont | null): unknown }, fonts: Fonts): void {
  surfaceUi.setTheme('compact', { color: COLORS.violet, text: COLORS.chalk, fontSize: 16 });
  surfaceUi.setFont(fonts.ui);
}
