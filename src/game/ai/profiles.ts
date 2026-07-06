import type { AiLevel, AiProfile } from './types';

export const AI_PROFILES: Record<AiLevel, AiProfile> = {
  beginner: {
    thinkDelayMs: [900, 1600],
    aimSpreadRad: 0.38,
    powerJitter: 0.22,
    powerMistakeChance: 0.38,
    ruleAwareness: 0.12,
    foulAvoidance: 0.05,
    useSpin: false,
    safetyBias: 0,
    topK: 12,
    badShotChance: 0.5,
    preferScoringOnly: false,
  },
  intermediate: {
    thinkDelayMs: [650, 1200],
    aimSpreadRad: 0.14,
    powerJitter: 0.08,
    powerMistakeChance: 0.12,
    ruleAwareness: 0.6,
    foulAvoidance: 0.45,
    useSpin: true,
    safetyBias: 0.08,
    topK: 5,
    badShotChance: 0.15,
    preferScoringOnly: true,
  },
  advanced: {
    thinkDelayMs: [480, 850],
    aimSpreadRad: 0.06,
    powerJitter: 0.03,
    powerMistakeChance: 0.04,
    ruleAwareness: 0.88,
    foulAvoidance: 0.82,
    useSpin: true,
    safetyBias: 0.2,
    topK: 2,
    badShotChance: 0.05,
    preferScoringOnly: true,
  },
  expert: {
    thinkDelayMs: [350, 600],
    aimSpreadRad: 0.02,
    powerJitter: 0.006,
    powerMistakeChance: 0,
    ruleAwareness: 1,
    foulAvoidance: 0.95,
    useSpin: true,
    safetyBias: 0.3,
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
