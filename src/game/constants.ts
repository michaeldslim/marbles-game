// Default player power exposed in the UI
export const DEFAULT_PLAYER_POWER = 5.5;

// Default power meter oscillation speed (cycles per second)
export const DEFAULT_CHARGE_CYCLES_PER_SEC = 0.8;

// Physics engine defaults
export const ENGINE_DEFAULT_RESTITUTION = 0.8;

// Settling thresholds
export const SETTLE_SPEED_THRESHOLD = 0.5;
export const SETTLE_FRAMES = 30;

// 3-Cushion billiards ball friction — per-second decay factor (0..1).
// Physics applies Math.pow(friction, dt) per step so value is sub-step-safe.
export const BILLIARDS_BALL_FRICTION = 0.73;

// Billiards cue launch speed — effective speed = BILLIARDS_LAUNCH_SPEED * DEFAULT_PLAYER_POWER
export const BILLIARDS_LAUNCH_SPEED = 230;

// Frames of all-balls-slow before declaring "Ready" in billiards (~0.2s at 60fps)
export const BILLIARDS_SETTLE_FRAMES = 10;

// 4-Ball billiards (사구) — separate tuning
export const FOURBALL_BALL_FRICTION = 0.73;
export const FOURBALL_LAUNCH_SPEED = 230;
export const FOURBALL_SETTLE_FRAMES = 10;

// Pile marble (triangle rack) settings
export const PILE_MARBLE_RADIUS = 12;
// Per-second decay factor; equivalent old per-frame value at 60 fps: ~0.9999.
export const PILE_MARBLE_FRICTION = 0.994;

// ── Shot technique spin constants ───────────────────────────────────────────
// How much spin (topspin/backspin) shifts the cue ball's post-collision speed.
// 0 = no effect, 1 = full transfer at launch speed ratio
export const SPIN_TRANSFER_FACTOR = 0.5;

// How much side-spin (English) deflects the ball off a cushion.
// Applied as a fraction of the normal speed component.
export const ENGLISH_FACTOR = 0.4;

// Per-second spin decay factor (sub-step safe).
export const SPIN_DECAY = 0.219;

// Fraction of spin remaining after a marble-marble collision.
export const SPIN_COLLISION_RETAIN = 0.25;

// Fraction of sideSpin remaining after a cushion bounce.
export const SIDE_SPIN_CUSHION_RETAIN = 0.6;

// Linear deceleration (px/s²) applied at all speeds to make balls stop sooner.
// At high speeds this is negligible vs multiplicative friction; at low speeds it dominates.
export const STOP_DRAG = 7;

// default length of the trajectory preview line in pixels
export const TRAJECTORY_LENGTH = 60;

// Win score defaults
export const DEFAULT_WIN_SCORE_3C = 11;
export const DEFAULT_WIN_SCORE_4B = 10;

// Default UI language
export const DEFAULT_LANGUAGE = 'ko' as const;

// UI / Audio defaults
export const DEFAULT_BM_VOLUME = 0.2;
export const DEFAULT_BM_ENABLED = false;

// Internal version number for settings structure, used for migration when loading old settings
export const DEFAULT_SETTINGS_VERSION = 2;
