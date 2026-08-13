// The match simulation — 22 players + a ball on a top-down pitch. Not real
// soccer physics: a small set of readable heuristics (chase, mark, pass,
// dribble, shoot, press) driven by each player's stats/genome/personality and
// the team's tactics. Restarts (kickoff/throw-in/goal-kick/corner) are simple
// pauses that reposition the ball and resume play.
import {
  PITCH_W, PITCH_H, GOAL_W, BALL_CONTROL_RADIUS, MAX_SUBSTEP_SIM_SECONDS,
  PASS_ERROR_BASE, SHOT_ERROR_BASE, PLAYER_RADIUS, MATCH_SIM_MINUTES,
} from '../config.js';
import { type Rng, chance, clamp, randFloat } from './rng.js';
import type { Player } from './player.js';
import { genomeMods, type GenomeMods } from './genome.js';
import { personalityMods, type PersonalityMods } from './personality.js';
import { type Team, playerById } from './team.js';
import { type Slot, formationSlots } from './formations.js';
import { lineHeightBias, passDistanceBias, pressRadiusBias, tempoSpeedMul } from './tactics.js';

export type Side = 0 | 1; // 0 = home, 1 = away

export interface Vec2 { x: number; y: number; }

export interface MatchPlayer {
  player: Player;
  side: Side;
  slot: Slot;
  pos: Vec2;
  vel: Vec2;
  stamina: number; // 1 = fresh, 0 = exhausted
  mods: GenomeMods;
  pmods: PersonalityMods;
  isPresser: boolean;
  /** Seconds until this player will re-evaluate pass/shoot/dribble — decouples
   *  decision-making cadence from the physics substep rate. */
  decisionCooldown: number;
}

export interface Ball {
  pos: Vec2;
  vel: Vec2;
  ownerId: string | null;
  lastTouchSide: Side | null;
  lastKickerId: string | null;
  touchCooldown: number;
}

export type MatchPhase = 'kickoff' | 'play' | 'throwin' | 'goalkick' | 'corner' | 'halftime' | 'fulltime';

export interface MatchStats {
  shots: [number, number];
  onTarget: [number, number];
  passes: [number, number];
  tackles: [number, number];
  corners: [number, number];
  possessionSec: [number, number];
}

export interface MatchEvent {
  clockSec: number;
  type: 'goal' | 'halftime' | 'fulltime' | 'save';
  side: Side;
  playerName: string;
}

export interface MatchState {
  home: Team;
  away: Team;
  players: MatchPlayer[]; // 22 total
  ball: Ball;
  clockSec: number; // 0..MATCH_SIM_MINUTES*60
  half: 1 | 2;
  score: [number, number];
  phase: MatchPhase;
  phaseTimer: number;
  restartSide: Side;
  restartPos: Vec2;
  /** Seconds after a restart during which a fresh out-of-bounds can't retrigger
   *  another restart — corner/throw-in spots sit right on a boundary, so without
   *  this the very next touch can bounce straight back out. */
  restartGrace: number;
  attackDir: [number, number]; // +1 = attacks toward x=PITCH_W, -1 = toward x=0, indexed by side
  stats: MatchStats;
  events: MatchEvent[];
  rng: Rng;
}

const MATCH_SECONDS = MATCH_SIM_MINUTES * 60;

function vlen(v: Vec2): number { return Math.hypot(v.x, v.y); }
function vsub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
function vdist(a: Vec2, b: Vec2): number { return vlen(vsub(a, b)); }
function vnorm(v: Vec2): Vec2 { const l = vlen(v) || 1; return { x: v.x / l, y: v.y / l }; }

function worldX(slotX: number, dir: number): number {
  return dir > 0 ? slotX * PITCH_W : (1 - slotX) * PITCH_W;
}
function basePos(slot: Slot, dir: number): Vec2 {
  return { x: worldX(slot.x, dir), y: slot.y * PITCH_H };
}

