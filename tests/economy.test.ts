import { describe, expect, it } from 'vitest';
import { ECONOMY, recycleValue, streakReward } from '../src/game/economy';
import { drawBox } from '../src/game/series';
import { rngFromString } from '../src/rng';
import { SETS, setProgress } from '../src/game/sets';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { generateCharacter } from '../src/gen/generate';
import { newSave } from '../src/save/schema';
import type { CharacterSpec } from '../src/gen/types';

/**
 * A "normal player": opens the app every day, plays 5 orders (mixed results) and the daily
 * order, recycles duplicates and spends all coins on normal blind boxes.
 */
function simulate(days: number, seed: string) {
  const rng = rngFromString(seed);
  let coins = 0;
  let boxesTotal = 0;
  const owned = new Map<string, number>();
  const specs: CharacterSpec[] = [];
  const doneSets = new Set<string>();
  const save = newSave();
  const perDay: number[] = [];
  let oneOffCoins = 0;
  for (let day = 1; day <= days; day++) {
    let boxes = 0;
    coins += ECONOMY.dailyLoginCoins;
    const sr = streakReward(day);
    boxes += sr.boxes + sr.premium;
    const street = day <= 7 ? 0 : day <= 20 ? 1 : 2;
    for (let i = 0; i < 5; i++) {
      const r = rng();
      const stars = r < 0.2 ? 1 : r < 0.65 ? 2 : 3;
      coins += stars * ECONOMY.orders.streetMultiplier[street]!;
    }
    coins += 2 * ECONOMY.orders.dailyOrderMultiplier;
    // Open free boxes, recycle dupes, buy more with coins.
    const open = () => {
      const d = drawBox('normal', rng);
      const n = (owned.get(d.seed) ?? 0) + 1;
      owned.set(d.seed, n);
      save.stats.boxesOpened++;
      if (n > 1) {
        coins += recycleValue(d.rarity) ?? 0;
        save.stats.recycled++;
      } else specs.push(generateCharacter(d.seed, d.v));
    };
    // One-off rewards: sets + achievements (as the real hooks pay them).
    const oneOffs = () => {
      for (const set of SETS) {
        if (!doneSets.has(set.id) && setProgress(set, specs).done) {
          doneSets.add(set.id);
          save.badges.push(set.id);
          coins += set.coins;
          oneOffCoins += set.coins;
        }
      }
      save.collection = specs.map((sp, i) => ({
        uid: String(i),
        seed: sp.seed,
        v: sp.generatorVersion,
        foundAt: 0,
        favourite: false,
        count: 1,
        source: 'box' as const,
      }));
      for (const a of ACHIEVEMENTS) {
        if (!save.achievements.includes(a.id) && a.done(save)) {
          save.achievements.push(a.id);
          coins += a.coins;
          oneOffCoins += a.coins;
        }
      }
    };
    save.stats.maxStreak = day;
    save.stats.ordersPlayed += 6;
    for (let i = 0; i < boxes; i++) open();
    oneOffs();
    while (coins >= ECONOMY.shop.box) {
      coins -= ECONOMY.shop.box;
      boxes++;
      open();
    }
    perDay.push(boxes);
    boxesTotal += boxes;
  }
  return { avg: boxesTotal / days, perDay, unique: owned.size, oneOffCoins };
}

describe('economy', () => {
  it('a normal player earns about 3–5 boxes per day', () => {
    for (const seed of ['a', 'b', 'c']) {
      const r = simulate(30, seed);
      if (process.env.ECON_DEBUG)
        console.log(seed, r.avg.toFixed(2), r.oneOffCoins, r.perDay.join(','));
      expect(r.avg, JSON.stringify(r.perDay)).toBeGreaterThanOrEqual(3);
      expect(r.avg).toBeLessThanOrEqual(5);
      // Never zero boxes on a day.
      expect(Math.min(...r.perDay)).toBeGreaterThanOrEqual(2);
    }
  });
  it('recycle values match the spec', () => {
    expect(ECONOMY.recycle).toEqual({
      common: 5,
      rare: 15,
      epic: 50,
      legendary: 200,
      secret: null,
    });
    expect(ECONOMY.shop).toEqual({ box: 100, premium: 400, themed: 250 });
  });
  it('streak rewards: day 3 = 2 boxes, day 7 = premium', () => {
    expect(streakReward(1)).toEqual({ boxes: 1, premium: 0 });
    expect(streakReward(3)).toEqual({ boxes: 2, premium: 0 });
    expect(streakReward(7)).toEqual({ boxes: 0, premium: 1 });
    expect(streakReward(10)).toEqual({ boxes: 2, premium: 0 });
  });
});
