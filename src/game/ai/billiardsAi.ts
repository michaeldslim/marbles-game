import type { AiProfile, BilliardsAiInput, Pt, ShotPlan } from './types';
import {
  applyAimSpread,
  dist,
  jitterPower,
  makeWalls,
  mirror,
  normalize,
  wallHit,
} from './geometry';
import { applyPowerMistake, pickRankedCandidate } from './selection';

type TargetBall = 'red' | 'white';
type RouteKind = 'threeWall' | 'twoWall' | 'wallCenter' | 'direct';

interface Candidate {
  aimDx: number;
  aimDy: number;
  pathLen: number;
  routeKind: RouteKind;
  targetBall: TargetBall;
}

function collectThreeWall(
  cue: Pt,
  targets: { ball: TargetBall; pos: Pt }[],
  tableW: number,
  tableH: number,
  margin: number,
): Candidate[] {
  const walls = makeWalls(tableW, tableH, margin);
  const out: Candidate[] = [];

  for (const { ball, pos: T } of targets) {
    for (let wa = 0; wa < 4; wa++) {
      for (let wb = 0; wb < 4; wb++) {
        if (wb === wa) continue;
        for (let wc = 0; wc < 4; wc++) {
          if (wc === wb) continue;
          const m1 = mirror(T, wc, walls);
          const m2 = mirror(m1, wb, walls);
          const m3 = mirror(m2, wa, walls);
          const ca = wallHit(cue, m3, wa, walls, tableW, tableH, margin);
          if (!ca) continue;
          const cb = wallHit(ca, m2, wb, walls, tableW, tableH, margin);
          if (!cb) continue;
          const cc = wallHit(cb, m1, wc, walls, tableW, tableH, margin);
          if (!cc) continue;
          out.push({
            aimDx: ca.x - cue.x,
            aimDy: ca.y - cue.y,
            pathLen: dist(cue, ca) + dist(ca, cb) + dist(cb, cc) + dist(cc, T),
            routeKind: 'threeWall',
            targetBall: ball,
          });
        }
      }
    }
  }

  return out;
}

function collectTwoWall(
  cue: Pt,
  targets: { ball: TargetBall; pos: Pt }[],
  tableW: number,
  tableH: number,
  margin: number,
): Candidate[] {
  const walls = makeWalls(tableW, tableH, margin);
  const out: Candidate[] = [];

  for (const { ball, pos: T } of targets) {
    for (let wa = 0; wa < 4; wa++) {
      for (let wb = 0; wb < 4; wb++) {
        if (wb === wa) continue;
        const m1 = mirror(T, wb, walls);
        const m2 = mirror(m1, wa, walls);
        const ca = wallHit(cue, m2, wa, walls, tableW, tableH, margin);
        if (!ca) continue;
        const cb = wallHit(ca, m1, wb, walls, tableW, tableH, margin);
        if (!cb) continue;
        out.push({
          aimDx: ca.x - cue.x,
          aimDy: ca.y - cue.y,
          pathLen: dist(cue, ca) + dist(ca, cb) + dist(cb, T),
          routeKind: 'twoWall',
          targetBall: ball,
        });
      }
    }
  }

  return out;
}

function collectWallCenter(
  cue: Pt,
  tableW: number,
  tableH: number,
  margin: number,
): Candidate[] {
  const nearY = cue.y < tableH * 0.5 ? margin : tableH - margin;
  const target = { x: tableW * 0.5, y: nearY };
  return [{
    aimDx: target.x - cue.x,
    aimDy: target.y - cue.y,
    pathLen: dist(cue, target) * 3,
    routeKind: 'wallCenter',
    targetBall: 'red',
  }];
}

function collectDirect(
  cue: Pt,
  targets: { ball: TargetBall; pos: Pt }[],
): Candidate[] {
  return targets.map(({ ball, pos }) => ({
    aimDx: pos.x - cue.x,
    aimDy: pos.y - cue.y,
    pathLen: dist(cue, pos),
    routeKind: 'direct' as const,
    targetBall: ball,
  }));
}

function routeTier(kind: RouteKind): number {
  if (kind === 'threeWall') return 4;
  if (kind === 'twoWall') return 3;
  if (kind === 'wallCenter') return 2;
  return 1;
}

