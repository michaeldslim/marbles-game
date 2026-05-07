// Player launch speed multiplier (multiplied by `power` to get initial speed)
export const PLAYER_LAUNCH_SPEED = 180;
// Default player power exposed in the UI
export const DEFAULT_PLAYER_POWER = 4.5;

// Physics engine defaults
export const ENGINE_DEFAULT_RESTITUTION = 0.8;

// Pile marble tuning
export const PILE_MARBLE_FRICTION = 0.97;
export const PLAYER_MARBLE_FRICTION = 0.97;
export const PILE_MARBLE_RADIUS = 14;

// Player marble size
export const PLAYER_MARBLE_RADIUS = 14;

// Settling thresholds
export const SETTLE_SPEED_THRESHOLD = 0.5;
export const SETTLE_FRAMES = 30;
export const TELEPORT_DELAY_MS = 700;

// 3-Cushion billiards ball friction (lower = more deceleration)
export const BILLIARDS_BALL_FRICTION = 0.991;
// Billiards cue launch speed — effective speed = BILLIARDS_LAUNCH_SPEED * DEFAULT_PLAYER_POWER
// 150 * 4.5 = 675, enough to reach all cushions without being uncontrollably fast
export const BILLIARDS_LAUNCH_SPEED = 205;
// Frames of all-balls-slow before declaring "Ready" in billiards (~0.2s at 60fps)
export const BILLIARDS_SETTLE_FRAMES = 10;
// Billiards ball radius in pixels 14, 15, 16
export const BILLIARDS_BALL_RADIUS = 16;

// 4-Ball billiards (사구) — separate tuning
export const FOURBALL_BALL_FRICTION = 0.987;
export const FOURBALL_LAUNCH_SPEED = 205;
export const FOURBALL_SETTLE_FRAMES = 10;
export const FOURBALL_BALL_RADIUS = 14;
