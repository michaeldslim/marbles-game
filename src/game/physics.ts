export type Vec = { x: number; y: number };

import {
  ENGINE_DEFAULT_RESTITUTION, PILE_MARBLE_RADIUS, PILE_MARBLE_FRICTION,
  SPIN_TRANSFER_FACTOR, ENGLISH_FACTOR, SPIN_DECAY,
  SPIN_COLLISION_RETAIN, SIDE_SPIN_CUSHION_RETAIN, STOP_DRAG,
} from './constants';

export interface Marble {
  id: number;
  pos: Vec;
  vel: Vec;
  radius: number;
  color?: string;
  captured?: boolean;
  stopped?: boolean;
  // optional per-marble friction multiplier (0..1). If not set, engine.friction is used.
  friction?: number;
  // counts how many times this marble has bounced off a wall (used for 3-cushion scoring)
  wallHitCount?: number;
  // id of the last marble that directly collided with this one
  lastHitById?: number;
  // Shot technique spin values set at launch time.
  // spin:     +1 = topspin (follow/밀어치기)  0 = stop shot (스톱샷)  -1 = backspin (draw/끌어치기)
  // sideSpin: +1 = right English (오른회전)   0 = none               -1 = left English (왼회전)
  spin?: number;
  sideSpin?: number;
}

export class PhysicsEngine {
  width: number;
  height: number;
  marbles: Marble[] = [];
  nextId = 1;
  friction = 0.998;
  // coefficient of restitution (bounciness) 0..1
  restitution = ENGINE_DEFAULT_RESTITUTION;
  // spin transfer factor (draw/follow effect strength) — overridable from settings
  spinTransferFactor = SPIN_TRANSFER_FACTOR;
  // English factor (side-spin cushion deflection) — overridable from settings
  englishFactor = ENGLISH_FACTOR;
  // called whenever two marbles collide; receives the impact speed
  onCollision?: (impactSpeed: number) => void;
  // linear deceleration (px/s²) applied every step to help balls stop sooner
  stopDrag = STOP_DRAG;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  addMarble(m: Omit<Marble, 'id' | 'captured'>) {
    const marble: Marble = { id: this.nextId++, ...m, captured: false, stopped: false };
    this.marbles.push(marble);
    return marble;
  }

  launchMarble(id: number, vel: Vec) {
    const m = this.marbles.find((x) => x.id === id);
    if (m) {
      m.vel = vel;
      m.stopped = false;
    }
  }

