/** Distance from board SVG edge to inner play-area edge (6px margin + half of 10px stroke). */
export const BOARD_INSET = 11;

export interface BoardDimensions {
  boardW: number;
  boardH: number;
  innerW: number;
  innerH: number;
}

export function computeBoardDimensions(
  containerW: number,
  containerH: number,
  hudHeight: number,
): BoardDimensions {
  const boardMaxH = containerH - hudHeight;
  const boardH = Math.min(boardMaxH, containerW * 2);
  const boardW = boardH / 2;
  const innerW = Math.max(4, boardW - BOARD_INSET * 2);
  const innerH = Math.max(4, boardH - BOARD_INSET * 2);
  return { boardW, boardH, innerW, innerH };
}
