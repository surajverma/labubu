import { describe, expect, it } from 'vitest';
import { normalizeSeed, randomSeed, rngFromString, SEED_ALPHABET, isValidSeed } from '../src/rng';

describe('rng', () => {
  it('is deterministic for the same key', () => {
    const a = rngFromString('ABCD-EFGH');
    const b = rngFromString('ABCD-EFGH');
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('differs between keys and stays in [0,1)', () => {
    const a = rngFromString('ABCD-EFGH');
    const b = rngFromString('ABCD-EFGJ');
    let same = 0;
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      if (x === b()) same++;
    }
    expect(same).toBe(0);
  });
  it('has a 32-character alphabet without look-alikes', () => {
    expect(SEED_ALPHABET.length).toBe(32);
    expect(new Set(SEED_ALPHABET).size).toBe(32);
    for (const c of '01IO') expect(SEED_ALPHABET).not.toContain(c);
  });
  it('makes valid seeds and normalises input', () => {
    for (let i = 0; i < 50; i++) expect(isValidSeed(randomSeed())).toBe(true);
    expect(normalizeSeed('k7q2 mx9a')).toBe('K7Q2-MX9A');
    expect(normalizeSeed('abcd-efg1')).toBe('ABCD-EFGL');
    expect(normalizeSeed('ABCD-EFG0')).toBeNull();
    expect(normalizeSeed('ABC')).toBeNull();
  });
});
