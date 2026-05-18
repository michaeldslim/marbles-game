import React from 'react';
import { Polyline } from 'react-native-svg';
import { PhysicsEngine } from '../game/physics';

type AimState = { startX: number; startY: number; x: number; y: number };
type ChargeDir = { dx: number; dy: number; mag: number };

type Props = {
  aim: AimState | null;
  charging: boolean;
  chargeDirection: ChargeDir | null;
  engine: PhysicsEngine | null;
  /** ID of the currently shooting cue ball */
  activeCueId: number | null | undefined;
  /** Base launch speed (use s.launchSpeed3C or s.launchSpeed4B) */
  launchSpeed: number;
  /** Current power multiplier (powerRef.current) */
  power: number;
  /** Charge power multiplier (chargePowerRef.current) */
  chargePower: number;
  /** Current English/side-spin setting: 'left' | 'none' | 'right' */
  english: string;
  /** Number of simulation steps to preview (s.trajectoryLength) */
  trajectoryLength: number;
  /** When true, nothing is rendered (e.g. winner declared) */
  disabled?: boolean;
  offsetX?: number;
  offsetY?: number;
};

/**
 * Renders a dashed trajectory preview line as an SVG Polyline.
 * Must be used as a direct child of a react-native-svg <Svg> element.
 */
export default function TrajectoryLine({
  aim,
  charging,
  chargeDirection,
  engine: eng,
  activeCueId,
  launchSpeed,
  power,
  chargePower,
  english,
  trajectoryLength,
  disabled,
  offsetX = 0,
  offsetY = 0,
}: Props) {
  if (!eng || disabled || activeCueId == null) return null;
  if (!aim && !charging) return null;

  let dx: number, dy: number, mag: number;
  if (charging && chargeDirection) {
    ({ dx, dy, mag } = chargeDirection);
  } else if (aim) {
    dx = (aim.x || aim.startX) - aim.startX;
    dy = (aim.y || aim.startY) - aim.startY;
    mag = Math.hypot(dx, dy) || 1;
  } else {
    return null;
  }

  const active = eng.marbles.find((m) => m.id === activeCueId);
  let px = active ? active.pos.x : (aim ? aim.startX : 0);
  let py = active ? active.pos.y : (aim ? aim.startY : 0);
  const effectiveSpeed = charging
    ? launchSpeed * power * chargePower
    : launchSpeed * power;
  let vx = (dx / mag) * effectiveSpeed;
  let vy = (dy / mag) * effectiveSpeed;
  const r = active ? active.radius : 0;
  const fr = active?.friction ?? eng.friction;
  const e = eng.restitution;
  const ef = eng.englishFactor;
  const scr = 0.6; // SIDE_SPIN_CUSHION_RETAIN
  const englishMap: Record<string, number> = { left: -0.85, none: 0, right: 0.85 };
  let sideSpin = englishMap[english] ?? 0;
  const dt = 1 / 60;
  const pts: number[] = [];
  for (let i = 0; i < trajectoryLength; i++) {
    px += vx * dt; py += vy * dt;
    vx *= fr; vy *= fr;
    if (px - r < 0) { px = r; const pvx = vx; vx *= -e; if (sideSpin) { vy -= sideSpin * ef * Math.abs(pvx); sideSpin *= scr; } }
    if (px + r > eng.width) { px = eng.width - r; const pvx = vx; vx *= -e; if (sideSpin) { vy += sideSpin * ef * Math.abs(pvx); sideSpin *= scr; } }
    if (py - r < 0) { py = r; const pvy = vy; vy *= -e; if (sideSpin) { vx += sideSpin * ef * Math.abs(pvy); sideSpin *= scr; } }
    if (py + r > eng.height) { py = eng.height - r; const pvy = vy; vy *= -e; if (sideSpin) { vx -= sideSpin * ef * Math.abs(pvy); sideSpin *= scr; } }
    pts.push(px + offsetX, py + offsetY);
  }
  return (
    <Polyline
      points={pts.join(' ')}
      fill="none" stroke="#ffffff" strokeWidth={3} strokeOpacity={0.65} strokeDasharray={[6, 6]}
    />
  );
}
