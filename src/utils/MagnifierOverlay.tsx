import React from 'react';
import { View } from 'react-native';
import { Circle, Line, Rect, Svg } from 'react-native-svg';
import { Marble, PhysicsEngine } from '../game/physics';

type AimState = { startX: number; startY: number; x: number; y: number };
type ChargeDir = { dx: number; dy: number; mag: number };

type Props = {
  aim: AimState | null;
  charging: boolean;
  chargeDirection: ChargeDir | null;
  engine: PhysicsEngine | null;
  /** ID of the currently shooting cue ball */
  activeCueId: number | null | undefined;
  /** When true, nothing is rendered (e.g. shot in flight) */
  disabled?: boolean;
  offsetX?: number;
  offsetY?: number;
};

/**
 * Circular magnifier that shows a zoomed view of the first ball in the aim path.
 * Renders as an absolutely positioned View (top-right corner of the board).
 */
export default function MagnifierOverlay({
  aim,
  charging,
  chargeDirection,
  engine: eng,
  activeCueId,
  disabled,
  offsetX = 0,
  offsetY = 0,
}: Props) {
  if (!eng || activeCueId == null || disabled) return null;
  if (!aim && !charging) return null;

  let dx: number, dy: number, mag: number;
  if (charging && chargeDirection) {
    ({ dx, dy, mag } = chargeDirection);
  } else if (aim) {
    // aim.x/y and aim.startX/Y are both in physics coords; delta = direction from ball to finger
    dx = aim.x - aim.startX;
    dy = aim.y - aim.startY;
    mag = Math.hypot(dx, dy) || 1;
  } else {
    return null;
  }

  const active = eng.marbles.find((m) => m.id === activeCueId);
  if (!active) return null;
  const ux = dx / mag;
  const uy = dy / mag;

  // Ray-circle intersection: find first target marble in the aim direction
  let minT = Infinity;
  let hitMarble: Marble | null = null;
  for (const m of eng.marbles) {
    if (m.id === activeCueId || m.captured) continue;
    const fx = active.pos.x - m.pos.x;
    const fy = active.pos.y - m.pos.y;
    const minDist = active.radius + m.radius;
    const b = 2 * (fx * ux + fy * uy);
    const c = fx * fx + fy * fy - minDist * minDist;
    const disc = b * b - 4 * c;
    if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / 2;
    if (t > 0 && t < minT) { minT = t; hitMarble = m; }
  }
  if (!hitMarble) return null;

  const collX = active.pos.x + ux * minT;
  const collY = active.pos.y + uy * minT;
  const MAG_SIZE = 80;
  const ZOOM = 1.2;
  const worldW = MAG_SIZE / ZOOM;
  const worldH = MAG_SIZE / ZOOM;
  const midX = (collX + hitMarble.pos.x) / 2;
  const midY = (collY + hitMarble.pos.y) / 2;
  const viewBox = `${midX - worldW / 2} ${midY - worldH / 2} ${worldW} ${worldH}`;

  // Luminance-based line color for crosshair contrast
  const hex = (hitMarble.color || '#fff').replace('#', '');
  const r2 = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
  const g2 = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
  const b2 = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
  const lineColor = (r2 * 0.299 + g2 * 0.587 + b2 * 0.114) > 160 ? '#000' : '#fff';

  return (
    <View
      style={{
        position: 'absolute', top: 17, right: 17,
        width: MAG_SIZE, height: MAG_SIZE,
        borderRadius: MAG_SIZE / 2,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.8)',
      }}
      pointerEvents="none"
    >
      <Svg width={MAG_SIZE} height={MAG_SIZE} viewBox={viewBox}>
        <Rect x={0} y={0} width={eng.width} height={eng.height} fill="#2d6a4f" />
        <Rect x={6} y={6} width={eng.width - 12} height={eng.height - 12} fill="none" stroke="#1b4332" strokeWidth={10} />
        {eng.marbles.filter((m) => !m.captured).map((m) => (
          <Circle
            key={m.id}
            cx={m.pos.x + offsetX} cy={m.pos.y + offsetY} r={m.radius}
            fill={m.color || '#fff'}
            stroke={m.id === activeCueId ? '#999' : 'none'}
            strokeWidth={1.5}
          />
        ))}
        {/* Ghost cue ball at collision position */}
        <Circle
          cx={collX + offsetX} cy={collY + offsetY} r={active.radius}
          fill={active.color || '#fff'}
          opacity={0.5}
          stroke="#fff" strokeWidth={1}
          strokeDasharray={[3, 3]}
        />
        {/* Crosshair lines through target ball center */}
        <Line
          x1={hitMarble.pos.x + offsetX} y1={hitMarble.pos.y - hitMarble.radius + offsetY}
          x2={hitMarble.pos.x + offsetX} y2={hitMarble.pos.y + hitMarble.radius + offsetY}
          stroke={lineColor} strokeWidth={1} strokeDasharray={[2, 2]} strokeOpacity={0.85}
        />
        <Line
          x1={hitMarble.pos.x - hitMarble.radius + offsetX} y1={hitMarble.pos.y + offsetY}
          x2={hitMarble.pos.x + hitMarble.radius + offsetX} y2={hitMarble.pos.y + offsetY}
          stroke={lineColor} strokeWidth={1} strokeDasharray={[2, 2]} strokeOpacity={0.85}
        />
      </Svg>
    </View>
  );
}
