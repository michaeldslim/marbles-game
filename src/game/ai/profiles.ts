import type { AiLevel, AiProfile } from './types';

export const AI_PROFILES: Record<AiLevel, AiProfile> = {
  beginner: {
    thinkDelayMs: [900, 1600],
    aimSpreadRad: 0.5,
    powerJitter: 0.18,
    powerMistakeChance: 0.28,
    ruleAwareness: 0.1,
    foulAvoidance: 0.05,
    useSpin: false,
    safetyBias: 0.02,
    topK: 18,
    badShotChance: 0.38,
    preferScoringOnly: false,
  },
  intermediate: {
    thinkDelayMs: [650, 1200],
    aimSpreadRad: 0.22,
    powerJitter: 0.1,
    powerMistakeChance: 0.12,
    ruleAwareness: 0.5,
    foulAvoidance: 0.5,
    useSpin: true,
    safetyBias: 0.15,
    topK: 6,
    badShotChance: 0.1,
    preferScoringOnly: false,
  },
  advanced: {
    thinkDelayMs: [500, 950],
    aimSpreadRad: 0.08,
    powerJitter: 0.04,
    powerMistakeChance: 0.04,
    ruleAwareness: 0.85,
    foulAvoidance: 0.85,
    useSpin: true,
    safetyBias: 0.3,
    topK: 2,
    badShotChance: 0.02,
    preferScoringOnly: false,
  },
  expert: {
    thinkDelayMs: [400, 750],
    aimSpreadRad: 0.02,
    powerJitter: 0.01,
    powerMistakeChance: 0,
    ruleAwareness: 1,
    foulAvoidance: 0.98,
    useSpin: true,
    safetyBias: 0.45,
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
