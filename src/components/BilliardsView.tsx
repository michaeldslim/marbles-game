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
import { View, PanResponder, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import BilliardsMarbles from '../utils/BilliardsMarbles';
import PickerOverlay from '../utils/PickerOverlay';
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

interface Props {
  onBack: () => void;
  vsAI?: boolean;
}

export default function BilliardsView({ onBack, vsAI = false }: Props): JSX.Element {
  const vsAIRef = useRef<boolean>(vsAI);
  useEffect(() => { vsAIRef.current = vsAI; }, [vsAI]);
  const { settings } = useSettings();
  const s = settings; // shorthand
  const lang = settings.language ?? 'en';
  const [size, setSize] = useState({ w: 360, h: 640 });
  const [marbles, setMarbles] = useState<Marble[]>([]);
  const [score1, setScore1] = useState<number>(0);
  const score1Ref = useRef<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const score2Ref = useRef<number>(0);
  const [turn, setTurn] = useState<1 | 2>(1);
  const turnRef = useRef<1 | 2>(1);

  const shotActiveRef = useRef<boolean>(false);
  const powerRef = useRef<number>(DEFAULT_PLAYER_POWER);
  const engineRef = useRef<PhysicsEngine | null>(null);
  const playerIdRef = useRef<number | null>(null);
  const aimingRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const settledCounterRef = useRef<number>(0);
  const hitSoundRef = useRef<Audio.Sound | null>(null);

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
  type SpinType    = 'draw' | 'stop' | 'follow';
  type EnglishType = 'left' | 'none' | 'right';
  const [shotType, setShotType]   = useState<SpinType>('stop');
  const [english,  setEnglish]    = useState<EnglishType>('none');
  const shotTypeRef = useRef<SpinType>('stop');
  const englishRef  = useRef<EnglishType>('none');
  useEffect(() => { shotTypeRef.current = shotType; }, [shotType]);
  useEffect(() => { englishRef.current  = english;  }, [english]);

  // Cue ball contact point picker
  const PICKER_R = 54;
  const pickerContactRef = useRef({ x: 0, y: 0 }); // pixel offset from circle center
  const [pickerContact, setPickerContact] = useState({ x: 0, y: 0 });
  const pickerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const cx = evt.nativeEvent.locationX - 64;
        const cy = evt.nativeEvent.locationY - 64;
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
        const cx = evt.nativeEvent.locationX - 64;
        const cy = evt.nativeEvent.locationY - 64;
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
        const SIZE = 128;
        const boardMaxH = sizeRef.current.h - 140;
        const boardH = Math.min(boardMaxH, sizeRef.current.w * 2);
        const boardW = boardH / 2;
        const cur = pickerPosRef.current ?? { x: Math.max(0, boardW - SIZE - 12), y: 130 };
        pickerDragStartRef.current = { ...cur };
      },
      onPanResponderMove: (_, g) => {
        const SIZE = 128; const HANDLE_H = 22;
        const boardMaxH = sizeRef.current.h - 140;
        const boardH = Math.min(boardMaxH, sizeRef.current.w * 2);
        const boardW = boardH / 2;
        const nx = Math.max(0, Math.min(boardW - SIZE, pickerDragStartRef.current.x + g.dx));
        const ny = Math.max(0, Math.min(boardH - SIZE - HANDLE_H, pickerDragStartRef.current.y + g.dy));
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
        s.setVolumeAsync(0)
          .then(() => s.playAsync())
          .then(() => s.setVolumeAsync(1))
          .catch(() => {});
      })
      .catch(() => {});
    return () => { sound?.unloadAsync(); };
  }, []);

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
                  } else {
                    const n = score2Ref.current + points; score2Ref.current = n; setScore2(n);
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
                    } else {
                      const n = score2Ref.current + points; score2Ref.current = n; setScore2(n);
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
  // Always aims at a wall first. Plans a 3-wall route (cue→wa→wb→wc→target) via triple
  // reflection. Falls back to 2-wall, then a guaranteed wall-center shot if needed.
  useEffect(() => {
    if (!vsAI || turn !== 2 || !billiardReady || shotActiveRef.current) return;
    const timeoutId = setTimeout(() => {
      const eng = engineRef.current;
      const cueId = yellowIdRef.current;
      if (!eng || cueId == null) return;
      const cue   = eng.marbles.find((m) => m.id === cueId);
      const red   = eng.marbles.find((m) => m.id === redBallIdRef.current);
      const white = eng.marbles.find((m) => m.id === playerIdRef.current);
      if (!cue || !red || !white) return;

      const W = eng.width; const H = eng.height; const r = cue.radius;
      const mg = r * 2; // cushion margin

      const walls = [
        { axis: 'y' as const, val: mg },       // 0: top
        { axis: 'y' as const, val: H - mg },   // 1: bottom
        { axis: 'x' as const, val: mg },       // 2: left
        { axis: 'x' as const, val: W - mg },   // 3: right
      ];

      type Pt = { x: number; y: number };
      const mir = (p: Pt, w: number): Pt => {
        const wb = walls[w];
        return wb.axis === 'y' ? { x: p.x, y: 2 * wb.val - p.y } : { x: 2 * wb.val - p.x, y: p.y };
      };
      const hit = (from: Pt, to: Pt, w: number): Pt | null => {
        const wb = walls[w];
        const dx = to.x - from.x; const dy = to.y - from.y;
        let t: number;
        if (wb.axis === 'y') { if (Math.abs(dy) < 0.5) return null; t = (wb.val - from.y) / dy; }
        else { if (Math.abs(dx) < 0.5) return null; t = (wb.val - from.x) / dx; }
        if (t <= 0.005 || t >= 0.995) return null;
        const px = from.x + t * dx; const py = from.y + t * dy;
        if (wb.axis === 'y' && (px < mg || px > W - mg)) return null;
        if (wb.axis === 'x' && (py < mg || py > H - mg)) return null;
        return { x: px, y: py };
      };
      const d = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

      let aimDx = 0; let aimDy = 0; let bestLen = Infinity;

      // 3-wall: cue → wa → wb → wc → T  (triple reflection)
      // Also tries both object balls as the final target
      for (const T of [red.pos, white.pos] as Pt[]) {
        for (let wa = 0; wa < 4; wa++) {
          for (let wb = 0; wb < 4; wb++) {
            if (wb === wa) continue;
            for (let wc = 0; wc < 4; wc++) {
              if (wc === wb) continue;
              const m1 = mir(T, wc);
              const m2 = mir(m1, wb);
              const m3 = mir(m2, wa);
              const ca = hit(cue.pos, m3, wa); if (!ca) continue;
              const cb = hit(ca, m2, wb);      if (!cb) continue;
              const cc = hit(cb, m1, wc);      if (!cc) continue;
              const len = d(cue.pos, ca) + d(ca, cb) + d(cb, cc) + d(cc, T);
              if (len < bestLen) { bestLen = len; aimDx = ca.x - cue.pos.x; aimDy = ca.y - cue.pos.y; }
            }
          }
        }
      }

      // Fallback: 2-wall
      if (bestLen === Infinity) {
        for (const T of [red.pos, white.pos] as Pt[]) {
          for (let wa = 0; wa < 4; wa++) {
            for (let wb = 0; wb < 4; wb++) {
              if (wb === wa) continue;
              const m1 = mir(T, wb);
              const m2 = mir(m1, wa);
              const ca = hit(cue.pos, m2, wa); if (!ca) continue;
              const cb = hit(ca, m1, wb);      if (!cb) continue;
              const len = d(cue.pos, ca) + d(ca, cb) + d(cb, T);
              if (len < bestLen) { bestLen = len; aimDx = ca.x - cue.pos.x; aimDy = ca.y - cue.pos.y; }
            }
          }
        }
      }

      // Last resort: always aim at center of nearest wall (guaranteed cushion contact)
      if (bestLen === Infinity) {
        const nearY = cue.pos.y < H * 0.5 ? mg : H - mg;
        aimDx = W * 0.5 - cue.pos.x; aimDy = nearY - cue.pos.y;
        bestLen = d(cue.pos, { x: W * 0.5, y: nearY }) * 3;
      }

      const spread = (Math.random() - 0.5) * 0.15;
      const cosS = Math.cos(spread); const sinS = Math.sin(spread);
      const rdx = aimDx * cosS - aimDy * sinS; const rdy = aimDx * sinS + aimDy * cosS;
      const mag = Math.hypot(rdx, rdy) || 1;

      const distFactor = Math.min(bestLen / (H * 1.5), 1);
      const power = 0.8 + distFactor * 0.15;
      const speed = s.launchSpeed3C * powerRef.current * power;

      cue.spin = 0.25;  // follow spin helps carry through cushions
      cue.sideSpin = 0;
      eng.launchMarble(cueId, { x: (rdx / mag) * speed, y: (rdy / mag) * speed });
      shotActiveRef.current = true;
      setBilliardReady(false);
      billiardReadyRef.current = false;
      // Reset picker to default (스톱샷 + 무회전)
      pickerContactRef.current = { x: 0, y: 0 };
      setPickerContact({ x: 0, y: 0 });
      shotTypeRef.current = 'stop'; setShotType('stop');
      englishRef.current = 'none'; setEnglish('none');
    }, 600 + Math.random() * 700);
    return () => clearTimeout(timeoutId);
  }, [turn, billiardReady, vsAI]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const containerW = Math.max(320, width);
    const containerH = Math.max(480, height);
    setSize({ w: containerW, h: containerH });

    const boardMaxH = containerH - 140;
    const desiredBoardH = Math.min(boardMaxH, containerW * 2);
    const desiredBoardW = desiredBoardH / 2;

    if (!engineRef.current) {
      // account for inner border stroke: inset = 6px margin + half stroke (10/2 =5)
      const INSET = 11; // 6 + 5
      const innerW = Math.max(4, desiredBoardW - INSET * 2);
      const innerH = Math.max(4, desiredBoardH - INSET * 2);
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
    const eng = engineRef.current;
    if (eng) { const INSET = 11; eng.width = Math.max(4, desiredBoardW - INSET * 2); eng.height = Math.max(4, desiredBoardH - INSET * 2); }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !(vsAIRef.current && turnRef.current === 2),
      onPanResponderGrant: (evt) => {
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
          // Reset picker to default (스톱샷 + 무회전)
          pickerContactRef.current = { x: 0, y: 0 };
          setPickerContact({ x: 0, y: 0 });
          shotTypeRef.current = 'stop'; setShotType('stop');
          englishRef.current = 'none'; setEnglish('none');
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
        // Convert arenaWrap touch position to physics coords:
        //   physics_x = locationX − (arenaWrap_width − boardW) / 2 − 11
        const bH = Math.min(sizeRef.current.h - 140, sizeRef.current.w * 2);
        const bW = bH / 2;
        const boardOffX = (sizeRef.current.w - bW) / 2 + 11;
        const boardOffY = 11;
        aimingRef.current.x = evt.nativeEvent.locationX - boardOffX;
        aimingRef.current.y = evt.nativeEvent.locationY - boardOffY;
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
    setLastResult(null);
    setBilliardReady(true);
    billiardReadyRef.current = true;
    chargingRef.current = false;
    setCharging(false);
    chargePowerRef.current = 0;
    setChargePower(0);
    chargeDirectionRef.current = null;
    setMarbles([...eng.marbles]);
  };

  const boardMaxH = size.h - 140;
  const boardH = Math.min(boardMaxH, size.w * 2);
  const boardW = boardH / 2;

  return (
    <View style={styles.container} onLayout={onLayout}>

      {/* Top bar */}
      <View style={styles.hudRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.restartBtn} onPress={restart}>
          <Text style={styles.restartText}>{t(lang, 'restart')}</Text>
        </TouchableOpacity>
        {billiardReady ? (
          <Text style={styles.turnText}>
            {turn === 1 ? `⚪ ${t(lang, 'player1')}` : vsAI ? `🤖 ${t(lang, 'ai')}` : `🟡 ${t(lang, 'player2')}`} {t(lang,'turnSuffix')}
          </Text>
        ) : (
          <Text style={styles.shotText}>{t(lang, 'shot')}</Text>
        )}
      </View>

      {/* Scoreboard — compact single row */}
      <View style={styles.scoreRow}>
        <View style={[styles.scoreChip, turn === 1 ? styles.activeChip : null]}>
          <Text style={styles.chipLabel}>{t(lang, 'player1')}</Text>
          <Text style={styles.chipScore}>{score1}</Text>
        </View>
        <View style={styles.statsChip}>
          <Text style={styles.statItem}>{t(lang, 'cushions')} <Text style={styles.statVal}>{cushionCount}/3</Text></Text>
          <Text style={styles.statItem}>{t(lang, 'balls')} <Text style={styles.statVal}>{ballsHit}/2</Text></Text>
          <Text style={[styles.resultText, lastResult?.startsWith('+') ? styles.hit : styles.miss]}>
            {lastResult ? lastResult : ''}
          </Text>
        </View>
        <View style={[styles.scoreChip, turn === 2 ? styles.activeChip : null]}>
          <Text style={styles.chipLabel}>{vsAI ? `🤖 ${t(lang, 'ai')}` : t(lang, 'player2')}</Text>
          <Text style={styles.chipScore}>{score2}</Text>
        </View>
      </View>

      {/* Shot technique selector / Power charge meter — same fixed slot */}
      <View style={styles.techRow}>
        {vsAI && turn === 2 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '700' }}>🤖 {t(lang, 'aiThinking')}</Text>
          </View>
        ) : charging ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
            <View style={styles.powerMeterInner}>
              <Text style={styles.powerMeterLabel}>{t(lang, 'tapToShoot')}</Text>
              <View style={styles.powerMeterTrack}>
                <View style={[styles.powerMeterFill, {
                  width: `${Math.round(chargePower * 100)}%` as any,
                  backgroundColor: chargePower > 0.7 ? '#e44' : chargePower > 0.4 ? '#f4a020' : '#2cc47a',
                }]} />
              </View>
              <Text style={styles.powerMeterPct}>{Math.round(chargePower * 100)}%</Text>
            </View>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                chargingRef.current = false;
                setCharging(false);
                chargeDirectionRef.current = null;
                chargePowerRef.current = 0;
                setChargePower(0);
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Spin row */}
            <View style={styles.techGroup}>
              {([
                { key: 'draw',   label: '끌어치기', sub: 'Draw' },
                { key: 'stop',   label: '스톱샷',   sub: 'Stop' },
                { key: 'follow', label: '밀어치기', sub: 'Follow' },
              ] as { key: SpinType; label: string; sub: string }[]).map(({ key, label, sub }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.techBtn, shotType === key && styles.techBtnActive]}
                  onPress={() => {
                    setShotType(key);
                    const yMap: Record<SpinType, number> = { draw: PICKER_R, stop: 0, follow: -PICKER_R };
                    const nx = pickerContactRef.current.x;
                    const ny = yMap[key];
                    const d = Math.sqrt(nx * nx + ny * ny);
                    const s = d > PICKER_R ? PICKER_R / d : 1;
                    pickerContactRef.current = { x: nx * s, y: ny * s };
                    setPickerContact({ x: nx * s, y: ny * s });
                  }}
                >
                  <Text style={[styles.techLabel, shotType === key && styles.techLabelActive]}>{settings.language === 'ko' ? label : sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* English row */}
            <View style={styles.techGroup}>
              {([
                { key: 'left',  label: '왼회전', sub: 'Left Eng' },
                { key: 'none',  label: '무회전', sub: 'No Eng' },
                { key: 'right', label: '오른회전', sub: 'Right Eng' },
              ] as { key: EnglishType; label: string; sub: string }[]).map(({ key, label, sub }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.techBtn, english === key && styles.techBtnEnActive]}
                  onPress={() => {
                    setEnglish(key);
                    const xMap: Record<EnglishType, number> = { left: -PICKER_R, none: 0, right: PICKER_R };
                    const nx = xMap[key];
                    const ny = pickerContactRef.current.y;
                    const d = Math.sqrt(nx * nx + ny * ny);
                    const s = d > PICKER_R ? PICKER_R / d : 1;
                    pickerContactRef.current = { x: nx * s, y: ny * s };
                    setPickerContact({ x: nx * s, y: ny * s });
                  }}
                >
                  <Text style={[styles.techLabel, english === key && styles.techLabelActive]}>{settings.language === 'ko' ? label : sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.arenaWrap} {...pan.panHandlers}>
        <View style={{ width: boardW, height: boardH }}>
          <Svg width={boardW} height={boardH}>
            <Rect x={0} y={0} width={boardW} height={boardH} fill="#2d6a4f" />
            <Rect x={6} y={6} width={boardW - 12} height={boardH - 12} fill="none" stroke="#1b4332" strokeWidth={10} />
            <BilliardsMarbles
              marbles={marbles}
              whiteBallId={playerIdRef.current}
              yellowBallId={yellowIdRef.current}
              activeCueId={turn === 1 ? playerIdRef.current : yellowIdRef.current}
              isReady={billiardReady}
              offsetX={11}
              offsetY={11}
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
              offsetX={11}
              offsetY={11}
            />
          </Svg>
          <MagnifierOverlay
            aim={aimingRef.current}
            charging={charging}
            chargeDirection={chargeDirectionRef.current}
            engine={engineRef.current}
            activeCueId={turn === 1 ? playerIdRef.current : yellowIdRef.current}
            offsetX={11}
            offsetY={11}
          />
          <PickerOverlay
            visible={billiardReady && !(vsAI && turn === 2)}
            pickerContact={pickerContact}
            pickerPos={pickerPos}
            boardWidth={boardW}
            pickerPanHandlers={pickerPan.panHandlers as Record<string, unknown>}
            pickerMovePanHandlers={pickerMovePan.panHandlers as Record<string, unknown>}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 2 },
  arenaWrap: { width: '100%', alignItems: 'center' },

  hudRow: { width: '95%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  statusText: { flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  turnText: { flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'center', color: '#2cc47a' },
  readyText: { color: '#2cc47a' },
  shotText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#f4a020', textAlign: 'center' },

  scoreRow: { width: '95%', flexDirection: 'row', alignItems: 'center', marginBottom: 1, gap: 3 },
  scoreChip: {
    flex: 1, alignItems: 'center', paddingVertical: 1, paddingHorizontal: 6,
    backgroundColor: '#fff', borderRadius: 5,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  activeChip: { borderColor: '#2cc47a' },
  chipLabel: { fontSize: 8, fontWeight: '600', color: '#666' },
  chipScore: { fontSize: 13, fontWeight: '800', color: '#111' },

  statsChip: { flex: 1, alignItems: 'center', flexDirection: 'column' },
  statItem: { fontSize: 7, color: '#444', fontWeight: '600' },
  statVal: { fontWeight: '800', color: '#111' },
  resultText: { fontSize: 8, fontWeight: '700', textAlign: 'center' },
  hit: { color: '#2cc47a' },
  miss: { color: '#e44' },

  restartBtn: { width: 60, height: 26, backgroundColor: '#e44', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  restartText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  backBtn: { width: 28, height: 26, backgroundColor: '#666', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  techRow: { width: '95%', flexDirection: 'column', gap: 4, marginBottom: 4, height: 58 },
  techGroup: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  techBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 3, borderRadius: 6,
    backgroundColor: '#e8e8e8', borderWidth: 1.5, borderColor: 'transparent',
  },
  techBtnActive:   { backgroundColor: '#1b5e36', borderColor: '#2cc47a' },
  techBtnEnActive: { backgroundColor: '#1a3a6b', borderColor: '#4da6ff' },
  techLabel:      { fontSize: 11, fontWeight: '700', color: '#444' },
  techSub:        { fontSize: 9,  fontWeight: '500', color: '#888' },
  techLabelActive: { color: '#fff' },

  powerMeterInner: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  cancelBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  powerMeterLabel: { fontSize: 11, fontWeight: '800', color: '#fff', marginBottom: 3, letterSpacing: 1 },
  powerMeterTrack: { width: '100%', height: 14, backgroundColor: '#333', borderRadius: 7, overflow: 'hidden' },
  powerMeterFill: { height: '100%', borderRadius: 7 },
  powerMeterPct: { fontSize: 10, fontWeight: '700', color: '#fff', marginTop: 2 },
});
