import React, { useEffect, useRef, useState } from 'react';
import { View, PanResponder, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Circle, Line, Rect, Ellipse } from 'react-native-svg';
import { Audio } from 'expo-av';
import { PhysicsEngine, createTrianglePile, Marble } from '../game/physics';
import {
  PLAYER_LAUNCH_SPEED, DEFAULT_PLAYER_POWER, ENGINE_DEFAULT_RESTITUTION,
  PLAYER_MARBLE_RADIUS, PLAYER_MARBLE_FRICTION, SETTLE_SPEED_THRESHOLD,
  SETTLE_FRAMES, TELEPORT_DELAY_MS,
} from '../game/constants';

interface Props {
  onBack: () => void;
}

export default function MarblesView({ onBack }: Props): JSX.Element {
  const [size, setSize] = useState({ w: 360, h: 640 });
  const [marbles, setMarbles] = useState<Marble[]>([]);
  const [score, setScore] = useState<number>(0);
  const startedRef = useRef<boolean>(false);
  const shotActiveRef = useRef<boolean>(false);
  const [restitution, setRestitution] = useState<number>(ENGINE_DEFAULT_RESTITUTION);
  const [power, setPower] = useState<number>(DEFAULT_PLAYER_POWER);
  const powerRef = useRef<number>(DEFAULT_PLAYER_POWER);
  const restitutionRef = useRef<number>(ENGINE_DEFAULT_RESTITUTION);
  const engineRef = useRef<PhysicsEngine | null>(null);
  const playerIdRef = useRef<number | null>(null);
  const aimingRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const boundaryRadiusRef = useRef<number | null>(null);
  const boundaryCenterRef = useRef<{ x: number; y: number } | null>(null);
  const settledCounterRef = useRef<number>(0);
  const hitSoundRef = useRef<Audio.Sound | null>(null);

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
        const playerMarble = eng.marbles.find((m) => m.id === playerIdRef.current);
        const playerMoving = playerMarble && Math.hypot(playerMarble.vel.x, playerMarble.vel.y) > SETTLE_SPEED_THRESHOLD;
        const centerX = boundaryCenterRef.current ? boundaryCenterRef.current.x : eng.width / 2;
        const centerY = boundaryCenterRef.current ? boundaryCenterRef.current.y : eng.height / 2;
        const boundaryRadius = boundaryRadiusRef.current != null ? boundaryRadiusRef.current : Math.min(eng.width, eng.height) * 0.32;
        for (let i = eng.marbles.length - 1; i >= 0; i--) {
          const m = eng.marbles[i];
          const dx = m.pos.x - centerX;
          const dy = m.pos.y - centerY;
          const outside = Math.abs(dx) - m.radius > boundaryRadius || Math.abs(dy) - m.radius > boundaryRadius;
          if (outside) {
            if (m.color === '#f44') continue;
            eng.marbles.splice(i, 1);
            if (startedRef.current) setScore((s) => s + 1);
          }
        }
        if (startedRef.current) {
          const pileMarbles = eng.marbles.filter((m) => m.color !== '#f44');
          if (pileMarbles.length === 0) {
            startedRef.current = false;
            shotActiveRef.current = false;
            settledCounterRef.current = 0;
            setTimeout(() => restart(), 800);
          }
        }
        if (shotActiveRef.current) {
          if (!playerMoving) settledCounterRef.current++; else settledCounterRef.current = 0;
          if (settledCounterRef.current === SETTLE_FRAMES) {
            settledCounterRef.current = 0;
            shotActiveRef.current = false;
            const eng2 = eng;
            setTimeout(() => {
              const player = eng2.marbles.find((m) => m.id === playerIdRef.current);
              if (player) {
                player.pos.x = eng2.width / 2;
                player.pos.y = eng2.height - 60;
                player.vel.x = 0;
                player.vel.y = 0;
                player.stopped = false;
              }
            }, TELEPORT_DELAY_MS);
          }
        }
        setMarbles([...eng.marbles]);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => { if (rafId != null) cancelAnimationFrame(rafId); };
  }, []);

  useEffect(() => {
    restitutionRef.current = restitution;
    const eng = engineRef.current;
    if (!eng) return;
    eng.restitution = restitution;
  }, [restitution]);

  useEffect(() => { powerRef.current = power; }, [power]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const newW = Math.max(320, width);
    const newH = Math.max(480, height);
    setSize({ w: newW, h: newH });
    const boardHeight = newH - 200;
    if (!engineRef.current) {
      const eng = new PhysicsEngine(newW, boardHeight);
      eng.restitution = restitution;
      eng.onCollision = () => {
        const sound = hitSoundRef.current;
        if (sound) sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
      };
      const pileCenterY = eng.height * 0.28 + 40;
      createTrianglePile(eng, newW / 2, pileCenterY, 5);
      let cx = 0, cy = 0, count = 0;
      for (const m of eng.marbles) { cx += m.pos.x; cy += m.pos.y; count++; }
      if (count > 0) { cx /= count; cy /= count; } else { cx = eng.width / 2; cy = pileCenterY; }
      let maxDist = 0;
      for (const m of eng.marbles) {
        const d = Math.hypot(m.pos.x - cx, m.pos.y - cy) + m.radius;
        if (d > maxDist) maxDist = d;
      }
      const maxAllowed = Math.min(eng.width, eng.height) * 0.4;
      boundaryRadiusRef.current = Math.min(maxDist + 12, maxAllowed);
      boundaryCenterRef.current = { x: cx, y: cy };
      const player = eng.addMarble({ pos: { x: newW / 2, y: eng.height - 60 }, vel: { x: 0, y: 0 }, radius: PLAYER_MARBLE_RADIUS, color: '#f44', friction: PLAYER_MARBLE_FRICTION });
      playerIdRef.current = player.id;
      setScore(0);
      startedRef.current = false;
      setTimeout(() => (startedRef.current = true), 500);
      engineRef.current = eng;
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
        let player = eng.marbles.find((m) => m.color === '#f44') || null;
        if (!player && playerIdRef.current != null) player = eng.marbles.find((m) => m.id === playerIdRef.current) || null;
        if (player) playerIdRef.current = player.id;
        if (!player) {
          const newPlayer = eng.addMarble({ pos: { x: eng.width / 2, y: eng.height - 60 }, vel: { x: 0, y: 0 }, radius: PLAYER_MARBLE_RADIUS, color: '#f44', friction: PLAYER_MARBLE_FRICTION });
          playerIdRef.current = newPlayer.id;
          player = newPlayer;
        }
        const px = player.pos.x, py = player.pos.y;
        const dx = ex - px, dy = ey - py;
        const mag = Math.hypot(dx, dy) || 1;
        const vel = { x: (dx / mag) * PLAYER_LAUNCH_SPEED * powerRef.current, y: (dy / mag) * PLAYER_LAUNCH_SPEED * powerRef.current };
        shotActiveRef.current = true;
        eng.launchMarble(playerIdRef.current, vel);
        aimingRef.current = null;
      },
    })
  ).current;

  const renderMarbles = () =>
    marbles.map((m) => {
      if (m.captured) return null;
      return (
        <React.Fragment key={m.id}>
          <Ellipse cx={m.pos.x} cy={m.pos.y + m.radius * 0.6} rx={m.radius * 1.15} ry={m.radius * 0.5} fill="#000" opacity={0.12} />
          <Circle cx={m.pos.x} cy={m.pos.y} r={m.radius} fill={m.color || '#66c'} />
        </React.Fragment>
      );
    });

  const aimLine = () => {
    const aim = aimingRef.current;
    if (!aim) return null;
    return <Line x1={aim.startX} y1={aim.startY} x2={aim.x || aim.startX} y2={aim.y || aim.startY} stroke="#000" strokeWidth={2} strokeOpacity={0.5} />;
  };

  const restart = () => {
    const existingEng = engineRef.current;
    const w = existingEng ? existingEng.width : size.w;
    const engH = existingEng ? existingEng.height : size.h - 200;
    boundaryRadiusRef.current = null;
    boundaryCenterRef.current = null;
    settledCounterRef.current = 0;
    startedRef.current = false;
    shotActiveRef.current = false;
    setScore(0);
    const eng = new PhysicsEngine(w, engH);
    eng.restitution = restitution;
    eng.onCollision = () => {
      const sound = hitSoundRef.current;
      if (sound) sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
    };
    const pileCenterY = eng.height * 0.28 + 40;
    createTrianglePile(eng, w / 2, pileCenterY, 5);
    let cx = 0, cy = 0, count = 0;
    for (const m of eng.marbles) { cx += m.pos.x; cy += m.pos.y; count++; }
    if (count > 0) { cx /= count; cy /= count; } else { cx = w / 2; cy = pileCenterY; }
    let maxDist = 0;
    for (const m of eng.marbles) {
      const d = Math.hypot(m.pos.x - cx, m.pos.y - cy) + m.radius;
      if (d > maxDist) maxDist = d;
    }
    boundaryRadiusRef.current = Math.min(maxDist + 12, Math.min(w, eng.height) * 0.4);
    boundaryCenterRef.current = { x: cx, y: cy };
    const player = eng.addMarble({ pos: { x: w / 2, y: eng.height - 60 }, vel: { x: 0, y: 0 }, radius: PLAYER_MARBLE_RADIUS, color: '#f44', friction: PLAYER_MARBLE_FRICTION });
    playerIdRef.current = player.id;
    engineRef.current = eng;
    setTimeout(() => (startedRef.current = true), 500);
    setMarbles([...eng.marbles]);
  };

  const boardH = size.h - 200;
  const bw = size.w;
  const cx = boundaryCenterRef.current ? boundaryCenterRef.current.x : bw / 2;
  const cy2 = boundaryCenterRef.current ? boundaryCenterRef.current.y : boardH / 2;
  const r = boundaryRadiusRef.current != null ? boundaryRadiusRef.current : Math.min(bw, boardH) * 0.32;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.hudRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.restartBtn} onPress={restart}>
          <Text style={styles.restartText}>Restart</Text>
        </TouchableOpacity>
        <View style={styles.scoreBox}>
          <Text style={styles.score}>Score: {score}</Text>
        </View>
      </View>
      <View style={styles.controls}>
        <View style={styles.controlItem}>
          <Text>Restitution</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={restitution}
            minimumTrackTintColor="#2a9df4"
            maximumTrackTintColor="#ddd"
            onValueChange={(v: number) => setRestitution(parseFloat(v.toFixed(2)))}
          />
        </View>
        <View style={styles.controlItem}>
          <Text>Power</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={10}
            step={0.1}
            value={power}
            minimumTrackTintColor="#2a9df4"
            maximumTrackTintColor="#ddd"
            onValueChange={(v: number) => setPower(parseFloat(v.toFixed(1)))}
          />
        </View>
      </View>
      <View style={styles.arenaWrap} {...pan.panHandlers}>
        <Svg width={bw} height={boardH}>
          <Rect x={0} y={0} width={bw} height={boardH} fill="#fff6e6" />
          <Rect x={cx - r} y={cy2 - r} width={r * 2} height={r * 2} fill="none" stroke="#2a9df4" strokeWidth={6} />
          {renderMarbles()}
          {aimLine()}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 2 },
  arenaWrap: { width: '100%', alignItems: 'center' },
  controlItem: { width: '100%', marginBottom: 6 },
  controls: { width: '95%', padding: 8, marginBottom: 8, backgroundColor: '#fff', borderRadius: 6, flexDirection: 'column', alignItems: 'stretch' },
  hudRow: { width: '95%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 10 },
  scoreBox: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  score: { fontSize: 14, marginLeft: 12 },
  restartBtn: { width: 72, height: 36, backgroundColor: '#e44', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  restartText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backBtn: { width: 36, height: 36, backgroundColor: '#666', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  slider: { width: '100%', height: 40, minWidth: 200 },
});
