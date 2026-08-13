// Modular procedural pixel-art footballers — built from simple Draw-verb shapes
// driven entirely by a player's genome. No image assets: every mutation
// (height, body, leg count, head size, horns, tail, cyclops eye...) changes
// the silhouette. Drawn as a small ~3/4 chibi figure, anchored at (x, y) where
// y is the ground/feet contact point (so it drops onto the pitch correctly).
import type { Draw } from '../../engine/webgpu.js';
import { heightUnits, type Genome } from '../sim/genome.js';

export interface FigureOpts {
  scale?: number; // 1 = the base chibi size; bigger for cards
  facing?: 1 | -1; // which way the figure leans/faces
  tint?: string; // jersey/skin overlay tint (rare use)
  glow?: boolean; // subtle highlight ring under the feet (ball carrier, selected)
}

/** Draw one footballer figure at (x, y-feet). Returns the figure's approx total height (for layout). */
export function drawPlayerFigure(d: Draw, x: number, y: number, jerseyColor: string, genome: Genome, opts: FigureOpts = {}): number {
  const scale = opts.scale ?? 1;
  const facing = opts.facing ?? 1;
  const h = heightUnits(genome.height) * scale; // total figure height budget
  const legLen = { normal: 0.34, short: 0.22, long: 0.44, four: 0.30, oneGiant: 0.30 }[genome.legs] * h;
  const bodyW = { skinny: 0.42, normal: 0.55, chunky: 0.70, huge: 0.85, round: 0.95 }[genome.body] * h;
  const bodyH = h - legLen - h * (genome.head === 'giant' ? 0.34 : genome.head === 'tiny' ? 0.16 : 0.24);
  const headR = (genome.head === 'giant' ? 0.30 : genome.head === 'tiny' ? 0.13 : 0.20) * h;

  const feetY = y;
  const bodyBottomY = feetY - legLen;
  const bodyTopY = bodyBottomY - bodyH;
  const headCy = bodyTopY - (genome.neck === 'none' ? headR * 0.5 : headR * 0.85);

  if (opts.glow) d.ring(x, feetY - 2, bodyW * 0.62, 3, '#ffd147', 0.85);

  // legs
  const legW = Math.max(3, bodyW * 0.16);
  if (genome.legs === 'oneGiant') {
    d.rect(x - legW * 1.1, bodyBottomY, legW * 2.2, legLen, shade(genome.skinColor, -0.1), 1, 0);
  } else if (genome.legs === 'four') {
    const offsets = [-0.32, -0.11, 0.11, 0.32];
    for (const o of offsets) d.rect(x + o * bodyW - legW / 2, bodyBottomY, legW, legLen, shade(genome.skinColor, -0.1), 1, 0);
  } else {
    d.rect(x - bodyW * 0.24 - legW / 2, bodyBottomY, legW, legLen, shade(genome.skinColor, -0.1), 1, 0);
    d.rect(x + bodyW * 0.24 - legW / 2, bodyBottomY, legW, legLen, shade(genome.skinColor, -0.1), 1, 0);
  }

  // feet
  const footW = genome.feet === 'massive' ? legW * 2.4 : genome.feet === 'tiny' ? legW * 0.8 : legW * 1.5;
  const footH = footW * 0.45;
  const footColor = '#1c1c1c';
  if (genome.legs === 'oneGiant') {
    d.rect(x - footW / 2, feetY - footH * 0.4, footW, footH, footColor, 1, 0);
  } else if (genome.legs === 'four') {
    for (const o of [-0.32, -0.11, 0.11, 0.32]) d.rect(x + o * bodyW - footW / 2, feetY - footH * 0.4, footW, footH, footColor, 1, 0);
  } else {
    d.rect(x - bodyW * 0.24 - footW / 2, feetY - footH * 0.4, footW, footH, footColor, 1, 0);
    d.rect(x + bodyW * 0.24 - footW / 2, feetY - footH * 0.4, footW, footH, footColor, 1, 0);
  }

  // tail (drawn behind the body, before it)
  if (genome.tail) {
    const tx = x - facing * bodyW * 0.55;
    d.circle(tx, bodyBottomY - bodyH * 0.3, bodyW * 0.1, genome.skinColor, 1);
    d.line(x - facing * bodyW * 0.3, bodyBottomY - bodyH * 0.2, tx, bodyBottomY - bodyH * 0.3, 4, genome.skinColor);
  }

  // arms
  const armLen = (genome.arms === 'long' ? 0.5 : 0.36) * bodyH;
  const armW = Math.max(2.5, bodyW * 0.1);
  d.line(x - bodyW * 0.46, bodyTopY + bodyH * 0.15, x - bodyW * 0.46 - armLen * 0.3, bodyTopY + bodyH * 0.15 + armLen, armW, genome.skinColor);
  d.line(x + bodyW * 0.46, bodyTopY + bodyH * 0.15, x + bodyW * 0.46 + armLen * 0.3, bodyTopY + bodyH * 0.15 + armLen, armW, genome.skinColor);

  // torso — jersey
  if (genome.body === 'round') d.circle(x, bodyTopY + bodyH / 2, bodyW / 2, jerseyColor, 1);
  else d.rect(x - bodyW / 2, bodyTopY, bodyW, bodyH, jerseyColor, 1, 0);

  // neck
  if (genome.neck !== 'none') d.rect(x - headR * 0.35, bodyTopY - headR * 0.35, headR * 0.7, headR * 0.5, genome.skinColor, 1, 0);

  // head
  d.circle(x, headCy, headR, genome.skinColor, 1);
  if (genome.cyclops) {
    d.circle(x, headCy, headR * 0.32, '#ffffff', 1);
    d.circle(x, headCy, headR * 0.16, '#151515', 1);
  } else {
    d.circle(x - headR * 0.32, headCy - headR * 0.05, headR * 0.16, '#151515', 1);
    d.circle(x + headR * 0.32, headCy - headR * 0.05, headR * 0.16, '#151515', 1);
  }

  // hair
  drawHair(d, x, headCy, headR, genome);

  // horns
  if (genome.horns) {
    d.fill([{ x: x - headR * 0.55, y: headCy - headR * 0.7 }, { x: x - headR * 0.75, y: headCy - headR * 1.5 }, { x: x - headR * 0.25, y: headCy - headR * 0.85 }], '#e6e2d3', 1);
    d.fill([{ x: x + headR * 0.55, y: headCy - headR * 0.7 }, { x: x + headR * 0.75, y: headCy - headR * 1.5 }, { x: x + headR * 0.25, y: headCy - headR * 0.85 }], '#e6e2d3', 1);
  }

  return h;
}

