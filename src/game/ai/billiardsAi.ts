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
type RouteKind = 'plus2_reflect' | 'plus1_carom' | 'bank' | 'direct' | 'wall_only';

interface Candidate {
  aimDx: number;
  aimDy: number;
  pathLen: number;
  cushionsBeforeFirst: number;
  cushionsBeforeSecond: number;
  firstBall: FirstBall;
  hitsSecond: boolean;
  points: 0 | 1 | 2;
  routeKind: RouteKind;
}

const HITS_SECOND_TOLERANCE = 0.85;

function ghostAimVector(cue: Pt, target: Pt, ballRadius: number): { dx: number; dy: number } {
  const toT = { x: target.x - cue.x, y: target.y - cue.y };
  const mag = Math.hypot(toT.x, toT.y) || 1;
  const contactDist = ballRadius * 2;
  const nx = toT.x / mag;
  const ny = toT.y / mag;
  const ghostX = target.x - nx * contactDist;
  const ghostY = target.y - ny * contactDist;
  return { dx: ghostX - cue.x, dy: ghostY - cue.y };
}

function estimateSecondBallHit(
  firstBallPos: Pt,
  exitDir: Pt,
  secondBallPos: Pt,
  ballRadius: number,
): boolean {
  const contactDist = ballRadius * 2;
  const alongMin = ballRadius * 0.8;
  const apx = secondBallPos.x - firstBallPos.x;
  const apy = secondBallPos.y - firstBallPos.y;
  const along = apx * exitDir.x + apy * exitDir.y;
  if (along <= alongMin) return false;
  const perp = Math.abs(apx * exitDir.y - apy * exitDir.x);
  return perp <= contactDist * HITS_SECOND_TOLERANCE;
}

function cushionsOnAimToBall(
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
  const pathToBall = dist(cue, ballPos);
  return countCushionsAlongRay(cue, { x, y }, pathToBall * 1.05, walls, tableW, tableH, margin, 6);
}

function cushionsBetweenBalls(
  from: Pt,
  to: Pt,
  walls: ReturnType<typeof makeWalls>,
  tableW: number,
  tableH: number,
  margin: number,
): number {
  const { x, y, mag } = normalize(to.x - from.x, to.y - from.y);
  return countCushionsAlongRay(from, { x, y }, mag * 1.05, walls, tableW, tableH, margin, 4);
}

/** 3-cushion paths from firstBall toward secondBall (for +1 scoring). */
function findCaromPathAfterFirst(
  firstPos: Pt,
  secondPos: Pt,
  walls: ReturnType<typeof makeWalls>,
  tableW: number,
  tableH: number,
  margin: number,
): { cushionsAfter: number; exitDir: Pt; pathLen: number } | null {
  let best: { cushionsAfter: number; exitDir: Pt; pathLen: number } | null = null;

  for (let wa = 0; wa < 4; wa++) {
    for (let wb = 0; wb < 4; wb++) {
      if (wb === wa) continue;
      for (let wc = 0; wc < 4; wc++) {
        if (wc === wb) continue;
        const m1 = mirror(secondPos, wc, walls);
        const m2 = mirror(m1, wb, walls);
        const m3 = mirror(m2, wa, walls);
        const ca = wallHit(firstPos, m3, wa, walls, tableW, tableH, margin);
        if (!ca) continue;
        const cb = wallHit(ca, m2, wb, walls, tableW, tableH, margin);
        if (!cb) continue;
        const cc = wallHit(cb, m1, wc, walls, tableW, tableH, margin);
        if (!cc) continue;
        const pathLen = dist(firstPos, ca) + dist(ca, cb) + dist(cb, cc) + dist(cc, secondPos);
        const exitDir = normalize(ca.x - firstPos.x, ca.y - firstPos.y);
        const entry = { cushionsAfter: 3, exitDir, pathLen };
        if (!best || pathLen < best.pathLen) best = entry;
      }
    }
  }

  // 2-cushion after first is not enough for +1, but include for completeness with lower priority
  return best;
}

function classifyPoints(
  cushionsBeforeFirst: number,
  cushionsAfterFirst: number,
  hitsSecond: boolean,
): 0 | 1 | 2 {
  if (!hitsSecond) return 0;
  if (cushionsBeforeFirst >= 3) return 2;
  if (cushionsAfterFirst >= 3) return 1;
  return 0;
}

function makeCandidate(
  aimDx: number,
  aimDy: number,
  pathLen: number,
  firstBall: FirstBall,
  firstPos: Pt,
  secondPos: Pt,
  ballRadius: number,
  cushionsBeforeFirst: number,
  cushionsAfterFirst: number,
  exitDir: Pt,
  routeKind: RouteKind,
): Candidate {
  const hitsSecond = estimateSecondBallHit(firstPos, exitDir, secondPos, ballRadius);
  const afterFirst = hitsSecond ? cushionsAfterFirst : 0;
  const points = classifyPoints(cushionsBeforeFirst, afterFirst, hitsSecond);

  return {
    aimDx,
    aimDy,
    pathLen,
    cushionsBeforeFirst,
    cushionsBeforeSecond: cushionsBeforeFirst + afterFirst,
    firstBall,
    hitsSecond,
    points,
    routeKind,
  };
}

