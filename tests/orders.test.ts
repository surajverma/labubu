import { describe, expect, it } from 'vitest';
import { LEVELS, STREETS, levelUnlocked, streetUnlocked } from '../src/game/levels';
import {
  dailyOrder,
  meets,
  reqLabel,
  scoreRun,
  simulateGreedy,
  solve,
  specOfRun,
} from '../src/game/orders';
import { generateCharacter } from '../src/gen/generate';
import { rngFromString } from '../src/rng';

describe('orders', () => {
  it('has 30 handcrafted levels across 3 streets', () => {
    expect(LEVELS.length).toBe(30);
    expect(STREETS.length).toBe(3);
    for (const s of STREETS) expect(LEVELS.filter((l) => l.street === s.id).length).toBe(10);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(30);
  });

  it('every level is solvable (generator v1 and v2), and the solution really works', () => {
    for (const v of [1, 2]) {
      for (const o of LEVELS) {
        const sol = solve(o, v);
        expect(sol, `${o.id} v${v}`).not.toBeNull();
        const s = specOfRun({ base: 'SOLV-ER22', slots: sol!, locks: [], spinsLeft: 0 }, v);
        expect(
          o.reqs.every((r) => meets(s, r)),
          o.id,
        ).toBe(true);
      }
    }
  });

  it('daily orders are the same for everyone, solvable, and change by date', () => {
    const titles = new Set<string>();
    for (let d = 1; d <= 20; d++) {
      const day = `2026-12-${String(d).padStart(2, '0')}`;
      const a = dailyOrder(day, 2);
      expect(dailyOrder(day, 2)).toEqual(a);
      expect(solve(a, 2), day).not.toBeNull();
      titles.add(a.reqs.map(reqLabel).join('|'));
    }
    expect(titles.size).toBeGreaterThan(15);
  });

  it('scores: points per requirement, spare-spin bonus, stars, coins', () => {
    const o = LEVELS[0]!;
    const s = generateCharacter('ABCD-EFGH', 1);
    const r = scoreRun(s, o, 3);
    expect(r.total).toBe(3);
    expect(r.stars).toBe(r.met === 3 ? 3 : r.met === 2 ? 2 : r.met >= 2 ? 1 : 0);
    expect(r.coins).toBe(r.stars * o.multiplier);
    if (r.met === 3) expect(r.score).toBe(400 + 3 * 15);
  });

  it('difficulty rises from street to street', () => {
    const avg = (street: number) => {
      const ls = LEVELS.filter((l) => l.street === street);
      let three = 0;
      for (const o of ls) {
        const rng = rngFromString('diff' + o.id);
        for (let i = 0; i < 25; i++) if (simulateGreedy(o, rng, 1).stars === 3) three++;
      }
      return three / (ls.length * 25);
    };
    const [a, b, c] = [avg(1), avg(2), avg(3)];
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeGreaterThan(0.2);
  });

  it('unlocks streets by stars and levels in order', () => {
    expect(streetUnlocked({}, 1)).toBe(true);
    expect(streetUnlocked({}, 2)).toBe(false);
    expect(levelUnlocked({}, 0)).toBe(true);
    expect(levelUnlocked({}, 1)).toBe(false);
    expect(levelUnlocked({ L01: 1 }, 1)).toBe(true);
    const best = Object.fromEntries(LEVELS.slice(0, 7).map((l) => [l.id, 3]));
    expect(streetUnlocked(best, 2)).toBe(true);
  });
});
