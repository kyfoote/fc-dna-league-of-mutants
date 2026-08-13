// Pitch background + ball rendering — maps logical pitch units (PITCH_W x
// PITCH_H) onto a screen-space rect so the sim's coordinate space never has
// to match worldHeight.
import type { Draw } from '../../engine/webgpu.js';
import { PITCH_W, PITCH_H, GOAL_W, GOAL_DEPTH, COLORS } from '../config.js';

export interface PitchRect { x: number; y: number; w: number; h: number; }

/** Fit the logical pitch into a screen rect, letterboxed, and return the mapping. */
export function fitPitch(areaX: number, areaY: number, areaW: number, areaH: number): PitchRect {
  const scale = Math.min(areaW / PITCH_W, areaH / PITCH_H);
  const w = PITCH_W * scale, h = PITCH_H * scale;
  return { x: areaX + (areaW - w) / 2, y: areaY + (areaH - h) / 2, w, h };
}

export function toScreen(rect: PitchRect, px: number, py: number): { x: number; y: number } {
  return { x: rect.x + (px / PITCH_W) * rect.w, y: rect.y + (py / PITCH_H) * rect.h };
}

export function pitchScale(rect: PitchRect): number {
  return rect.w / PITCH_W;
}

export function drawPitch(d: Draw, rect: PitchRect): void {
  const s = pitchScale(rect);
  d.rect(rect.x - 20, rect.y - 20, rect.w + 40, rect.h + 40, '#123a26');
  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    if (i % 2 === 0) continue;
    d.rect(rect.x + (rect.w / stripes) * i, rect.y, rect.w / stripes, rect.h, COLORS.turfStripe);
  }
  const line = Math.max(1.5, 2 * s);
  const chalk = COLORS.chalk;
  // outer boundary
  d.poly([
    { x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h }, { x: rect.x, y: rect.y },
  ], line, chalk);
  // halfway line + centre circle
  d.line(rect.x + rect.w / 2, rect.y, rect.x + rect.w / 2, rect.y + rect.h, line, chalk);
  d.ring(rect.x + rect.w / 2, rect.y + rect.h / 2, 60 * s, line, chalk);
  d.circle(rect.x + rect.w / 2, rect.y + rect.h / 2, 3 * s, chalk);
  // penalty boxes
  const boxW = 130 * s, boxH = 320 * s;
  d.poly([
    { x: rect.x, y: rect.y + (rect.h - boxH) / 2 }, { x: rect.x + boxW, y: rect.y + (rect.h - boxH) / 2 },
    { x: rect.x + boxW, y: rect.y + (rect.h + boxH) / 2 }, { x: rect.x, y: rect.y + (rect.h + boxH) / 2 },
  ], line, chalk);
  d.poly([
    { x: rect.x + rect.w, y: rect.y + (rect.h - boxH) / 2 }, { x: rect.x + rect.w - boxW, y: rect.y + (rect.h - boxH) / 2 },
    { x: rect.x + rect.w - boxW, y: rect.y + (rect.h + boxH) / 2 }, { x: rect.x + rect.w, y: rect.y + (rect.h + boxH) / 2 },
  ], line, chalk);
  // goals
  const goalW = GOAL_W * s, goalD = GOAL_DEPTH * s;
  d.rect(rect.x - goalD, rect.y + (rect.h - goalW) / 2, goalD, goalW, '#cfd6e6', 0.85);
  d.rect(rect.x + rect.w, rect.y + (rect.h - goalW) / 2, goalD, goalW, '#cfd6e6', 0.85);
}

export function drawBall(d: Draw, rect: PitchRect, ballX: number, ballY: number): void {
  const s = pitchScale(rect);
  const { x, y } = toScreen(rect, ballX, ballY);
  d.circle(x, y + 3 * s, 6 * s, '#000000', 0.25); // shadow
  d.circle(x, y, 6 * s, '#ffffff');
  d.ring(x, y, 6 * s, 1.2, '#20242e', 0.7);
}
