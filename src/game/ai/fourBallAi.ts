import type { AiProfile, FourBallAiInput, Pt, ShotPlan } from './types';
import {
  applyAimSpread,
  dist,
  jitterPower,
  makeWalls,
  normalize,
  opponentLineRisk,
  rayHitsWallBeforeTarget,
} from './geometry';
import { applyPowerMistake, pickRankedCandidate } from './selection';

type ShotKind = 'follow' | 'ghost' | 'direct' | 'safety';

interface Candidate {
  dx: number;
  dy: number;
  spin: number;
  pathLen: number;
  kind: ShotKind;
  scoresBoth: boolean;
  foulRisk: number;
  safetyScore: number;
  wallBeforeBall: boolean;
}

function ghostBallScore(
  ghost: Pt,
  cue: Pt,
  primary: Pt,
  primToSecN: Pt,
  contactDist: number,
): number {
  const toG = { x: ghost.x - cue.x, y: ghost.y - cue.y };
  const toGMag = Math.hypot(toG.x, toG.y);
  if (toGMag < 1) return -Infinity;
  const toGN = { x: toG.x / toGMag, y: toG.y / toGMag };
  const cn = {
    x: (ghost.x - primary.x) / contactDist,
    y: (ghost.y - primary.y) / contactDist,
  };
  const proj = toGN.x * cn.x + toGN.y * cn.y;
  return (toGN.x - proj * cn.x) * primToSecN.x + (toGN.y - proj * cn.y) * primToSecN.y;
}

function foulRiskToTarget(
  cue: Pt,
  target: Pt,
  opponent: Pt,
  cueRadius: number,
  oppRadius: number,
): number {
  return opponentLineRisk(cue, target, opponent, cueRadius, oppRadius);
}

function buildCaromCandidates(
  cue: Pt,
  cueRadius: number,
  primaryPos: Pt,
  primaryRadius: number,
  secondaryPos: Pt,
  opponentPos: Pt,
  oppRadius: number,
  tableW: number,
  tableH: number,
): Candidate[] {
  const primaryDist = dist(cue, primaryPos);
  const cueToPrimN = {
    x: (primaryPos.x - cue.x) / primaryDist,
    y: (primaryPos.y - cue.y) / primaryDist,
  };
  const primToSec = { x: secondaryPos.x - primaryPos.x, y: secondaryPos.y - primaryPos.y };
  const primToSecMag = Math.hypot(primToSec.x, primToSec.y);
  const primToSecN = { x: primToSec.x / primToSecMag, y: primToSec.y / primToSecMag };
  const alignment = cueToPrimN.x * primToSecN.x + cueToPrimN.y * primToSecN.y;

  const out: Candidate[] = [];
  const m = cueRadius * 2;
  const walls = makeWalls(tableW, tableH, m);
  const contactDist = primaryRadius + cueRadius;

  const wallBeforePrimary = (dx: number, dy: number) =>
    rayHitsWallBeforeTarget(cue, { x: cue.x + dx, y: cue.y + dy }, walls, tableW, tableH, m, contactDist);

  if (alignment > 0.5) {
    const target = primaryPos;
    const dx = target.x - cue.x;
    const dy = target.y - cue.y;
    out.push({
      dx,
      dy,
      spin: 0.65,
      pathLen: primaryDist,
      kind: 'follow',
      scoresBoth: true,
      foulRisk: foulRiskToTarget(cue, target, opponentPos, cueRadius, oppRadius),
      safetyScore: 0,
      wallBeforeBall: wallBeforePrimary(dx, dy),
    });
  } else {
    const nA = { x: -primToSecN.y, y: primToSecN.x };
    const nB = { x: primToSecN.y, y: -primToSecN.x };
    const ghostA = { x: primaryPos.x + nA.x * contactDist, y: primaryPos.y + nA.y * contactDist };
    const ghostB = { x: primaryPos.x + nB.x * contactDist, y: primaryPos.y + nB.y * contactDist };

    for (const ghost of [ghostA, ghostB]) {
      const inBounds =
        ghost.x > m && ghost.x < tableW - m && ghost.y > m && ghost.y < tableH - m;
      if (!inBounds) continue;

      const ghostScore = ghostBallScore(ghost, cue, primaryPos, primToSecN, contactDist);
      if (ghostScore < -0.1) continue;

      const dx = ghost.x - cue.x;
      const dy = ghost.y - cue.y;
      out.push({
        dx,
        dy,
        spin: 0,
        pathLen: dist(cue, ghost),
        kind: 'ghost',
        scoresBoth: true,
        foulRisk: Math.max(
          foulRiskToTarget(cue, ghost, opponentPos, cueRadius, oppRadius),
          foulRiskToTarget(primaryPos, secondaryPos, opponentPos, cueRadius, oppRadius) * 0.5,
        ),
        safetyScore: 0,
        wallBeforeBall: wallBeforePrimary(dx, dy),
      });
    }

    if (out.length === 0) {
      const dx = primaryPos.x - cue.x;
      const dy = primaryPos.y - cue.y;
      out.push({
        dx,
        dy,
        spin: 0,
        pathLen: primaryDist,
        kind: 'ghost',
        scoresBoth: false,
        foulRisk: foulRiskToTarget(cue, primaryPos, opponentPos, cueRadius, oppRadius),
        safetyScore: 0,
        wallBeforeBall: wallBeforePrimary(dx, dy),
      });
    }
  }

  const directDx = secondaryPos.x - cue.x;
  const directDy = secondaryPos.y - cue.y;
  out.push({
    dx: directDx,
    dy: directDy,
    spin: 0.4,
    pathLen: dist(cue, secondaryPos),
    kind: 'direct',
    scoresBoth: false,
    foulRisk: foulRiskToTarget(cue, secondaryPos, opponentPos, cueRadius, oppRadius),
    safetyScore: 0,
    wallBeforeBall: rayHitsWallBeforeTarget(
      cue,
      secondaryPos,
      walls,
      tableW,
      tableH,
      m,
      contactDist,
    ),
  });

  return out;
}

