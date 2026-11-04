import { describe, expect, it } from 'vitest';
import { activeSeason } from '../src/game/seasons';
import { generateCharacter } from '../src/gen/generate';
import { weeklyTheme } from '../src/game/themes';
import { drawBox } from '../src/game/series';
import { rngFromString } from '../src/rng';

describe('seasons', () => {
  it('activates on the right dates', () => {
    expect(activeSeason('2026-11-08')?.id).toBe('diwali');
    expect(activeSeason('2026-11-05')?.id).toBe('diwali');
    expect(activeSeason('2026-11-11')).toBeNull();
    expect(activeSeason('2027-03-22')?.id).toBe('holi');
    expect(activeSeason('2026-12-25')?.id).toBe('christmas');
    expect(activeSeason('2026-12-31')?.id).toBe('newyear');
    expect(activeSeason('2027-01-01')?.id).toBe('newyear');
    expect(activeSeason('2026-07-01')).toBeNull();
  });
  it('seasonal variants recolour deterministically without changing parts', () => {
    const a = generateCharacter('ABCD-EFGH', 2);
    const d = generateCharacter('ABCD-EFGH', 2, 'diwali');
    expect(d).toEqual(generateCharacter('ABCD-EFGH', 2, 'diwali'));
    expect(d.palette.seasonal).toBe('diwali');
    expect(d.tags).toContain('diwali');
    expect(d.palette.skin).not.toBe(a.palette.skin);
  });
  it('weekly theme rotates and themed boxes honour it', () => {
    const themes = new Set(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'].map((d) => weeklyTheme(d).tag));
    expect(themes.size).toBeGreaterThan(1);
    expect(weeklyTheme('2026-11-02')).toEqual(weeklyTheme('2026-11-08'));
    const rng = rngFromString('th');
    for (const t of ['space', 'ocean', 'cozy', 'nature', 'sweet', 'magic', 'snow', 'party', 'animal', 'sparkly']) {
      const dr = drawBox('themed', rng, { tag: t, seriesId: 2 });
      expect(generateCharacter(dr.seed, dr.v).tags, t).toContain(t);
    }
  });
});
