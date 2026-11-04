import { SAVE_VERSION, newSave, defaultSettings, defaultDaily, defaultStats, type SaveData } from './schema';

/**
 * Migrations from saveVersion N to N+1. Each takes the raw object of version N and returns
 * version N+1. Never edit an existing migration once released; add a new one.
 */
type Raw = Record<string, unknown> & { saveVersion?: number };
export const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  // 0 → 1: pre-release saves without a version (only used by early dev builds).
  0: (s) => ({ ...newSave(), ...s, saveVersion: 1 }),
  // 1 → 2 (Phase 2): coins, premium boxes, daily streaks, orders, achievements.
  1: (s) => ({
    ...s,
    saveVersion: 2,
    coins: 0,
    premiumBoxes: 0,
    daily: defaultDaily(),
    orders: { best: {}, daily: {}, tutorialDone: false },
    achievements: [],
    redeemedGifts: [],
    stats: { ...defaultStats(), ...(s.stats as object) },
  }),
};

export class SaveTooNewError extends Error {}

/** Brings any older save up to the current version and fills missing fields. */
export function migrate(input: unknown): SaveData {
  if (!input || typeof input !== 'object') throw new Error('Save is not an object');
  let s = { ...(input as Raw) };
  let v = typeof s.saveVersion === 'number' ? s.saveVersion : 0;
  if (v > SAVE_VERSION) throw new SaveTooNewError(`Save version ${v} is newer than this app (${SAVE_VERSION})`);
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from save version ${v}`);
    s = m(s);
    v = s.saveVersion as number;
  }
  // Defensive fill of any missing fields (forward-compatible defaults).
  const base = newSave(typeof s.createdAt === 'number' ? s.createdAt : Date.now());
  const out = { ...base, ...s } as SaveData;
  out.settings = { ...defaultSettings(), ...(s.settings as object) };
  out.stats = { ...base.stats, ...(s.stats as object) };
  if (!Array.isArray(out.collection)) out.collection = [];
  if (!Array.isArray(out.badges)) out.badges = [];
  if (!Array.isArray(out.seen)) out.seen = [];
  out.daily = { ...defaultDaily(), ...(s.daily as object) };
  out.orders = { ...base.orders, ...(s.orders as object) };
  if (!Array.isArray(out.achievements)) out.achievements = [];
  if (!Array.isArray(out.redeemedGifts)) out.redeemedGifts = [];
  return out;
}
