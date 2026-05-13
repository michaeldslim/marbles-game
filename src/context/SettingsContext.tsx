import React, { createContext, useContext, useState } from 'react';
import { Dimensions } from 'react-native';
import {
  BILLIARDS_BALL_FRICTION,
  FOURBALL_BALL_FRICTION,
  ENGINE_DEFAULT_RESTITUTION,
  BILLIARDS_LAUNCH_SPEED,
  FOURBALL_LAUNCH_SPEED,
  DEFAULT_PLAYER_POWER,
  SPIN_TRANSFER_FACTOR,
  ENGLISH_FACTOR,
  DEFAULT_CHARGE_CYCLES_PER_SEC,
  STOP_DRAG,
  TRAJECTORY_LENGTH,
} from '../game/constants';

export interface Settings {
  // Ball sizes / 공 크기
  ballRadius3C: number;       // 3-Cushion ball radius
  ballRadius4B: number;       // 4-Ball ball radius

  // Physics / 물리
  restitution: number;        // Bounciness / 반발계수
  friction3C: number;         // 3-Cushion ball friction
  friction4B: number;         // 4-Ball ball friction

  // Launch / 발사
  launchSpeed3C: number;      // 3-Cushion launch speed
  launchSpeed4B: number;      // 4-Ball launch speed
  playerPower: number;        // Power multiplier / 파워 배율
  chargeCyclesPerSec: number; // Power meter oscillation speed

  // Spin / 스핀
  spinTransfer: number;       // Draw/Follow spin transfer factor
  englishFactor: number;      // Side-spin English factor

  // Stopping / 정지
  stopDrag: number;           // Linear deceleration to help balls stop sooner

  trajectoryLength: number;   // Length of the trajectory preview line in pixels
}

const screenW = Dimensions.get('window').width;
export const AUTO_BALL_RADIUS = Math.round(screenW * 0.042); // 360→15, 412→17, 659→28
export const BALL_RADIUS_MIN  = Math.round(AUTO_BALL_RADIUS * 0.7);
export const BALL_RADIUS_MAX  = Math.round(AUTO_BALL_RADIUS * 1.6);

export const DEFAULT_SETTINGS: Settings = {
  ballRadius3C:  AUTO_BALL_RADIUS,
  ballRadius4B:  AUTO_BALL_RADIUS,
  restitution:   ENGINE_DEFAULT_RESTITUTION,
  friction3C:    BILLIARDS_BALL_FRICTION,
  friction4B:    FOURBALL_BALL_FRICTION,
  launchSpeed3C: BILLIARDS_LAUNCH_SPEED,
  launchSpeed4B: FOURBALL_LAUNCH_SPEED,
  playerPower:   DEFAULT_PLAYER_POWER,
  chargeCyclesPerSec: DEFAULT_CHARGE_CYCLES_PER_SEC,
  spinTransfer:  SPIN_TRANSFER_FACTOR,
  englishFactor: ENGLISH_FACTOR,
  stopDrag:      STOP_DRAG,
  trajectoryLength: TRAJECTORY_LENGTH,
};

interface SettingsContextValue {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSetting: () => {},
  resetSettings: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => setSettings({ ...DEFAULT_SETTINGS });

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