  step(dt: number) {
    // integrate
    for (const m of this.marbles) {
      if (m.captured || m.stopped) continue;
      m.pos.x += m.vel.x * dt;
      m.pos.y += m.vel.y * dt;
      // apply per-marble friction if supplied, otherwise engine friction
      const fr = Math.min(Math.max(m.friction ?? this.friction, 0), 1);
      m.vel.x *= fr;
      m.vel.y *= fr;
      // apply linear drag to make balls stop sooner at low speeds
      const speed = Math.hypot(m.vel.x, m.vel.y);
      if (speed > 0) {
        const drag = Math.min(this.stopDrag * dt, speed);
        m.vel.x -= (m.vel.x / speed) * drag;
        m.vel.y -= (m.vel.y / speed) * drag;
      }
      // decay spin values (rolling gradually removes spin)
      if (m.spin) {
        m.spin *= SPIN_DECAY;
        if (Math.abs(m.spin) < 0.001) m.spin = 0;
      }
      if (m.sideSpin) {
        m.sideSpin *= SPIN_DECAY;
        if (Math.abs(m.sideSpin) < 0.001) m.sideSpin = 0;
      }
    }

    // wall collisions (simple reflecting)
    for (const m of this.marbles) {
      if (m.captured) continue;
      if (m.pos.x - m.radius < 0) {
        m.pos.x = m.radius;
        const prevVx = m.vel.x;
        m.vel.x *= -this.restitution;
        // English: side-spin deflects tangential (vy) component off vertical cushion
        if (m.sideSpin) {
          m.vel.y += m.sideSpin * this.englishFactor * Math.abs(prevVx);
          m.sideSpin *= SIDE_SPIN_CUSHION_RETAIN;
        }
        m.wallHitCount = (m.wallHitCount ?? 0) + 1;
      }
      if (m.pos.x + m.radius > this.width) {
        m.pos.x = this.width - m.radius;
        const prevVx = m.vel.x;
        m.vel.x *= -this.restitution;
        if (m.sideSpin) {
          m.vel.y += m.sideSpin * this.englishFactor * Math.abs(prevVx);
          m.sideSpin *= SIDE_SPIN_CUSHION_RETAIN;
        }
        m.wallHitCount = (m.wallHitCount ?? 0) + 1;
      }
      if (m.pos.y - m.radius < 0) {
        m.pos.y = m.radius;
        const prevVy = m.vel.y;
        m.vel.y *= -this.restitution;
        // English: side-spin deflects tangential (vx) component off horizontal cushion
        if (m.sideSpin) {
          m.vel.x += m.sideSpin * this.englishFactor * Math.abs(prevVy);
          m.sideSpin *= SIDE_SPIN_CUSHION_RETAIN;
        }
        m.wallHitCount = (m.wallHitCount ?? 0) + 1;
      }
      if (m.pos.y + m.radius > this.height) {
        // captured when fully out (simple rule: if touching bottom edge)
        m.pos.y = this.height - m.radius;
        const prevVy = m.vel.y;
        m.vel.y *= -this.restitution;
        if (m.sideSpin) {
          m.vel.x += m.sideSpin * this.englishFactor * Math.abs(prevVy);
          m.sideSpin *= SIDE_SPIN_CUSHION_RETAIN;
        }
        m.wallHitCount = (m.wallHitCount ?? 0) + 1;
      }
    }

    // clamp restitution to [0,1]
    const e = Math.min(Math.max(this.restitution, 0), 1);

    // circle-circle collisions
    for (let i = 0; i < this.marbles.length; i++) {
      for (let j = i + 1; j < this.marbles.length; j++) {
        const a = this.marbles[i];
        const b = this.marbles[j];
        if (a.captured || b.captured) continue;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (dist > 0 && dist < minDist) {
          // separate
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.pos.x -= nx * overlap;
          a.pos.y -= ny * overlap;
          b.pos.x += nx * overlap;
          b.pos.y += ny * overlap;

          // simple elastic collision for equal mass
          const tx = -ny;
          const ty = nx;
          const va_n = a.vel.x * nx + a.vel.y * ny;
          const vb_n = b.vel.x * nx + b.vel.y * ny;
          const va_t = a.vel.x * tx + a.vel.y * ty;
          const vb_t = b.vel.x * tx + b.vel.y * ty;
          // use coefficient of restitution for normal component (equal mass)
          const rel = va_n - vb_n;
          const J = -(1 + e) * rel / 2;
          const va_n_after = va_n + J;
          const vb_n_after = vb_n - J;
          // record direct hit source for billiards scoring
          a.lastHitById = b.id;
          b.lastHitById = a.id;
          // fire collision callback with impact speed
          if (this.onCollision) {
            const impactSpeed = Math.abs(rel);
            this.onCollision(impactSpeed);
          }
          // convert back to velocity vectors
          a.vel.x = va_n_after * nx + va_t * tx;
          a.vel.y = va_n_after * ny + va_t * ty;
          b.vel.x = vb_n_after * nx + vb_t * tx;
          b.vel.y = vb_n_after * ny + vb_t * ty;
          // Apply spin (topspin/backspin) — shifts cue ball along collision normal.
          // Positive spin → ball continues forward (follow/밀어치기).
          // Negative spin → ball reverses  (draw/끌어치기).
          // Zero spin    → ball stops      (stop shot/스톱샷, natural for head-on equal-mass collision).
          const impact = Math.abs(rel);
          if (a.spin) {
            a.vel.x += a.spin * impact * this.spinTransferFactor * nx;
            a.vel.y += a.spin * impact * this.spinTransferFactor * ny;
            a.spin *= SPIN_COLLISION_RETAIN;
          }
          if (b.spin) {
            // b's approach direction is opposite the normal
            b.vel.x += b.spin * impact * this.spinTransferFactor * (-nx);
            b.vel.y += b.spin * impact * this.spinTransferFactor * (-ny);
            b.spin *= SPIN_COLLISION_RETAIN;
          }
        }
      }
    }
  }
}

export function createTrianglePile(engine: PhysicsEngine, centerX: number, centerY: number, rows = 4) {
  const radius = PILE_MARBLE_RADIUS;
  const spacing = radius * 2 + 2;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i <= r; i++) {
      const x = centerX + (i - r / 2) * spacing;
      const y = centerY - r * (spacing * 0.87);
      // set very high per-marble friction multiplier (~no damping) for pile marbles
      // make even less damping so pile slides freely
      engine.addMarble({ pos: { x, y }, vel: { x: 0, y: 0 }, radius, color: '#6a9', friction: PILE_MARBLE_FRICTION });
    }
  }
}
