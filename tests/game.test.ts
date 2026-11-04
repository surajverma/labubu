import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { getPool } from '../src/game/series';
import { rngFromString } from '../src/rng';

function game(): Game {
  const g = new Game();
  g.flush = async () => {};
  return g;
}

describe('Game', () => {
  it('opens boxes, counts duplicates and recycles them', () => {
    const g = game();
    const common = getPool(1).byTier.common[0]!;
    g.addCharacter({ seed: common.seed, v: 1, series: 1, index: common.index }, 'box');
    g.addCharacter({ seed: common.seed, v: 1, series: 1, index: common.index }, 'box');
    expect(g.save.collection.length).toBe(1);
    expect(g.save.collection[0]!.count).toBe(2);
    expect(g.duplicatesValue()).toEqual({ coins: 5, copies: 1 });
    expect(g.recycle(g.save.collection[0]!.uid)).toBe(5);
    expect(g.save.coins).toBe(5);
    expect(g.recycle(g.save.collection[0]!.uid)).toBeNull();
  });
  it('never recycles secrets', () => {
    const g = game();
    const s = getPool(1).byTier.secret[0]!;
    g.addCharacter({ seed: s.seed, v: 1 }, 'box');
    g.addCharacter({ seed: s.seed, v: 1 }, 'box');
    expect(g.recycle(g.save.collection[0]!.uid)).toBeNull();
    expect(g.recycleAllDuplicates()).toBe(0);
  });
  it('buys and opens boxes with coins only when affordable', () => {
    const g = game();
    g.save.boxes = 0;
    expect(g.buy('normal')).toBe(false);
    g.save.coins = 450;
    expect(g.buy('normal')).toBe(true);
    expect(g.save.boxes).toBe(1);
    expect(g.buy('premium')).toBe(false);
    const r = g.openBox('normal', rngFromString('x'));
    expect(r).not.toBeNull();
    expect(g.save.boxes).toBe(0);
    expect(g.openBox('normal', rngFromString('y'))).toBeNull();
    expect(g.openBox('premium', rngFromString('z'))).toBeNull();
    g.save.premiumBoxes = 1;
    expect(g.openBox('premium', rngFromString('z'))!.spec.rarity).not.toBe('common');
    expect(g.save.premiumBoxes).toBe(0);
  });
});

describe('gifting', () => {
  it('gift removes a copy; redeeming adds it once per device', async () => {
    const a = game();
    const b = game();
    const e = getPool(1).byTier.rare[0]!;
    a.addCharacter({ seed: e.seed, v: 1 }, 'box');
    const code = (await a.gift(a.save.collection[0]!.uid))!;
    expect(a.save.collection.length).toBe(0);
    const r = await b.redeem(code);
    expect(r.ok).toBe(true);
    expect(b.save.collection[0]!.seed).toBe(e.seed);
    expect(b.save.collection[0]!.source).toBe('gift');
    const again = await b.redeem(code);
    expect(again.ok).toBe(false);
    expect(b.save.collection[0]!.count).toBe(1);
    expect((await b.redeem('GIFT-NOPE-NOPE')).ok).toBe(false);
  });
});