function scoreCandidate(c: Candidate, isBreak: boolean, ruleAwareness: number, tableH: number): number {
  let score = 0;

  // +1 slightly preferred — shorter, more realistic billiards shot
  if (c.points === 1) score += 112;
  else if (c.points === 2) score += 100;
  else score -= 90 * ruleAwareness;

  if (isBreak && c.firstBall !== 'red') {
    score -= 250 * ruleAwareness;
  }

  if (!c.hitsSecond) {
    score -= 70 * ruleAwareness;
  }

  // Prefer +1 carom / bank over long +2 wall routes
  if (c.points === 1) {
    if (c.routeKind === 'plus1_carom') score += 18;
    if (c.routeKind === 'bank') score += 12;
    if (c.routeKind === 'direct') score += 8;
  }

  if (c.points === 2 && c.routeKind === 'plus2_reflect') {
    score -= 8;
  }

  score -= c.pathLen * 0.025;
  score += (tableH - Math.min(c.pathLen, tableH)) * 0.008;

  return score;
}

/** +2: cue → 3 cushions → object ball(s) via mirror from cue. */
function collectPlusTwoCandidates(
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

  const targets: { ball: FirstBall; pos: Pt; other: Pt }[] = [
    { ball: 'red', pos: red, other: white },
    { ball: 'white', pos: white, other: red },
  ];

  for (const { ball, pos, other } of targets) {
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
          const pathLen = dist(cue, ca) + dist(ca, cb) + dist(cb, cc) + dist(cc, pos);
          const exitDir = normalize(pos.x - cc.x, pos.y - cc.y);
          const cushionsAfter = estimateSecondBallHit(pos, exitDir, other, ballRadius)
            ? cushionsBetweenBalls(pos, other, walls, tableW, tableH, margin)
            : 0;

          out.push(makeCandidate(
            ca.x - cue.x, ca.y - cue.y, pathLen,
            ball, pos, other, ballRadius,
            3, cushionsAfter, exitDir, 'plus2_reflect',
          ));
        }
      }
    }
  }

  return out;
}

/** +1: cue → first object ball (0–2 cushions), then 3 cushions → second ball. */
function collectPlusOneCandidates(
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
    const carom = findCaromPathAfterFirst(firstPos, secondPos, walls, tableW, tableH, margin);
    if (!carom) continue;

    const aim = ghostAimVector(cue, firstPos, ballRadius);
    const cushionsBefore = cushionsOnAimToBall(
      cue, aim.dx, aim.dy, firstPos, walls, tableW, tableH, margin,
    );
    if (cushionsBefore >= 3) continue;

    const pathLen = dist(cue, firstPos) + carom.pathLen;
    out.push(makeCandidate(
      aim.dx, aim.dy, pathLen,
      ball, firstPos, secondPos, ballRadius,
      cushionsBefore, carom.cushionsAfter, carom.exitDir, 'plus1_carom',
    ));
  }

  return out;
}

/** 1-bank to first ball, then carom to second (+1 style). */
function collectBankCandidates(
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
    const carom = findCaromPathAfterFirst(firstPos, secondPos, walls, tableW, tableH, margin);

    for (let w = 0; w < 4; w++) {
      const mirrored = mirror(firstPos, w, walls);
      const ca = wallHit(cue, mirrored, w, walls, tableW, tableH, margin);
      if (!ca) continue;

      const aimDx = ca.x - cue.x;
      const aimDy = ca.y - cue.y;
      const pathLen = dist(cue, ca) + dist(ca, firstPos);
      const exitDir = normalize(firstPos.x - ca.x, firstPos.y - ca.y);

      if (carom) {
        const afterFirst = carom.cushionsAfter;
        const hitsSecond = estimateSecondBallHit(firstPos, carom.exitDir, secondPos, ballRadius);
        const points = classifyPoints(1, afterFirst, hitsSecond);
        if (points === 1) {
          out.push(makeCandidate(
            aimDx, aimDy, pathLen + carom.pathLen,
            ball, firstPos, secondPos, ballRadius,
            1, afterFirst, carom.exitDir, 'bank',
          ));
          continue;
        }
      }

      // Bank to first ball only (setup / partial)
      out.push(makeCandidate(
        aimDx, aimDy, pathLen,
        ball, firstPos, secondPos, ballRadius,
        1, 0, exitDir, 'bank',
      ));
    }
  }

  return out;
}

