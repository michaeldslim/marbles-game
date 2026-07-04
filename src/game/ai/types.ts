export type AiLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface Pt {
  x: number;
  y: number;
}

export interface AiProfile {
  thinkDelayMs: [number, number];
  aimSpreadRad: number;
  powerJitter: number;
  /** Chance to apply a large wrong-power error (too soft / too hard). */
  powerMistakeChance: number;
  ruleAwareness: number;
  foulAvoidance: number;
  useSpin: boolean;
  safetyBias: number;
  /** Pick randomly among the top K scored candidates (1 = always best). */
  topK: number;
  /** Chance to deliberately pick a low-ranked candidate. */
  badShotChance: number;
  /** When true, prefer scoring candidates; fallback only if none exist. */
  preferScoringOnly: boolean;
}

export interface ShotPlan {
  dx: number;
  dy: number;
  spin: number;
  sideSpin: number;
  power: number;
}

export interface MarblePos {
  pos: Pt;
  radius: number;
}

export interface BilliardsAiInput {
  cue: MarblePos;
  red: MarblePos;
  white: MarblePos;
  tableW: number;
  tableH: number;
  isBreak: boolean;
}

export interface FourBallAiInput {
  cue: MarblePos;
  red1: MarblePos;
  red2: MarblePos;
  opponentCue: MarblePos;
  tableW: number;
  tableH: number;
}
