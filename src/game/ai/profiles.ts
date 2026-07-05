import type { AiLevel, AiProfile } from './types';

export const AI_PROFILES: Record<AiLevel, AiProfile> = {
  beginner: {
    thinkDelayMs: [1000, 1800],
    aimSpreadRad: 0.42,
    powerJitter: 0.2,
    powerMistakeChance: 0.32,
    ruleAwareness: 0.15,
    foulAvoidance: 0.08,
    useSpin: false,
    safetyBias: 0,
    topK: 14,
    badShotChance: 0.45,
    preferScoringOnly: false,
  },
  intermediate: {
    thinkDelayMs: [700, 1300],
    aimSpreadRad: 0.14,
    powerJitter: 0.08,
    powerMistakeChance: 0.1,
    ruleAwareness: 0.65,
    foulAvoidance: 0.6,
    useSpin: true,
    safetyBias: 0.1,
    topK: 4,
    badShotChance: 0.12,
    preferScoringOnly: true,
  },
  advanced: {
    thinkDelayMs: [500, 900],
    aimSpreadRad: 0.05,
    powerJitter: 0.03,
    powerMistakeChance: 0.03,
    ruleAwareness: 0.92,
    foulAvoidance: 0.9,
    useSpin: true,
    safetyBias: 0.22,
    topK: 2,
    badShotChance: 0.03,
    preferScoringOnly: true,
  },
  expert: {
    thinkDelayMs: [350, 650],
    aimSpreadRad: 0.015,
    powerJitter: 0.008,
    powerMistakeChance: 0,
    ruleAwareness: 1,
    foulAvoidance: 0.98,
    useSpin: true,
    safetyBias: 0.35,
    topK: 1,
    badShotChance: 0,
    preferScoringOnly: true,
  },
};

export const AI_LEVELS: AiLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

export function getAiProfile(level: AiLevel): AiProfile {
  return AI_PROFILES[level];
}

export function randomThinkDelayMs(profile: AiProfile): number {
  const [min, max] = profile.thinkDelayMs;
  return min + Math.random() * (max - min);
}
