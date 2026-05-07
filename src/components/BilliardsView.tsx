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

interface Props {
  onBack: () => void;
}

export default function BilliardsView({ onBack }: Props): JSX.Element {
  const [size, setSize] = useState({ w: 360, h: 640 });
  const [marbles, setMarbles] = useState<Marble[]>([]);
  const [score, setScore] = useState<number>(0);
  const shotActiveRef = useRef<boolean>(false);
  const [power, setPower] = useState<number>(DEFAULT_PLAYER_POWER);
  const powerRef = useRef<number>(DEFAULT_PLAYER_POWER);
  const engineRef = useRef<PhysicsEngine | null>(null);
  const playerIdRef = useRef<number | null>(null);
  const aimingRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const settledCounterRef = useRef<number>(0);
  const hitSoundRef = useRef<Audio.Sound | null>(null);

  // Billiards-specific refs
  const yellowIdRef = useRef<number | null>(null);
  const redBallIdRef = useRef<number | null>(null);
  const yellowHitRef = useRef<boolean>(false);
  const redBallHitRef = useRef<boolean>(false);
  const cushionCountRef = useRef<number>(0);
  const cushionAtFirstHitRef = useRef<number>(-1);
  const cushionAtSecondHitRef = useRef<number>(-1);
  const [cushionCount, setCushionCount] = useState<number>(0);
  const [ballsHit, setBallsHit] = useState<number>(0);
  const [billiardReady, setBilliardReady] = useState<boolean>(true);

  // Load hit sound on mount, unload on unmount
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

  const setupBilliards = (eng: PhysicsEngine) => {
    const w = eng.width;
    const h = eng.height;
    const r = BILLIARDS_BALL_RADIUS;
    const cue = eng.addMarble({ pos: { x: w * 0.56, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: r, color: '#f0f0f0', friction: BILLIARDS_BALL_FRICTION });
    playerIdRef.current = cue.id;
    const yellow = eng.addMarble({ pos: { x: w * 0.44, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: r, color: '#f4c430', friction: BILLIARDS_BALL_FRICTION });
    yellowIdRef.current = yellow.id;
    const redBall = eng.addMarble({ pos: { x: w * 0.5, y: h * 0.3 }, vel: { x: 0, y: 0 }, radius: r, color: '#cc2200', friction: BILLIARDS_BALL_FRICTION });
    redBallIdRef.current = redBall.id;
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
          const yellow = eng.marbles.find((m) => m.id === yellowIdRef.current);
          const redBall = eng.marbles.find((m) => m.id === redBallIdRef.current);
          const cueId = playerIdRef.current;
          const cue = eng.marbles.find((m) => m.id === playerIdRef.current);
          const c = cue?.wallHitCount ?? 0;
          if (c !== cushionCountRef.current) {
            cushionCountRef.current = c;
            setCushionCount(c);
          }
          if (yellow && !yellowHitRef.current && yellow.lastHitById === cueId && Math.hypot(yellow.vel.x, yellow.vel.y) > SETTLE_SPEED_THRESHOLD) {
            yellowHitRef.current = true;
            if (cushionAtFirstHitRef.current === -1) cushionAtFirstHitRef.current = c;
            else if (cushionAtSecondHitRef.current === -1) cushionAtSecondHitRef.current = c;
            setBallsHit((prev) => prev + 1);
          }
          if (redBall && !redBallHitRef.current && redBall.lastHitById === cueId && Math.hypot(redBall.vel.x, redBall.vel.y) > SETTLE_SPEED_THRESHOLD) {
            redBallHitRef.current = true;
            if (cushionAtFirstHitRef.current === -1) cushionAtFirstHitRef.current = c;
            else if (cushionAtSecondHitRef.current === -1) cushionAtSecondHitRef.current = c;
            setBallsHit((prev) => prev + 1);
          }
          const allSlow = eng.marbles.every((m) => Math.hypot(m.vel.x, m.vel.y) <= SETTLE_SPEED_THRESHOLD);
          if (!allSlow) {
            settledCounterRef.current = 0;
          } else {
            settledCounterRef.current++;
            if (settledCounterRef.current >= BILLIARDS_SETTLE_FRAMES) {
              const bothHit = yellowHitRef.current && redBallHitRef.current;
              const c1 = cushionAtFirstHitRef.current;
              const c2 = cushionAtSecondHitRef.current;
              const option1 = bothHit && c1 >= 0 && c2 >= 0 && (c2 - c1 >= 3);
              const option2 = bothHit && c1 >= 3;
              if (option1 || option2) setScore((s) => s + 1);
              if (cue) cue.wallHitCount = 0;
              yellowHitRef.current = false;
              redBallHitRef.current = false;
              cushionCountRef.current = 0;
              cushionAtFirstHitRef.current = -1;
              cushionAtSecondHitRef.current = -1;
              setCushionCount(0);
              setBallsHit(0);
              shotActiveRef.current = false;
              settledCounterRef.current = 0;
              setBilliardReady(true);
            }
          }
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
    const boardHeight = newH - 120;
    if (!engineRef.current) {
      const eng = new PhysicsEngine(newW, boardHeight);
      eng.restitution = ENGINE_DEFAULT_RESTITUTION;
      eng.onCollision = () => {
        const sound = hitSoundRef.current;
        if (sound) sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
      };
      setupBilliards(eng);
      engineRef.current = eng;
      setScore(0);
      setMarbles([...eng.marbles]);
      return;
    }
    const engRef = engineRef.current;
    if (engRef) { engRef.width = newW; engRef.height = boardHeight; }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const eng = engineRef.current;
        const player = eng && playerIdRef.current != null ? eng.marbles.find((m) => m.id === playerIdRef.current) : null;
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
        const aim = aimingRef.current;
        const eng = engineRef.current;
        if (!aim || !eng || playerIdRef.current == null) { aimingRef.current = null; return; }
        const sx = aim.startX, sy = aim.startY;
        const ex = aim.x || sx, ey = aim.y || sy;
        const player = eng.marbles.find((m) => m.id === playerIdRef.current) || null;
        if (!player) { aimingRef.current = null; return; }
        const px = player.pos.x, py = player.pos.y;
        const dx = ex - px, dy = ey - py;
        const mag = Math.hypot(dx, dy) || 1;
        const vel = { x: (dx / mag) * BILLIARDS_LAUNCH_SPEED * powerRef.current, y: (dy / mag) * BILLIARDS_LAUNCH_SPEED * powerRef.current };
        shotActiveRef.current = true;
        setBilliardReady(false);
        eng.launchMarble(playerIdRef.current, vel);
        aimingRef.current = null;
      },
    })
  ).current;

  const renderMarbles = () =>
    marbles.map((m) => {
      if (m.captured) return null;
      const isCueBall = m.id === playerIdRef.current;
      const isRedBall = m.id === redBallIdRef.current;
      const isYellow = m.id === yellowIdRef.current;
      const dotColor = isRedBall ? '#ffffff' : (isCueBall || isYellow) ? '#cc2200' : null;
      return (
        <React.Fragment key={m.id}>
          <Ellipse cx={m.pos.x} cy={m.pos.y + m.radius * 0.6} rx={m.radius * 1.15} ry={m.radius * 0.5} fill="#000" opacity={0.12} />
          <Circle
            cx={m.pos.x}
            cy={m.pos.y}
            r={m.radius}
            fill={m.color || '#66c'}
            stroke={isCueBall ? '#999' : 'none'}
            strokeWidth={isCueBall ? 1.5 : 0}
          />
          {dotColor && <Circle cx={m.pos.x} cy={m.pos.y} r={3} fill={dotColor} />}
        </React.Fragment>
      );
    });

  const renderTrajectory = () => {
    const aim = aimingRef.current;
    const eng = engineRef.current;
    if (!aim || !eng || playerIdRef.current == null) return null;
    const dx = (aim.x || aim.startX) - aim.startX;
    const dy = (aim.y || aim.startY) - aim.startY;
    const mag = Math.hypot(dx, dy) || 1;
    const pts: number[] = [];
    const player = eng.marbles.find((m) => m.id === playerIdRef.current);
    let px = player ? player.pos.x : aim.startX;
    let py = player ? player.pos.y : aim.startY;
    let vx = (dx / mag) * BILLIARDS_LAUNCH_SPEED * powerRef.current;
    let vy = (dy / mag) * BILLIARDS_LAUNCH_SPEED * powerRef.current;
    const r = player ? player.radius : 0;
    const fr = player?.friction ?? eng.friction;
    const e = eng.restitution;
    const dt = 1 / 60;
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
    const cue = eng.marbles.find((m) => m.id === playerIdRef.current);
    const yellow = eng.marbles.find((m) => m.id === yellowIdRef.current);
    const redBall = eng.marbles.find((m) => m.id === redBallIdRef.current);
    if (cue) { cue.pos = { x: w * 0.56, y: h * 0.72 }; cue.vel = { x: 0, y: 0 }; cue.wallHitCount = 0; }
    if (yellow) { yellow.pos = { x: w * 0.44, y: h * 0.72 }; yellow.vel = { x: 0, y: 0 }; }
    if (redBall) { redBall.pos = { x: w * 0.5, y: h * 0.3 }; redBall.vel = { x: 0, y: 0 }; }
    yellowHitRef.current = false;
    redBallHitRef.current = false;
    cushionCountRef.current = 0;
    cushionAtFirstHitRef.current = -1;
    cushionAtSecondHitRef.current = -1;
    setCushionCount(0);
    setBallsHit(0);
    shotActiveRef.current = false;
    settledCounterRef.current = 0;
    setScore(0);
    setBilliardReady(true);
    setMarbles([...eng.marbles]);
  };

  const boardH = size.h - 120;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.hudRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.restartBtn} onPress={restart}>
          <Text style={styles.restartText}>Restart</Text>
        </TouchableOpacity>
        <Text style={[styles.statusText, billiardReady ? styles.readyText : styles.shotText]}>
          {billiardReady ? 'Ready!' : 'Shot…'}
        </Text>
      </View>
      <View style={styles.billiardHud}>
        <Text style={styles.billiardScore}>Score: {score}</Text>
        <Text style={styles.billiardStat}>Cushions: {cushionCount}/3</Text>
        <Text style={styles.billiardStat}>Balls hit: {ballsHit}/2</Text>
      </View>
      <View style={styles.arenaWrap} {...pan.panHandlers}>
        <Svg width={size.w} height={boardH}>
          <Rect x={0} y={0} width={size.w} height={boardH} fill="#2d7a3e" />
          <Rect x={6} y={6} width={size.w - 12} height={boardH - 12} fill="none" stroke="#1a4a28" strokeWidth={10} />
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
  hudRow: { width: '95%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  statusText: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  readyText: { color: '#2cc47a' },
  shotText: { color: '#f4a020' },
  restartBtn: { width: 72, height: 36, backgroundColor: '#e44', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  restartText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backBtn: { width: 36, height: 36, backgroundColor: '#666', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  billiardHud: { flexDirection: 'row', gap: 16, paddingBottom: 4, alignItems: 'center' },
  billiardScore: { fontSize: 16, fontWeight: '700', color: '#222' },
  billiardStat: { fontSize: 14, fontWeight: '600', color: '#333' },
});
