import type { AiProfile, BilliardsAiInput, Pt, ShotPlan } from './types';
import {
  applyAimSpread,
  countCushionsAlongRay,
  dist,
  jitterPower,
  makeWalls,
  mirror,
  normalize,
  wallHit,
} from './geometry';
import { applyPowerMistake, pickRankedCandidate } from './selection';

type FirstBall = 'red' | 'white';
type RouteKind = 'plus2' | 'plus1' | 'direct';

interface Candidate {
  aimDx: number;
  aimDy: number;
  pathLen: number;
  firstBall: FirstBall;
  points: 0 | 1 | 2;
  routeKind: RouteKind;
}

function ghostAimVector(cue: Pt, target: Pt, ballRadius: number): { dx: number; dy: number } {
  const toT = { x: target.x - cue.x, y: target.y - cue.y };
  const mag = Math.hypot(toT.x, toT.y) || 1;
  const nx = toT.x / mag;
  const ny = toT.y / mag;
  const ghostX = target.x - nx * ballRadius * 2;
  const ghostY = target.y - ny * ballRadius * 2;
  return { dx: ghostX - cue.x, dy: ghostY - cue.y };
}

function cushionsBeforeBall(
  cue: Pt,
  aimDx: number,
  aimDy: number,
  ballPos: Pt,
  walls: ReturnType<typeof makeWalls>,
  tableW: number,
  tableH: number,
  margin: number,
): number {
  const { x, y } = normalize(aimDx, aimDy);
  return countCushionsAlongRay(cue, { x, y }, dist(cue, ballPos) * 1.05, walls, tableW, tableH, margin, 4);
}

/** Cue-ball 3-cushion path toward second object ball (game +1 rule). */
function findCueCaromToSecond(
  fromPos: Pt,
  secondPos: Pt,
  walls: ReturnType<typeof makeWalls>,
  tableW: number,
  tableH: number,
  margin: number,
): { pathLen: number } | null {
  let bestLen = Infinity;

  for (let wa = 0; wa < 4; wa++) {
    for (let wb = 0; wb < 4; wb++) {
      if (wb === wa) continue;
      for (let wc = 0; wc < 4; wc++) {
        if (wc === wb) continue;
        const m1 = mirror(secondPos, wc, walls);
        const m2 = mirror(m1, wb, walls);
        const m3 = mirror(m2, wa, walls);
        const ca = wallHit(fromPos, m3, wa, walls, tableW, tableH, margin);
        if (!ca) continue;
        const cb = wallHit(ca, m2, wb, walls, tableW, tableH, margin);
        if (!cb) continue;
        const cc = wallHit(cb, m1, wc, walls, tableW, tableH, margin);
        if (!cc) continue;
        const pathLen = dist(fromPos, ca) + dist(ca, cb) + dist(cb, cc) + dist(cc, secondPos);
        if (pathLen < bestLen) bestLen = pathLen;
      }
    }
  }

  return bestLen < Infinity ? { pathLen: bestLen } : null;
}

function estimateCueAfterFirstHit(firstPos: Pt, aimDx: number, aimDy: number, r: number): Pt {
  const { x, y } = normalize(aimDx, aimDy);
  return { x: firstPos.x + x * r * 0.6, y: firstPos.y + y * r * 0.6 };
}

function collectPlusOne(
  cue: Pt,
  red: Pt,
  white: Pt,
  tableW: number,
  tableH: number,
  margin: number,
  ballRadius: number,
): Candidate[] {
  const walls = makeWalls(tableW, tableH, margin);
  const out: Candidate[] = [];

  for (const { ball, firstPos, secondPos } of [
    { ball: 'red' as FirstBall, firstPos: red, secondPos: white },
    { ball: 'white' as FirstBall, firstPos: white, secondPos: red },
  ]) {
    const aim = ghostAimVector(cue, firstPos, ballRadius);
    if (cushionsBeforeBall(cue, aim.dx, aim.dy, firstPos, walls, tableW, tableH, margin) >= 3) continue;

    const postCue = estimateCueAfterFirstHit(firstPos, aim.dx, aim.dy, ballRadius);
    const carom = findCueCaromToSecond(postCue, secondPos, walls, tableW, tableH, margin);
    if (!carom) continue;

    out.push({
      aimDx: aim.dx,
      aimDy: aim.dy,
      pathLen: dist(cue, firstPos) + carom.pathLen,
      firstBall: ball,
      points: 1,
      routeKind: 'plus1',
    });
  }

  return out;
}

