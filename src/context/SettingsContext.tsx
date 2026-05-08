import React, { createContext, useContext, useState } from 'react';
import {
  BILLIARDS_BALL_RADIUS,
  FOURBALL_BALL_RADIUS,
  BILLIARDS_BALL_FRICTION,
  FOURBALL_BALL_FRICTION,
  ENGINE_DEFAULT_RESTITUTION,
  BILLIARDS_LAUNCH_SPEED,
  FOURBALL_LAUNCH_SPEED,
  DEFAULT_PLAYER_POWER,
  SPIN_TRANSFER_FACTOR,
  ENGLISH_FACTOR,
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

  // Spin / 스핀
  spinTransfer: number;       // Draw/Follow spin transfer factor
  englishFactor: number;      // Side-spin English factor
}

export const DEFAULT_SETTINGS: Settings = {
  ballRadius3C:  BILLIARDS_BALL_RADIUS,
  ballRadius4B:  FOURBALL_BALL_RADIUS,
  restitution:   ENGINE_DEFAULT_RESTITUTION,
  friction3C:    BILLIARDS_BALL_FRICTION,
  friction4B:    FOURBALL_BALL_FRICTION,
  launchSpeed3C: BILLIARDS_LAUNCH_SPEED,
  launchSpeed4B: FOURBALL_LAUNCH_SPEED,
  playerPower:   DEFAULT_PLAYER_POWER,
  spinTransfer:  SPIN_TRANSFER_FACTOR,
  englishFactor: ENGLISH_FACTOR,
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
