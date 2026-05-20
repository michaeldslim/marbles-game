import React, { createContext, useContext, useState, useEffect } from 'react';
import { Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  
  // UI language: 'ko' or 'en'
  language?: 'ko' | 'en';
  // Internal version for settings migration
  settingsVersion?: number;
}

const { width: screenW, height: screenH } = Dimensions.get('window');
// Compute an AUTO_BALL_RADIUS that fits a 1:2 (W:H) playboard placed within the
// available window height (reserve ~140px for HUD). Convert real-world ball
// radius (61.5mm diameter → 30.75mm radius) to pixels using board pixel height
// with 1 inch = 2.54 cm conversion.
const BOARD_UI_GAP = 140;
const BALL_RADIUS_M = 0.03075; // 30.75 mm
const boardMaxH = Math.max(320, screenH - BOARD_UI_GAP);
const desiredBoardH = Math.min(boardMaxH, Math.max(320, screenW) * 2);
export const AUTO_BALL_RADIUS = Math.max(4, Math.round(BALL_RADIUS_M * desiredBoardH / 2.54));
export const BALL_RADIUS_MIN  = Math.max(3, Math.round(AUTO_BALL_RADIUS * 0.7));
export const BALL_RADIUS_MAX  = Math.max(16, Math.round(AUTO_BALL_RADIUS * 1.6));

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
  language: 'ko',
  settingsVersion: 2,
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

const STORAGE_KEY = '@marbles_settings';
// Bump this when stored setting values change meaning (forces migration).
const SETTINGS_VERSION = 2;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });

  // Load persisted settings on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Partial<Settings> & { settingsVersion?: number };
        // Version 1 → 2: friction/spinDecay changed from per-step to per-second.
        // Old values (>0.95) would make balls slide forever; reset to new defaults.
        if ((saved.settingsVersion ?? 1) < SETTINGS_VERSION) {
          delete saved.friction3C;
          delete saved.friction4B;
          saved.settingsVersion = SETTINGS_VERSION;
        }
        setSettings((prev) => ({ ...prev, ...saved }));
      } catch {
        // corrupted data — ignore and use defaults
      }
    });
  }, []);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resetSettings = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