function buildSafetyCandidate(
  cue: Pt,
  opponent: Pt,
  tableW: number,
  tableH: number,
  margin: number,
): Candidate {
  const awayX = cue.x < tableW * 0.5 ? tableW - margin * 3 : margin * 3;
  const awayY = cue.y < tableH * 0.5 ? tableH - margin * 3 : margin * 3;
  const dx = awayX - cue.x + (opponent.x - cue.x) * -0.35;
  const dy = awayY - cue.y + (opponent.y - cue.y) * -0.35;
  return {
    dx,
    dy,
    spin: 0,
    pathLen: dist(cue, { x: awayX, y: awayY }),
    kind: 'safety',
    scoresBoth: false,
    foulRisk: 0,
    safetyScore: dist(cue, opponent),
    wallBeforeBall: true,
  };
}

function scoreCandidate(c: Candidate, profile: AiProfile): number {
  let score = 0;
  if (c.scoresBoth) score += 100;
  else if (c.kind === 'direct') score += 12;
  else if (c.kind === 'safety') score += profile.safetyBias * 40;

  score -= c.foulRisk * profile.foulAvoidance * 200;

  if (c.foulRisk > 0.35 && profile.foulAvoidance > 0.5) {
    score -= 80 * profile.foulAvoidance;
  }

  if (c.wallBeforeBall) {
    score -= c.kind === 'safety' ? 0 : 90 * Math.max(0.35, profile.ruleAwareness);
  }

  score += c.safetyScore * profile.safetyBias * 0.08;
  score -= c.pathLen * 0.01;

  return score;
}

export function planFourBallShot(input: FourBallAiInput, profile: AiProfile): ShotPlan {
  const { cue, red1, red2, opponentCue, tableW, tableH } = input;
  const margin = cue.radius * 2;

  const d1 = dist(cue.pos, red1.pos);
  const d2 = dist(cue.pos, red2.pos);
  const [primary, secondary] = d1 <= d2 ? [red1, red2] : [red2, red1];

  let candidates = buildCaromCandidates(
    cue.pos,
    cue.radius,
    primary.pos,
    primary.radius,
    secondary.pos,
    opponentCue.pos,
    opponentCue.radius,
    tableW,
    tableH,
  );

  const hasScoring = candidates.some((c) => c.scoresBoth && c.foulRisk < 0.5 && !c.wallBeforeBall);

  if (!hasScoring && profile.safetyBias > 0.2) {
    candidates.push(buildSafetyCandidate(cue.pos, opponentCue.pos, tableW, tableH, margin));
  }

  const best = pickRankedCandidate(
    candidates,
    (c) => scoreCandidate(c, profile),
    profile,
    {
      scoringFilter: (c) =>
        c.scoresBoth &&
        !c.wallBeforeBall &&
        (profile.foulAvoidance < 0.55 || c.foulRisk < 0.4),
    },
  );

  const useSafetyFallback =
    !hasScoring &&
    profile.safetyBias > 0.35 &&
    best.kind !== 'safety' &&
    Math.random() < profile.safetyBias * 0.25;

  const chosen = useSafetyFallback
    ? candidates.find((c) => c.kind === 'safety') ?? best
    : best;

  const spreadMul = chosen.kind === 'follow' ? 1.15 : chosen.kind === 'ghost' ? 1 : 0.9;
  const spread = applyAimSpread(chosen.dx, chosen.dy, profile.aimSpreadRad * spreadMul);
  const { x: nx, y: ny, mag } = normalize(spread.dx, spread.dy);

  const primaryDist = Math.min(d1, d2);
  const distFactor = Math.min(primaryDist / (tableH * 0.6), 1);
  let power = chosen.kind === 'safety' ? 0.5 : 0.6 + distFactor * 0.3;
  power = jitterPower(power, profile.powerJitter);
  power = applyPowerMistake(power, profile);

  return {
    dx: nx * mag,
    dy: ny * mag,
    spin: chosen.spin,
    sideSpin: 0,
    power,
  };
}
