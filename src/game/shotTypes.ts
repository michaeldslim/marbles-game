import { PICKER_R } from '../utils/PickerOverlay';

export type SpinType = 'draw' | 'stop' | 'follow';
export type EnglishType = 'left' | 'none' | 'right';

export function spinPickerContact(
  key: SpinType,
  current: { x: number; y: number },
): { x: number; y: number } {
  const yMap: Record<SpinType, number> = { draw: PICKER_R, stop: 0, follow: -PICKER_R };
  const nx = current.x;
  const ny = yMap[key];
  const d = Math.hypot(nx, ny);
  const s = d > PICKER_R ? PICKER_R / d : 1;
  return { x: nx * s, y: ny * s };
}

export function englishPickerContact(
  key: EnglishType,
  current: { x: number; y: number },
): { x: number; y: number } {
  const xMap: Record<EnglishType, number> = { left: -PICKER_R, none: 0, right: PICKER_R };
  const nx = xMap[key];
  const ny = current.y;
  const d = Math.hypot(nx, ny);
  const s = d > PICKER_R ? PICKER_R / d : 1;
  return { x: nx * s, y: ny * s };
}
