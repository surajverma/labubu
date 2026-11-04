import type { SaveData } from '../save/schema';
import { rarityRank } from '../gen/rarity';
import { specFor } from './game';
import { streetUnlocked } from './levels';

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  coins: number;
  done(s: SaveData): boolean;
  /** Optional progress [have, need] for the profile screen. */
  progress?(s: SaveData): [number, number];
}

const maxRank = (s: SaveData) => s.collection.reduce((m, c) => Math.max(m, rarityRank(specFor(c).rarity)), -1);
const count = (id: string, name: string, icon: string, description: string, coins: number, need: number, get: (s: SaveData) => number): AchievementDef => ({
  id,
  name,
  icon,
  description,
  coins,
  done: (s) => get(s) >= need,
  progress: (s) => [Math.min(need, get(s)), need],
});

export const ACHIEVEMENTS: AchievementDef[] = [
  count('first-box', 'First Box', '🎁', 'Open your first blind box', 50, 1, (s) => s.stats.boxesOpened),
  count('ten-boxes', 'Box Fan', '📦', 'Open 10 blind boxes', 100, 10, (s) => s.stats.boxesOpened),
  count('fifty-boxes', 'Box Collector', '🏬', 'Open 50 blind boxes', 250, 50, (s) => s.stats.boxesOpened),
  { id: 'first-rare', name: 'Ooh, Rare!', icon: '◆', description: 'Find a Rare buddy (or better)', coins: 50, done: (s) => maxRank(s) >= 1 },
  { id: 'first-epic', name: 'Epic Find', icon: '★', description: 'Find an Epic buddy (or better)', coins: 100, done: (s) => maxRank(s) >= 2 },
  { id: 'first-legendary', name: 'Legend', icon: '♛', description: 'Find a Legendary buddy', coins: 250, done: (s) => maxRank(s) >= 3 },
  { id: 'first-secret', name: 'Shh… Secret!', icon: '✦', description: 'Find a Secret buddy', coins: 500, done: (s) => maxRank(s) >= 4 },
  count('streak-3', 'Three in a Row', '🔥', 'Reach a 3-day streak', 50, 3, (s) => s.stats.maxStreak),
  count('streak-7', 'Week Streak', '📅', 'Reach a 7-day streak', 150, 7, (s) => s.stats.maxStreak),
  count('streak-30', 'Super Loyal', '🏅', 'Reach a 30-day streak', 400, 30, (s) => s.stats.maxStreak),
  count('set-1', 'Set Starter', '🧩', 'Complete a set', 100, 1, (s) => s.badges.length),
  count('sets-3', 'Set Builder', '🗂️', 'Complete 3 sets', 200, 3, (s) => s.badges.length),
  count('sets-8', 'Set Master', '🏆', 'Complete 8 sets', 400, 8, (s) => s.badges.length),
  count('order-1', 'First Order', '🍽️', 'Serve your first order', 50, 1, (s) => s.stats.ordersPlayed),
  count('orders-50', 'Busy Shop', '🧾', 'Serve 50 orders', 300, 50, (s) => s.stats.ordersPlayed),
  count('perfect-10', 'Perfectionist', '🌟', 'Get 3 stars on 10 orders', 200, 10, (s) => s.stats.ordersThreeStar),
  { id: 'street-2', name: 'Maple Lane', icon: '🍁', description: 'Unlock the second street', coins: 100, done: (s) => streetUnlocked(s.orders.best, 2) },
  { id: 'street-3', name: 'Starlight Avenue', icon: '🌠', description: 'Unlock the third street', coins: 200, done: (s) => streetUnlocked(s.orders.best, 3) },
  count('recycler', 'Recycler', '♻️', 'Recycle 10 duplicates', 100, 10, (s) => s.stats.recycled),
  count('collector-100', 'Big Book', '📚', 'Collect 100 different buddies', 300, 100, (s) => s.collection.length),
];

/** Returns achievements that are newly completed (not yet in the save). */
export function newAchievements(s: SaveData): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !s.achievements.includes(a.id) && a.done(s));
}
