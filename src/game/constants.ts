// Default player power exposed in the UI
export const DEFAULT_PLAYER_POWER = 4.5;

// Physics engine defaults
export const ENGINE_DEFAULT_RESTITUTION = 0.8;

// Settling thresholds
export const SETTLE_SPEED_THRESHOLD = 0.5;
export const SETTLE_FRAMES = 30;

// 3-Cushion billiards ball friction (lower = more deceleration)
export const BILLIARDS_BALL_FRICTION = 0.991;
// Billiards cue launch speed — effective speed = BILLIARDS_LAUNCH_SPEED * DEFAULT_PLAYER_POWER
// 150 * 4.5 = 675, enough to reach all cushions without being uncontrollably fast
export const BILLIARDS_LAUNCH_SPEED = 205;
// Frames of all-balls-slow before declaring "Ready" in billiards (~0.2s at 60fps)
export const BILLIARDS_SETTLE_FRAMES = 10;
// Billiards ball radius in pixels 14, 15, 16
export const BILLIARDS_BALL_RADIUS = 15;

// 4-Ball billiards (사구) — separate tuning
export const FOURBALL_BALL_FRICTION = 0.987;
export const FOURBALL_LAUNCH_SPEED = 205;
export const FOURBALL_SETTLE_FRAMES = 10;
export const FOURBALL_BALL_RADIUS = 15;
export const FOURBALL_WIN_SCORE = 20;

// Pile marble (triangle rack) settings
export const PILE_MARBLE_RADIUS = 12;
export const PILE_MARBLE_FRICTION = 0.9999;

// ── Shot technique spin constants ───────────────────────────────────────────
// How much spin (topspin/backspin) shifts the cue ball's post-collision speed.
// 0 = no effect, 1 = full transfer at launch speed ratio
export const SPIN_TRANSFER_FACTOR = 0.45;
// How much side-spin (English) deflects the ball off a cushion.
// Applied as a fraction of the normal speed component.
export const ENGLISH_FACTOR = 0.32;
// Per-frame spin decay multiplier (spin dissipates as ball rolls).
export const SPIN_DECAY = 0.975;
// Fraction of spin remaining after a marble-marble collision.
export const SPIN_COLLISION_RETAIN = 0.25;
// Fraction of sideSpin remaining after a cushion bounce.
export const SIDE_SPIN_CUSHION_RETAIN = 0.6;
