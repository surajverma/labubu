import { describe, expect, it } from 'vitest';
import { drawBox, getPool, quotas } from '../src/game/series';
import { generateCharacter } from '../src/gen/generate';
import { rngFromString } from '../src/rng';

describe('series pools', () => {
  it('match quotas exactly and are deterministic', () => {
    const p = getPool(1);
    const q = quotas(1000);
    expect(p.entries.length).toBe(1000);
    for (const [r, n] of Object.entries(q)) expect(p.byTier[r as keyof typeof q].length).toBe(n);
    expect(new Set(p.entries.map((e) => e.seed)).size).toBe(1000);
    for (const e of p.entries.slice(0, 50)) expect(generateCharacter(e.seed, 1).rarity).toBe(e.rarity);
    expect(p.entries[0]!.index).toBe(1);
  });
  it('premium boxes never give commons', () => {
    const rng = rngFromString('prem');
    for (let i = 0; i < 2000; i++) expect(drawBox('premium', rng).rarity).not.toBe('common');
  });
  it('themed boxes guarantee the tag', () => {
    const rng = rngFromString('theme');
    for (let i = 0; i < 500; i++) {
      const d = drawBox('themed', rng, { tag: 'space' });
      expect(generateCharacter(d.seed, d.v).tags).toContain('space');
    }
  });
  it('normal draws follow the odds', () => {
    const rng = rngFromString('odds');
    let commons = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (drawBox('normal', rng).rarity === 'common') commons++;
    expect(Math.abs(commons / N - 0.6)).toBeLessThan(0.02);
  });
});
