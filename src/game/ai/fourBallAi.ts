import type { AiProfile, FourBallAiInput, Pt, ShotPlan } from './types';
import { applyAimSpread, dist, jitterPower, normalize, opponentLineRisk } from './geometry';
import { applyPowerMistake, pickRankedCandidate } from './selection';

type ShotKind = 'follow' | 'ghost' | 'direct';

interface Candidate {
  dx: number;
  dy: number;
  spin: number;
  pathLen: number;
  kind: ShotKind;
  scoresBoth: boolean;
  foulRisk: number;
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

function buildCandidates(
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
  const m = cueRadius * 2;
  const contactDist = primaryRadius + cueRadius;
  const out: Candidate[] = [];

  const foul = (target: Pt) =>
    opponentLineRisk(cue, target, opponentPos, cueRadius, oppRadius);

  if (alignment > 0.5) {
    out.push({
      dx: primaryPos.x - cue.x,
      dy: primaryPos.y - cue.y,
      spin: 0.65,
      pathLen: primaryDist,
      kind: 'follow',
      scoresBoth: true,
      foulRisk: foul(primaryPos),
    });
  } else {
    const nA = { x: -primToSecN.y, y: primToSecN.x };
    const nB = { x: primToSecN.y, y: -primToSecN.x };
    const ghostA = { x: primaryPos.x + nA.x * contactDist, y: primaryPos.y + nA.y * contactDist };
    const ghostB = { x: primaryPos.x + nB.x * contactDist, y: primaryPos.y + nB.y * contactDist };
    const ghost = ghostBallScore(ghostA, cue, primaryPos, primToSecN, contactDist)
      >= ghostBallScore(ghostB, cue, primaryPos, primToSecN, contactDist)
      ? ghostA
      : ghostB;

    const inBounds =
      ghost.x > m && ghost.x < tableW - m && ghost.y > m && ghost.y < tableH - m;

    out.push({
      dx: inBounds ? ghost.x - cue.x : primaryPos.x - cue.x,
      dy: inBounds ? ghost.y - cue.y : primaryPos.y - cue.y,
      spin: 0,
      pathLen: inBounds ? dist(cue, ghost) : primaryDist,
      kind: 'ghost',
      scoresBoth: inBounds,
      foulRisk: Math.max(foul(ghost), foul(primaryPos) * 0.5),
    });
  }

  out.push({
    dx: secondaryPos.x - cue.x,
    dy: secondaryPos.y - cue.y,
    spin: 0.4,
    pathLen: dist(cue, secondaryPos),
    kind: 'direct',
    scoresBoth: false,
    foulRisk: foul(secondaryPos),
  });

  return out;
}

function scoreCandidate(c: Candidate, profile: AiProfile): number {
  let score = c.scoresBoth ? 100 : c.kind === 'direct' ? 12 : 0;
  score -= c.foulRisk * profile.foulAvoidance * 200;
  score -= c.pathLen * 0.01;
  return score;
}

function spreadForShot(kind: ShotKind, profile: AiProfile): number {
  // Original inline AI used ~0.32 follow / ~0.22 cut at intermediate.
  const base = kind === 'follow' ? 0.32 : kind === 'ghost' ? 0.22 : 0.18;
  const scale = profile.aimSpreadRad / 0.14;
  return base * scale;
}

export function planFourBallShot(input: FourBallAiInput, profile: AiProfile): ShotPlan {
  const { cue, red1, red2, opponentCue, tableW, tableH } = input;

  const d1 = dist(cue.pos, red1.pos);
  const d2 = dist(cue.pos, red2.pos);
  const [primary, secondary] = d1 <= d2 ? [red1, red2] : [red2, red1];
  const primaryDist = Math.min(d1, d2);

  const candidates = buildCandidates(
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

  const best = pickRankedCandidate(
    candidates,
    (c) => scoreCandidate(c, profile),
    profile,
    {
      scoringFilter: (c) =>
        c.scoresBoth && (profile.foulAvoidance < 0.5 || c.foulRisk < 0.35),
    },
  );

  const spread = applyAimSpread(best.dx, best.dy, spreadForShot(best.kind, profile));
  const { x: nx, y: ny, mag } = normalize(spread.dx, spread.dy);

  const distFactor = Math.min(primaryDist / (tableH * 0.6), 1);
  let power = 0.6 + distFactor * 0.3;
  power = jitterPower(power, profile.powerJitter);
  power = applyPowerMistake(power, profile);

  return { dx: nx * mag, dy: ny * mag, spin: best.spin, sideSpin: 0, power };
}
