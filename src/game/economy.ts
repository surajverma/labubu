import type { Rarity } from '../gen/types';

/**
 * Every economy number lives here. tests/economy.test.ts simulates a normal player and
 * checks they earn about 3–5 boxes per day. Coins are only ever earned in the game:
 * there are no real-money purchases.
 */
export const ECONOMY = {
  startingBoxes: 10,
  startingCoins: 0,

  /** Coins for opening the app on a new day. */
  dailyLoginCoins: 50,
  /** Free boxes per day (more on streak days, see `streakReward`). */
  dailyFreeBoxes: 1,

  shop: {
    box: 100,
    premium: 400,
    themed: 250,
  },

  /** Coins for recycling one duplicate. Secrets cannot be recycled. */
  recycle: {
    common: 5,
    rare: 15,
    epic: 50,
    legendary: 200,
    secret: null,
  } satisfies Record<Rarity, number | null>,

  orders: {
    /** Coins = stars × multiplier for the street (1-based). */
    streetMultiplier: [9, 13, 19],
    dailyOrderMultiplier: 20,
    /** Points per met requirement, and per leftover spin. */
    pointsPerRequirement: 100,
    pointsPerSpare: 15,
    /** Stars needed to unlock street 2 and 3. */
    unlockStars: [0, 20, 45],
  },
} as const;

export function recycleValue(r: Rarity): number | null {
  return ECONOMY.recycle[r];
}

/** Streak rewards: day 3 → 2 boxes, day 7 → a Premium box (then the cycle repeats). */
export function streakReward(streakDay: number): { boxes: number; premium: number } {
  const d = ((streakDay - 1) % 7) + 1;
  if (d === 7) return { boxes: 0, premium: 1 };
  if (d === 3) return { boxes: 2, premium: 0 };
  return { boxes: ECONOMY.dailyFreeBoxes, premium: 0 };
}
