import { describe, expect, it } from 'vitest';
import { SETS, setProgress } from '../src/game/sets';
import { generateCharacter } from '../src/gen/generate';
import { randomSeed, rngFromString } from '../src/rng';

describe('sets', () => {
  it('has 8 Phase 1 sets and 8 Phase 2 sets with unique ids', () => {
    expect(SETS.filter((s) => s.since === 1).length).toBe(8);
    expect(SETS.filter((s) => s.since === 2).length).toBe(8);
    expect(new Set(SETS.map((s) => s.id)).size).toBe(SETS.length);
  });
  it('progress never exceeds need and is reachable', () => {
    const rng = rngFromString('sets');
    const specs = Array.from({ length: 3000 }, () => generateCharacter(randomSeed(rng), 2));
    for (const set of SETS) {
      const p = setProgress(set, specs);
      expect(p.have).toBeLessThanOrEqual(p.need);
      expect(p.done, `${set.id} should be completable`).toBe(true);
    }
    for (const set of SETS) expect(setProgress(set, []).have).toBe(0);
  });
  it('hat collector counts distinct hats only', () => {
    const hc = SETS.find((s) => s.id === 'hat-collector')!;
    const base = generateCharacter('ABCD-EFGH', 1);
    const same = Array.from({ length: 20 }, () => ({ ...base, hat: 'crown' }));
    expect(hc.progress(same)).toBe(1);
  });
});
