import React from 'react';
import { View } from 'react-native';
import { Circle, Line, Svg } from 'react-native-svg';

const PICKER_R = 54;
const SIZE = 128;
const HANDLE_H = 22;

type Props = {
  /** Whether the picker should be visible */
  visible: boolean;
  /** Current dot position relative to picker center */
  pickerContact: { x: number; y: number };
  /** Absolute position of the picker on the board, or null for default */
  pickerPos: { x: number; y: number } | null;
  /** Board width, used to compute the default right-aligned position */
  boardWidth: number;
  /** panHandlers from the dot-drag PanResponder (pickerPan.panHandlers) */
  pickerPanHandlers: Record<string, unknown>;
  /** panHandlers from the container-drag PanResponder (pickerMovePan.panHandlers) */
  pickerMovePanHandlers: Record<string, unknown>;
};

/**
 * English / spin picker overlay.
 * Renders as an absolutely positioned View on top of the board.
 */
export default function PickerOverlay({
  visible,
  pickerContact,
  pickerPos,
  boardWidth,
  pickerPanHandlers,
  pickerMovePanHandlers,
}: Props) {
  if (!visible) return null;

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const dotX = cx + pickerContact.x;
  const dotY = cy + pickerContact.y;
  const pos = pickerPos ?? { x: boardWidth - SIZE - 11, y: 130 };

  return (
    <View style={{ position: 'absolute', top: pos.y, left: pos.x, width: SIZE, height: SIZE + HANDLE_H }}
      pointerEvents="box-none"
    >
      {/* Drag handle */}
      <View
        style={{
          height: HANDLE_H, width: SIZE,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.4)',
          borderTopLeftRadius: 6, borderTopRightRadius: 6,
          rowGap: 4,
        }}
        {...(pickerMovePanHandlers as object)}
      >
        <View style={{ width: 28, height: 2.5, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
        <View style={{ width: 28, height: 2.5, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
      </View>

      {/* Picker circle */}
      <View style={{ width: SIZE, height: SIZE }} {...(pickerPanHandlers as object)}>
        <Svg width={SIZE} height={SIZE}>
          {/* outer ring */}
          <Circle cx={cx} cy={cy} r={PICKER_R} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
          {/* crosshair lines */}
          <Line x1={cx} y1={cy - PICKER_R} x2={cx} y2={cy + PICKER_R} stroke="rgba(255,255,255,0.25)" strokeWidth={0.8} />
          <Line x1={cx - PICKER_R} y1={cy} x2={cx + PICKER_R} y2={cy} stroke="rgba(255,255,255,0.25)" strokeWidth={0.8} />
          {/* zone ring */}
          <Circle cx={cx} cy={cy} r={PICKER_R * 0.3} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} />
          {/* dot */}
          <Circle cx={dotX} cy={dotY} r={9} fill="#fff" opacity={0.95} />
          <Circle cx={dotX} cy={dotY} r={9} fill="none" stroke="#333" strokeWidth={1.5} />
        </Svg>
      </View>
    </View>
  );
}