/** Direct thin cut at first ball. */
function collectDirectCandidates(
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
    const carom = findCaromPathAfterFirst(firstPos, secondPos, walls, tableW, tableH, margin);
    const aim = ghostAimVector(cue, firstPos, ballRadius);
    const cushionsBefore = cushionsOnAimToBall(
      cue, aim.dx, aim.dy, firstPos, walls, tableW, tableH, margin,
    );
    const pathLen = dist(cue, firstPos);

    if (carom && cushionsBefore < 3) {
      out.push(makeCandidate(
        aim.dx, aim.dy, pathLen + carom.pathLen,
        ball, firstPos, secondPos, ballRadius,
        cushionsBefore, carom.cushionsAfter, carom.exitDir, 'direct',
      ));
    } else {
      const exitDir = normalize(aim.dx, aim.dy);
      out.push(makeCandidate(
        aim.dx, aim.dy, pathLen,
        ball, firstPos, secondPos, ballRadius,
        cushionsBefore, 0, exitDir, 'direct',
      ));
    }
  }

  return out;
}

function collectWallOnlyCandidates(
  cue: Pt,
  tableW: number,
  tableH: number,
  margin: number,
): Candidate[] {
  const nearY = cue.y < tableH * 0.5 ? margin : tableH - margin;
  const targets = [
    { x: tableW * 0.5, y: nearY },
    { x: margin * 2, y: tableH * 0.5 },
    { x: tableW - margin * 2, y: tableH * 0.5 },
  ];

  return targets.map((target) => ({
    aimDx: target.x - cue.x,
    aimDy: target.y - cue.y,
    pathLen: dist(cue, target) * 2,
    cushionsBeforeFirst: 1,
    cushionsBeforeSecond: 1,
    firstBall: 'red' as FirstBall,
    hitsSecond: false,
    points: 0 as const,
    routeKind: 'wall_only' as const,
  }));
}

function fallbackShot(
  cue: Pt,
  tableW: number,
  tableH: number,
  margin: number,
): Candidate {
  const nearY = cue.y < tableH * 0.5 ? margin : tableH - margin;
  const target = { x: tableW * 0.5, y: nearY };
  return {
    aimDx: target.x - cue.x,
    aimDy: target.y - cue.y,
    pathLen: dist(cue, target) * 3,
    cushionsBeforeFirst: 1,
    cushionsBeforeSecond: 1,
    firstBall: 'red',
    hitsSecond: false,
    points: 0,
    routeKind: 'wall_only',
  };
}

function spinForRoute(c: Candidate, profile: AiProfile): { spin: number; sideSpin: number } {
  if (!profile.useSpin) return { spin: 0, sideSpin: 0 };

  switch (c.routeKind) {
    case 'plus1_carom':
    case 'direct':
      return { spin: c.cushionsBeforeFirst === 0 ? 0 : 0.12, sideSpin: 0 };
    case 'bank':
      return { spin: 0.08, sideSpin: 0.1 };
    case 'plus2_reflect':
      return { spin: 0.35, sideSpin: 0.05 };
    default:
      return { spin: 0, sideSpin: 0 };
  }
}

function powerForRoute(c: Candidate, tableH: number): number {
  const distFactor = Math.min(c.pathLen / (tableH * 1.5), 1);
  switch (c.routeKind) {
    case 'plus1_carom':
    case 'direct':
      return 0.62 + distFactor * 0.22;
    case 'bank':
      return 0.68 + distFactor * 0.2;
    case 'plus2_reflect':
      return 0.78 + distFactor * 0.17;
    default:
      return 0.75 + distFactor * 0.15;
  }
}

export function planBilliardsShot(input: BilliardsAiInput, profile: AiProfile): ShotPlan {
  const { cue, red, white, tableW, tableH, isBreak } = input;
  const margin = cue.radius * 2;
  const ballRadius = cue.radius;

  let candidates = [
    ...collectPlusOneCandidates(cue.pos, red.pos, white.pos, tableW, tableH, margin, ballRadius),
    ...collectBankCandidates(cue.pos, red.pos, white.pos, tableW, tableH, margin, ballRadius),
    ...collectDirectCandidates(cue.pos, red.pos, white.pos, tableW, tableH, margin, ballRadius),
    ...collectPlusTwoCandidates(cue.pos, red.pos, white.pos, tableW, tableH, margin, ballRadius),
    ...collectWallOnlyCandidates(cue.pos, tableW, tableH, margin),
  ];

  if (candidates.length === 0) {
    candidates = [fallbackShot(cue.pos, tableW, tableH, margin)];
  }

  const best = pickRankedCandidate(
    candidates,
    (c) => scoreCandidate(c, isBreak, profile.ruleAwareness, tableH),
    profile,
    { scoringFilter: (c) => c.points >= 1 },
  );

  const spread = applyAimSpread(best.aimDx, best.aimDy, profile.aimSpreadRad);
  const { x: nx, y: ny, mag } = normalize(spread.dx, spread.dy);

  let power = powerForRoute(best, tableH);
  power = jitterPower(power, profile.powerJitter);
  power = applyPowerMistake(power, profile);

  const { spin, sideSpin } = spinForRoute(best, profile);

  return {
    dx: nx * mag,
    dy: ny * mag,
    spin,
    sideSpin,
    power,
  };
}