function collectPlusTwo(
  cue: Pt,
  red: Pt,
  white: Pt,
  tableW: number,
  tableH: number,
  margin: number,
): Candidate[] {
  const walls = makeWalls(tableW, tableH, margin);
  const out: Candidate[] = [];

  for (const { ball, pos, other } of [
    { ball: 'red' as FirstBall, pos: red, other: white },
    { ball: 'white' as FirstBall, pos: white, other: red },
  ]) {
    if (dist(pos, other) > tableH * 0.95) continue;

    for (let wa = 0; wa < 4; wa++) {
      for (let wb = 0; wb < 4; wb++) {
        if (wb === wa) continue;
        for (let wc = 0; wc < 4; wc++) {
          if (wc === wb) continue;
          const m1 = mirror(pos, wc, walls);
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
            pathLen: dist(cue, ca) + dist(ca, cb) + dist(cb, cc) + dist(cc, pos),
            firstBall: ball,
            points: 2,
            routeKind: 'plus2',
          });
        }
      }
    }
  }

  return out;
}

function collectDirectFallback(
  cue: Pt,
  red: Pt,
  white: Pt,
  ballRadius: number,
): Candidate[] {
  return [
    { ball: 'red' as FirstBall, pos: red, other: white },
    { ball: 'white' as FirstBall, pos: white, other: red },
  ].map(({ ball, pos }) => {
    const aim = ghostAimVector(cue, pos, ballRadius);
    return {
      aimDx: aim.dx,
      aimDy: aim.dy,
      pathLen: dist(cue, pos),
      firstBall: ball,
      points: 0 as const,
      routeKind: 'direct' as const,
    };
  });
}

function scoreCandidate(c: Candidate, isBreak: boolean, ruleAwareness: number): number {
  if (c.points === 2) return 100;
  if (c.points === 1) return 120;
  let score = -80 * ruleAwareness;
  if (isBreak && c.firstBall !== 'red') score -= 200 * ruleAwareness;
  return score;
}

function spinForRoute(c: Candidate, profile: AiProfile): { spin: number; sideSpin: number } {
  if (!profile.useSpin) return { spin: 0, sideSpin: 0 };
  if (c.routeKind === 'plus2') return { spin: 0.35, sideSpin: 0 };
  if (c.routeKind === 'plus1') return { spin: 0.15, sideSpin: 0 };
  return { spin: 0, sideSpin: 0 };
}

function powerForRoute(c: Candidate, tableH: number): number {
  const f = Math.min(c.pathLen / (tableH * 1.5), 1);
  if (c.routeKind === 'plus2') return 0.75 + f * 0.18;
  if (c.routeKind === 'plus1') return 0.62 + f * 0.22;
  return 0.58 + f * 0.2;
}

export function planBilliardsShot(input: BilliardsAiInput, profile: AiProfile): ShotPlan {
  const { cue, red, white, tableW, tableH, isBreak } = input;
  const margin = cue.radius * 2;
  const ballRadius = cue.radius;

  const plus1 = collectPlusOne(cue.pos, red.pos, white.pos, tableW, tableH, margin, ballRadius);
  const candidates = plus1.length > 0
    ? plus1
    : [
      ...collectPlusTwo(cue.pos, red.pos, white.pos, tableW, tableH, margin),
      ...collectDirectFallback(cue.pos, red.pos, white.pos, ballRadius),
    ];

  const best = pickRankedCandidate(
    candidates,
    (c) => scoreCandidate(c, isBreak, profile.ruleAwareness),
    profile,
    { scoringFilter: (c) => c.points >= 1 },
  );

  const spread = applyAimSpread(best.aimDx, best.aimDy, profile.aimSpreadRad);
  const { x: nx, y: ny, mag } = normalize(spread.dx, spread.dy);

  let power = powerForRoute(best, tableH);
  power = jitterPower(power, profile.powerJitter);
  power = applyPowerMistake(power, profile);

  const { spin, sideSpin } = spinForRoute(best, profile);

  return { dx: nx * mag, dy: ny * mag, spin, sideSpin, power };
}
