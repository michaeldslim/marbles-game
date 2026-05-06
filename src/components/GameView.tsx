import React, { useEffect, useRef, useState } from 'react';
import { View, PanResponder, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Circle, Line, Rect, Ellipse, Polyline } from 'react-native-svg';
import { PhysicsEngine, createTrianglePile, Marble } from '../game/physics';
import { PLAYER_LAUNCH_SPEED, DEFAULT_PLAYER_POWER, ENGINE_DEFAULT_RESTITUTION, PLAYER_MARBLE_RADIUS, PLAYER_MARBLE_FRICTION, SETTLE_SPEED_THRESHOLD, SETTLE_FRAMES, TELEPORT_DELAY_MS, BILLIARDS_BALL_FRICTION } from '../game/constants';

const FPS = 60;

interface Props {
  gameMode: 'marbles' | 'billiards';
  onBack: () => void;
}

export default function GameView({ gameMode, onBack }: Props): JSX.Element {
  const isBilliards = gameMode === 'billiards';

  const [size, setSize] = useState({ w: 360, h: 640 });
  const [marbles, setMarbles] = useState<Marble[]>([]);
  const [score, setScore] = useState<number>(0);
  const startedRef = useRef<boolean>(false);
  const shotActiveRef = useRef<boolean>(false);
  const [restitution, setRestitution] = useState<number>(ENGINE_DEFAULT_RESTITUTION);
  const [power, setPower] = useState<number>(DEFAULT_PLAYER_POWER);
  // refs so PanResponder/tick closures (created once) always read the live value
  const powerRef = useRef<number>(DEFAULT_PLAYER_POWER);
  const restitutionRef = useRef<number>(ENGINE_DEFAULT_RESTITUTION);
  const engineRef = useRef<PhysicsEngine | null>(null);
  const playerIdRef = useRef<number | null>(null);
  const aimingRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const boundaryRadiusRef = useRef<number | null>(null);
  const boundaryCenterRef = useRef<{ x: number; y: number } | null>(null);
  const settledCounterRef = useRef<number>(0);

  // Billiards-specific refs
  const yellowIdRef = useRef<number | null>(null);
  const redBallIdRef = useRef<number | null>(null);
  const yellowHitRef = useRef<boolean>(false);
  const redBallHitRef = useRef<boolean>(false);
  const cushionCountRef = useRef<number>(0);
  const [cushionCount, setCushionCount] = useState<number>(0);
  const [ballsHit, setBallsHit] = useState<number>(0);

  // main tick loop: run the physics step and rendering updates
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

        if (isBilliards) {
          // ── 3-Cushion billiards logic ──
          if (shotActiveRef.current) {
            // Track which object balls were hit (velocity spikes from stationary)
            const yellow = eng.marbles.find((m) => m.id === yellowIdRef.current);
            const redBall = eng.marbles.find((m) => m.id === redBallIdRef.current);
            if (yellow && !yellowHitRef.current && Math.hypot(yellow.vel.x, yellow.vel.y) > SETTLE_SPEED_THRESHOLD * 4) {
              yellowHitRef.current = true;
              setBallsHit((prev) => prev + 1);
            }
            if (redBall && !redBallHitRef.current && Math.hypot(redBall.vel.x, redBall.vel.y) > SETTLE_SPEED_THRESHOLD * 4) {
              redBallHitRef.current = true;
              setBallsHit((prev) => prev + 1);
            }
            // Sync live cushion count display
            const cue = eng.marbles.find((m) => m.id === playerIdRef.current);
            const c = cue?.wallHitCount ?? 0;
            if (c !== cushionCountRef.current) {
              cushionCountRef.current = c;
              setCushionCount(c);
            }
            // Settle detection: all balls slow
            const allSlow = eng.marbles.every((m) => Math.hypot(m.vel.x, m.vel.y) <= SETTLE_SPEED_THRESHOLD);
            if (!allSlow) {
              settledCounterRef.current = 0;
            } else {
              settledCounterRef.current++;
              if (settledCounterRef.current >= SETTLE_FRAMES) {
                // Check 3-cushion scoring condition
                const cushions = cue?.wallHitCount ?? 0;
                if (yellowHitRef.current && redBallHitRef.current && cushions >= 3) {
                  setScore((s) => s + 1);
                }
                // Reset for next shot
                if (cue) cue.wallHitCount = 0;
                yellowHitRef.current = false;
                redBallHitRef.current = false;
                cushionCountRef.current = 0;
                setCushionCount(0);
                setBallsHit(0);
                shotActiveRef.current = false;
                settledCounterRef.current = 0;
              }
            }
          }
        } else {
          // ── Marbles game logic ──
          const playerMarble = eng.marbles.find((m) => m.id === playerIdRef.current);
          const playerMoving = playerMarble && Math.hypot(playerMarble.vel.x, playerMarble.vel.y) > SETTLE_SPEED_THRESHOLD;
          // remove marbles that leave the square boundary and award points
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
              if (startedRef.current) {
                setScore((s) => s + 1);
              }
            }
          }
          // auto-restart if all pile marbles are gone (only after game has started)
          if (startedRef.current) {
            const pileMarbles = eng.marbles.filter((m) => m.color !== '#f44');
            if (pileMarbles.length === 0) {
              startedRef.current = false;
              shotActiveRef.current = false;
              settledCounterRef.current = 0;
              setTimeout(() => restart(), 800);
            }
          }
          // teleport player back when all marbles settle (only after a shot)
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
        }
        setMarbles([...eng.marbles]);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  // apply parameter updates immediately when changed; also keep refs in sync
  useEffect(() => {
    restitutionRef.current = restitution;
    const eng = engineRef.current;
    if (!eng) return;
    eng.restitution = restitution;
  }, [restitution]);

  useEffect(() => {
    powerRef.current = power;
  }, [power]);

  const setupBilliards = (eng: PhysicsEngine) => {
    const w = eng.width;
    const h = eng.height;
    const r = PLAYER_MARBLE_RADIUS;
    // White cue ball (player) — lower right area
    const cue = eng.addMarble({ pos: { x: w * 0.55, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: r, color: '#f0f0f0', friction: BILLIARDS_BALL_FRICTION });
    playerIdRef.current = cue.id;
    // Yellow object ball — lower left area
    const yellow = eng.addMarble({ pos: { x: w * 0.45, y: h * 0.72 }, vel: { x: 0, y: 0 }, radius: r, color: '#f4c430', friction: BILLIARDS_BALL_FRICTION });
    yellowIdRef.current = yellow.id;
    // Red object ball — upper center
    const redBall = eng.addMarble({ pos: { x: w * 0.5, y: h * 0.3 }, vel: { x: 0, y: 0 }, radius: r, color: '#cc2200', friction: BILLIARDS_BALL_FRICTION });
    redBallIdRef.current = redBall.id;
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const newW = Math.max(320, width);
    const newH = Math.max(480, height);
    setSize({ w: newW, h: newH });
    const boardHeight = isBilliards ? newH - 120 : newH - 200;
    // create engine once when we have a layout and engine not yet created
    if (!engineRef.current) {
      const eng = new PhysicsEngine(newW, boardHeight);
      eng.restitution = restitution;

      if (isBilliards) {
        setupBilliards(eng);
        engineRef.current = eng;
        setScore(0);
        startedRef.current = true;
        setMarbles([...eng.marbles]);
        return;
      }

      // Marbles setup: place pile higher on the board so play area moves up
      const engHeight = eng.height;
      const pileCenterY = engHeight * 0.28 + 40;
      createTrianglePile(eng, newW / 2, pileCenterY, 5);
      // compute tight circular boundary around pile using centroid of pile marbles
      let cx = 0;
      let cy = 0;
      let count = 0;
      for (const m of eng.marbles) {
        cx += m.pos.x;
        cy += m.pos.y;
        count++;
      }
      if (count > 0) {
        cx /= count;
        cy /= count;
      } else {
        cx = eng.width / 2;
        cy = pileCenterY;
      }
      let maxDist = 0;
      for (const m of eng.marbles) {
        const d = Math.hypot(m.pos.x - cx, m.pos.y - cy) + m.radius;
        if (d > maxDist) maxDist = d;
      }
      // keep radius tight but not larger than a reasonable fraction of the arena
      const maxAllowed = Math.min(eng.width, eng.height) * 0.4;
      boundaryRadiusRef.current = Math.min(maxDist + 12, maxAllowed);
      boundaryCenterRef.current = { x: cx, y: cy };
      const playerY = eng.height - 60;
      const player = eng.addMarble({ pos: { x: newW / 2, y: playerY }, vel: { x: 0, y: 0 }, radius: PLAYER_MARBLE_RADIUS, color: '#f44', friction: PLAYER_MARBLE_FRICTION });
      playerIdRef.current = player.id;
      // reset scores and mark game as not started briefly to avoid scoring during setup
      setScore(0);
      startedRef.current = false;
      setTimeout(() => (startedRef.current = true), 500);
      engineRef.current = eng;
      setMarbles([...eng.marbles]);
      return;
    }
    // otherwise just update engine dimensions without recreating objects
    const engRef = engineRef.current;
    if (engRef) {
      engRef.width = newW;
      engRef.height = boardHeight;
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gState) => {
          // start aiming from the player marble position so launch vector is computed from player->release
          const eng = engineRef.current;
          const player = eng && playerIdRef.current != null ? eng.marbles.find((m) => m.id === playerIdRef.current) : null;
          const sx = player ? player.pos.x : evt.nativeEvent.locationX;
          const sy = player ? player.pos.y : evt.nativeEvent.locationY;
          aimingRef.current = { startX: sx, startY: sy, x: sx, y: sy };
      },
      onPanResponderMove: (evt, gState) => {
        if (!aimingRef.current) return;
        aimingRef.current.x = evt.nativeEvent.locationX;
        aimingRef.current.y = evt.nativeEvent.locationY;
      },
      onPanResponderRelease: (evt, gState) => {
        const aim = aimingRef.current;
        const eng = engineRef.current;
        if (!aim || !eng || playerIdRef.current == null) {
          aimingRef.current = null;
          return;
        }
        const sx = aim.startX;
        const sy = aim.startY;
        const ex = aim.x || sx;
        const ey = aim.y || sy;
        // compute velocity from player position -> release point so player marble always moves
        // ensure we have a single persistent player marble: prefer finding by color
        let player = eng.marbles.find((m) => m.color === '#f44') || null;
        if (!player && playerIdRef.current != null) player = eng.marbles.find((m) => m.id === playerIdRef.current) || null;
        if (player) playerIdRef.current = player.id;
        if (!player) {
          const newPlayer = eng.addMarble({ pos: { x: eng.width / 2, y: eng.height - 60 }, vel: { x: 0, y: 0 }, radius: PLAYER_MARBLE_RADIUS, color: '#f44', friction: PLAYER_MARBLE_FRICTION });
          playerIdRef.current = newPlayer.id;
          player = newPlayer;
        }
        const px = player ? player.pos.x : sx;
        const py = player ? player.pos.y : sy;
        const dx = ex - px;
        const dy = ey - py;
        const mag = Math.hypot(dx, dy) || 1;
        const dirx = dx / mag;
        const diry = dy / mag;
        const vel = { x: dirx * PLAYER_LAUNCH_SPEED * powerRef.current, y: diry * PLAYER_LAUNCH_SPEED * powerRef.current };
        shotActiveRef.current = true;
        eng.launchMarble(playerIdRef.current, vel);
        aimingRef.current = null;
      },
    })
  ).current;

  const renderMarbles = () => {
    return marbles.map((m) => {
      if (m.captured) return null;
      const isCueBall = isBilliards && m.id === playerIdRef.current;
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
        </React.Fragment>
      );
    });
  };

  const renderTrajectory = () => {
    const aim = aimingRef.current;
    const eng = engineRef.current;
    if (!aim || !eng || playerIdRef.current == null) return null;
    const sx = aim.startX;
    const sy = aim.startY;
    const ex = aim.x || sx;
    const ey = aim.y || sy;
    const dx = ex - sx;
    const dy = ey - sy;
    const LAUNCH_SPEED = PLAYER_LAUNCH_SPEED;
    const mag = Math.hypot(dx, dy) || 1;
    const dirx = dx / mag;
    const diry = dy / mag;
    const initialVel = { x: dirx * LAUNCH_SPEED * powerRef.current, y: diry * LAUNCH_SPEED * powerRef.current };

    // simple forward simulation (no collisions with other marbles)
    const pts: number[] = [];
    const player = eng.marbles.find((m) => m.id === playerIdRef.current);
    let px = player ? player.pos.x : sx;
    let py = player ? player.pos.y : sy;
    let vx = initialVel.x;
    let vy = initialVel.y;
    const dt = 1 / 30;
    const steps = 40;
    const fr = eng.friction;
    const e = eng.restitution;
    for (let i = 0; i < steps; i++) {
      px += vx * dt;
      py += vy * dt;
      vx *= fr;
      vy *= fr;
      // simple wall reflection
      if (px < 0) {
        px = 0;
        vx *= -e;
      }
      if (px > size.w) {
        px = size.w;
        vx *= -e;
      }
      if (py < 0) {
        py = 0;
        vy *= -e;
      }
      if (py > eng.height) {
        py = eng.height;
        vy *= -e;
      }
      pts.push(px, py);
    }
    const ptsStr = pts.join(' ');
    return <Polyline points={ptsStr} fill="none" stroke="#222" strokeWidth={2} strokeOpacity={0.45} strokeDasharray={[6, 6]} />;
  };

  const aimLine = () => {
    const aim = aimingRef.current;
    if (!aim) return null;
    const sx = aim.startX;
    const sy = aim.startY;
    const ex = aim.x || sx;
    const ey = aim.y || sy;
    return <Line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#000" strokeWidth={2} strokeOpacity={0.5} />;
  };

  const restart = () => {
    if (isBilliards) {
      // Reposition balls to starting positions without recreating the engine
      const eng = engineRef.current;
      if (!eng) return;
      const w = eng.width;
      const h = eng.height;
      const cue = eng.marbles.find((m) => m.id === playerIdRef.current);
      const yellow = eng.marbles.find((m) => m.id === yellowIdRef.current);
      const redBall = eng.marbles.find((m) => m.id === redBallIdRef.current);
      if (cue) { cue.pos = { x: w * 0.55, y: h * 0.72 }; cue.vel = { x: 0, y: 0 }; cue.wallHitCount = 0; }
      if (yellow) { yellow.pos = { x: w * 0.45, y: h * 0.72 }; yellow.vel = { x: 0, y: 0 }; }
      if (redBall) { redBall.pos = { x: w * 0.5, y: h * 0.3 }; redBall.vel = { x: 0, y: 0 }; }
      yellowHitRef.current = false;
      redBallHitRef.current = false;
      cushionCountRef.current = 0;
      setCushionCount(0);
      setBallsHit(0);
      shotActiveRef.current = false;
      settledCounterRef.current = 0;
      setScore(0);
      setMarbles([...eng.marbles]);
      return;
    }
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
    const pileCenterY = eng.height * 0.28 + 40;
    createTrianglePile(eng, w / 2, pileCenterY, 5);
    let cx = 0, cy = 0, count = 0;
    for (const m of eng.marbles) { cx += m.pos.x; cy += m.pos.y; count++; }
    if (count > 0) { cx /= count; cy /= count; } else { cx = w / 2; cy = pileCenterY; }
    let maxDist = 0;
    for (const m of eng.marbles) { const d = Math.hypot(m.pos.x - cx, m.pos.y - cy) + m.radius; if (d > maxDist) maxDist = d; }
    boundaryRadiusRef.current = Math.min(maxDist + 12, Math.min(w, eng.height) * 0.4);
    boundaryCenterRef.current = { x: cx, y: cy };
    const player = eng.addMarble({ pos: { x: w / 2, y: eng.height - 60 }, vel: { x: 0, y: 0 }, radius: PLAYER_MARBLE_RADIUS, color: '#f44', friction: PLAYER_MARBLE_FRICTION });
    playerIdRef.current = player.id;
    engineRef.current = eng;
    setTimeout(() => (startedRef.current = true), 500);
    setMarbles([...eng.marbles]);
  };

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
          {!isBilliards && <Text style={styles.score}>Score: {score}</Text>}
        </View>
      </View>
      {isBilliards && (
        <View style={styles.billiardHud}>
          <Text style={styles.billiardScore}>Score: {score}</Text>
          <Text style={styles.billiardStat}>Cushions: {cushionCount}/3</Text>
          <Text style={styles.billiardStat}>Balls hit: {ballsHit}/2</Text>
        </View>
      )}
      {!isBilliards && (
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
      )}
      <View style={styles.arenaWrap} {...pan.panHandlers}>
        {(() => {
          const boardW = size.w;
          const boardH = isBilliards ? size.h - 120 : size.h - 200;
          return (
            <Svg width={boardW} height={boardH}>
              <Rect x={0} y={0} width={boardW} height={boardH} fill={isBilliards ? '#2d7a3e' : '#fff6e6'} />
              {isBilliards ? (
                <Rect x={6} y={6} width={boardW - 12} height={boardH - 12} fill="none" stroke="#1a4a28" strokeWidth={10} />
              ) : (
                (() => {
                  const bw = boardW;
                  const bh = boardH;
                  const cx = boundaryCenterRef.current ? boundaryCenterRef.current.x : bw / 2;
                  const cy = boundaryCenterRef.current ? boundaryCenterRef.current.y : bh / 2;
                  const r = boundaryRadiusRef.current != null ? boundaryRadiusRef.current : Math.min(bw, bh) * 0.32;
                  return <Rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="none" stroke="#2a9df4" strokeWidth={6} />;
                })()
              )}
              {renderMarbles()}
              {aimLine()}
            </Svg>
          );
        })()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 2 },
  hud: { marginBottom: 8, fontSize: 14 },
  arenaWrap: { width: '100%', alignItems: 'center' },
  controlItem: { width: '100%', marginBottom: 6 },
  controls: { width: '95%', padding: 8, marginBottom: 8, backgroundColor: '#fff', borderRadius: 6, flexDirection: 'column', alignItems: 'stretch' },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  btn: { padding: 6, backgroundColor: '#eee', borderRadius: 4, marginHorizontal: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 6, minWidth: 48, textAlign: 'center' },
  label: { fontSize: 12 },
  hudRow: { width: '95%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 10 },
  scoreBox: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  score: { fontSize: 14, marginLeft: 12 },
  restartBtn: { width: 72, height: 36, backgroundColor: '#e44', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  restartText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backBtn: { width: 36, height: 36, backgroundColor: '#666', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  slider: { width: '100%', height: 40, minWidth: 200 },
  sliderValue: { textAlign: 'center', marginTop: 4, width: '100%' },
  billiardHud: { flexDirection: 'row', gap: 16, paddingBottom: 4, alignItems: 'center' },
  billiardScore: { fontSize: 16, fontWeight: '700', color: '#222' },
  billiardStat: { fontSize: 14, fontWeight: '600', color: '#333' },
});