function buildMatchPlayer(player: Player, side: Side, slot: Slot, dir: number): MatchPlayer {
  const pos = basePos(slot, dir);
  return {
    player, side, slot, pos: { ...pos }, vel: { x: 0, y: 0 }, stamina: 1,
    mods: genomeMods(player.genome), pmods: personalityMods(player.personality), isPresser: false, decisionCooldown: 0,
  };
}

export function createMatch(home: Team, away: Team, rng: Rng): MatchState {
  const homeSlots = formationSlots(home.formation);
  const awaySlots = formationSlots(away.formation);
  const players: MatchPlayer[] = [];
  home.lineup.forEach((id, i) => {
    const p = playerById(home, id);
    if (p) players.push(buildMatchPlayer(p, 0, homeSlots[i], 1));
  });
  away.lineup.forEach((id, i) => {
    const p = playerById(away, id);
    if (p) players.push(buildMatchPlayer(p, 1, awaySlots[i], -1));
  });

  const state: MatchState = {
    home, away, players,
    ball: { pos: { x: PITCH_W / 2, y: PITCH_H / 2 }, vel: { x: 0, y: 0 }, ownerId: null, lastTouchSide: null, lastKickerId: null, touchCooldown: 0 },
    clockSec: 0, half: 1, score: [0, 0],
    phase: 'kickoff', phaseTimer: 1, restartSide: 0, restartPos: { x: PITCH_W / 2, y: PITCH_H / 2 }, restartGrace: 0,
    attackDir: [1, -1],
    stats: { shots: [0, 0], onTarget: [0, 0], passes: [0, 0], tackles: [0, 0], corners: [0, 0], possessionSec: [0, 0] },
    events: [], rng,
  };
  placeKickoff(state, 0); // home kicks off the first half, ball owned from the whistle
  return state;
}

function teamOf(state: MatchState, side: Side): Team { return side === 0 ? state.home : state.away; }

function maxSpeed(mp: MatchPlayer, tempoMul: number): number {
  const base = 70 + (mp.player.stats.speed / 99) * 130;
  const staminaFactor = 0.55 + 0.45 * mp.stamina;
  return base * mp.mods.speedMul * tempoMul * staminaFactor;
}
function acceleration(mp: MatchPlayer): number {
  const base = 260 + (mp.player.stats.acceleration / 99) * 420;
  return base * mp.mods.accelMul * mp.mods.agilityMul;
}
function controlRadius(mp: MatchPlayer): number {
  let r = BALL_CONTROL_RADIUS * mp.mods.controlRadiusMul;
  if (mp.slot.group === 'GK') r *= 1 + (mp.player.stats.goalkeeping / 99) * 1.2;
  return r;
}

function ownerOf(state: MatchState): MatchPlayer | undefined {
  if (!state.ball.ownerId) return undefined;
  return state.players.find((p) => p.player.id === state.ball.ownerId);
}

function placeKickoff(state: MatchState, concedingSideKicks: Side): void {
  state.ball.pos = { x: PITCH_W / 2, y: PITCH_H / 2 };
  state.ball.vel = { x: 0, y: 0 };
  state.ball.ownerId = null;
  state.ball.lastTouchSide = null;
  for (const mp of state.players) {
    mp.pos = basePos(mp.slot, state.attackDir[mp.side]);
    mp.vel = { x: 0, y: 0 };
  }
  // whoever kicks off gets the ball at the centre spot
  const centreTaker = state.players
    .filter((p) => p.side === concedingSideKicks && p.slot.group === 'FW')
    .sort((a, b) => vdist(a.pos, state.ball.pos) - vdist(b.pos, state.ball.pos))[0]
    ?? state.players.filter((p) => p.side === concedingSideKicks)[0];
  if (centreTaker) state.ball.ownerId = centreTaker.player.id;
  state.restartSide = concedingSideKicks;
  state.phase = 'kickoff';
  state.phaseTimer = 0.8;
}

