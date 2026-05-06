// Player launch speed multiplier (multiplied by `power` to get initial speed)
export const PLAYER_LAUNCH_SPEED = 4.5; // px/s per power unit
// Default player power exposed in the UI
export const DEFAULT_PLAYER_POWER = 4.5;

// Physics engine defaults
export const ENGINE_DEFAULT_FRICTION = 0.998; // global damping applied each step
export const ENGINE_DEFAULT_RESTITUTION = 0.8; // bounciness 0..1

// Pile marble tuning
export const PILE_MARBLE_FRICTION = 0.97555; // per-marble friction for pile pieces
export const PILE_MARBLE_RADIUS = 14; // visual / collision radius for pile marbles

// Player / AI marble sizes (kept consistent)
export const PLAYER_MARBLE_RADIUS = 14; // player marble radius
export const AI_MARBLE_RADIUS = 14; // AI marble radius

// AI behavior tuning
export const AI_BASE_SPEED = 180; // base speed used when computing AI shot velocity

// Turn/settling thresholds
export const SETTLE_SPEED_THRESHOLD = 3; // px/s considered 'moving' vs settled
export const SETTLE_FRAMES = 3; // consecutive frames required to consider settled
export const TURN_MAX_WAIT_MS = 1600; // ms before forcing a turn transition

