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
import Svg, { Circle, Rect, Ellipse, Polyline } from 'react-native-svg';
import { Audio } from 'expo-av';
import { PhysicsEngine, Marble } from '../game/physics';
import {
  BILLIARDS_LAUNCH_SPEED, DEFAULT_PLAYER_POWER, ENGINE_DEFAULT_RESTITUTION,
  BILLIARDS_BALL_RADIUS, BILLIARDS_BALL_FRICTION, SETTLE_SPEED_THRESHOLD,
  BILLIARDS_SETTLE_FRAMES,
} from '../game/constants';
import { useSettings } from '../context/SettingsContext';

interface Props {
  onBack: () => void;
}

export default function BilliardsView({ onBack }: Props): JSX.Element {
  const { settings } = useSettings();
  const s = settings; // shorthand
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
    const cue = eng.addMarble({ pos: { x: w * 0.56, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: r, color: '#f0f0f0', friction: s.friction3C });
    playerIdRef.current = cue.id;
    const yellow = eng.addMarble({ pos: { x: w * 0.44, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: r, color: '#f4c430', friction: s.friction3C });
    yellowIdRef.current = yellow.id;
    const redBall = eng.addMarble({ pos: { x: w * 0.5, y: h * 0.3 }, vel: { x: 0, y: 0 }, radius: r, color: '#cc2200', friction: s.friction3C });
    redBallIdRef.current = redBall.id;
  };

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
              const validCushions = cushionAtSecondHitRef.current >= 3;

              let keepTurn = false;
              if (breakFoul) {
                setLastResult('Foul – miss turn');
                keepTurn = false;
              } else if (bothHit && validCushions) {
                if (turnRef.current === 1) {
                  const n = score1Ref.current + 1; score1Ref.current = n; setScore1(n);
                } else {
                  const n = score2Ref.current + 1; score2Ref.current = n; setScore2(n);
                }
                setLastResult('+1');
                keepTurn = true;
              } else {
                setLastResult('Miss');
                keepTurn = false;
              }

              setTimeout(() => setLastResult(null), 1200);

              // Mark break done
              isBreakRef.current = false;

              if (!keepTurn) {
                const next: 1 | 2 = turnRef.current === 1 ? 2 : 1;
                turnRef.current = next;
                setTurn(next);
              }

              // Reset shot tracking
              yellowHitRef.current = false;
              redBallHitRef.current = false;
              firstBallHitRef.current = null;
              cushionAtSecondHitRef.current = -1;
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
      setupBilliards(eng);
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
          const activeCueId = turnRef.current === 1 ? playerIdRef.current : yellowIdRef.current;
          const dir = chargeDirectionRef.current;
          if (!eng || activeCueId == null || !dir) return;
          const player = eng.marbles.find((m) => m.id === activeCueId);
          if (!player) return;
          const speed = s.launchSpeed3C * powerRef.current * chargePowerRef.current;
          const vel = { x: (dir.dx / dir.mag) * speed, y: (dir.dy / dir.mag) * speed };
          const spinMap:    Record<string, number> = { draw: -0.85, stop: 0, follow: 0.85 };
          const englishMap: Record<string, number> = { left: -0.85, none: 0, right: 0.85 };
          player.spin     = spinMap[shotTypeRef.current];
          player.sideSpin = englishMap[englishRef.current];
          eng.launchMarble(activeCueId, vel);
          shotActiveRef.current = true;
          setBilliardReady(false);
          billiardReadyRef.current = false;
          chargingRef.current = false;
          setCharging(false);
          chargePowerRef.current = 0;
          setChargePower(0);
          chargeDirectionRef.current = null;
          return;
        }
        // Normal aim setup
        const eng = engineRef.current;
        const activeCueId = turnRef.current === 1 ? playerIdRef.current : yellowIdRef.current;
        const player = eng && activeCueId != null ? eng.marbles.find((m) => m.id === activeCueId) : null;
        const sx = player ? player.pos.x : evt.nativeEvent.locationX;
        const sy = player ? player.pos.y : evt.nativeEvent.locationY;
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
        const activeCueId = turnRef.current === 1 ? playerIdRef.current : yellowIdRef.current;
        if (!aim || !eng || !billiardReadyRef.current || activeCueId == null) { aimingRef.current = null; return; }
        const player = eng.marbles.find((m) => m.id === activeCueId);
        if (!player) { aimingRef.current = null; return; }
        const dx = (aim.x || aim.startX) - player.pos.x;
        const dy = (aim.y || aim.startY) - player.pos.y;
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
      const isWhiteCue = m.id === playerIdRef.current;
      const isYellowCue = m.id === yellowIdRef.current;
      const isRed    = m.id === redBallIdRef.current;
      const activeCueId = turn === 1 ? playerIdRef.current : yellowIdRef.current;
      const isActiveCue = m.id === activeCueId;
      const dotColor = isRed ? '#ffffff' : (isWhiteCue || isYellowCue) ? '#cc2200' : null;
      return (
        <React.Fragment key={m.id}>
          {isActiveCue && billiardReady && (
            <Circle cx={m.pos.x} cy={m.pos.y} r={m.radius + 5} fill="none" stroke="#fff" strokeWidth={2} strokeOpacity={0.7} />
          )}
          <Ellipse cx={m.pos.x} cy={m.pos.y + m.radius * 0.6} rx={m.radius * 1.15} ry={m.radius * 0.5} fill="#000" opacity={0.12} />
          <Circle
            cx={m.pos.x} cy={m.pos.y} r={m.radius}
            fill={m.color || '#fff'}
            stroke={isWhiteCue ? '#999' : 'none'}
            strokeWidth={isWhiteCue ? 1.5 : 0}
          />
          {dotColor && <Circle cx={m.pos.x} cy={m.pos.y} r={3} fill={dotColor} />}
        </React.Fragment>
      );
    });

  const renderTrajectory = () => {
    const aim = aimingRef.current;
    const eng = engineRef.current;
    const activeCueId = turn === 1 ? playerIdRef.current : yellowIdRef.current;
    if (!eng || activeCueId == null) return null;
    if (!aim && !charging) return null;
    const player = eng.marbles.find((m) => m.id === activeCueId);
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
    let px = player ? player.pos.x : (aim ? aim.startX : 0);
    let py = player ? player.pos.y : (aim ? aim.startY : 0);
    const effectiveSpeed = charging
      ? s.launchSpeed3C * powerRef.current * chargePowerRef.current
      : s.launchSpeed3C * powerRef.current;
    let vx = (dx / mag) * effectiveSpeed;
    let vy = (dy / mag) * effectiveSpeed;
    const r  = player ? player.radius : 0;
    const fr = player?.friction ?? eng.friction;
    const e  = eng.restitution;
    const dt = 1 / 60;
    const pts: number[] = [];
    for (let i = 0; i < 80; i++) {
      px += vx * dt; py += vy * dt;
      vx *= fr; vy *= fr;
      if (px - r < 0) { px = r; vx *= -e; }
      if (px + r > eng.width) { px = eng.width - r; vx *= -e; }
      if (py - r < 0) { py = r; vy *= -e; }
      if (py + r > eng.height) { py = eng.height - r; vy *= -e; }
      pts.push(px, py);
    }
    return <Polyline points={pts.join(' ')} fill="none" stroke="#ffffff" strokeWidth={3} strokeOpacity={0.65} strokeDasharray={[6, 6]} />;
  };

  const restart = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const w = eng.width, h = eng.height;
    const cue    = eng.marbles.find((m) => m.id === playerIdRef.current);
    const yellow = eng.marbles.find((m) => m.id === yellowIdRef.current);
    const red    = eng.marbles.find((m) => m.id === redBallIdRef.current);
    if (cue)    { cue.pos    = { x: w * 0.56, y: h * 0.72 }; cue.vel    = { x: 0, y: 0 }; cue.wallHitCount = 0; }
    if (yellow) { yellow.pos = { x: w * 0.44, y: h * 0.72 }; yellow.vel = { x: 0, y: 0 }; }
    if (red)    { red.pos    = { x: w * 0.5,  y: h * 0.3  }; red.vel    = { x: 0, y: 0 }; }
    yellowHitRef.current = false;
    redBallHitRef.current = false;
    firstBallHitRef.current = null;
    cushionAtSecondHitRef.current = -1;
    cushionCountRef.current = 0;
    shotActiveRef.current = false;
    settledCounterRef.current = 0;
    isBreakRef.current = true;
    score1Ref.current = 0;
    score2Ref.current = 0;
    turnRef.current = 1;
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
        {billiardReady ? (
          <Text style={styles.turnText}>
            {turn === 1 ? '⚪ Player 1' : '🟡 Player 2'}'s turn
          </Text>
        ) : (
          <Text style={styles.shotText}>Shot…</Text>
        )}
      </View>

      {/* Scoreboard — compact single row */}
      <View style={styles.scoreRow}>
        <View style={[styles.scoreChip, turn === 1 ? styles.activeChip : null]}>
          <Text style={styles.chipLabel}>Player 1</Text>
          <Text style={styles.chipScore}>{score1}</Text>
        </View>
        <View style={styles.statsChip}>
          <Text style={styles.statItem}>Cushions <Text style={styles.statVal}>{cushionCount}/3</Text></Text>
          <Text style={styles.statItem}>Balls <Text style={styles.statVal}>{ballsHit}/2</Text></Text>
          {lastResult && (
            <Text style={[styles.resultText, lastResult.startsWith('+') ? styles.hit : styles.miss]}>{lastResult}</Text>
          )}
        </View>
        <View style={[styles.scoreChip, turn === 2 ? styles.activeChip : null]}>
          <Text style={styles.chipLabel}>Player 2</Text>
          <Text style={styles.chipScore}>{score2}</Text>
        </View>
      </View>

      {/* Shot technique selector / Power charge meter — same fixed slot */}
      <View style={styles.techRow}>
        {charging ? (
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
                  onPress={() => setShotType(key)}
                >
                  <Text style={[styles.techLabel, shotType === key && styles.techLabelActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* English row */}
            <View style={styles.techGroup}>
              {([
                { key: 'left',  label: '왼회전', sub: '← Eng' },
                { key: 'none',  label: '무회전', sub: 'Center' },
                { key: 'right', label: '오른회전', sub: 'Eng →' },
              ] as { key: EnglishType; label: string; sub: string }[]).map(({ key, label, sub }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.techBtn, english === key && styles.techBtnEnActive]}
                  onPress={() => setEnglish(key)}
                >
                  <Text style={[styles.techLabel, english === key && styles.techLabelActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.arenaWrap} {...pan.panHandlers}>
        <Svg width={size.w} height={boardH}>
          <Rect x={0} y={0} width={size.w} height={boardH} fill="#2d6a4f" />
          <Rect x={6} y={6} width={size.w - 12} height={boardH - 12} fill="none" stroke="#1b4332" strokeWidth={10} />
          {renderMarbles()}
          {renderTrajectory()}
        </Svg>
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
  shotText: { color: '#f4a020' },

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
  statItem: { fontSize: 8, color: '#444', fontWeight: '600' },
  statVal: { fontWeight: '800', color: '#111' },
  resultText: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
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

  powerMeterInner: { width: '100%', alignItems: 'center', justifyContent: 'center', flex: 1 },
  powerMeterLabel: { fontSize: 11, fontWeight: '800', color: '#fff', marginBottom: 3, letterSpacing: 1 },
  powerMeterTrack: { width: '100%', height: 14, backgroundColor: '#333', borderRadius: 7, overflow: 'hidden' },
  powerMeterFill: { height: '100%', borderRadius: 7 },
  powerMeterPct: { fontSize: 10, fontWeight: '700', color: '#fff', marginTop: 2 },
});