function resolveRestart(state: MatchState): void {
  const side = state.restartSide;
  state.ball.pos = { ...state.restartPos };
  state.ball.vel = { x: 0, y: 0 };
  state.ball.lastTouchSide = null;
  const taker = state.players
    .filter((p) => p.side === side)
    .sort((a, b) => vdist(a.pos, state.restartPos) - vdist(b.pos, state.restartPos))[0];
  state.ball.ownerId = taker?.player.id ?? null;
  state.phase = 'play';
  state.restartGrace = 3.5;
}

function outOfBoundsCheck(state: MatchState): void {
  const b = state.ball;
  if (b.ownerId) return; // carried ball can't cross a line
  if (state.restartGrace > 0) return; // just restarted right on a boundary — don't instantly retrigger
  const y = b.pos.y;
  if (y < 0 || y > PITCH_H) {
    const throwSide: Side = b.lastTouchSide === 0 ? 1 : 0;
    state.restartSide = throwSide;
    state.restartPos = { x: clamp(b.pos.x, 10, PITCH_W - 10), y: clamp(y, 4, PITCH_H - 4) };
    state.ball.pos = { ...state.restartPos };
    state.ball.vel = { x: 0, y: 0 };
    state.phase = 'throwin';
    state.phaseTimer = 1.2;
    return;
  }
  if (b.pos.x < 0 || b.pos.x > PITCH_W) {
    const crossedHomeGoal = b.pos.x < 0; // home defends x=0
    const inGoalMouth = Math.abs(b.pos.y - PITCH_H / 2) < GOAL_W / 2;
    const attackerSide: Side = crossedHomeGoal ? 1 : 0; // side attacking that goal
    const defenderSide: Side = crossedHomeGoal ? 0 : 1;
    if (inGoalMouth) {
      // A shot that reaches the goal mouth still has to beat the keeper — a
      // last-ditch stat-driven save roll (the physical interception during
      // flight already does some of this; this keeps the scoreline sane
      // regardless of how congested the box was on the way).
      const keeper = state.players.find((p) => p.side === defenderSide && p.slot.group === 'GK');
      const saveChance = keeper ? 0.32 + (keeper.player.stats.goalkeeping / 99) * 0.55 : 0.25;
      if (chance(state.rng, saveChance)) {
        state.events.push({ clockSec: state.clockSec, type: 'save', side: defenderSide, playerName: keeper ? `${keeper.player.firstName} ${keeper.player.lastName}` : '?' });
        state.stats.corners[attackerSide]++;
        state.restartSide = attackerSide;
        state.restartPos = { x: crossedHomeGoal ? 12 : PITCH_W - 12, y: clamp(b.pos.y, 4, PITCH_H - 4) };
        state.ball.pos = { ...state.restartPos };
        state.ball.vel = { x: 0, y: 0 };
        state.phase = 'corner';
        state.phaseTimer = 1.2;
        return;
      }
      // GOAL
      state.score[attackerSide]++;
      const scorer = [...state.players].filter((p) => p.side === attackerSide)
        .sort((a, b2) => vdist(a.pos, state.ball.pos) - vdist(b2.pos, state.ball.pos))[0];
      state.events.push({ clockSec: state.clockSec, type: 'goal', side: attackerSide, playerName: scorer ? `${scorer.player.firstName} ${scorer.player.lastName}` : '?' });
      placeKickoff(state, defenderSide);
      return;
    }
    // wide/long — goal kick to the defending team, corner if last touched by defender
    if (b.lastTouchSide === defenderSide) {
      state.stats.corners[attackerSide]++;
      state.restartSide = attackerSide;
      state.restartPos = { x: crossedHomeGoal ? 12 : PITCH_W - 12, y: b.pos.y < PITCH_H / 2 ? 4 : PITCH_H - 4 };
      state.phase = 'corner';
    } else {
      state.restartSide = defenderSide;
      state.restartPos = { x: crossedHomeGoal ? 40 : PITCH_W - 40, y: PITCH_H / 2 };
      state.phase = 'goalkick';
    }
    state.ball.pos = { ...state.restartPos };
    state.ball.vel = { x: 0, y: 0 };
    state.phaseTimer = 1.2;
  }
}

