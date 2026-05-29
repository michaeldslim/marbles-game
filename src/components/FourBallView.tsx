/**
 * Korean 4-Ball Billiards (사구 / Sa-gu)
 *
 * Rules:
 *  - Hit both red balls with your cue ball → +1 pt, keep shooting
 *  - Miss (fail to hit both reds) → turn changes, no penalty
 *  - Foul (touch opponent's cue ball) → −1 pt, turn changes
 *  - First to WIN_SCORE points wins
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, PanResponder, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, AppState, AppStateStatus, Platform } from 'react-native';
import Svg, { Rect, Defs, Pattern, Image as SvgImage } from 'react-native-svg';
import BilliardsMarbles from '../utils/BilliardsMarbles';
import PickerOverlay, { PICKER_R, PICKER_HALF, PICKER_SIZE } from '../utils/PickerOverlay';
import MagnifierOverlay from '../utils/MagnifierOverlay';
import TrajectoryLine from '../utils/TrajectoryLine';
import { Audio } from 'expo-av';
import { PhysicsEngine, Marble } from '../game/physics';
import { 
  DEFAULT_PLAYER_POWER, 
  SETTLE_SPEED_THRESHOLD, 
  FOURBALL_SETTLE_FRAMES, 
  FOURBALL_WIN_SCORE, 
} from '../game/constants';
import { useSettings } from '../context/SettingsContext';
import { t } from '../i18n';

interface Props {
  onBack: () => void;
  vsAI?: boolean;
}

export default function FourBallView({ onBack, vsAI = false }: Props): JSX.Element {
  const { settings } = useSettings();
  const s = settings; // shorthand
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const lang = settings.language ?? 'en';
  const vsAIRef = useRef<boolean>(vsAI);
  useEffect(() => { vsAIRef.current = vsAI; }, [vsAI]);
  const [size, setSize] = useState({ w: 360, h: 640 });
  const [marbles, setMarbles] = useState<Marble[]>([]);

  // Separate scores per player
  const [score1, setScore1] = useState<number>(0); // Yellow (Player 1)
  const [score2, setScore2] = useState<number>(0); // White  (Player 2)
  const score1Ref = useRef<number>(0);
  const score2Ref = useRef<number>(0);

  const shotActiveRef = useRef<boolean>(false);
  const [power, setPower] = useState<number>(DEFAULT_PLAYER_POWER);
  const powerRef = useRef<number>(DEFAULT_PLAYER_POWER);
  const engineRef = useRef<PhysicsEngine | null>(null);
  const playerIdRef = useRef<number | null>(null); // white cue ball
  const aimingRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const settledCounterRef = useRef<number>(0);
  const hitSoundRef = useRef<Audio.Sound | null>(null);
  const bmSoundRef = useRef<Audio.Sound | null>(null);

  // Ball IDs
  const yellowIdRef = useRef<number | null>(null);
  const red1IdRef = useRef<number | null>(null);
  const red2IdRef = useRef<number | null>(null);

  // Per-shot hit tracking
  const red1HitRef = useRef<boolean>(false);
  const red2HitRef = useRef<boolean>(false);
  const foulRef = useRef<boolean>(false); // touched opponent's cue ball

  // Turn state
  const [turn, setTurn] = useState<'yellow' | 'white'>('yellow');
  const turnRef = useRef<'yellow' | 'white'>('yellow');

  const [ballsHit, setBallsHit] = useState<number>(0);
  const [ready, setReady] = useState<boolean>(true);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [winner, setWinner] = useState<'yellow' | 'white' | null>(null);

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
  const pickerContactRef = useRef({ x: 0, y: 0 });
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
        const boardMaxH = sizeRef.current.h - 140;
        const boardH = Math.min(boardMaxH, sizeRef.current.w * 2);
        const boardW = boardH / 2;
        const cur = pickerPosRef.current ?? { x: Math.max(0, boardW - PICKER_SIZE - 12), y: 130 };
        pickerDragStartRef.current = { ...cur };
      },
      onPanResponderMove: (_, g) => {
        const HANDLE_H = 18;
        const boardMaxH = sizeRef.current.h - 140;
        const boardH = Math.min(boardMaxH, sizeRef.current.w * 2);
        const boardW = boardH / 2;
        const nx = Math.max(0, Math.min(boardW - PICKER_SIZE, pickerDragStartRef.current.x + g.dx));
        const ny = Math.max(0, Math.min(boardH - PICKER_SIZE - HANDLE_H, pickerDragStartRef.current.y + g.dy));
        pickerPosRef.current = { x: nx, y: ny };
        setPickerPos({ x: nx, y: ny });
      },
    })
  ).current;

  // Two-step power charging
  const readyRef = useRef<boolean>(true);
  useEffect(() => { readyRef.current = ready; }, [ready]);
  const [charging, setCharging] = useState<boolean>(false);
  const chargingRef = useRef<boolean>(false);
  const [chargePower, setChargePower] = useState<number>(0);
  const chargePowerRef = useRef<number>(0);
  const chargeStartTimeRef = useRef<number>(0);
  const chargeDirectionRef = useRef<{ dx: number; dy: number; mag: number } | null>(null);

  // Load hit sound
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
        (bm as any).__appStateSub = sub;
      })
      .catch(() => {});
    return () => {
      try { (bm as any)?.__appStateSub?.remove?.(); } catch {}
      bm?.unloadAsync();
    };
  }, []);

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

  useEffect(() => { powerRef.current = power; }, [power]);

  // AI shot: fires when it's white's turn in vsAI mode
  useEffect(() => {
    if (!vsAI || turn !== 'white' || !ready || !!winner) return;
    const timeoutId = setTimeout(() => {
      const eng = engineRef.current;
      const cueId = playerIdRef.current;
      if (!eng || cueId == null) return;
      const cue  = eng.marbles.find((m) => m.id === cueId);
      const red1 = eng.marbles.find((m) => m.id === red1IdRef.current);
      const red2 = eng.marbles.find((m) => m.id === red2IdRef.current);
      if (!cue || !red1 || !red2) return;

      // Pick the closer red as the primary target, the other as secondary
      const d1 = Math.hypot(red1.pos.x - cue.pos.x, red1.pos.y - cue.pos.y);
      const d2 = Math.hypot(red2.pos.x - cue.pos.x, red2.pos.y - cue.pos.y);
      const [primary, secondary] = d1 <= d2 ? [red1, red2] : [red2, red1];
      const primaryDist = d1 <= d2 ? d1 : d2;

      // Unit vectors
      const cueToPrimN = { x: (primary.pos.x - cue.pos.x) / primaryDist, y: (primary.pos.y - cue.pos.y) / primaryDist };
      const primToSec = { x: secondary.pos.x - primary.pos.x, y: secondary.pos.y - primary.pos.y };
      const primToSecMag = Math.hypot(primToSec.x, primToSec.y);
      const primToSecN = { x: primToSec.x / primToSecMag, y: primToSec.y / primToSecMag };

      // alignment > 0: secondary is roughly in the same direction as primary from cue
      const alignment = cueToPrimN.x * primToSecN.x + cueToPrimN.y * primToSecN.y;

      let dx: number;
      let dy: number;
      let spinVal: number;

      if (alignment > 0.5) {
        // ── Follow shot: secondary is roughly behind primary → shoot through with topspin
        dx = primary.pos.x - cue.pos.x;
        dy = primary.pos.y - cue.pos.y;
        spinVal = 0.65;
      } else {
        // ── Ghost-ball cut shot: aim so the cue deflects toward secondary after stop contact
        // Contact normal ⊥ primToSecN; two candidates (left / right side of primary)
        const contactDist = primary.radius + cue.radius;
        const nA = { x: -primToSecN.y, y:  primToSecN.x };
        const nB = { x:  primToSecN.y, y: -primToSecN.x };
        const ghostA = { x: primary.pos.x + nA.x * contactDist, y: primary.pos.y + nA.y * contactDist };
        const ghostB = { x: primary.pos.x + nB.x * contactDist, y: primary.pos.y + nB.y * contactDist };

        // Score each ghost: positive means cue's post-contact tangential velocity points toward secondary
        const scoreGhost = (g: { x: number; y: number }) => {
          const toG = { x: g.x - cue.pos.x, y: g.y - cue.pos.y };
          const toGMag = Math.hypot(toG.x, toG.y);
          const toGN = { x: toG.x / toGMag, y: toG.y / toGMag };
          const cn = { x: (g.x - primary.pos.x) / contactDist, y: (g.y - primary.pos.y) / contactDist };
          const proj = toGN.x * cn.x + toGN.y * cn.y;
          // tangential component of shot direction (what the cue retains after stop contact)
          return (toGN.x - proj * cn.x) * primToSecN.x + (toGN.y - proj * cn.y) * primToSecN.y;
        };

        const ghost = scoreGhost(ghostA) >= scoreGhost(ghostB) ? ghostA : ghostB;
        const m = cue.radius * 2;
        const inBounds = ghost.x > m && ghost.x < eng.width - m && ghost.y > m && ghost.y < eng.height - m;

        dx = inBounds ? ghost.x - cue.pos.x : primary.pos.x - cue.pos.x;
        dy = inBounds ? ghost.y - cue.pos.y : primary.pos.y - cue.pos.y;
        spinVal = 0; // stop shot — preserves the deflection angle
      }

      // Small random spread: tighter for cut shots (precision matters more)
      const spreadRange = alignment > 0.5 ? 0.32 : 0.22;
      const spread = (Math.random() - 0.5) * spreadRange;
      const cosS = Math.cos(spread);
      const sinS = Math.sin(spread);
      const rdx = dx * cosS - dy * sinS;
      const rdy = dx * sinS + dy * cosS;

      const mag = Math.hypot(rdx, rdy);
      // Distance-based power using primary distance (60–90%)
      const distFactor = Math.min(primaryDist / (eng.height * 0.6), 1);
      const power = 0.6 + distFactor * 0.3;
      const speed = s.launchSpeed4B * powerRef.current * power;

      cue.spin = spinVal;
      cue.sideSpin = 0;
      eng.launchMarble(cueId, { x: (rdx / mag) * speed, y: (rdy / mag) * speed });
      shotActiveRef.current = true;
      setReady(false);
      readyRef.current = false;
      // Reset picker to default (스톱샷 + 무회전)
      pickerContactRef.current = { x: 0, y: 0 };
      setPickerContact({ x: 0, y: 0 });
      shotTypeRef.current = 'stop'; setShotType('stop');
      englishRef.current = 'none'; setEnglish('none');
    }, 600 + Math.random() * 700); // 600–1300ms random delay
    return () => clearTimeout(timeoutId);
  }, [turn, ready, winner, vsAI]);

  const setupBalls = (eng: PhysicsEngine) => {
    const w = eng.width;
    const h = eng.height;
    // White — top centre
    const white = eng.addMarble({ pos: { x: w * 0.5, y: h * 0.18 }, vel: { x: 0, y: 0 }, radius: s.ballRadius4B, color: '#f0f0f0', friction: s.friction4B });
    playerIdRef.current = white.id;
    // Red 1 — just below white
    const red1 = eng.addMarble({ pos: { x: w * 0.5, y: h * 0.34 }, vel: { x: 0, y: 0 }, radius: s.ballRadius4B, color: '#cc2200', friction: s.friction4B });
    red1IdRef.current = red1.id;
    // Red 2 — lower left
    const red2 = eng.addMarble({ pos: { x: w * 0.5, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: s.ballRadius4B, color: '#cc2200', friction: s.friction4B });
    red2IdRef.current = red2.id;
    // Yellow — lower right
    const yellow = eng.addMarble({ pos: { x: w * 0.64, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: s.ballRadius4B, color: '#f4c430', friction: s.friction4B });
    yellowIdRef.current = yellow.id;
  };

  // Main tick loop
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
          const cueId      = turnRef.current === 'yellow' ? yellowIdRef.current : playerIdRef.current;
          const otherCueId = turnRef.current === 'yellow' ? playerIdRef.current : yellowIdRef.current;
          const red1     = eng.marbles.find((m) => m.id === red1IdRef.current);
          const red2     = eng.marbles.find((m) => m.id === red2IdRef.current);
          const otherCue = eng.marbles.find((m) => m.id === otherCueId);

          if (red1 && !red1HitRef.current && red1.lastHitById === cueId && Math.hypot(red1.vel.x, red1.vel.y) > SETTLE_SPEED_THRESHOLD) {
            red1HitRef.current = true;
            setBallsHit((p) => p + 1);
          }
          if (red2 && !red2HitRef.current && red2.lastHitById === cueId && Math.hypot(red2.vel.x, red2.vel.y) > SETTLE_SPEED_THRESHOLD) {
            red2HitRef.current = true;
            setBallsHit((p) => p + 1);
          }
          if (otherCue && !foulRef.current && otherCue.lastHitById === cueId && Math.hypot(otherCue.vel.x, otherCue.vel.y) > SETTLE_SPEED_THRESHOLD) {
            foulRef.current = true;
          }

          const allSlow = eng.marbles.every((m) => Math.hypot(m.vel.x, m.vel.y) <= SETTLE_SPEED_THRESHOLD);
          if (!allSlow) {
            settledCounterRef.current = 0;
          } else {
            settledCounterRef.current++;
              if (settledCounterRef.current >= FOURBALL_SETTLE_FRAMES) {
              const bothReds     = red1HitRef.current && red2HitRef.current;
              const isFoul       = foulRef.current;
              const isYellowTurn = turnRef.current === 'yellow';
              let keepTurn       = false;

              if (isFoul) {
                // Foul: -1 pt (floor 0), lose turn
                if (isYellowTurn) {
                  const next = Math.max(0, score1Ref.current - 1);
                  score1Ref.current = next;
                  setScore1(next);
                } else {
                  const next = Math.max(0, score2Ref.current - 1);
                  score2Ref.current = next;
                  setScore2(next);
                }
                setLastResult(t(lang, 'foulMinus'));
                keepTurn = false;
              } else if (bothReds) {
                // Score: +1 pt, keep turn
                if (isYellowTurn) {
                  const next = score1Ref.current + 1;
                  score1Ref.current = next;
                  setScore1(next);
                  if (next >= FOURBALL_WIN_SCORE) setWinner('yellow');
                } else {
                  const next = score2Ref.current + 1;
                  score2Ref.current = next;
                  setScore2(next);
                  if (next >= FOURBALL_WIN_SCORE) setWinner('white');
                }
                setLastResult('+1  ' + t(lang, 'bothReds'));
                keepTurn = true;
              } else {
                // Miss: lose turn, no penalty
                setLastResult(t(lang, 'miss'));
                keepTurn = false;
              }

              setTimeout(() => setLastResult(null), 1200);

              // Reset shot tracking
              red1HitRef.current = false;
              red2HitRef.current = false;
              foulRef.current = false;
              shotActiveRef.current = false;
              settledCounterRef.current = 0;
              setBallsHit(0);

              if (!keepTurn) {
                const nextTurn = turnRef.current === 'yellow' ? 'white' : 'yellow';
                turnRef.current = nextTurn;
                setTurn(nextTurn);
                // background mood plays continuously; do not stop on turn change
                // Reset tech buttons for the new player
                shotTypeRef.current = 'stop';
                englishRef.current  = 'none';
                setShotType('stop');
                setEnglish('none');
                pickerContactRef.current = { x: 0, y: 0 };
                setPickerContact({ x: 0, y: 0 });
              }
              setReady(true);
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

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const containerW = Math.max(320, width);
    const containerH = Math.max(480, height);
    setSize({ w: containerW, h: containerH });

    const boardMaxH = containerH - 140;
    const desiredBoardH = Math.min(boardMaxH, containerW * 2);
    const desiredBoardW = desiredBoardH / 2;

    if (!engineRef.current) {
      const INSET = 11; // 6px margin + 5px half stroke
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
      setupBalls(eng);
      engineRef.current = eng;
      setMarbles([...eng.marbles]);
      return;
    }
    const eng = engineRef.current;
    if (eng) { const INSET = 11; eng.width = Math.max(4, desiredBoardW - INSET * 2); eng.height = Math.max(4, desiredBoardH - INSET * 2); }
  };

  // Stores the arenaWrap's absolute page origin so that move events can use
  // pageX/pageY (screen-absolute) instead of locationX/Y (relative to whatever
  // child element is currently under the finger — the picker, for example).
  const arenaPageOriginRef = useRef({ x: 0, y: 0 });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !(vsAIRef.current && turnRef.current === 'white'),
      onPanResponderGrant: (evt) => {
        arenaPageOriginRef.current = {
          x: evt.nativeEvent.pageX - evt.nativeEvent.locationX,
          y: evt.nativeEvent.pageY - evt.nativeEvent.locationY,
        };
        // During charging: this tap fires the ball at current power
        if (chargingRef.current) {
          const eng = engineRef.current;
          const activeCueId = turnRef.current === 'yellow' ? yellowIdRef.current : playerIdRef.current;
          const dir = chargeDirectionRef.current;
          if (!eng || activeCueId == null || !dir) return;
          const active = eng.marbles.find((m) => m.id === activeCueId);
          if (!active) return;
          const speed = s.launchSpeed4B * powerRef.current * chargePowerRef.current;
          const vel = { x: (dir.dx / dir.mag) * speed, y: (dir.dy / dir.mag) * speed };
          active.spin     = -(pickerContactRef.current.y / PICKER_R) * 0.85;
          active.sideSpin =  (pickerContactRef.current.x / PICKER_R) * 0.85;
          eng.launchMarble(activeCueId, vel);
          shotActiveRef.current = true;
          setReady(false);
          readyRef.current = false;
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
          // Play bm.mp3 while Player 1 (yellow) is taking a human turn
          if (turnRef.current === 'yellow') {
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
        const activeCueId = turnRef.current === 'yellow' ? yellowIdRef.current : playerIdRef.current;
        const active = eng && activeCueId != null ? eng.marbles.find((m) => m.id === activeCueId) : null;
        const sx = active ? active.pos.x : 0;
        const sy = active ? active.pos.y : 0;
        aimingRef.current = { startX: sx, startY: sy, x: sx, y: sy };
      },
      onPanResponderMove: (evt) => {
        if (!aimingRef.current) return;
        const bH = Math.min(sizeRef.current.h - 140, sizeRef.current.w * 2);
        const bW = bH / 2;
        const boardOffX = (sizeRef.current.w - bW) / 2 + 11;
        const boardOffY = 11;
        const relX = evt.nativeEvent.pageX - arenaPageOriginRef.current.x;
        const relY = evt.nativeEvent.pageY - arenaPageOriginRef.current.y;
        aimingRef.current.x = relX - boardOffX;
        aimingRef.current.y = relY - boardOffY;
      },
      onPanResponderRelease: () => {
        if (chargingRef.current) return;
        const aim = aimingRef.current;
        const eng = engineRef.current;
        if (!aim || !eng || !readyRef.current || winner) { aimingRef.current = null; return; }
        const activeCueId = turnRef.current === 'yellow' ? yellowIdRef.current : playerIdRef.current;
        if (activeCueId == null) { aimingRef.current = null; return; }
        const active = eng.marbles.find((m) => m.id === activeCueId);
        if (!active) { aimingRef.current = null; return; }
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
    const white  = eng.marbles.find((m) => m.id === playerIdRef.current);
    const yellow = eng.marbles.find((m) => m.id === yellowIdRef.current);
    const red1   = eng.marbles.find((m) => m.id === red1IdRef.current);
    const red2   = eng.marbles.find((m) => m.id === red2IdRef.current);
    if (white)  { white.pos  = { x: w * 0.5,  y: h * 0.18 }; white.vel  = { x: 0, y: 0 }; white.wallHitCount = 0; }
    if (red1)   { red1.pos   = { x: w * 0.5,  y: h * 0.34 }; red1.vel   = { x: 0, y: 0 }; }
    if (red2)   { red2.pos   = { x: w * 0.5,  y: h * 0.72 }; red2.vel   = { x: 0, y: 0 }; }
    if (yellow) { yellow.pos = { x: w * 0.64, y: h * 0.72 }; yellow.vel = { x: 0, y: 0 }; }
    red1HitRef.current = false;
    red2HitRef.current = false;
    foulRef.current = false;
    shotActiveRef.current = false;
    settledCounterRef.current = 0;
    score1Ref.current = 0;
    score2Ref.current = 0;
    setBallsHit(0);
    setScore1(0);
    setScore2(0);
    turnRef.current = 'yellow';
    setTurn('yellow');
    // background mood plays continuously; do not stop on restart here
    shotTypeRef.current = 'stop';
    englishRef.current  = 'none';
    setShotType('stop');
    setEnglish('none');
    pickerContactRef.current = { x: 0, y: 0 };
    setPickerContact({ x: 0, y: 0 });
    setReady(true);
    readyRef.current = true;
    chargingRef.current = false;
    setCharging(false);
    chargePowerRef.current = 0;
    setChargePower(0);
    chargeDirectionRef.current = null;
    setLastResult(null);
    setWinner(null);
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
        {ready && !winner && (
          <Text style={[styles.turnText, turn === 'yellow' ? styles.yellowTurn : styles.whiteTurn]}>
            {turn === 'yellow' ? `🟡 ${t(lang, 'player1')}` : vsAI ? `🤖 ${t(lang, 'ai')}` : `⚪ ${t(lang, 'player2')}`} {t(lang,'turnSuffix')}
          </Text>
        )}
        {!ready && !winner && <Text style={styles.shotText}>{t(lang, 'shot')}</Text>}
      </View>

      {/* Scoreboard */}
      <View style={styles.scoreRow}>
        <View style={[styles.scoreCard, turn === 'yellow' && !winner ? styles.activeCard : null]}>
          <Text style={styles.playerLabel}>🟡 {t(lang, 'player1')}</Text>
          <Text style={styles.scoreNum}>{score1}</Text>
        </View>
        <View style={styles.midCol}>
          <Text style={styles.redsLabel}>{t(lang, 'redsLabel')}</Text>
          <Text style={styles.redsNum}>{ballsHit}/2</Text>
          <Text style={[styles.resultText, lastResult?.startsWith('+') ? styles.hit : styles.miss]}>
            {lastResult ? lastResult : ''}
          </Text>
        </View>
        <View style={[styles.scoreCard, turn === 'white' && !winner ? styles.activeCard : null]}>
          <Text style={styles.playerLabel}>{vsAI ? '🤖 AI' : '⚪ Player 2'}</Text>
          <Text style={styles.scoreNum}>{score2}</Text>
        </View>
      </View>

      {/* Win banner */}
      {winner && (
        <View style={styles.winBanner}>
          <Text style={styles.winText}>
            {winner === 'yellow' ? `🟡 ${t(lang, 'player1')} ${t(lang, 'playAgain')}` : vsAI ? `🤖 ${t(lang, 'ai')} ${t(lang, 'playAgain')}` : `⚪ ${t(lang, 'player2')} ${t(lang, 'playAgain')}`}
          </Text>
          <TouchableOpacity style={styles.playAgainBtn} onPress={restart}>
            <Text style={styles.playAgainText}>{t(lang, 'playAgain')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Shot technique selector / Power charge meter — same fixed slot */}
      {!winner && (
        <View style={styles.techRow}>
          {vsAI && turn === 'white' ? (
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
      )}

      <View style={styles.arenaWrap}>
        <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={size.w} height={boardH}>
          <Defs>
            <Pattern id="woodBg" x="0" y="0" width={150} height={150} patternUnits="userSpaceOnUse">
              <SvgImage href={require('../../assets/pattern-table.png')} x="0" y="0" width={150} height={150} />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={boardH} fill="url(#woodBg)" />
        </Svg>
        <View style={{ width: boardW, height: boardH }} {...pan.panHandlers}>
            <Svg width={boardW} height={boardH}>
              <Rect x={0} y={0} width={boardW} height={boardH} fill="#2d6a4f" />
              <Rect x={6} y={6} width={boardW - 12} height={boardH - 12} fill="none" stroke="#1b4332" strokeWidth={10} />
            <BilliardsMarbles
              marbles={marbles}
              whiteBallId={playerIdRef.current}
              yellowBallId={yellowIdRef.current}
              activeCueId={turn === 'yellow' ? yellowIdRef.current : playerIdRef.current}
              isReady={!winner && ready}
              offsetX={11}
              offsetY={11}
            />
            <TrajectoryLine
              aim={aimingRef.current}
              charging={charging}
              chargeDirection={chargeDirectionRef.current}
              engine={engineRef.current}
              activeCueId={turn === 'yellow' ? yellowIdRef.current : playerIdRef.current}
              launchSpeed={s.launchSpeed4B}
              power={powerRef.current}
              chargePower={chargePowerRef.current}
              english={englishRef.current}
              trajectoryLength={s.trajectoryLength}
              disabled={!!winner}
              offsetX={11}
              offsetY={11}
            />
          </Svg>
          <MagnifierOverlay
            aim={aimingRef.current}
            charging={charging}
            chargeDirection={chargeDirectionRef.current}
            engine={engineRef.current}
            activeCueId={turn === 'yellow' ? yellowIdRef.current : playerIdRef.current}
            offsetX={11}
            offsetY={11}
          />
            <PickerOverlay
            visible={!winner && ready && !(vsAI && turn === 'white')}
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
  arenaWrap: { width: '100%', alignItems: 'center', backgroundColor: 'transparent' },

  hudRow: { width: '95%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  turnText: { flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  yellowTurn: { color: '#2cc47a' },
  whiteTurn: { color: '#2cc47a' },
  shotText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#f4a020', textAlign: 'center' },

  scoreRow: { width: '95%', flexDirection: 'row', alignItems: 'center', marginBottom: 1, gap: 3 },
  scoreCard: {
    flex: 1, alignItems: 'center', paddingVertical: 1, paddingHorizontal: 4,
    backgroundColor: '#fff', borderRadius: 5,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  activeCard: { borderColor: '#f4c430' },
  playerLabel: { fontSize: 8, fontWeight: '600', color: '#444', marginBottom: 0 },
  scoreNum: { fontSize: 13, fontWeight: '800', color: '#111' },

  midCol: { flex: 1, alignItems: 'center' },
  redsLabel: { fontSize: 7, color: '#444', fontWeight: '600' },
  redsNum: { fontSize: 7, fontWeight: '800', color: '#111' },
  resultText: { fontSize: 8, fontWeight: '700', marginTop: 0, textAlign: 'center' },
  hit: { color: '#2cc47a' },
  miss: { color: '#e44' },

  winBanner: {
    width: '95%', backgroundColor: '#f4c430', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginBottom: 4, gap: 8,
  },
  winText: { fontSize: 20, fontWeight: '800', color: '#111' },
  playAgainBtn: { backgroundColor: '#111', borderRadius: 6, paddingHorizontal: 20, paddingVertical: 8 },
  playAgainText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  restartBtn: { width: 60, height: 26, backgroundColor: '#e44', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  restartText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  backBtn: { width: 38, height: 26, backgroundColor: '#e67e22', borderRadius: 5, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 3, elevation: 4 },
  backText: { color: '#fff', fontWeight: '900', fontSize: 16, textAlign: 'center', textAlignVertical: 'center', lineHeight: 21 },

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
