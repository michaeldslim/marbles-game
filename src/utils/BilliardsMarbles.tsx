import React from 'react';
import { Circle, Ellipse } from 'react-native-svg';
import { Marble } from '../game/physics';

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
  return (
    <>
      {marbles.map((m) => {
        if (m.captured) return null;
        const isWhite = m.id === whiteBallId;
        const isYellow = m.id === yellowBallId;
        const isRed = redBallIds.some((id) => id != null && m.id === id);
        const isActiveCue = m.id === activeCueId;
        const dotColor = isRed ? '#ffffff' : isWhite || isYellow ? '#cc2200' : null;
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
            {dotColor && <Circle cx={m.pos.x} cy={m.pos.y} r={3} fill={dotColor} />}
          </React.Fragment>
        );
      })}
    </>
  );
}
