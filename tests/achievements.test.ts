import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, newAchievements } from '../src/game/achievements';
import { newSave } from '../src/save/schema';

describe('achievements', () => {
  it('has 20 unique achievements with coins', () => {
    expect(ACHIEVEMENTS.length).toBe(20);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(20);
    for (const a of ACHIEVEMENTS) expect(a.coins).toBeGreaterThan(0);
  });
  it('none are done on a new save; counters unlock them', () => {
    const s = newSave();
    expect(newAchievements(s)).toEqual([]);
    s.stats.boxesOpened = 10;
    s.stats.maxStreak = 7;
    expect(
      newAchievements(s)
        .map((a) => a.id)
        .sort(),
    ).toEqual(['first-box', 'streak-3', 'streak-7', 'ten-boxes']);
    s.achievements.push('first-box');
    expect(newAchievements(s).map((a) => a.id)).not.toContain('first-box');
  });
});