function scoreCandidate(c: Candidate, isBreak: boolean, profile: AiProfile): number {
  const tierBase = { threeWall: 120, twoWall: 75, wallCenter: 45, direct: 8 }[c.routeKind];
  let score = tierBase - c.pathLen * 0.01;

  if (isBreak && c.targetBall !== 'red') {
    score -= 90 * profile.ruleAwareness;
  }

  // Expert/advanced prefer cushion routes; beginner may wander to simpler paths.
  if (c.routeKind === 'direct') {
    score -= 60 * profile.ruleAwareness;
  } else {
    score += profile.safetyBias * routeTier(c.routeKind) * 8;
  }

  return score;
}

function minRouteTier(profile: AiProfile): RouteKind {
  if (profile.ruleAwareness >= 0.9) return 'threeWall';
  if (profile.ruleAwareness >= 0.55) return 'twoWall';
  if (profile.ruleAwareness >= 0.25) return 'wallCenter';
  return 'direct';
}

function buildCandidatePool(
  cue: Pt,
  red: Pt,
  white: Pt,
  tableW: number,
  tableH: number,
  margin: number,
  profile: AiProfile,
): Candidate[] {
  const targets = [
    { ball: 'red' as TargetBall, pos: red },
    { ball: 'white' as TargetBall, pos: white },
  ];

  const threeWall = collectThreeWall(cue, targets, tableW, tableH, margin);
  const twoWall = collectTwoWall(cue, targets, tableW, tableH, margin);
  const wallCenter = collectWallCenter(cue, tableW, tableH, margin);
  const direct = collectDirect(cue, targets);

  const minTier = routeTier(minRouteTier(profile));
  const byTier = (items: Candidate[]) => items.filter((c) => routeTier(c.routeKind) >= minTier);

  const pool: Candidate[] = [];
  if (threeWall.length > 0) pool.push(...byTier(threeWall));
  if (pool.length === 0 && twoWall.length > 0) pool.push(...byTier(twoWall));
  if (pool.length === 0) pool.push(...wallCenter);
  if (pool.length === 0 || profile.badShotChance > 0.2) {
    pool.push(...direct);
  }

  return pool.length > 0 ? pool : [...wallCenter, ...direct];
}

function spinForRoute(c: Candidate, profile: AiProfile): { spin: number; sideSpin: number } {
  if (!profile.useSpin) return { spin: 0, sideSpin: 0 };
  if (c.routeKind === 'threeWall' || c.routeKind === 'twoWall') return { spin: 0.25, sideSpin: 0 };
  if (c.routeKind === 'wallCenter') return { spin: 0.15, sideSpin: 0 };
  return { spin: 0, sideSpin: 0 };
}

function powerForRoute(c: Candidate, tableH: number): number {
  const f = Math.min(c.pathLen / (tableH * 1.5), 1);
  if (c.routeKind === 'threeWall' || c.routeKind === 'twoWall') {
    return 0.8 + f * 0.15;
  }
  if (c.routeKind === 'wallCenter') return 0.72 + f * 0.12;
  return 0.58 + f * 0.2;
}

export function planBilliardsShot(input: BilliardsAiInput, profile: AiProfile): ShotPlan {
  const { cue, red, white, tableW, tableH, isBreak } = input;
  const margin = cue.radius * 2;

  const candidates = buildCandidatePool(
    cue.pos,
    red.pos,
    white.pos,
    tableW,
    tableH,
    margin,
    profile,
  );

  const best = pickRankedCandidate(
    candidates,
    (c) => scoreCandidate(c, isBreak, profile),
    profile,
    {
      scoringFilter: (c) => routeTier(c.routeKind) >= 3,
    },
  );

  const spread = applyAimSpread(best.aimDx, best.aimDy, profile.aimSpreadRad);
  const { x: nx, y: ny, mag } = normalize(spread.dx, spread.dy);

  let power = powerForRoute(best, tableH);
  power = jitterPower(power, profile.powerJitter);
  power = applyPowerMistake(power, profile);

  const { spin, sideSpin } = spinForRoute(best, profile);

  return { dx: nx * mag, dy: ny * mag, spin, sideSpin, power };
}
