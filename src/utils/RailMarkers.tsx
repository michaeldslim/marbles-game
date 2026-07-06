import React from 'react';
import { Circle } from 'react-native-svg';

type Props = {
  totalWidth: number;
  boardW: number;
  boardH: number;
  dotCount?: number;
};

/**
 * White alignment dots centered on the left/right wooden rails beside the felt.
 */
export default function RailMarkers({
  totalWidth,
  boardW,
  boardH,
  dotCount = 9,
}: Props) {
  const railWidth = (totalWidth - boardW) / 2;
  if (railWidth < 4 || dotCount < 1) return null;

  const dotRadius = Math.min(3, railWidth * 0.14);
  const leftX = railWidth / 2;
  const rightX = totalWidth - railWidth / 2;
  const marginY = boardH * 0.05;
  const span = boardH - marginY * 2;

  const ys = Array.from({ length: dotCount }, (_, i) =>
    dotCount === 1 ? boardH / 2 : marginY + (span * i) / (dotCount - 1),
  );

  return (
    <>
      {ys.map((y, i) => (
        <React.Fragment key={i}>
          <Circle cx={leftX} cy={y} r={dotRadius} fill="#fff" />
          <Circle cx={rightX} cy={y} r={dotRadius} fill="#fff" />
        </React.Fragment>
      ))}
    </>
  );
}
