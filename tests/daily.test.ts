import { describe, expect, it } from 'vitest';
import { claimDaily, dailyStatus } from '../src/game/daily';
import { defaultDaily, type DailyState } from '../src/save/schema';
import { isoWeek } from '../src/game/time';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0).getTime();

function run(days: number[][]): { s: DailyState; log: string[] } {
  let s = defaultDaily();
  const log: string[] = [];
  for (const [y, m, d, h] of days) {
    const r = claimDaily(s, at(y!, m!, d!, h ?? 12));
    s = r.state;
    log.push(
      r.status.kind === 'claimable'
        ? `${r.status.streak}${r.status.freeze ? 'f' : ''}:${r.status.reward.boxes}/${r.status.reward.premium}`
        : r.status.kind,
    );
  }
  return { s, log };
}

describe('daily boxes & streaks', () => {
  it('grants once per local day and builds a streak with day-3 and day-7 bonuses', () => {
    const { log } = run([
      [2026, 3, 2],
      [2026, 3, 2, 20],
      [2026, 3, 3],
      [2026, 3, 4],
      [2026, 3, 5],
      [2026, 3, 6],
      [2026, 3, 7],
      [2026, 3, 8],
    ]);
    expect(log).toEqual(['1:1/0', 'claimed', '2:1/0', '3:2/0', '4:1/0', '5:1/0', '6:1/0', '7:0/1']);
  });
  it('resets at local midnight', () => {
    const { log } = run([
      [2026, 3, 2, 23],
      [2026, 3, 3, 0],
    ]);
    expect(log).toEqual(['1:1/0', '2:1/0']);
  });
  it('missing a day uses the weekly freeze once, then resets', () => {
    // Mon 2 Mar, skip Tue, Wed 4 Mar (freeze), skip Thu, Fri 6 Mar (no freeze left this week → reset)
    const { log, s } = run([
      [2026, 3, 2],
      [2026, 3, 4],
      [2026, 3, 6],
    ]);
    expect(log).toEqual(['1:1/0', '2f:1/0', '1:1/0']);
    expect(s.freezeUsedWeek).toBe(isoWeek('2026-03-04'));
    // Next week the freeze is available again.
    const r2 = run([
      [2026, 3, 9],
      [2026, 3, 11],
    ]);
    expect(r2.log).toEqual(['1:1/0', '2f:1/0']);
  });
  it('missing two days resets the streak', () => {
    const { log } = run([
      [2026, 3, 2],
      [2026, 3, 3],
      [2026, 3, 6],
    ]);
    expect(log).toEqual(['1:1/0', '2:1/0', '1:1/0']);
  });
  it('clock guard: moving time backwards grants nothing', () => {
    let s = claimDaily(defaultDaily(), at(2026, 3, 10)).state;
    // Player sets the clock back a day.
    const back = dailyStatus(s, at(2026, 3, 9));
    expect(back.kind).toBe('clock');
    // Clock forward to tomorrow then back to today: the forward claim counts, the back one does not.
    s = claimDaily(s, at(2026, 3, 11)).state;
    expect(dailyStatus(s, at(2026, 3, 10, 18)).kind).toBe('clock');
    // Small NTP drift is fine.
    expect(dailyStatus(s, at(2026, 3, 11) - 60_000).kind).toBe('claimed');
  });
});
