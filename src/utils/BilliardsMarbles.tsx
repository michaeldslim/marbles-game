import React, { useRef, useEffect } from 'react';
import { Circle, Ellipse } from 'react-native-svg';
import { Marble } from '../game/physics';

// module-level rotation state store so visual rotation survives component re-renders
const rotStore: Record<number, { angle: number; lastX: number; lastY: number }> = {};

type Props = {
  marbles: Marble[];
  /** ID of the white cue ball */
  whiteBallId: number | null | undefined;
  /** ID of the yellow cue ball */
  yellowBallId: number | null | undefined;
  /** IDs of all red balls (1 for 3-cushion, 2 for 4-ball) */
  redBallIds: (number | null | undefined)[];
  /** ID of the ball that is currently shooting */
  activeCueId: number | null | undefined;
  /** Whether the board is in "ready to shoot" state (shows the active ring) */
  isReady: boolean;
};

/**
 * Renders all marbles as SVG elements.
 * Must be used as a direct child of a react-native-svg <Svg> element.
 */
export default function BilliardsMarbles({
  marbles,
  whiteBallId,
  yellowBallId,
  redBallIds,
  activeCueId,
  isReady,
}: Props) {
  // rotStore is a module-level map (persisting across renders/components)
  // we mutate it directly from the IIFE rendering code so it survives re-renders
  // (defined below at module scope)
  useEffect(() => {
    // cleanup entries for marbles that no longer exist
    const ids = new Set(marbles.map((mm) => mm.id));
    for (const k of Object.keys(rotStore)) {
      const id = Number(k);
      if (!ids.has(id)) delete rotStore[id];
    }
  }, [marbles]);
  return (
    <>
      {marbles.map((m) => {
        if (m.captured) return null;
        const isWhite = m.id === whiteBallId;
        const isYellow = m.id === yellowBallId;
        const isRed = redBallIds.some((id) => id != null && m.id === id);
        const isActiveCue = m.id === activeCueId;
        // No center dot: use a rotating highlight that contrasts with the ball color.
        return (
          <React.Fragment key={m.id}>
            {isActiveCue && isReady && (
              <Circle
                cx={m.pos.x} cy={m.pos.y} r={m.radius + 5}
                fill="none" stroke="#fff" strokeWidth={2} strokeOpacity={0.7}
              />
            )}
            <Ellipse
              cx={m.pos.x} cy={m.pos.y + m.radius * 0.6}
              rx={m.radius * 1.15} ry={m.radius * 0.5}
              fill="#000" opacity={0.12}
            />
            <Circle
              cx={m.pos.x} cy={m.pos.y} r={m.radius}
              fill={m.color || '#fff'}
              stroke={isWhite ? '#999' : 'none'}
              strokeWidth={isWhite ? 1.5 : 0}
            />
            {(() => {
              const MIN_SPEED = 2; // px/s threshold under which we hide highlight
              const speed = Math.hypot(m.vel.x ?? 0, m.vel.y ?? 0);
              if (speed < MIN_SPEED) return null;
              const state = rotStore[m.id] ?? { angle: 0, lastX: m.pos.x, lastY: m.pos.y };
              const dx = m.pos.x - state.lastX;
              const dy = m.pos.y - state.lastY;
              const dist = Math.hypot(dx, dy);
              // advance angle by arc length / radius (distance travelled corresponds to rotation)
              if (m.radius > 0 && dist > 0) {
                state.angle += dist / m.radius;
              }
              state.lastX = m.pos.x;
              state.lastY = m.pos.y;
              rotStore[m.id] = state;
              const HIGHLIGHT_DIST = 0.62 * m.radius;
              const hx = m.pos.x + Math.cos(state.angle) * HIGHLIGHT_DIST;
              const hy = m.pos.y + Math.sin(state.angle) * HIGHLIGHT_DIST;
              const hr = Math.max(1.5, m.radius * 0.12);
              // choose highlight color: darker for white, red for yellow, white for others
              const highlightFill = isWhite ? '#888' : isYellow ? '#cc2200' : '#ffffff';
              const highlightOpacity = isWhite ? 0.9 : 0.85;
              return <Circle cx={hx} cy={hy} r={hr} fill={highlightFill} opacity={highlightOpacity} />;
            })()}
          </React.Fragment>
        );
      })}
    </>
  );
}