function drawHair(d: Draw, x: number, headCy: number, headR: number, genome: Genome): void {
  const c = genome.hairColor;
  switch (genome.hair) {
    case 'none': case 'bald': return;
    case 'mohawk':
      d.fill([{ x: x - headR * 0.12, y: headCy - headR }, { x: x + headR * 0.12, y: headCy - headR }, { x, y: headCy - headR * 1.9 }], c, 1);
      break;
    case 'afro':
      d.circle(x, headCy - headR * 0.3, headR * 1.25, c, 1);
      d.circle(x, headCy, headR, genome.skinColor, 1); // re-paint face over the afro's lower half
      break;
    case 'spiky':
      for (const o of [-0.5, -0.2, 0.1, 0.4]) {
        d.fill([{ x: x + o * headR, y: headCy - headR * 0.7 }, { x: x + o * headR + headR * 0.18, y: headCy - headR * 0.7 }, { x: x + o * headR + headR * 0.09, y: headCy - headR * 1.5 }], c, 1);
      }
      break;
    case 'long':
      d.rect(x - headR * 0.9, headCy - headR * 0.5, headR * 1.8, headR * 1.6, c, 1, 0);
      d.circle(x, headCy, headR, genome.skinColor, 1);
      break;
  }
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt * 255)));
  g = Math.max(0, Math.min(255, Math.round(g + amt * 255)));
  b = Math.max(0, Math.min(255, Math.round(b + amt * 255)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
