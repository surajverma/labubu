import type { DailyState } from '../save/schema';
import { ECONOMY, streakReward } from './economy';
import { dayKey, daysBetween, isoWeek } from './time';

/** Allowed backwards clock drift before we call it a clock change (NTP adjustments etc.). */
const CLOCK_TOLERANCE_MS = 10 * 60 * 1000;

export type DailyStatus =
  | {
      kind: 'claimable';
      streak: number;
      reward: { boxes: number; premium: number; coins: number };
      freeze: boolean;
    }
  | { kind: 'claimed' }
  | { kind: 'clock' };

/** What would happen if the player claimed now (pure; does not change state). */
export function dailyStatus(s: DailyState, now: number): DailyStatus {
  // Clock guard: time moved backwards (or to a day before the last claim) → nothing extra.
  if (now < s.maxSeenTime - CLOCK_TOLERANCE_MS) return { kind: 'clock' };
  const today = dayKey(now);
  if (s.lastClaimDay && today <= s.lastClaimDay) return { kind: 'claimed' };
  let streak = 1;
  let freeze = false;
  if (s.lastClaimDay) {
    const gap = daysBetween(s.lastClaimDay, today);
    if (gap === 1) streak = s.streak + 1;
    else if (gap === 2 && s.freezeUsedWeek !== isoWeek(today)) {
      // One automatic streak freeze per week covers a single missed day.
      streak = s.streak + 1;
      freeze = true;
    }
  }
  const r = streakReward(streak);
  return { kind: 'claimable', streak, freeze, reward: { ...r, coins: ECONOMY.dailyLoginCoins } };
}

/** Claims the daily reward. Returns the new state and the status that was applied. */
export function claimDaily(s: DailyState, now: number): { state: DailyState; status: DailyStatus } {
  const status = dailyStatus(s, now);
  const state: DailyState = { ...s, maxSeenTime: Math.max(s.maxSeenTime, now) };
  if (status.kind !== 'claimable') return { state, status };
  const today = dayKey(now);
  state.lastClaimDay = today;
  state.lastLoginDay = today;
  state.streak = status.streak;
  if (status.freeze) state.freezeUsedWeek = isoWeek(today);
  return { state, status };
}

/** Records "now" so later backwards jumps can be detected. */
export function touchClock(s: DailyState, now: number): DailyState {
  return now > s.maxSeenTime ? { ...s, maxSeenTime: now } : s;
}

/** Next time the daily box becomes available (local midnight after the last claim). */
export function nextResetTime(now: number): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}
