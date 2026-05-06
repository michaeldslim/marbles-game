import React, { useEffect, useRef, useState } from 'react';
import { View, PanResponder, LayoutChangeEvent, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line, Rect, Ellipse, Polyline } from 'react-native-svg';
import { PhysicsEngine, createTrianglePile, Marble } from '../game/physics';
import { PLAYER_LAUNCH_SPEED, DEFAULT_PLAYER_POWER, ENGINE_DEFAULT_FRICTION, ENGINE_DEFAULT_RESTITUTION, PLAYER_MARBLE_RADIUS, AI_MARBLE_RADIUS, AI_BASE_SPEED, SETTLE_SPEED_THRESHOLD, SETTLE_FRAMES, TURN_MAX_WAIT_MS } from '../game/constants';

const FPS = 60;

export default function GameView(): JSX.Element {
  const [size, setSize] = useState({ w: 360, h: 640 });
  const [marbles, setMarbles] = useState<Marble[]>([]);
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [aiScore, setAiScore] = useState<number>(0);
  const [lastLaunch, setLastLaunch] = useState<{ px: number; py: number; ex: number; ey: number; vx: number; vy: number; id: number | null } | null>(null);
  const lastShooterRef = useRef<'player' | 'ai' | null>(null);
  const turnRef = useRef<'human' | 'ai' | 'idle'>('idle');
  const roundStarterRef = useRef<'human' | 'ai'>('human');
  const turnActiveRef = useRef<boolean>(false);
  const aiSnapshotRef = useRef<Set<number> | null>(null);
  const startedRef = useRef<boolean>(false);
  const [friction, setFriction] = useState<number>(ENGINE_DEFAULT_FRICTION);
  const [restitution, setRestitution] = useState<number>(ENGINE_DEFAULT_RESTITUTION);
  const [power, setPower] = useState<number>(DEFAULT_PLAYER_POWER);
  const engineRef = useRef<PhysicsEngine | null>(null);
  const playerIdRef = useRef<number | null>(null);
  const aimingRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const boundaryRadiusRef = useRef<number | null>(null);
  const boundaryCenterRef = useRef<{ x: number; y: number } | null>(null);
  const settledCounterRef = useRef<number>(0);
  const turnStartTimeRef = useRef<number | null>(null);
  const [winner, setWinner] = useState<'ai' | 'human' | null>(null);

  // start animation loop once; engine is created on first layout
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
        // detect moving marbles to know when a turn has settled (use threshold)
        const moving = eng.marbles.filter((m) => !m.captured && Math.hypot(m.vel.x, m.vel.y) > SETTLE_SPEED_THRESHOLD).length;
        // remove marbles that leave the circular boundary and award points to last shooter
        const centerX = boundaryCenterRef.current ? boundaryCenterRef.current.x : eng.width / 2;
        const centerY = boundaryCenterRef.current ? boundaryCenterRef.current.y : eng.height / 2;
        const boundaryRadius = boundaryRadiusRef.current != null ? boundaryRadiusRef.current : Math.min(eng.width, eng.height) * 0.32;
        for (let i = eng.marbles.length - 1; i >= 0; i--) {
          const m = eng.marbles[i];
          const dx = m.pos.x - centerX;
          const dy = m.pos.y - centerY;
          const dist = Math.hypot(dx, dy);
          if (dist - m.radius > boundaryRadius) {
            // do not remove the player marble here (keeps player persistent)
            if (m.color === '#f44') continue;
            // remove from engine
            eng.marbles.splice(i, 1);
            // award points to active turn's player, but ignore during initial setup
            if (startedRef.current) {
              if (turnRef.current === 'human') {
                setScore((s) => s + 1);
              } else if (turnRef.current === 'ai') {
                setAiScore((s) => s + 1);
              }
            }
          }
        }
        // if a turn is active, require several consecutive settled frames to avoid transient misses
        if (turnActiveRef.current) {
          // also allow a maximum wait so AI doesn't stall when friction is very low
          const nowMs = Date.now();
          const turnStart = turnStartTimeRef.current ?? 0;
          const maxWait = TURN_MAX_WAIT_MS; // ms
          if (moving === 0) settledCounterRef.current++; else settledCounterRef.current = 0;
          if (settledCounterRef.current >= SETTLE_FRAMES || (turnStart && nowMs - turnStart > maxWait)) {
            settledCounterRef.current = 0;
            console.log('tick: settled, turn=', turnRef.current, 'moving=', moving);
            if (turnRef.current === 'human') {
            // human turn finished -> move red marble to start and begin AI turn
              const player = eng.marbles.find((m) => m.color === '#f44');
            if (player) {
              player.pos.x = eng.width / 2;
              player.pos.y = eng.height - 80;
              player.vel.x = 0;
              player.vel.y = 0;
            }
            // prepare snapshot of marbles inside boundary for AI win check
            const insideIds = new Set<number>();
            for (const m of eng.marbles) {
              const dx = m.pos.x - centerX;
              const dy = m.pos.y - centerY;
              if (Math.hypot(dx, dy) <= boundaryRadius && m.color !== '#48f') insideIds.add(m.id);
            }
            aiSnapshotRef.current = insideIds;
            console.log('transition: human->ai, snapshot size=', insideIds.size);
            // start AI turn and shoot immediately (avoid setTimeout stalls)
            turnRef.current = 'ai';
            turnActiveRef.current = true;
            turnStartTimeRef.current = Date.now();
            console.log('transition: human->ai - starting aiShoot immediately');
            aiShoot();
            } else if (turnRef.current === 'ai') {
              // AI turn finished -> next round starter becomes AI
              roundStarterRef.current = 'ai';
              turnRef.current = 'idle';
              turnActiveRef.current = false;
              aiSnapshotRef.current = null;
            }
          }
        }
        setMarbles([...eng.marbles]);
        // AI win: if AI turn and snapshot existed but none of those ids remain inside
        if (turnRef.current === 'ai' && aiSnapshotRef.current) {
          const anyLeft = [...aiSnapshotRef.current].some((id) => eng.marbles.some((m) => m.id === id));
          if (!anyLeft && aiSnapshotRef.current.size > 0) {
            console.log('AI win detected: none left from snapshot');
            setWinner('ai');
            turnRef.current = 'idle';
            turnActiveRef.current = false;
            aiSnapshotRef.current = null;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  // apply parameter updates immediately when changed
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.friction = friction;
    eng.restitution = restitution;
  }, [friction, restitution]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const newW = Math.max(320, width);
    const newH = Math.max(480, height);
    setSize({ w: newW, h: newH });
    // create engine once when we have a layout and engine not yet created
    if (!engineRef.current) {
      const eng = new PhysicsEngine(newW, newH - 120);
      eng.friction = friction;
      eng.restitution = restitution;
      // place pile higher on the board so play area moves up (relative to engine height)
      const engHeight = eng.height;
      const pileCenterY = engHeight * 0.28;
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
      const playerY = eng.height - 120;
      const player = eng.addMarble({ pos: { x: newW / 2, y: playerY }, vel: { x: 0, y: 0 }, radius: PLAYER_MARBLE_RADIUS, color: '#f44' });
      playerIdRef.current = player.id;
      // reset scores and mark game as not started briefly to avoid scoring during setup
      setScore(0);
      setAiScore(0);
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
      engRef.height = newH - 120;
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
          const newPlayer = eng.addMarble({ pos: { x: eng.width / 2, y: eng.height - 80 }, vel: { x: 0, y: 0 }, radius: PLAYER_MARBLE_RADIUS, color: '#f44' });
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
        const vel = { x: dirx * PLAYER_LAUNCH_SPEED * power, y: diry * PLAYER_LAUNCH_SPEED * power };
        lastShooterRef.current = 'player';
        turnRef.current = 'human';
        turnStartTimeRef.current = Date.now();
        turnActiveRef.current = true;
        // debug: record and log computed launch
        console.log('launch', { playerId: playerIdRef.current, px, py, ex, ey, vel });
        setLastLaunch({ px: Math.round(px), py: Math.round(py), ex: Math.round(ex), ey: Math.round(ey), vx: Math.round(vel.x), vy: Math.round(vel.y), id: player ? player.id : playerIdRef.current });
        eng.launchMarble(playerIdRef.current, vel);
        // verify marble in engine received velocity
        const launched = eng.marbles.find((mm) => mm.id === playerIdRef.current);
        console.log('post-launch marble', launched ? { id: launched.id, vel: launched.vel, pos: launched.pos } : 'not found');
        aimingRef.current = null;
        // AI turn will start automatically when the human turn settles
      },
    })
  ).current;

  const renderMarbles = () => {
    return marbles.map((m) => {
      if (m.captured) return null;
      return (
        <React.Fragment key={m.id}>
          <Ellipse cx={m.pos.x} cy={m.pos.y + m.radius * 0.6} rx={m.radius * 1.15} ry={m.radius * 0.5} fill="#000" opacity={0.12} />
          <Circle cx={m.pos.x} cy={m.pos.y} r={m.radius} fill={m.color || '#66c'} />
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
    const initialVel = { x: dirx * LAUNCH_SPEED * power, y: diry * LAUNCH_SPEED * power };

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

  // simple AI shooter: spawn an AI marble at bottom center and shoot toward center with randomized angle
  const aiShoot = () => {
    const eng = engineRef.current;
    if (!eng) return;
    console.log('aiShoot: starting');
    const aiStart = { x: eng.width / 2, y: eng.height - 80 };
    const ai = eng.addMarble({ pos: { ...aiStart }, vel: { x: 0, y: 0 }, radius: AI_MARBLE_RADIUS, color: '#48f' });
    // aim roughly toward center with small random offset
    const center = { x: eng.width / 2, y: eng.height / 2 };
    const dx = center.x - aiStart.x + (Math.random() - 0.5) * 80;
    const dy = center.y - aiStart.y + (Math.random() - 0.5) * 80;
    const mag = Math.hypot(dx, dy) || 1;
    const dirx = dx / mag;
    const diry = dy / mag;
    const vel = { x: dirx * AI_BASE_SPEED * DEFAULT_PLAYER_POWER, y: diry * AI_BASE_SPEED * DEFAULT_PLAYER_POWER };
    lastShooterRef.current = 'ai';
    eng.launchMarble(ai.id, vel);
    // debug
    const la = eng.marbles.find((mm) => mm.id === ai.id);
    console.log('ai launch', la ? { id: la.id, vel: la.vel, pos: la.pos } : 'not found');
    // AI turn remains active; tick will detect when it settles and transition
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.hudRow}>
        <Text style={styles.hud}>Tap-drag to aim and release to shoot</Text>
        <View style={styles.scoreBox}>
          <Text style={styles.score}>Player: {score}</Text>
          <Text style={styles.score}>AI: {aiScore}</Text>
          <Text style={styles.score}>Lives: {lives}</Text>
          <Text style={styles.score}>Turn: {turnRef.current}</Text>
          <Text style={styles.score}>Starter: {roundStarterRef.current}</Text>
          {winner ? <Text style={[styles.score, { fontWeight: '700' }]}>Winner: {winner}</Text> : null}
          {
            (() => {
              const eng = engineRef.current;
              if (!eng) return null;
              const p = eng.marbles.find((m) => m.id === playerIdRef.current) || eng.marbles.find((m) => m.color === '#f44');
              if (!p) return null;
              return <Text style={styles.score}>P@{Math.round(p.pos.x)},{Math.round(p.pos.y)}</Text>;
            })()
          }
          {lastLaunch ? (
            <Text style={styles.score}>L:{lastLaunch.vx},{lastLaunch.vy}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.controls}>
        <View style={styles.controlItem}>
          <Text>Friction</Text>
          <View style={styles.ctrlRow}>
            <TouchableOpacity onPress={() => setFriction((v) => Math.max(0, +(v - 0.001).toFixed(3)))} style={styles.btn}><Text>-</Text></TouchableOpacity>
            <TextInput style={styles.input} value={String(friction)} onChangeText={(t) => setFriction(Math.min(1, Math.max(0, parseFloat(t) || 0)))} keyboardType="numeric" />
            <TouchableOpacity onPress={() => setFriction((v) => Math.min(1, +(v + 0.001).toFixed(3)))} style={styles.btn}><Text>+</Text></TouchableOpacity>
          </View>
        </View>
        <View style={styles.controlItem}>
          <Text>Restitution</Text>
          <View style={styles.ctrlRow}>
            <TouchableOpacity onPress={() => setRestitution((v) => Math.max(0, +(v - 0.05).toFixed(2)))} style={styles.btn}><Text>-</Text></TouchableOpacity>
            <TextInput style={styles.input} value={String(restitution)} onChangeText={(t) => setRestitution(Math.min(1, Math.max(0, parseFloat(t) || 0)))} keyboardType="numeric" />
            <TouchableOpacity onPress={() => setRestitution((v) => Math.min(1, +(v + 0.05).toFixed(2)))} style={styles.btn}><Text>+</Text></TouchableOpacity>
          </View>
        </View>
        <View style={styles.controlItem}>
          <Text>Power</Text>
          <View style={styles.ctrlRow}>
            <TouchableOpacity onPress={() => setPower((v) => Math.max(0, +(v - 0.1).toFixed(1)))} style={styles.btn}><Text>-</Text></TouchableOpacity>
            <TextInput style={styles.input} value={String(power)} onChangeText={(t) => setPower(parseFloat(t) || 0)} keyboardType="numeric" />
            <TouchableOpacity onPress={() => setPower((v) => +(v + 0.1).toFixed(1))} style={styles.btn}><Text>+</Text></TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.arenaWrap} {...pan.panHandlers}>
        <Svg width={size.w} height={size.h - 120}>
          <Rect x={0} y={0} width={size.w} height={size.h - 120} fill="#fff6e6" />
            {/* visible play boundary (circle) */}
            {
              (() => {
                const bw = size.w;
                const bh = size.h - 120;
                const cx = boundaryCenterRef.current ? boundaryCenterRef.current.x : bw / 2;
                const cy = boundaryCenterRef.current ? boundaryCenterRef.current.y : bh / 2;
                const r = boundaryRadiusRef.current != null ? boundaryRadiusRef.current : Math.min(bw, bh) * 0.32;
                return <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a9df4" strokeWidth={6} />;
              })()
            }
          {renderMarbles()}
          {aimLine()}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 20 },
  hud: { marginBottom: 8, fontSize: 14 },
  arenaWrap: { width: '100%', alignItems: 'center' },
  controlItem: { marginBottom: 0, width: '32%' },
  controls: { width: '95%', padding: 6, marginBottom: 8, backgroundColor: '#fff', borderRadius: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', height: 92 },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  btn: { padding: 6, backgroundColor: '#eee', borderRadius: 4, marginHorizontal: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 6, minWidth: 48, textAlign: 'center' },
  label: { fontSize: 12 },
  hudRow: { width: '95%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreBox: { flexDirection: 'row' },
  score: { fontSize: 14, marginLeft: 12 },
});
