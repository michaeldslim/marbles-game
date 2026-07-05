import type { Pt } from './types';

export interface Wall {
  axis: 'x' | 'y';
  val: number;
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function normalize(dx: number, dy: number): { x: number; y: number; mag: number } {
  const mag = Math.hypot(dx, dy) || 1;
  return { x: dx / mag, y: dy / mag, mag };
}

export function makeWalls(tableW: number, tableH: number, margin: number): Wall[] {
  return [
    { axis: 'y', val: margin },
    { axis: 'y', val: tableH - margin },
    { axis: 'x', val: margin },
    { axis: 'x', val: tableW - margin },
  ];
}

export function mirror(p: Pt, wallIdx: number, walls: Wall[]): Pt {
  const wb = walls[wallIdx];
  return wb.axis === 'y'
    ? { x: p.x, y: 2 * wb.val - p.y }
    : { x: 2 * wb.val - p.x, y: p.y };
}

export function wallHit(
  from: Pt,
  to: Pt,
  wallIdx: number,
  walls: Wall[],
  tableW: number,
  tableH: number,
  margin: number,
): Pt | null {
  const wb = walls[wallIdx];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let t: number;
  if (wb.axis === 'y') {
    if (Math.abs(dy) < 0.5) return null;
    t = (wb.val - from.y) / dy;
  } else {
    if (Math.abs(dx) < 0.5) return null;
    t = (wb.val - from.x) / dx;
  }
  if (t <= 0.005 || t >= 0.995) return null;
  const px = from.x + t * dx;
  const py = from.y + t * dy;
  if (wb.axis === 'y' && (px < margin || px > tableW - margin)) return null;
  if (wb.axis === 'x' && (py < margin || py > tableH - margin)) return null;
  return { x: px, y: py };
}

/** Count cushion bounces along a ray before reaching maxDist or leaving table. */
export function countCushionsAlongRay(
  from: Pt,
  dir: Pt,
  maxDist: number,
  walls: Wall[],
  tableW: number,
  tableH: number,
  margin: number,
  maxBounces = 6,
): number {
  let x = from.x;
  let y = from.y;
  let vx = dir.x;
  let vy = dir.y;
  let traveled = 0;
  let cushions = 0;

  for (let bounce = 0; bounce < maxBounces && traveled < maxDist; bounce++) {
    let bestT = Infinity;
    let bestWall = -1;

    for (let w = 0; w < 4; w++) {
      const wb = walls[w];
      let t: number;
      if (wb.axis === 'y') {
        if (Math.abs(vy) < 1e-6) continue;
        t = (wb.val - y) / vy;
      } else {
        if (Math.abs(vx) < 1e-6) continue;
        t = (wb.val - x) / vx;
      }
      if (t <= 1e-4) continue;
      const px = x + t * vx;
      const py = y + t * vy;
      if (wb.axis === 'y' && (px < margin || px > tableW - margin)) continue;
      if (wb.axis === 'x' && (py < margin || py > tableH - margin)) continue;
      if (t < bestT) {
        bestT = t;
        bestWall = w;
      }
    }

    if (bestWall < 0 || bestT === Infinity) break;
    if (traveled + bestT > maxDist) break;

    traveled += bestT;
    x += bestT * vx;
    y += bestT * vy;
    cushions++;

    const wb = walls[bestWall];
    if (wb.axis === 'y') vy = -vy;
    else vx = -vx;
  }

  return cushions;
}

/** Distance from point P to infinite line through A in direction D. */
export function pointLineDistance(p: Pt, a: Pt, dir: Pt): number {
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const cross = Math.abs(apx * dir.y - apy * dir.x);
  return cross;
}

/** True when the ray from `from` toward `target` hits a cushion before reaching the target. */
export function rayHitsWallBeforeTarget(
  from: Pt,
  target: Pt,
  walls: Wall[],
  tableW: number,
  tableH: number,
  margin: number,
  stopBeforeRadius = 0,
): boolean {
  const { x, y, mag } = normalize(target.x - from.x, target.y - from.y);
  if (mag < 1) return false;
  const maxDist = Math.max(1, mag - stopBeforeRadius);
  return countCushionsAlongRay(from, { x, y }, maxDist * 0.98, walls, tableW, tableH, margin, 2) > 0;
}

/** Whether opponent cue lies near the cue→target line (foul risk for 4-ball). */
export function opponentLineRisk(
  cue: Pt,
  target: Pt,
  opponent: Pt,
  cueRadius: number,
  oppRadius: number,
): number {
  const { x: nx, y: ny, mag } = normalize(target.x - cue.x, target.y - cue.y);
  if (mag < 1) return 0;
  const clearance = cueRadius + oppRadius + 4;
  const d = pointLineDistance(opponent, cue, { x: nx, y: ny });
  const along = (opponent.x - cue.x) * nx + (opponent.y - cue.y) * ny;
  if (along <= 0 || along >= mag) return 0;
  if (d >= clearance) return 0;
  return 1 - d / clearance;
}

export function applyAimSpread(dx: number, dy: number, spreadRad: number): { dx: number; dy: number } {
  const spread = (Math.random() - 0.5) * spreadRad * 2;
  const cosS = Math.cos(spread);
  const sinS = Math.sin(spread);
  return {
    dx: dx * cosS - dy * sinS,
    dy: dx * sinS + dy * cosS,
  };
}

export function jitterPower(power: number, jitter: number): number {
  const factor = 1 + (Math.random() - 0.5) * jitter * 2;
  return Math.max(0.3, Math.min(1, power * factor));
}
