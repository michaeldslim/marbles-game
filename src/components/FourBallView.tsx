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
import Svg, { Circle, Rect, Ellipse, Polyline } from 'react-native-svg';
import { Audio } from 'expo-av';
import { PhysicsEngine, Marble } from '../game/physics';
import {
  FOURBALL_LAUNCH_SPEED, DEFAULT_PLAYER_POWER, ENGINE_DEFAULT_RESTITUTION,
  FOURBALL_BALL_RADIUS, FOURBALL_BALL_FRICTION, SETTLE_SPEED_THRESHOLD,
  FOURBALL_SETTLE_FRAMES, FOURBALL_WIN_SCORE
} from '../game/constants';

interface Props {
  onBack: () => void;
}

export default function FourBallView({ onBack }: Props): JSX.Element {
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
    const white = eng.addMarble({ pos: { x: w * 0.5, y: h * 0.18 }, vel: { x: 0, y: 0 }, radius: FOURBALL_BALL_RADIUS, color: '#f0f0f0', friction: FOURBALL_BALL_FRICTION });
    playerIdRef.current = white.id;
    // Red 1 — just below white
    const red1 = eng.addMarble({ pos: { x: w * 0.5, y: h * 0.34 }, vel: { x: 0, y: 0 }, radius: FOURBALL_BALL_RADIUS, color: '#cc2200', friction: FOURBALL_BALL_FRICTION });
    red1IdRef.current = red1.id;
    // Red 2 — lower left
    const red2 = eng.addMarble({ pos: { x: w * 0.42, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: FOURBALL_BALL_RADIUS, color: '#cc2200', friction: FOURBALL_BALL_FRICTION });
    red2IdRef.current = red2.id;
    // Yellow — lower right
    const yellow = eng.addMarble({ pos: { x: w * 0.58, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: FOURBALL_BALL_RADIUS, color: '#f4c430', friction: FOURBALL_BALL_FRICTION });
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
              }
              setReady(true);
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
    const boardHeight = newH - 140;
    if (!engineRef.current) {
      const eng = new PhysicsEngine(newW, boardHeight);
      eng.restitution = ENGINE_DEFAULT_RESTITUTION;
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
        const aim = aimingRef.current;
        const eng = engineRef.current;
        if (!aim || !eng || !ready || winner) { aimingRef.current = null; return; }
        const activeCueId = turnRef.current === 'yellow' ? yellowIdRef.current : playerIdRef.current;
        if (activeCueId == null) { aimingRef.current = null; return; }
        const active = eng.marbles.find((m) => m.id === activeCueId);
        if (!active) { aimingRef.current = null; return; }
        const dx = (aim.x || aim.startX) - active.pos.x;
        const dy = (aim.y || aim.startY) - active.pos.y;
        const mag = Math.hypot(dx, dy) || 1;
        const vel = { x: (dx / mag) * FOURBALL_LAUNCH_SPEED * powerRef.current, y: (dy / mag) * FOURBALL_LAUNCH_SPEED * powerRef.current };
        shotActiveRef.current = true;
        setReady(false);
        eng.launchMarble(activeCueId, vel);
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

  const renderTrajectory = () => {
    const aim = aimingRef.current;
    const eng = engineRef.current;
    if (!aim || !eng || !ready || winner) return null;
    const activeCueId = turnRef.current === 'yellow' ? yellowIdRef.current : playerIdRef.current;
    if (activeCueId == null) return null;
    const dx = (aim.x || aim.startX) - aim.startX;
    const dy = (aim.y || aim.startY) - aim.startY;
    const mag = Math.hypot(dx, dy) || 1;
    const active = eng.marbles.find((m) => m.id === activeCueId);
    let px = active ? active.pos.x : aim.startX;
    let py = active ? active.pos.y : aim.startY;
    let vx = (dx / mag) * FOURBALL_LAUNCH_SPEED * powerRef.current;
    let vy = (dy / mag) * FOURBALL_LAUNCH_SPEED * powerRef.current;
    const r = active ? active.radius : 0;
    const fr = active?.friction ?? eng.friction;
    const e = eng.restitution;
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
    setReady(true);
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

  hudRow: { width: '95%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  turnText: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  yellowTurn: { color: '#f4c430' },
  whiteTurn: { color: '#e0e0e0' },
  shotText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#f4a020', textAlign: 'center' },

  scoreRow: { width: '95%', flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  scoreCard: {
    flex: 1, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4,
    backgroundColor: '#fff', borderRadius: 8,
    borderWidth: 2, borderColor: 'transparent',
  },
  activeCard: { borderColor: '#f4c430' },
  playerLabel: { fontSize: 12, fontWeight: '600', color: '#444', marginBottom: 2 },
  scoreNum: { fontSize: 28, fontWeight: '800', color: '#111' },

  midCol: { alignItems: 'center', minWidth: 70 },
  redsLabel: { fontSize: 11, color: '#555', fontWeight: '600' },
  redsNum: { fontSize: 22, fontWeight: '800', color: '#111' },
  resultText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  hit: { color: '#2cc47a' },
  miss: { color: '#e44' },

  winBanner: {
    width: '95%', backgroundColor: '#f4c430', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginBottom: 4, gap: 8,
  },
  winText: { fontSize: 20, fontWeight: '800', color: '#111' },
  playAgainBtn: { backgroundColor: '#111', borderRadius: 6, paddingHorizontal: 20, paddingVertical: 8 },
  playAgainText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  restartBtn: { width: 72, height: 36, backgroundColor: '#e44', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  restartText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backBtn: { width: 36, height: 36, backgroundColor: '#666', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontWeight: '700', fontSize: 18 },
});
