import type { AiProfile } from './types';

/** Sort by score desc, then pick from top-K or deliberately bad tail. */
export function pickRankedCandidate<T>(
  items: T[],
  scoreFn: (item: T) => number,
  profile: AiProfile,
  options?: {
    /** Keep only items matching this filter when preferScoringOnly and any match. */
    scoringFilter?: (item: T) => boolean;
  },
): T {
  if (items.length === 0) {
    throw new Error('pickRankedCandidate: empty list');
  }

  let pool = items;
  if (profile.preferScoringOnly && options?.scoringFilter) {
    const scoring = items.filter(options.scoringFilter);
    if (scoring.length > 0) pool = scoring;
  }

  const sorted = [...pool].sort((a, b) => scoreFn(b) - scoreFn(a));

  if (profile.badShotChance > 0 && Math.random() < profile.badShotChance) {
    const bottomStart = Math.max(1, Math.floor(sorted.length * 0.45));
    const idx = bottomStart + Math.floor(Math.random() * (sorted.length - bottomStart));
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  const k = Math.max(1, Math.min(profile.topK, sorted.length));
  const idx = Math.floor(Math.random() * k);
  return sorted[idx];
}

export function applyPowerMistake(power: number, profile: AiProfile): number {
  if (profile.powerMistakeChance <= 0 || Math.random() >= profile.powerMistakeChance) {
    return power;
  }
  const factor = Math.random() < 0.5 ? 0.52 : 1.38;
  return Math.max(0.3, Math.min(1, power * factor));
}
