import type { Rarity } from './types';

/** Stated odds (shown on the Odds screen and verified by tests). */
export const RARITY_ODDS: Record<Rarity, number> = {
  common: 0.6,
  rare: 0.28,
  epic: 0.1,
  legendary: 0.018,
  secret: 0.002,
};

export const SECRET_CHANCE = RARITY_ODDS.secret;

export const RARITY_INFO: Record<Rarity, { label: string; color: string; icon: string; rank: number }> = {
  common: { label: 'Common', color: '#9aa0ad', icon: '●', rank: 0 },
  rare: { label: 'Rare', color: '#3f8cff', icon: '◆', rank: 1 },
  epic: { label: 'Epic', color: '#a259ff', icon: '★', rank: 2 },
  legendary: { label: 'Legendary', color: '#f2b311', icon: '♛', rank: 3 },
  secret: { label: 'Secret', color: 'rainbow', icon: '✦', rank: 4 },
};

/**
 * Score thresholds per generator version: [rareMin, epicMin, legendaryMin].
 * Score = total surprisal (−ln p) of every pick, so rarer parts → higher score.
 * Calibrated by `scripts/calibrate-rarity.ts` on 400k seeds; never change for an existing
 * version (it would change the rarity of existing seeds).
 */
export const TIER_THRESHOLDS: Record<number, [number, number, number]> = {
  1: [27.2205, 28.7687, 30.2934],
  2: [32.4394, 34.3491, 36.2824],
};

export function tierForScore(score: number, version: number): Exclude<Rarity, 'secret'> {
  const t = TIER_THRESHOLDS[version] ?? TIER_THRESHOLDS[1]!;
  if (score >= t[2]) return 'legendary';
  if (score >= t[1]) return 'epic';
  if (score >= t[0]) return 'rare';
  return 'common';
}

export function rarityRank(r: Rarity): number {
  return RARITY_INFO[r].rank;
}