function nearestOpponentDist(state: MatchState, mp: MatchPlayer): number {
  let best = Infinity;
  for (const o of state.players) {
    if (o.side === mp.side) continue;
    const d = vdist(o.pos, mp.pos);
    if (d < best) best = d;
  }
  return best;
}

// chooseAction runs once per player's ~1-second decision tick (see
// decisionCooldown) — these are flat per-DECISION probabilities, not
// per-physics-substep ones, so they don't need to be scaled by dt.
function chooseAction(state: MatchState, mp: MatchPlayer, _dt: number): void {
  const dir = state.attackDir[mp.side];
  const goalX = dir > 0 ? PITCH_W : 0;
  const goalPos = { x: goalX, y: PITCH_H / 2 };
  const distToGoal = vdist(mp.pos, goalPos);
  const team = teamOf(state, mp.side);

  const shootRange = 190 + mp.player.stats.shooting * 1.1;
  const wantsShot = distToGoal < shootRange && chance(state.rng, 0.028 * mp.pmods.shotChance * (mp.slot.group === 'FW' ? 1.3 : mp.slot.group === 'MF' ? 0.5 : 0.12));
  console.log(`Player ${mp.player.firstName} ${mp.player.lastName} wants shot: ${wantsShot}`);
  if (wantsShot && mp.slot.group !== 'GK') {
    shoot(state, mp, goalPos);
    return;
  }

  // Deep in your own box, a misplaced pass risks conceding a corner right in
  // front of goal — clear it (dribble upfield) instead of risking a pass.
  const ownGoalPos = { x: dir > 0 ? 0 : PITCH_W, y: PITCH_H / 2 };
  const inOwnBox = vdist(mp.pos, ownGoalPos) < 170;

  const passBias = passDistanceBias(team.tactics.passing);
  const wantsPass = !inOwnBox && chance(state.rng, 0.55 * mp.pmods.passChance);
  if (wantsPass) {
    const target = pickPassTarget(state, mp, passBias);
    if (target) { pass(state, mp, target); return; }
  }

  // dribble toward goal, nudged away from the nearest defender
  const toGoal = vnorm(vsub(goalPos, mp.pos));
  let nearestDef: MatchPlayer | undefined; let bestD = Infinity;
  for (const o of state.players) { if (o.side !== mp.side) { const d = vdist(o.pos, mp.pos); if (d < bestD) { bestD = d; nearestDef = o; } } }
  let steer = toGoal;
  if (nearestDef && bestD < 60) {
    const away = vnorm(vsub(mp.pos, nearestDef.pos));
    steer = vnorm({ x: toGoal.x + away.x * 0.6, y: toGoal.y + away.y * 0.6 });
  }
  const speed = maxSpeed(mp, tempoSpeedMul(team.tactics.tempo)) * (0.55 + mp.player.stats.dribbling / 220);
  mp.vel = { x: steer.x * speed, y: steer.y * speed };
}

