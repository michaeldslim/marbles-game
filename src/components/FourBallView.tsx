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
import { View, PanResponder, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Svg, { Circle, Rect, Ellipse, Polyline, Line } from 'react-native-svg';
import { Audio } from 'expo-av';
import { PhysicsEngine, Marble } from '../game/physics';
import { 
  DEFAULT_PLAYER_POWER, 
  SETTLE_SPEED_THRESHOLD, 
  FOURBALL_SETTLE_FRAMES, 
  FOURBALL_WIN_SCORE, 
} from '../game/constants';
import { useSettings } from '../context/SettingsContext';

interface Props {
  onBack: () => void;
}

export default function FourBallView({ onBack }: Props): JSX.Element {
  const { settings } = useSettings();
  const s = settings; // shorthand
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
  const PICKER_R = 54;
  const pickerContactRef = useRef({ x: 0, y: 0 });
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
        const cur = pickerPosRef.current ?? { x: sizeRef.current.w - SIZE - 12, y: 130 };
        pickerDragStartRef.current = { ...cur };
      },
      onPanResponderMove: (_, g) => {
        const SIZE = 128; const HANDLE_H = 22;
        const boardH = sizeRef.current.h - 140;
        const nx = Math.max(0, Math.min(sizeRef.current.w - SIZE, pickerDragStartRef.current.x + g.dx));
        const ny = Math.max(0, Math.min(boardH - SIZE - HANDLE_H, pickerDragStartRef.current.y + g.dy));
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
        s.setVolumeAsync(0)
          .then(() => s.playAsync())
          .then(() => s.setVolumeAsync(1))
          .catch(() => {});
      })
      .catch(() => {});
    return () => { sound?.unloadAsync(); };
  }, []);

  useEffect(() => { powerRef.current = power; }, [power]);

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
    const red2 = eng.addMarble({ pos: { x: w * 0.42, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: s.ballRadius4B, color: '#cc2200', friction: s.friction4B });
    red2IdRef.current = red2.id;
    // Yellow — lower right
    const yellow = eng.addMarble({ pos: { x: w * 0.58, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: s.ballRadius4B, color: '#f4c430', friction: s.friction4B });
    yellowIdRef.current = yellow.id;
  };

  // Main tick loop
  useEffect(() => {
    let last = Date.now();
    let rafId: number | null = null;
    const tick = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      const eng = engineRef.current;
      if (eng) {
        eng.step(dt);

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
                setLastResult('Foul  −1');
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
                setLastResult('+1  Both reds!');
                keepTurn = true;
              } else {
                // Miss: lose turn, no penalty
                setLastResult('Miss');
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
    const newW = Math.max(320, width);
    const newH = Math.max(480, height);
    setSize({ w: newW, h: newH });
    const boardHeight = newH - 140;
    if (!engineRef.current) {
      const eng = new PhysicsEngine(newW, boardHeight);
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
    if (eng) { eng.width = newW; eng.height = boardHeight; }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
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
          return;
        }
        // Normal aim setup
        const eng = engineRef.current;
        const activeCueId = turnRef.current === 'yellow' ? yellowIdRef.current : playerIdRef.current;
        const active = eng && activeCueId != null ? eng.marbles.find((m) => m.id === activeCueId) : null;
        const sx = active ? active.pos.x : evt.nativeEvent.locationX;
        const sy = active ? active.pos.y : evt.nativeEvent.locationY;
        aimingRef.current = { startX: sx, startY: sy, x: sx, y: sy };
      },
      onPanResponderMove: (evt) => {
        if (!aimingRef.current) return;
        aimingRef.current.x = evt.nativeEvent.locationX;
        aimingRef.current.y = evt.nativeEvent.locationY;
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
        const dx = (aim.x || aim.startX) - active.pos.x;
        const dy = (aim.y || aim.startY) - active.pos.y;
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

  const renderMarbles = () =>
    marbles.map((m) => {
      if (m.captured) return null;
      const isWhite  = m.id === playerIdRef.current;
      const isYellow = m.id === yellowIdRef.current;
      const isRed    = m.id === red1IdRef.current || m.id === red2IdRef.current;
      const activeCueId = turnRef.current === 'yellow' ? yellowIdRef.current : playerIdRef.current;
      const isActive = m.id === activeCueId;
      const dotColor = isWhite || isYellow ? '#cc2200' : isRed ? '#ffffff' : null;
      return (
        <React.Fragment key={m.id}>
          {isActive && ready && (
            <Circle cx={m.pos.x} cy={m.pos.y} r={m.radius + 5} fill="none" stroke="#fff" strokeWidth={2} strokeOpacity={0.7} />
          )}
          <Ellipse cx={m.pos.x} cy={m.pos.y + m.radius * 0.6} rx={m.radius * 1.15} ry={m.radius * 0.5} fill="#000" opacity={0.12} />
          <Circle
            cx={m.pos.x} cy={m.pos.y} r={m.radius}
            fill={m.color || '#fff'}
            stroke={isWhite ? '#999' : 'none'}
            strokeWidth={isWhite ? 1.5 : 0}
          />
          {dotColor && <Circle cx={m.pos.x} cy={m.pos.y} r={3} fill={dotColor} />}
        </React.Fragment>
      );
    });

  const renderPicker = () => {
    if (winner || !ready) return null;
    const SIZE = 128; const HANDLE_H = 22;
    const cx = SIZE / 2; const cy = SIZE / 2;
    const dotX = cx + pickerContact.x; const dotY = cy + pickerContact.y;
    const pos = pickerPos ?? { x: size.w - SIZE - 12, y: 130 };
    return (
      <View style={{ position: 'absolute', top: pos.y, left: pos.x, width: SIZE, height: SIZE + HANDLE_H }}>
        <View
          style={{ height: HANDLE_H, width: SIZE, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderTopLeftRadius: 6, borderTopRightRadius: 6, rowGap: 4 }}
          {...pickerMovePan.panHandlers}
        >
          <View style={{ width: 28, height: 2.5, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
          <View style={{ width: 28, height: 2.5, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
        </View>
        <View style={{ width: SIZE, height: SIZE }} {...pickerPan.panHandlers}>
          <Svg width={SIZE} height={SIZE}>
            <Circle cx={cx} cy={cy} r={PICKER_R} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
            <Line x1={cx} y1={cy - PICKER_R} x2={cx} y2={cy + PICKER_R} stroke="rgba(255,255,255,0.25)" strokeWidth={0.8} />
            <Line x1={cx - PICKER_R} y1={cy} x2={cx + PICKER_R} y2={cy} stroke="rgba(255,255,255,0.25)" strokeWidth={0.8} />
            <Circle cx={cx} cy={cy} r={PICKER_R * 0.3} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} />
            <Circle cx={dotX} cy={dotY} r={9} fill="#fff" opacity={0.95} />
            <Circle cx={dotX} cy={dotY} r={9} fill="none" stroke="#333" strokeWidth={1.5} />
          </Svg>
        </View>
      </View>
    );
  };

  const renderMagnifier = () => {
    const aim = aimingRef.current;
    const eng = engineRef.current;
    const activeCueId = turn === 'yellow' ? yellowIdRef.current : playerIdRef.current;
    if (!eng || activeCueId == null) return null;
    if (!aim && !charging) return null;

    let dx: number, dy: number, mag: number;
    if (charging && chargeDirectionRef.current) {
      ({ dx, dy, mag } = chargeDirectionRef.current);
    } else if (aim) {
      dx = (aim.x || aim.startX) - aim.startX;
      dy = (aim.y || aim.startY) - aim.startY;
      mag = Math.hypot(dx, dy) || 1;
    } else {
      return null;
    }

    const active = eng.marbles.find((m) => m.id === activeCueId);
    if (!active) return null;
    const ux = dx / mag;
    const uy = dy / mag;

    // Ray-circle intersection: find first target marble in the aim direction
    let minT = Infinity;
    let hitMarble: Marble | null = null;
    for (const m of eng.marbles) {
      if (m.id === activeCueId || m.captured) continue;
      const fx = active.pos.x - m.pos.x;
      const fy = active.pos.y - m.pos.y;
      const minDist = active.radius + m.radius;
      const b = 2 * (fx * ux + fy * uy);
      const c = fx * fx + fy * fy - minDist * minDist;
      const disc = b * b - 4 * c;
      if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / 2;
      if (t > 0 && t < minT) { minT = t; hitMarble = m; }
    }
    if (!hitMarble) return null;

    const collX = active.pos.x + ux * minT;
    const collY = active.pos.y + uy * minT;
    const MAG_SIZE = 110;
    const ZOOM = 2.0;
    const worldW = MAG_SIZE / ZOOM;
    const worldH = MAG_SIZE / ZOOM;
    const midX = (collX + hitMarble.pos.x) / 2;
    const midY = (collY + hitMarble.pos.y) / 2;
    const viewBox = `${midX - worldW / 2} ${midY - worldH / 2} ${worldW} ${worldH}`;

    return (
      <View
        style={{
          position: 'absolute', top: 12, right: 12,
          width: MAG_SIZE, height: MAG_SIZE,
          borderRadius: MAG_SIZE / 2,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.8)',
        }}
        pointerEvents="none"
      >
        <Svg width={MAG_SIZE} height={MAG_SIZE} viewBox={viewBox}>
          <Rect x={0} y={0} width={eng.width} height={eng.height} fill="#2d6a4f" />
          <Rect x={6} y={6} width={eng.width - 12} height={eng.height - 12} fill="none" stroke="#1b4332" strokeWidth={10} />
          {eng.marbles.filter((m) => !m.captured).map((m) => (
            <Circle
              key={m.id}
              cx={m.pos.x} cy={m.pos.y} r={m.radius}
              fill={m.color || '#fff'}
              stroke={m.id === activeCueId ? '#999' : 'none'}
              strokeWidth={1.5}
            />
          ))}
          {/* Ghost cue ball at collision position */}
          <Circle
            cx={collX} cy={collY} r={active.radius}
            fill={active.color || '#fff'}
            opacity={0.5}
            stroke="#fff" strokeWidth={1}
            strokeDasharray={[3, 3]}
          />
          {/* Vertical + Horizontal reference lines through target ball center */}
          {(() => {
            const c = hitMarble.color || '#fff';
            const hex = c.replace('#', '');
            const r2 = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
            const g2 = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
            const b2 = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
            const isLight = (r2 * 0.299 + g2 * 0.587 + b2 * 0.114) > 160;
            const lineColor = isLight ? '#000' : '#fff';
            return (
              <>
                <Line
                  x1={hitMarble.pos.x} y1={hitMarble.pos.y - hitMarble.radius}
                  x2={hitMarble.pos.x} y2={hitMarble.pos.y + hitMarble.radius}
                  stroke={lineColor} strokeWidth={1} strokeDasharray={[2, 2]} strokeOpacity={0.85}
                />
                <Line
                  x1={hitMarble.pos.x - hitMarble.radius} y1={hitMarble.pos.y}
                  x2={hitMarble.pos.x + hitMarble.radius} y2={hitMarble.pos.y}
                  stroke={lineColor} strokeWidth={1} strokeDasharray={[2, 2]} strokeOpacity={0.85}
                />
              </>
            );
          })()}
        </Svg>
      </View>
    );
  };

  const renderTrajectory = () => {
    const aim = aimingRef.current;
    const eng = engineRef.current;
    if (!eng || winner) return null;
    if (!aim && !charging) return null;
    const activeCueId = turnRef.current === 'yellow' ? yellowIdRef.current : playerIdRef.current;
    if (activeCueId == null) return null;
    const active = eng.marbles.find((m) => m.id === activeCueId);
    let dx: number, dy: number, mag: number;
    if (charging && chargeDirectionRef.current) {
      ({ dx, dy, mag } = chargeDirectionRef.current);
    } else if (aim) {
      dx = (aim.x || aim.startX) - aim.startX;
      dy = (aim.y || aim.startY) - aim.startY;
      mag = Math.hypot(dx, dy) || 1;
    } else {
      return null;
    }
    let px = active ? active.pos.x : (aim ? aim.startX : 0);
    let py = active ? active.pos.y : (aim ? aim.startY : 0);
    const effectiveSpeed = charging
      ? s.launchSpeed4B * powerRef.current * chargePowerRef.current
      : s.launchSpeed4B * powerRef.current;
    let vx = (dx / mag) * effectiveSpeed;
    let vy = (dy / mag) * effectiveSpeed;
    const r = active ? active.radius : 0;
    const fr = active?.friction ?? eng.friction;
    const e = eng.restitution;
    const ef = eng.englishFactor;
    const scr = 0.6; // SIDE_SPIN_CUSHION_RETAIN
    const englishMap: Record<string, number> = { left: -0.85, none: 0, right: 0.85 };
    let sideSpin = englishMap[englishRef.current];
    const dt = 1 / 60;
    const pts: number[] = [];
    for (let i = 0; i < s.trajectoryLength; i++) {
      px += vx * dt; py += vy * dt;
      vx *= fr; vy *= fr;
      if (px - r < 0) { px = r; const pvx = vx; vx *= -e; if (sideSpin) { vy -= sideSpin * ef * Math.abs(pvx); sideSpin *= scr; } }
      if (px + r > eng.width) { px = eng.width - r; const pvx = vx; vx *= -e; if (sideSpin) { vy += sideSpin * ef * Math.abs(pvx); sideSpin *= scr; } }
      if (py - r < 0) { py = r; const pvy = vy; vy *= -e; if (sideSpin) { vx += sideSpin * ef * Math.abs(pvy); sideSpin *= scr; } }
      if (py + r > eng.height) { py = eng.height - r; const pvy = vy; vy *= -e; if (sideSpin) { vx -= sideSpin * ef * Math.abs(pvy); sideSpin *= scr; } }
      pts.push(px, py);
    }
    return <Polyline points={pts.join(' ')} fill="none" stroke="#ffffff" strokeWidth={3} strokeOpacity={0.65} strokeDasharray={[6, 6]} />;
  };

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
    if (red2)   { red2.pos   = { x: w * 0.42, y: h * 0.72 }; red2.vel   = { x: 0, y: 0 }; }
    if (yellow) { yellow.pos = { x: w * 0.58, y: h * 0.72 }; yellow.vel = { x: 0, y: 0 }; }
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

  const boardH = size.h - 140;

  return (
    <View style={styles.container} onLayout={onLayout}>

      {/* Top bar */}
      <View style={styles.hudRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.restartBtn} onPress={restart}>
          <Text style={styles.restartText}>Restart</Text>
        </TouchableOpacity>
        {ready && !winner && (
          <Text style={[styles.turnText, turn === 'yellow' ? styles.yellowTurn : styles.whiteTurn]}>
            {turn === 'yellow' ? '🟡 Player 1' : '⚪ Player 2'}'s turn
          </Text>
        )}
        {!ready && !winner && <Text style={styles.shotText}>Shot…</Text>}
      </View>

      {/* Scoreboard */}
      <View style={styles.scoreRow}>
        <View style={[styles.scoreCard, turn === 'yellow' && !winner ? styles.activeCard : null]}>
          <Text style={styles.playerLabel}>🟡 Player 1</Text>
          <Text style={styles.scoreNum}>{score1}</Text>
        </View>

        <View style={styles.midCol}>
          <Text style={styles.redsLabel}>Reds hit</Text>
          <Text style={styles.redsNum}>{ballsHit}/2</Text>
          {lastResult && (
            <Text style={[styles.resultText, lastResult.startsWith('+') ? styles.hit : styles.miss]}>
              {lastResult}
            </Text>
          )}
        </View>

        <View style={[styles.scoreCard, turn === 'white' && !winner ? styles.activeCard : null]}>
          <Text style={styles.playerLabel}>⚪ Player 2</Text>
          <Text style={styles.scoreNum}>{score2}</Text>
        </View>
      </View>

      {/* Win banner */}
      {winner && (
        <View style={styles.winBanner}>
          <Text style={styles.winText}>
            {winner === 'yellow' ? '🟡 Player 1 wins!' : '⚪ Player 2 wins!'}
          </Text>
          <TouchableOpacity style={styles.playAgainBtn} onPress={restart}>
            <Text style={styles.playAgainText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Shot technique selector / Power charge meter — same fixed slot */}
      {!winner && (
        <View style={styles.techRow}>
          {charging ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={styles.powerMeterInner}>
                <Text style={styles.powerMeterLabel}>TAP TO SHOOT  탭하여 발사</Text>
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
                    <Text style={[styles.techLabel, shotType === key && styles.techLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.techGroup}>
                {([
                  { key: 'left',  label: '왼회전',   sub: '← Eng' },
                  { key: 'none',  label: '무회전',   sub: 'Center' },
                  { key: 'right', label: '오른회전', sub: 'Eng →' },
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
                    <Text style={[styles.techLabel, english === key && styles.techLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      <View style={styles.arenaWrap} {...pan.panHandlers}>
        <View style={{ width: size.w, height: boardH }}>
          <Svg width={size.w} height={boardH}>
            <Rect x={0} y={0} width={size.w} height={boardH} fill="#2d6a4f" />
            <Rect x={6} y={6} width={size.w - 12} height={boardH - 12} fill="none" stroke="#1b4332" strokeWidth={10} />
            {renderMarbles()}
            {renderTrajectory()}
          </Svg>
          {renderMagnifier()}
          {renderPicker()}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 2 },
  arenaWrap: { width: '100%', alignItems: 'center' },

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
  redsLabel: { fontSize: 8, color: '#555', fontWeight: '600' },
  redsNum: { fontSize: 13, fontWeight: '800', color: '#111' },
  resultText: { fontSize: 9, fontWeight: '700', marginTop: 0 },
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
