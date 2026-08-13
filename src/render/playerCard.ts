// Player card / row rendering — the draft card, squad row and lab parent slot
// all share this. Built from d.panel + d.ui.label + the procedural figure, so
// nothing here allocates a retained text object per frame.
import type { Draw } from '../../engine/webgpu.js';
import { COLORS } from '../config.js';
import { overallRating, fullName, type Player } from '../sim/player.js';
import { PERSONALITY_LABEL } from '../sim/personality.js';
import { drawPlayerFigure } from './playerArt.js';

const TRAIT_TAGS: Record<string, (g: Player['genome']) => string[]> = {
  tags: (g) => {
    const tags: string[] = [];
    if (g.height !== 'normal') tags.push(g.height);
    if (g.body !== 'normal') tags.push(g.body);
    if (g.legs !== 'normal') tags.push(g.legs === 'four' ? '4 legs' : g.legs === 'oneGiant' ? '1 giant leg' : g.legs);
    if (g.head !== 'normal') tags.push(`${g.head} head`);
    if (g.horns) tags.push('horns');
    if (g.tail) tags.push('tail');
    if (g.cyclops) tags.push('cyclops');
    return tags;
  },
};
export function traitTags(g: Player['genome']): string[] { return TRAIT_TAGS.tags(g); }

function statBar(d: Draw, x: number, y: number, w: number, label: string, value: number): void {
  d.ui.label(x, y, label, { size: 10, color: COLORS.chalk });
  d.panel(x + 46, y - 1, w - 46, 8, 'inset');
  const frac = Math.max(0, Math.min(1, value / 99));
  d.panel(x + 47, y, (w - 48) * frac, 6, { base: 'bar', fill: frac > 0.66 ? COLORS.potion : frac > 0.4 ? COLORS.gold : COLORS.magenta });
}

export interface CardOpts {
  selected?: boolean;
  jerseyColor?: string;
  compact?: boolean;
}

/** A vertical draft/lab card: figure up top, name + tags + stats below. Returns click state. */
export function drawPlayerCard(d: Draw, x: number, y: number, w: number, h: number, player: Player, opts: CardOpts = {}): boolean {
  const state = d.panel(x, y, w, h, opts.selected
    ? { base: 'glossy', hover: true, pressed: true, interactive: true, fill: COLORS.violet, fillTo: '#3a1550', border: 3, borderColor: COLORS.gold }
    : { base: 'panel', hover: true, pressed: true, interactive: true, fill: '#181e34', fillTo: '#111624' });
  const jersey = opts.jerseyColor ?? '#3a4a6b';
  drawPlayerFigure(d, x + w / 2, y + h * 0.42, jersey, player.genome, { scale: (h * 0.3) / 26 });
  const ovr = overallRating(player.stats, player.position);
  d.ui.label(x + 10, y + h * 0.46, fullName(player), { size: 13, color: COLORS.chalk, bold: true });
  d.ui.label(x + 10, y + h * 0.46 + 16, `${player.position} · OVR ${ovr} · Age ${player.age}`, { size: 11, color: COLORS.runeGreen });
  if (player.personality) d.ui.label(x + 10, y + h * 0.46 + 32, PERSONALITY_LABEL[player.personality], { size: 11, color: COLORS.magenta });
  const tags = traitTags(player.genome);
  if (tags.length) d.ui.label(x + 10, y + h * 0.46 + 48, tags.join(', '), { size: 10, color: COLORS.cyan, wrap: w - 20 });
  const statsY = y + h * 0.46 + (tags.length ? 66 : 50);
  const keyStats: [string, number][] = player.position === 'GK'
    ? [['GK', player.stats.goalkeeping], ['STR', player.stats.strength], ['PAS', player.stats.passing]]
    : [['SPD', player.stats.speed], ['PAS', player.stats.passing], ['SHO', player.stats.shooting], ['TCK', player.stats.tackling]];
  keyStats.forEach(([label, value], i) => statBar(d, x + 10, statsY + i * 14, w - 20, label, value));
  return state.clicked;
}

/** A compact horizontal row: figure left, name/tags centre, OVR right. Returns click state. */
export function drawPlayerRow(d: Draw, x: number, y: number, w: number, h: number, player: Player, opts: CardOpts = {}): boolean {
  const state = d.panel(x, y, w, h, opts.selected
    ? { base: 'glossy', hover: true, pressed: true, interactive: true, fill: COLORS.violet, fillTo: '#3a1550', border: 3, borderColor: COLORS.gold }
    : { base: 'flat', hover: true, pressed: true, interactive: true, fill: '#181e34', fillTo: '#141a2c' });
  const jersey = opts.jerseyColor ?? '#3a4a6b';
  drawPlayerFigure(d, x + h * 0.55, y + h * 0.82, jersey, player.genome, { scale: (h * 0.62) / 26 });
  const ovr = overallRating(player.stats, player.position);
  const tx = x + h * 1.2;
  d.ui.label(tx, y + h * 0.16, `${fullName(player)}`, { size: 13, color: COLORS.chalk, bold: true });
  const tags = traitTags(player.genome);
  const sub = `${player.position} · OVR ${ovr}${player.personality ? ' · ' + PERSONALITY_LABEL[player.personality] : ''}`;
  d.ui.label(tx, y + h * 0.16 + 16, sub, { size: 11, color: COLORS.runeGreen });
  if (tags.length) d.ui.label(tx, y + h * 0.16 + 30, tags.join(', '), { size: 10, color: COLORS.cyan, wrap: w - (tx - x) - 10 });
  return state.clicked;
}