function pickPassTarget(state: MatchState, mp: MatchPlayer, passBias: number): MatchPlayer | undefined {
  const dir = state.attackDir[mp.side];
  const preferredDist = 160 + passBias * 220 + mp.player.stats.passing * 1.2;
  let best: MatchPlayer | undefined; let bestScore = -Infinity;
  for (const o of state.players) {
    if (o.side !== mp.side || o === mp) continue;
    const d = vdist(o.pos, mp.pos);
    if (d < 30) continue;
    const forwardness = (o.pos.x - mp.pos.x) * dir;
    const openness = nearestOpponentDist(state, o);
    const distScore = -Math.abs(d - preferredDist) / 100;
    const score = distScore + forwardness * 0.01 + openness * 0.01;
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}

function pass(state: MatchState, from: MatchPlayer, to: MatchPlayer): void {
  const acc = from.player.stats.passing / 99;
  const error = PASS_ERROR_BASE * (1 - acc);
  const aimAngle = Math.atan2(to.pos.y - from.pos.y, to.pos.x - from.pos.x) + randFloat(state.rng, -error, error);
  const speed = 240 + acc * 260;
  state.ball.vel = { x: Math.cos(aimAngle) * speed, y: Math.sin(aimAngle) * speed };
  state.ball.pos = { ...from.pos };
  state.ball.ownerId = null;
  state.ball.lastTouchSide = from.side;
  state.ball.lastKickerId = from.player.id;
  state.ball.touchCooldown = 0.25;
  state.stats.passes[from.side]++;
}

function shoot(state: MatchState, from: MatchPlayer, goalPos: Vec2): void {
  const acc = from.player.stats.shooting / 99;
  const error = SHOT_ERROR_BASE * (1 - acc);
  const aimY = clamp(goalPos.y + randFloat(state.rng, -1, 1) * (GOAL_W / 2) * (0.4 + error * 2), -40, PITCH_H + 40);
  const angle = Math.atan2(aimY - from.pos.y, goalPos.x - from.pos.x);
  const speed = (320 + acc * 260) * from.pmods.shotPower;
  state.ball.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  state.ball.pos = { ...from.pos };
  state.ball.ownerId = null;
  state.ball.lastTouchSide = from.side;
  state.ball.lastKickerId = from.player.id;
  state.ball.touchCooldown = 0.2;
  state.stats.shots[from.side]++;
  if (Math.abs(aimY - PITCH_H / 2) < GOAL_W / 2) state.stats.onTarget[from.side]++;
}

function offBallTarget(state: MatchState, mp: MatchPlayer): Vec2 {
  const dir = state.attackDir[mp.side];
  const base = basePos(mp.slot, dir);
  if (mp.slot.group === 'GK') {
    const goalLineX = dir > 0 ? 0 : PITCH_W; // the goal THIS keeper defends
    const ball = state.ball;
    // A loose ball heading toward this keeper's goal is a shot/cross in
    // flight — anticipate where it will cross the line instead of just
    // tracking its current Y, so a keeper actually has a chance to react.
    if (!ball.ownerId) {
      const approaching = goalLineX === 0 ? ball.vel.x < -10 : ball.vel.x > 10;
      if (approaching) {
        const t = (goalLineX - ball.pos.x) / ball.vel.x;
        if (t > 0 && t < 2.5) {
          const predictedY = clamp(ball.pos.y + ball.vel.y * t, 0, PITCH_H);
          return { x: base.x, y: predictedY };
        }
      }
    }
    const y = clamp(ball.pos.y, PITCH_H / 2 - GOAL_W * 0.9, PITCH_H / 2 + GOAL_W * 0.9);
    return { x: base.x, y };
  }
  const team = teamOf(state, mp.side);
  const lineBias = lineHeightBias(team.tactics.mentality);
  const groupPull: Record<string, number> = { DF: 0.10, MF: 0.22, FW: 0.30 };
  const pull = (groupPull[mp.slot.group] ?? 0.15) + (lineBias * (mp.slot.group === 'DF' ? 0.6 : 1));
  const ball = state.ball.pos;
  let tx = base.x + (ball.x - base.x) * pull;
  let ty = base.y + (ball.y - base.y) * (pull + 0.12);
  if (mp.pmods.chaseBallBias > 1.3) { // golden retriever: ignore shape, chase the ball
    tx = base.x * 0.3 + ball.x * 0.7;
    ty = base.y * 0.3 + ball.y * 0.7;
  }
  const noise = mp.pmods.decisionNoise;
  if (noise > 1) {
    tx += randFloat(state.rng, -30, 30) * (noise - 1);
    ty += randFloat(state.rng, -30, 30) * (noise - 1);
  }
  return { x: clamp(tx, 10, PITCH_W - 10), y: clamp(ty, 10, PITCH_H - 10) };
}

function assignPressers(state: MatchState): void {
  for (const mp of state.players) mp.isPresser = false;
  const owner = ownerOf(state);
  if (!owner) {
    // Nobody has it — the nearest outfield player on EACH side chases it down,
    // so a loose ball is always contested instead of drifting untouched.
    for (const side of [0, 1] as Side[]) {
      const chaser = state.players
        .filter((p) => p.side === side && p.slot.group !== 'GK')
        .sort((a, b) => vdist(a.pos, state.ball.pos) - vdist(b.pos, state.ball.pos))[0];
      if (chaser) chaser.isPresser = true;
    }
    return;
  }
  const defSide: Side = owner.side === 0 ? 1 : 0;
  const team = teamOf(state, defSide);
  const count = team.tactics.pressing === 'high' ? 3 : team.tactics.pressing === 'low' ? 1 : 2;
  const defenders = state.players
    .filter((p) => p.side === defSide && p.slot.group !== 'GK')
    .sort((a, b) => vdist(a.pos, owner.pos) - vdist(b.pos, owner.pos))
    .slice(0, count);
  for (const d of defenders) d.isPresser = true;
}

function moveTowards(mp: MatchPlayer, target: Vec2, dt: number, tempoMul: number): void {
  const desired = vsub(target, mp.pos);
  const dist = vlen(desired);
  if (dist < 1) { mp.vel = { x: mp.vel.x * 0.8, y: mp.vel.y * 0.8 }; return; }
  const dirV = { x: desired.x / dist, y: desired.y / dist };
  const speed = Math.min(maxSpeed(mp, tempoMul), dist / Math.max(dt, 0.001));
  const targetVel = { x: dirV.x * speed, y: dirV.y * speed };
  const acc = acceleration(mp);
  const dvx = targetVel.x - mp.vel.x, dvy = targetVel.y - mp.vel.y;
  const dv = Math.hypot(dvx, dvy);
  const step = Math.min(1, (acc * dt) / (dv || 1));
  mp.vel = { x: mp.vel.x + dvx * step, y: mp.vel.y + dvy * step };
}

function substep(state: MatchState, dt: number): void {
  if (state.phase === 'fulltime') return;

  if (state.phase !== 'play') {
    state.phaseTimer -= dt;
    if (state.phase === 'halftime') {
      if (state.phaseTimer <= 0) {
        state.half = 2;
        state.attackDir = [-state.attackDir[0], -state.attackDir[1]] as [number, number];
        placeKickoff(state, 1);
      }
      return;
    }
    if (state.phaseTimer <= 0) {
      if (state.phase === 'kickoff') { state.phase = 'play'; }
      else resolveRestart(state);
    }
    return;
  }

  state.clockSec += dt;
  if (state.restartGrace > 0) state.restartGrace -= dt;
  if (state.half === 1 && state.clockSec >= MATCH_SECONDS / 2) {
    state.phase = 'halftime'; state.phaseTimer = 1.0;
    state.events.push({ clockSec: state.clockSec, type: 'halftime', side: 0, playerName: '' });
    return;
  }
  if (state.half === 2 && state.clockSec >= MATCH_SECONDS) {
    state.clockSec = MATCH_SECONDS;
    state.phase = 'fulltime';
    state.events.push({ clockSec: state.clockSec, type: 'fulltime', side: 0, playerName: '' });
    return;
  }

  // stamina drain
  for (const mp of state.players) {
    const speed = vlen(mp.vel);
    const drain = (speed / 400) * (1 - mp.player.stats.stamina / 160) * mp.pmods.staminaDrain * dt * 0.02;
    mp.stamina = clamp(mp.stamina - drain, 0.35, 1);
  }

  assignPressers(state);

  // ball handling
  const owner = ownerOf(state);
  if (owner) {
    state.stats.possessionSec[owner.side] += dt;
    owner.decisionCooldown -= dt * 20;
    if (owner.decisionCooldown <= 0) {
      owner.decisionCooldown = randFloat(state.rng, 0.7, 1.6);
      chooseAction(state, owner, dt);
    }
    // chooseAction may have passed/shot (clearing ball.ownerId) — only keep
    // carrying the ball with the owner if they're still dribbling it.
    if (state.ball.ownerId === owner.player.id) {
      const dir = state.attackDir[owner.side];
      state.ball.pos = { x: owner.pos.x + dir * 10, y: owner.pos.y };
      state.ball.vel = { x: 0, y: 0 };
    }
  }
  // A ball with no owner is IN FLIGHT (whether it started this tick as a
  // fresh pass/shot, or was already loose) — always integrate it, so a shot
  // travels before the pickup-check below can re-award it at the kicker's feet.
  if (!state.ball.ownerId) {
    if (state.ball.touchCooldown > 0) state.ball.touchCooldown -= dt;
    state.ball.pos = { x: state.ball.pos.x + state.ball.vel.x * dt, y: state.ball.pos.y + state.ball.vel.y * dt };
    const drag = 90 * dt;
    const sp = vlen(state.ball.vel);
    if (sp > 0) {
      const ns = Math.max(0, sp - drag);
      const s = ns / sp;
      state.ball.vel = { x: state.ball.vel.x * s, y: state.ball.vel.y * s };
    }
    outOfBoundsCheck(state);
  }

  // off-ball movement
  const tempoHome = tempoSpeedMul(state.home.tactics.tempo);
  const tempoAway = tempoSpeedMul(state.away.tactics.tempo);
  for (const mp of state.players) {
    if (owner === mp) continue;
    const tempoMul = mp.side === 0 ? tempoHome : tempoAway;
    let target: Vec2;
    if (mp.isPresser) target = state.ball.pos;
    else target = offBallTarget(state, mp);
    moveTowards(mp, target, dt, tempoMul);
  }

  // integrate positions + resolve loose-ball pickups / tackles
  for (const mp of state.players) {
    mp.pos = { x: clamp(mp.pos.x + mp.vel.x * dt, PLAYER_RADIUS, PITCH_W - PLAYER_RADIUS), y: clamp(mp.pos.y + mp.vel.y * dt, PLAYER_RADIUS, PITCH_H - PLAYER_RADIUS) };
  }

  if (!state.ball.ownerId && state.phase === 'play') {
    let best: MatchPlayer | undefined; let bestD = Infinity;
    for (const mp of state.players) {
      if (state.ball.touchCooldown > 0 && mp.player.id === state.ball.lastKickerId) continue;
      const r = controlRadius(mp);
      const d = vdist(mp.pos, state.ball.pos);
      if (d < r && d < bestD) { bestD = d; best = mp; }
    }
    if (best) {
      const wasOpponentPossession = state.ball.lastTouchSide !== null && state.ball.lastTouchSide !== best.side;
      if (wasOpponentPossession) state.stats.tackles[best.side]++;
      state.ball.ownerId = best.player.id;
      state.ball.lastTouchSide = best.side;
    }
  }
}

/** Advance the match by dtSimSeconds of match-clock time, sub-stepped for stability. */
export function stepMatch(state: MatchState, dtSimSeconds: number): void {
  let remaining = dtSimSeconds;
  let guard = 0;
  while (remaining > 1e-6 && state.phase !== 'fulltime' && guard++ < 100000) {
    const sub = Math.min(remaining, MAX_SUBSTEP_SIM_SECONDS);
    substep(state, sub);
    remaining -= sub;
  }
}

export function isFullTime(state: MatchState): boolean {
  return state.phase === 'fulltime';
}

export function possessionPct(state: MatchState): [number, number] {
  const [h, a] = state.stats.possessionSec;
  const total = h + a || 1;
  return [Math.round((h / total) * 100), Math.round((a / total) * 100)];
}
