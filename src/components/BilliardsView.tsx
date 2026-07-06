/**
 * 3-Cushion Billiards
 *
 * Rules:
 *  - Cue ball must touch 3+ cushions before hitting the final (2nd) ball → +1 pt, keep shooting
 *  - Miss (fail) → turn ends, no penalty
 *  - Break: first shot must hit the red ball first; hitting yellow first = foul (turn ends, no penalty)
 *  - Foul (ball leaves table / illegal touch) → turn ends, no penalty
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, PanResponder, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, AppState, AppStateStatus, Platform } from 'react-native';
import Svg, { Rect, Defs, Pattern, Image as SvgImage } from 'react-native-svg';
import BilliardsMarbles from '../utils/BilliardsMarbles';
import RailMarkers from '../utils/RailMarkers';
import PickerOverlay, { PICKER_R, PICKER_HALF, PICKER_SIZE } from '../utils/PickerOverlay';
import MagnifierOverlay from '../utils/MagnifierOverlay';
import TrajectoryLine from '../utils/TrajectoryLine';
import { Audio } from 'expo-av';
import { PhysicsEngine, Marble } from '../game/physics';
import { 
  DEFAULT_PLAYER_POWER, 
  SETTLE_SPEED_THRESHOLD, 
  BILLIARDS_SETTLE_FRAMES, 
} from '../game/constants';
import { useSettings } from '../context/SettingsContext';
import { t } from '../i18n';
import GameHudNav from './ui/GameHudNav';
import GameHudPanel from './ui/GameHudPanel';
import BilliardsScoreboard from './gameHud/BilliardsScoreboard';
import ShotControls from './gameHud/ShotControls';
import { EnglishType, SpinType, englishPickerContact, spinPickerContact } from '../game/shotTypes';
import { BOARD_UI_GAP, colors } from '../theme';
import { BOARD_INSET, computeBoardDimensions } from '../game/boardLayout';
import { getAiProfile, planBilliardsShot, randomThinkDelayMs } from '../game/ai';

interface Props {
  onBack: () => void;
  vsAI?: boolean;
}

export default function BilliardsView({ onBack, vsAI = false }: Props): JSX.Element {
  const vsAIRef = useRef<boolean>(vsAI);
  useEffect(() => { vsAIRef.current = vsAI; }, [vsAI]);
  const { settings } = useSettings();
  const s = settings; // shorthand
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const lang = settings.language ?? 'en';
  const [size, setSize] = useState({ w: 360, h: 640 });
  const hudHeightRef = useRef(BOARD_UI_GAP);

  const syncEngineLayout = (innerW: number, innerH: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.width === innerW && eng.height === innerH) return;
    eng.width = innerW;
    eng.height = innerH;
    for (const m of eng.marbles) {
      if (m.captured) continue;
      m.pos.x = Math.max(m.radius, Math.min(innerW - m.radius, m.pos.x));
      m.pos.y = Math.max(m.radius, Math.min(innerH - m.radius, m.pos.y));
    }
  };

  useEffect(() => {
    const { innerW, innerH } = computeBoardDimensions(size.w, size.h, BOARD_UI_GAP);
    syncEngineLayout(innerW, innerH);
  }, [size.w, size.h]);
  const [marbles, setMarbles] = useState<Marble[]>([]);
  const [score1, setScore1] = useState<number>(0);
  const score1Ref = useRef<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const score2Ref = useRef<number>(0);
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [turn, setTurn] = useState<1 | 2>(1);
  const turnRef = useRef<1 | 2>(1);

  const shotActiveRef = useRef<boolean>(false);
  const powerRef = useRef<number>(DEFAULT_PLAYER_POWER);
  const engineRef = useRef<PhysicsEngine | null>(null);
  const playerIdRef = useRef<number | null>(null);
  const aimingRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const settledCounterRef = useRef<number>(0);
  const hitSoundRef = useRef<Audio.Sound | null>(null);
  const bmSoundRef = useRef<Audio.Sound | null>(null);

  const yellowIdRef = useRef<number | null>(null);
  const redBallIdRef = useRef<number | null>(null);

  // Per-shot tracking
  const yellowHitRef = useRef<boolean>(false);
  const redBallHitRef = useRef<boolean>(false);
  const firstBallHitRef = useRef<'yellow' | 'red' | null>(null); // which ball struck first
  const cushionCountRef = useRef<number>(0);           // live cushion count for display
  const cushionAtSecondHitRef = useRef<number>(-1);    // cushions when 2nd ball is struck
  const cushionAtFirstHitRef = useRef<number>(-1);     // cushions when 1st ball is struck

  // Break: first shot must hit red
  const isBreakRef = useRef<boolean>(true);

  const [cushionCount, setCushionCount] = useState<number>(0);
  const [ballsHit, setBallsHit] = useState<number>(0);
  const [billiardReady, setBilliardReady] = useState<boolean>(true);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Shot technique selection
  const [shotType, setShotType]   = useState<SpinType>('stop');
  const [english,  setEnglish]    = useState<EnglishType>('none');
  const shotTypeRef = useRef<SpinType>('stop');
  const englishRef  = useRef<EnglishType>('none');
  useEffect(() => { shotTypeRef.current = shotType; }, [shotType]);
  useEffect(() => { englishRef.current  = english;  }, [english]);

  // Cue ball contact point picker
  const pickerContactRef = useRef({ x: 0, y: 0 }); // pixel offset from circle center
  const [pickerContact, setPickerContact] = useState({ x: 0, y: 0 });
  const pickerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const cx = evt.nativeEvent.locationX - PICKER_HALF;
        const cy = evt.nativeEvent.locationY - PICKER_HALF;
        const dist = Math.hypot(cx, cy);
        const scale = dist > PICKER_R ? PICKER_R / dist : 1;
        const nx = cx * scale; const ny = cy * scale;
        pickerContactRef.current = { x: nx, y: ny };
        setPickerContact({ x: nx, y: ny });
        // snap button highlights to nearest zone
        const snapSpin: SpinType = ny < -PICKER_R * 0.3 ? 'follow' : ny > PICKER_R * 0.3 ? 'draw' : 'stop';
        const snapEng: EnglishType = nx < -PICKER_R * 0.3 ? 'left' : nx > PICKER_R * 0.3 ? 'right' : 'none';
        shotTypeRef.current = snapSpin; englishRef.current = snapEng;
        setShotType(snapSpin); setEnglish(snapEng);
      },
      onPanResponderMove: (evt) => {
        const cx = evt.nativeEvent.locationX - PICKER_HALF;
        const cy = evt.nativeEvent.locationY - PICKER_HALF;
        const dist = Math.hypot(cx, cy);
        const scale = dist > PICKER_R ? PICKER_R / dist : 1;
        const nx = cx * scale; const ny = cy * scale;
        pickerContactRef.current = { x: nx, y: ny };
        setPickerContact({ x: nx, y: ny });
        const snapSpin: SpinType = ny < -PICKER_R * 0.3 ? 'follow' : ny > PICKER_R * 0.3 ? 'draw' : 'stop';
        const snapEng: EnglishType = nx < -PICKER_R * 0.3 ? 'left' : nx > PICKER_R * 0.3 ? 'right' : 'none';
        shotTypeRef.current = snapSpin; englishRef.current = snapEng;
        setShotType(snapSpin); setEnglish(snapEng);
      },
    })
  ).current;
  // Picker container drag
  const sizeRef = useRef({ w: 375, h: 700 });
  useEffect(() => { sizeRef.current = size; }, [size]);
  const pickerPosRef = useRef<{ x: number; y: number } | null>(null);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null);
  const pickerDragStartRef = useRef({ x: 0, y: 0 });
  const pickerMovePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const { boardW, boardH } = computeBoardDimensions(sizeRef.current.w, sizeRef.current.h, hudHeightRef.current);
        const cur = pickerPosRef.current ?? { x: Math.max(0, boardW - PICKER_SIZE - 12), y: 130 };
        pickerDragStartRef.current = { ...cur };
      },
      onPanResponderMove: (_, g) => {
        const HANDLE_H = 18;
        const { boardW, boardH } = computeBoardDimensions(sizeRef.current.w, sizeRef.current.h, hudHeightRef.current);
        const nx = Math.max(0, Math.min(boardW - PICKER_SIZE, pickerDragStartRef.current.x + g.dx));
        const ny = Math.max(0, Math.min(boardH - PICKER_SIZE - HANDLE_H, pickerDragStartRef.current.y + g.dy));
        pickerPosRef.current = { x: nx, y: ny };
        setPickerPos({ x: nx, y: ny });
      },
    })
  ).current;

  // Two-step power charging
  const billiardReadyRef = useRef<boolean>(true);
  useEffect(() => { billiardReadyRef.current = billiardReady; }, [billiardReady]);
  const [charging, setCharging] = useState<boolean>(false);
  const chargingRef = useRef<boolean>(false);
  const [chargePower, setChargePower] = useState<number>(0);
  const chargePowerRef = useRef<number>(0);
  const chargeStartTimeRef = useRef<number>(0);
  const chargeDirectionRef = useRef<{ dx: number; dy: number; mag: number } | null>(null);

  useEffect(() => {
    let sound: Audio.Sound;
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false })
      .then(() => Audio.Sound.createAsync(require('../../assets/sounds/hit_effect.mp3')))
      .then(({ sound: s }) => {
          sound = s;
          hitSoundRef.current = s;
        s.setVolumeAsync(0.1)
          .then((_) => s.playAsync())
          .then((_) => new Promise<void>((res) => setTimeout(res, 250)))
          .then((_) => s.setVolumeAsync(0.4))
          .catch(() => {});
        })
      .catch(() => {});
    return () => { sound?.unloadAsync(); };
  }, []);

  // Load background/mood sound (bm.mp3) used while Player 1 is taking a turn
  useEffect(() => {
    let bm: Audio.Sound;
    const vol = settings.bmVolume ?? 0.2;
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false })
      .then(() => Audio.Sound.createAsync(require('../../assets/sounds/bm.mp3'), { isLooping: true }))
      .then(({ sound: s }) => {
        bm = s;
        bmSoundRef.current = s;
        s.setVolumeAsync(vol)
          .then((_) => bm.setPositionAsync(0))
            .then((_) => { if (settingsRef.current.bmEnabled) return bm.playAsync(); return bm.getStatusAsync(); })
          .catch(() => {});
        // Pause/play when app is backgrounded/foregrounded
        const handleAppState = (next: AppStateStatus) => {
          if (!bm) return;
          if (next === 'active') {
            if (settingsRef.current.bmEnabled) bm.playAsync().catch(() => {});
          } else bm.stopAsync().catch(() => {});
        };
        const sub = AppState.addEventListener('change', handleAppState);
        // ensure listener removed when unloaded
        (bm as any).__appStateSub = sub;
      })
      .catch(() => {});
    return () => {
      // remove appstate listener
      try { (bm as any)?.__appStateSub?.remove?.(); } catch {}
      bm?.unloadAsync();
    };
  }, []);

  // Toggle play/stop when the setting changes
  useEffect(() => {
    const bm = bmSoundRef.current;
    if (!bm) return;
    if (settings.bmEnabled) bm.playAsync().catch(() => {});
    else bm.stopAsync().catch(() => {});
  }, [settings.bmEnabled]);

  // Keep bm volume in sync with settings changes
  useEffect(() => {
    const bm = bmSoundRef.current;
    if (bm && typeof settings.bmVolume === 'number') {
      bm.setVolumeAsync(settings.bmVolume).catch(() => {});
    }
  }, [settings.bmVolume]);

  const setupBilliards = (eng: PhysicsEngine) => {
    const w = eng.width;
    const h = eng.height;
    const r = s.ballRadius3C;

    // Position balls vertically centered (red top, orange middle, white bottom)
    const cue = eng.addMarble({ pos: { x: w * 0.5, y: h * 0.78 }, vel: { x: 0, y: 0 }, radius: r, color: '#f0f0f0', friction: s.friction3C });
    playerIdRef.current = cue.id;

    const yellow = eng.addMarble({ pos: { x: w * 0.36, y: h * 0.55 }, vel: { x: 0, y: 0 }, radius: r, color: '#f4c430', friction: s.friction3C });
    yellowIdRef.current = yellow.id;
    
    const redBall = eng.addMarble({ pos: { x: w * 0.5, y: h * 0.31 }, vel: { x: 0, y: 0 }, radius: r, color: '#cc2200', friction: s.friction3C });
    redBallIdRef.current = redBall.id;
  };

  useEffect(() => {
    let last = Date.now();
    let rafId: number | null = null;
    const tick = () => {
      const now = Date.now();
      // Cap dt to 50ms to avoid huge jumps after app focus loss
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const eng = engineRef.current;
      if (eng) {
        // Adaptive sub-stepping: prevent tunneling when fast balls are smaller than
        // the distance they travel per frame.  Split dt so each sub-step moves the
        // fastest marble at most half its radius (guarantees overlap detection).
        const maxSpeed = eng.marbles.reduce((s, m) => Math.max(s, Math.hypot(m.vel.x, m.vel.y)), 0);
        const minR     = eng.marbles.reduce((s, m) => Math.min(s, m.radius), 8);
        const subSteps = Math.max(1, Math.ceil(maxSpeed * dt / (minR * 0.5)));
        const subDt    = dt / subSteps;
        for (let i = 0; i < subSteps; i++) eng.step(subDt);

        if (shotActiveRef.current) {
          const cueId  = turnRef.current === 1 ? playerIdRef.current : yellowIdRef.current;
          const otherCueId = turnRef.current === 1 ? yellowIdRef.current : playerIdRef.current;
          const cue    = eng.marbles.find((m) => m.id === cueId);
          const yellow = eng.marbles.find((m) => m.id === otherCueId);
          const red    = eng.marbles.find((m) => m.id === redBallIdRef.current);

          // Track live cushion count from cue ball
          const c = cue?.wallHitCount ?? 0;
          if (c !== cushionCountRef.current) {
            cushionCountRef.current = c;
            setCushionCount(c);
          }

          const isMoving = (m: Marble) => Math.hypot(m.vel.x, m.vel.y) > SETTLE_SPEED_THRESHOLD;

          // Yellow hit detection
          if (yellow && !yellowHitRef.current && yellow.lastHitById === cueId && isMoving(yellow)) {
            yellowHitRef.current = true;
            if (firstBallHitRef.current === null) {
              firstBallHitRef.current = 'yellow';
              // record cushions at first ball contact
              cushionAtFirstHitRef.current = c;
            } else {
              // This is the second ball hit — record cushions at this moment
              cushionAtSecondHitRef.current = c;
            }
            setBallsHit((p) => p + 1);
          }

          // Red hit detection
          if (red && !redBallHitRef.current && red.lastHitById === cueId && isMoving(red)) {
            redBallHitRef.current = true;
            if (firstBallHitRef.current === null) {
              firstBallHitRef.current = 'red';
              // record cushions at first ball contact
              cushionAtFirstHitRef.current = c;
            } else {
              cushionAtSecondHitRef.current = c;
            }
            setBallsHit((p) => p + 1);
          }

          const allSlow = eng.marbles.every((m) => Math.hypot(m.vel.x, m.vel.y) <= SETTLE_SPEED_THRESHOLD);
          if (!allSlow) {
            settledCounterRef.current = 0;
          } else {
            settledCounterRef.current++;
            if (settledCounterRef.current >= BILLIARDS_SETTLE_FRAMES) {
              const bothHit  = yellowHitRef.current && redBallHitRef.current;
              const breakFoul = isBreakRef.current && firstBallHitRef.current !== 'red' && firstBallHitRef.current !== null;
              // 3+ cushions accumulated before the second ball was struck
              // Determine cushions relative to first and second object contacts.
              const firstCushions = cushionAtFirstHitRef.current;   // -1 if not set
              const secondCushions = cushionAtSecondHitRef.current; // cushions at second-hit moment

              let keepTurn = false;
              if (breakFoul) {
                setLastResult(t(lang, 'foulMiss'));
                keepTurn = false;
              } else if (bothHit) {
                // Case A: cue ball contacted 3+ cushions BEFORE hitting the first object ball → +2
                if (firstCushions >= 3) {
                  const points = 2;
                  if (turnRef.current === 1) {
                    const n = score1Ref.current + points; score1Ref.current = n; setScore1(n);
                    if (n >= settingsRef.current.winScore3C) setWinner(1);
                  } else {
                    const n = score2Ref.current + points; score2Ref.current = n; setScore2(n);
                    if (n >= settingsRef.current.winScore3C) setWinner(2);
                  }
                  setLastResult(t(lang, 'plus2'));
                  keepTurn = true;
                } else {
                  // Case B: cue ball hit first object, then accumulated 3+ cushions before striking second → +1
                  const cushionsAfterFirst = secondCushions - Math.max(0, firstCushions);
                  if (cushionsAfterFirst >= 3) {
                    const points = 1;
                    if (turnRef.current === 1) {
                      const n = score1Ref.current + points; score1Ref.current = n; setScore1(n);
                      if (n >= settingsRef.current.winScore3C) setWinner(1);
                    } else {
                      const n = score2Ref.current + points; score2Ref.current = n; setScore2(n);
                      if (n >= settingsRef.current.winScore3C) setWinner(2);
                    }
                    setLastResult(t(lang, 'plus1'));
                    keepTurn = true;
                  } else {
                    setLastResult(t(lang, 'miss'));
                    keepTurn = false;
                  }
                }
              } else {
                setLastResult(t(lang, 'miss'));
                keepTurn = false;
              }

              setTimeout(() => setLastResult(null), 1200);

              // Mark break done
              isBreakRef.current = false;

              if (!keepTurn) {
                const next: 1 | 2 = turnRef.current === 1 ? 2 : 1;
                turnRef.current = next;
                setTurn(next);
                // background mood plays continuously; do not stop on turn change
                // Reset tech buttons for the new player
                shotTypeRef.current = 'stop';
                englishRef.current  = 'none';
                setShotType('stop');
                setEnglish('none');
                pickerContactRef.current = { x: 0, y: 0 };
                setPickerContact({ x: 0, y: 0 });
              }

              // Reset shot tracking
              yellowHitRef.current = false;
              redBallHitRef.current = false;
              firstBallHitRef.current = null;
              cushionAtSecondHitRef.current = -1;
              cushionAtFirstHitRef.current = -1;
              cushionCountRef.current = 0;
              // Reset wall hits on both cue balls
              eng.marbles.forEach((m) => { m.wallHitCount = 0; });
              setCushionCount(0);
              setBallsHit(0);
              shotActiveRef.current = false;
              settledCounterRef.current = 0;
              // Reset picker after balls settle
              pickerContactRef.current = { x: 0, y: 0 };
              setPickerContact({ x: 0, y: 0 });
              shotTypeRef.current = 'stop'; setShotType('stop');
              englishRef.current = 'none'; setEnglish('none');
              setBilliardReady(true);
            }
          }
        }
        // Oscillate charge power
        if (chargingRef.current) {
          const elapsed = (Date.now() - chargeStartTimeRef.current) / 1000;
          const t = (elapsed * s.chargeCyclesPerSec) % 2;
          const raw = t <= 1 ? t : 2 - t;
          const p = 0.1 + 0.9 * raw;
          chargePowerRef.current = p;
          setChargePower(p);
        }
        setMarbles([...eng.marbles]);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => { if (rafId != null) cancelAnimationFrame(rafId); };
  }, []);

  // AI play for player 2 (yellow cue) when vsAI is enabled.
  useEffect(() => {
    if (!vsAI || turn !== 2 || !billiardReady || shotActiveRef.current || !!winner) return;
    const profile = getAiProfile(settings.aiLevel ?? 'intermediate');
    const timeoutId = setTimeout(() => {
      const eng = engineRef.current;
      const cueId = yellowIdRef.current;
      if (!eng || cueId == null) return;
      const cue   = eng.marbles.find((m) => m.id === cueId);
      const red   = eng.marbles.find((m) => m.id === redBallIdRef.current);
      const white = eng.marbles.find((m) => m.id === playerIdRef.current);
      if (!cue || !red || !white) return;

      const plan = planBilliardsShot(
        {
          cue: { pos: cue.pos, radius: cue.radius },
          red: { pos: red.pos, radius: red.radius },
          white: { pos: white.pos, radius: white.radius },
          tableW: eng.width,
          tableH: eng.height,
          isBreak: isBreakRef.current,
        },
        profile,
      );

      const mag = Math.hypot(plan.dx, plan.dy) || 1;
      const speed = s.launchSpeed3C * powerRef.current * plan.power;

      cue.spin = plan.spin;
      cue.sideSpin = plan.sideSpin;
      eng.launchMarble(cueId, { x: (plan.dx / mag) * speed, y: (plan.dy / mag) * speed });
      shotActiveRef.current = true;
      setBilliardReady(false);
      billiardReadyRef.current = false;
      pickerContactRef.current = { x: 0, y: 0 };
      setPickerContact({ x: 0, y: 0 });
      shotTypeRef.current = 'stop'; setShotType('stop');
      englishRef.current = 'none'; setEnglish('none');
    }, randomThinkDelayMs(profile));
    return () => clearTimeout(timeoutId);
  }, [turn, billiardReady, vsAI, winner, settings.aiLevel]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const containerW = Math.max(320, width);
    const containerH = Math.max(480, height);
    setSize({ w: containerW, h: containerH });

    const { boardW, boardH, innerW, innerH } = computeBoardDimensions(containerW, containerH, hudHeightRef.current);

    if (!engineRef.current) {
      const eng = new PhysicsEngine(innerW, innerH);
      eng.restitution = s.restitution;
      eng.spinTransferFactor = s.spinTransfer;
      eng.englishFactor = s.englishFactor;
      eng.stopDrag = s.stopDrag;
      eng.onCollision = () => {
        const sound = hitSoundRef.current;
        if (sound) sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
      };
      setupBilliards(eng);
      engineRef.current = eng;
      setMarbles([...eng.marbles]);
      return;
    }
    syncEngineLayout(innerW, innerH);
  };

  // Stores the arenaWrap's absolute page origin so that move events can use
  // pageX/pageY (screen-absolute) instead of locationX/Y (relative to whatever
  // child element is currently under the finger — the picker, for example).
  const arenaPageOriginRef = useRef({ x: 0, y: 0 });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !(vsAIRef.current && turnRef.current === 2),
      onPanResponderGrant: (evt) => {
        // Record the arenaWrap's page-level origin once per gesture so that
        // subsequent move events can compute position relative to the board
        // regardless of which child view is under the finger.
        arenaPageOriginRef.current = {
          x: evt.nativeEvent.pageX - evt.nativeEvent.locationX,
          y: evt.nativeEvent.pageY - evt.nativeEvent.locationY,
        };
        // During charging: this tap fires the ball at current power
        if (chargingRef.current) {
          const eng = engineRef.current;
          const activeCueId = turnRef.current === 1 ? playerIdRef.current : yellowIdRef.current;
          const dir = chargeDirectionRef.current;
          if (!eng || activeCueId == null || !dir) return;
          const player = eng.marbles.find((m) => m.id === activeCueId);
          if (!player) return;
          const speed = s.launchSpeed3C * powerRef.current * chargePowerRef.current;
          const vel = { x: (dir.dx / dir.mag) * speed, y: (dir.dy / dir.mag) * speed };
          player.spin     = -(pickerContactRef.current.y / PICKER_R) * 0.85;
          player.sideSpin =  (pickerContactRef.current.x / PICKER_R) * 0.85;
          eng.launchMarble(activeCueId, vel);
          shotActiveRef.current = true;
          setBilliardReady(false);
          billiardReadyRef.current = false;
          chargingRef.current = false;
          setCharging(false);
          chargePowerRef.current = 0;
          setChargePower(0);
          chargeDirectionRef.current = null;
          // Play background mood sound when Player 1 fires a human-controlled shot
          if (turnRef.current === 1) {
            const bm = bmSoundRef.current;
            if (bm && settingsRef.current.bmEnabled) {
              bm.getStatusAsync()
                .then((status) => {
                  if (!status || !status.isLoaded) return status;
                  if (!status.isPlaying) return bm.playAsync();
                  return status;
                })
                .catch(() => {});
            }
          }
          return;
        }
        // Normal aim setup — startX/Y = cue ball in physics coords.
        // Move events convert arenaWrap locationX/Y → physics coords so the direction
        // "startXY → aim.xy" is correctly "ball → finger" in physics space.
        const eng = engineRef.current;
        const activeCueId = turnRef.current === 1 ? playerIdRef.current : yellowIdRef.current;
        const player = eng && activeCueId != null ? eng.marbles.find((m) => m.id === activeCueId) : null;
        const sx = player ? player.pos.x : 0;
        const sy = player ? player.pos.y : 0;
        aimingRef.current = { startX: sx, startY: sy, x: sx, y: sy };
      },
      onPanResponderMove: (evt) => {
        if (!aimingRef.current) return;
        // Use pageX/pageY (absolute screen coords) minus the arenaWrap's page
        // origin recorded at gesture start. This is immune to locationX/Y
        // jumping when the finger moves over a child view (e.g. the picker).
        const relX = evt.nativeEvent.pageX - arenaPageOriginRef.current.x;
        const relY = evt.nativeEvent.pageY - arenaPageOriginRef.current.y;
        // arenaPageOriginRef is the board view's screen origin (pan handler is on the board view),
        // so relX/Y are already relative to the board view. Only subtract the INSET (11px).
        aimingRef.current.x = relX - BOARD_INSET;
        aimingRef.current.y = relY - BOARD_INSET;
      },
      onPanResponderRelease: () => {
        if (chargingRef.current) return;
        const aim = aimingRef.current;
        const eng = engineRef.current;
        const activeCueId = turnRef.current === 1 ? playerIdRef.current : yellowIdRef.current;
        if (!aim || !eng || !billiardReadyRef.current || activeCueId == null) { aimingRef.current = null; return; }
        const player = eng.marbles.find((m) => m.id === activeCueId);
        if (!player) { aimingRef.current = null; return; }
        // aim.x/y are now in physics coords; aim.startX/Y = ball pos in physics coords
        const dx = aim.x - aim.startX;
        const dy = aim.y - aim.startY;
        const dist = Math.hypot(dx, dy);
        if (dist < 5) { aimingRef.current = null; return; }
        chargeDirectionRef.current = { dx, dy, mag: dist };
        chargingRef.current = true;
        setCharging(true);
        chargeStartTimeRef.current = Date.now();
        aimingRef.current = null;
      },
    })
  ).current;

  const restart = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const w = eng.width, h = eng.height;
    const cue    = eng.marbles.find((m) => m.id === playerIdRef.current);
    const yellow = eng.marbles.find((m) => m.id === yellowIdRef.current);
    const red    = eng.marbles.find((m) => m.id === redBallIdRef.current);
    if (cue)    { cue.pos    = { x: w * 0.5,  y: h * 0.78 }; cue.vel    = { x: 0, y: 0 }; cue.wallHitCount = 0; }
    if (yellow) { yellow.pos = { x: w * 0.36,  y: h * 0.55 }; yellow.vel = { x: 0, y: 0 }; }
    if (red)    { red.pos    = { x: w * 0.5,  y: h * 0.31 }; red.vel    = { x: 0, y: 0 }; }
    yellowHitRef.current = false;
    redBallHitRef.current = false;
    firstBallHitRef.current = null;
    cushionAtSecondHitRef.current = -1;
    cushionAtFirstHitRef.current = -1;
    cushionCountRef.current = 0;
    shotActiveRef.current = false;
    settledCounterRef.current = 0;
    isBreakRef.current = true;
    score1Ref.current = 0;
    score2Ref.current = 0;
    turnRef.current = 1;
    shotTypeRef.current = 'stop';
    englishRef.current  = 'none';
    setShotType('stop');
    setEnglish('none');
    pickerContactRef.current = { x: 0, y: 0 };
    setPickerContact({ x: 0, y: 0 });
    setCushionCount(0);
    setBallsHit(0);
    setScore1(0);
    setScore2(0);
    setTurn(1);
    // background mood plays continuously; do not stop on restart here
    setLastResult(null);
    setWinner(null);
    setBilliardReady(true);
    billiardReadyRef.current = true;
    chargingRef.current = false;
    setCharging(false);
    chargePowerRef.current = 0;
    setChargePower(0);
    chargeDirectionRef.current = null;
    setMarbles([...eng.marbles]);
  };

  const { boardW, boardH } = computeBoardDimensions(size.w, size.h, BOARD_UI_GAP);

  const handleShotTypeChange = (key: SpinType) => {
    setShotType(key);
    shotTypeRef.current = key;
    const next = spinPickerContact(key, pickerContactRef.current);
    pickerContactRef.current = next;
    setPickerContact(next);
  };

  const handleEnglishChange = (key: EnglishType) => {
    setEnglish(key);
    englishRef.current = key;
    const next = englishPickerContact(key, pickerContactRef.current);
    pickerContactRef.current = next;
    setPickerContact(next);
  };

  const cancelCharge = () => {
    chargingRef.current = false;
    setCharging(false);
    chargeDirectionRef.current = null;
    chargePowerRef.current = 0;
    setChargePower(0);
  };

  return (
    <View style={styles.container} onLayout={onLayout}>

      <View style={styles.hudChrome}>
      <GameHudPanel>
        <GameHudNav lang={lang} onBack={onBack} onRestart={restart} />
        <BilliardsScoreboard
          lang={lang}
          score1={score1}
          score2={score2}
          turn={turn}
          vsAI={vsAI}
          cushionCount={cushionCount}
          ballsHit={ballsHit}
          lastResult={lastResult}
          ready={billiardReady}
        />
        {!winner && (
          <ShotControls
            lang={lang}
            shotType={shotType}
            english={english}
            onShotTypeChange={handleShotTypeChange}
            onEnglishChange={handleEnglishChange}
            charging={charging}
            chargePower={chargePower}
            onCancelCharge={cancelCharge}
            aiThinking={vsAI && turn === 2}
          />
        )}
      </GameHudPanel>

      {winner && (
        <View style={styles.winBanner}>
          <Text style={styles.winText}>
            {winner === 1 ? `⚪ ${t(lang, 'player1')} 🏆` : vsAI ? `🤖 ${t(lang, 'ai')} 🏆` : `🟡 ${t(lang, 'player2')} 🏆`}
          </Text>
          <TouchableOpacity style={styles.playAgainBtn} onPress={restart}>
            <Text style={styles.playAgainText}>{t(lang, 'playAgain')}</Text>
          </TouchableOpacity>
        </View>
      )}

      </View>

      <View style={styles.arenaShell}>
      <View style={styles.arenaWrap}>
        <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={size.w} height={boardH}>
          <Defs>
            <Pattern id="woodBg" x="0" y="0" width={150} height={150} patternUnits="userSpaceOnUse">
              <SvgImage href={require('../../assets/pattern-table.png')} x="0" y="0" width={150} height={150} />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={boardH} fill="url(#woodBg)" />
          <RailMarkers totalWidth={size.w} boardW={boardW} boardH={boardH} />
        </Svg>
        <View style={{ width: boardW, height: boardH }} {...pan.panHandlers}>
          <Svg width={boardW} height={boardH}>
            <Rect x={0} y={0} width={boardW} height={boardH} fill="#2d6a4f" />
            <Rect x={6} y={6} width={boardW - 12} height={boardH - 12} fill="none" stroke="#1b4332" strokeWidth={10} />
            {(() => {
              const aim = aimingRef.current;
              if (!aim || charging || !billiardReady) return null;
              const eng = engineRef.current;
              if (!eng) return null;
              const activeCueId = turn === 1 ? playerIdRef.current : yellowIdRef.current;
              const cue = eng.marbles.find((m) => m.id === activeCueId);
              if (!cue) return null;
              const dx = aim.x - aim.startX;
              const dy = aim.y - aim.startY;
              if (Math.hypot(dx, dy) < 5) return null;
              const angleDeg = Math.atan2(-dy, -dx) * 180 / Math.PI;
              const cx = cue.pos.x + BOARD_INSET;
              const cy = cue.pos.y + BOARD_INSET;
              const r = cue.radius;
              return (
                <>
                  {/* Cue shaft */}
                  <Rect
                    x={r + 3}
                    y={-3.5}
                    width={90}
                    height={7}
                    rx={3}
                    fill="#c8903a"
                    opacity={0.9}
                    transform={`translate(${cx} ${cy}) rotate(${angleDeg})`}
                  />
                  {/* Cue tip (blue) */}
                  <Rect
                    x={r + 1}
                    y={-2.5}
                    width={6}
                    height={5}
                    rx={1.5}
                    fill="#4a90d9"
                    opacity={0.95}
                    transform={`translate(${cx} ${cy}) rotate(${angleDeg})`}
                  />
                </>
              );
            })()}
            <BilliardsMarbles
              marbles={marbles}
              whiteBallId={playerIdRef.current}
              yellowBallId={yellowIdRef.current}
              activeCueId={turn === 1 ? playerIdRef.current : yellowIdRef.current}
              isReady={billiardReady}
              offsetX={BOARD_INSET}
              offsetY={BOARD_INSET}
            />
            <TrajectoryLine
              aim={aimingRef.current}
              charging={charging}
              chargeDirection={chargeDirectionRef.current}
              engine={engineRef.current}
              activeCueId={turn === 1 ? playerIdRef.current : yellowIdRef.current}
              launchSpeed={s.launchSpeed3C}
              power={powerRef.current}
              chargePower={chargePowerRef.current}
              english={englishRef.current}
              trajectoryLength={s.trajectoryLength}
              disabled={!billiardReady}
              offsetX={BOARD_INSET}
              offsetY={BOARD_INSET}
            />
          </Svg>
          <MagnifierOverlay
            aim={aimingRef.current}
            charging={charging}
            chargeDirection={chargeDirectionRef.current}
            engine={engineRef.current}
            activeCueId={turn === 1 ? playerIdRef.current : yellowIdRef.current}
            disabled={!billiardReady}
            offsetX={BOARD_INSET}
            offsetY={BOARD_INSET}
          />
          <PickerOverlay
            visible={charging && !(vsAI && turn === 2)}
            pickerContact={pickerContact}
            pickerPos={pickerPos}
            boardWidth={boardW}
            pickerPanHandlers={pickerPan.panHandlers as Record<string, unknown>}
            pickerMovePanHandlers={pickerMovePan.panHandlers as Record<string, unknown>}
          />
        </View>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'stretch', paddingTop: 0, backgroundColor: colors.hudBg },
  hudChrome: { width: '100%', alignItems: 'stretch', height: BOARD_UI_GAP, overflow: 'hidden' },
  arenaShell: { flex: 1, width: '100%', justifyContent: 'flex-start', alignItems: 'center' },
  arenaWrap: { width: '100%', alignItems: 'center', backgroundColor: 'transparent' },

  winBanner: {
    width: '95%', alignSelf: 'center', backgroundColor: '#f4c430', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginBottom: 4, gap: 8,
  },
  winText: { fontSize: 20, fontWeight: '800', color: '#111' },
  playAgainBtn: { backgroundColor: '#111', borderRadius: 6, paddingHorizontal: 20, paddingVertical: 8 },
  playAgainText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
