import { describe, expect, it } from 'vitest';
import { generateCharacter, randomFace, LATEST_GENERATOR_VERSION } from '../src/gen/generate';
import { PARTS, partsFor } from '../src/gen/parts';
import { RARITY_ODDS } from '../src/gen/rarity';
import { applyRules, CROWN_HATS, TOP_EARS } from '../src/gen/rules';
import { randomSeed, rngFromString } from '../src/rng';
import { LAYERS, RARITIES, type CharacterSpec, type Rarity } from '../src/gen/types';
import { createHash } from 'node:crypto';

const seeds = (n: number, key = 't') => {
  const r = rngFromString(key);
  return Array.from({ length: n }, () => randomSeed(r));
};

describe('generateCharacter', () => {
  it('is deterministic', () => {
    for (const s of seeds(200)) {
      expect(generateCharacter(s, 1)).toEqual(generateCharacter(s, 1));
      expect(generateCharacter(s, 2)).toEqual(generateCharacter(s, 2));
    }
  });

  it('never changes what existing v1 seeds produce (golden snapshot)', () => {
    const h = createHash('sha256');
    for (const s of seeds(500, 'golden')) h.update(JSON.stringify(generateCharacter(s, 1)));
    // If this fails you changed generator v1 output. Revert, or put the change behind a new version.
    expect(h.digest('hex').slice(0, 16)).toMatchInlineSnapshot(`"4acb7c548e076736"`);
  });

  it('only uses parts available in its version', () => {
    for (const s of seeds(2000)) {
      const c = generateCharacter(s, 1);
      for (const [layer, id] of [
        ['body', c.body], ['head', c.head], ['ears', c.ears], ['hat', c.hat], ['outfit', c.outfit],
        ['accessory', c.accessory], ['scene', c.scene], ['eyes', c.face.eyes], ['mouth', c.face.mouth],
      ] as const) {
        const p = PARTS[layer].find((x) => x.id === id)!;
        expect(p, `${layer}:${id}`).toBeTruthy();
        expect(p.since).toBe(1);
      }
      if (c.rarity !== 'secret') expect(c.finish === 'glossy' || c.finish === 'matte').toBe(true);
    }
  });

  it('has the Phase 1 part counts from the spec', () => {
    const want: Record<string, number> = { body: 6, head: 5, ears: 12, eyes: 20, brows: 8, mouth: 18, nose: 6, cheeks: 6, hat: 14, outfit: 14, accessory: 10, scene: 10 };
    for (const l of LAYERS) expect(partsFor(l, 1, false).length, l).toBe(want[l]);
    const want2: Record<string, number> = { body: 8, head: 7, ears: 18, eyes: 30, brows: 12, mouth: 26, nose: 8, cheeks: 10, hat: 22, outfit: 22, accessory: 18, scene: 16 };
    for (const l of LAYERS) expect(partsFor(l, 2, false).length, l).toBe(want2[l]);
  });

  it('matches the stated rarity odds over 100,000 seeds', () => {
    for (const v of [1, 2]) {
      const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0, secret: 0 };
      const N = 100000;
      for (const s of seeds(N, 'odds' + v)) counts[generateCharacter(s, v).rarity]++;
      for (const r of RARITIES) {
        const got = counts[r] / N;
        const want = RARITY_ODDS[r];
        // 4 standard deviations of a binomial proportion, plus a little slack.
        const tol = 4 * Math.sqrt((want * (1 - want)) / N) + want * 0.03;
        expect(Math.abs(got - want), `v${v} ${r}: got ${got}, want ${want}`).toBeLessThan(tol);
      }
    }
  });

  it('gives secret characters exclusive parts', () => {
    let found = 0;
    for (const s of seeds(20000, 'sec')) {
      const c = generateCharacter(s, 1);
      if (c.rarity !== 'secret') {
        expect(c.finish).not.toBe('galaxy');
        expect(c.mods.halo).toBeFalsy();
        expect(c.face.eyes).not.toBe('glow');
        continue;
      }
      found++;
      const n = Number(c.finish === 'galaxy') + Number(!!c.mods.glowEyes) + Number(!!c.mods.halo);
      expect(n).toBeGreaterThanOrEqual(2);
    }
    expect(found).toBeGreaterThan(10);
  });

  it('produces names and tags', () => {
    for (const s of seeds(300)) {
      const c = generateCharacter(s);
      expect(c.name.length).toBeGreaterThan(2);
      expect(c.tags.length).toBeGreaterThan(0);
      expect(c.generatorVersion).toBe(LATEST_GENERATOR_VERSION);
    }
  });

  it('randomFace is deterministic and valid', () => {
    expect(randomFace('abc')).toEqual(randomFace('abc'));
    const f = randomFace('xyz', 1);
    expect(PARTS.eyes.some((p) => p.id === f.eyes)).toBe(true);
  });
});

describe('compatibility rules', () => {
  const base = () => generateCharacter('ABCD-EFGH', 1);
  it('helmet replaces the hat and hides ears', () => {
    const s = { ...base(), outfit: 'astronaut', hat: 'crown', mods: {} as CharacterSpec['mods'] };
    applyRules(s);
    expect(s.hat).toBe('none');
    expect(s.mods.hideEars).toBe(true);
  });
  it('hood hides ears', () => {
    const s = { ...base(), hat: 'hood', outfit: 'none', mods: {} as CharacterSpec['mods'] };
    applyRules(s);
    expect(s.mods.hideEars).toBe(true);
  });
  it('tall ears + hat get shortened', () => {
    const s = { ...base(), ears: 'bunny', hat: 'tophat', outfit: 'none', mods: {} as CharacterSpec['mods'] };
    expect(applyRules(s)).toContain('short-ears-under-hat');
    expect(s.mods.shortEars).toBe(true);
  });
  it('top ears never poke through crown hats in generated characters', () => {
    for (const sd of seeds(5000, 'rules')) {
      const c = generateCharacter(sd, 2);
      if (TOP_EARS.has(c.ears) && CROWN_HATS.has(c.hat)) expect(c.mods.hideEars).toBe(true);
      if (c.outfit === 'astronaut' || c.outfit === 'diver') expect(c.hat).toBe('none');
      if (c.face.eyes === 'cyclops') expect(c.accessory).not.toBe('glasses');
    }
  });
});

import { encodeMix, parseMix } from '../src/gen/generate';
describe('mix variants (order results)', () => {
  it('takes chosen layers from other seeds, deterministically', () => {
    const base = 'ABCD-EFGH';
    const hatFrom = 'ZZZZ-2222';
    const faceFrom = 'K7Q2-MX9A';
    const v = encodeMix({ H: hatFrom, F: faceFrom })!;
    expect(parseMix(v)).toEqual({ H: hatFrom, F: faceFrom });
    const m = generateCharacter(base, 1, v);
    expect(m).toEqual(generateCharacter(base, 1, v));
    const b = generateCharacter(base, 1);
    const h = generateCharacter(hatFrom, 1);
    const f = generateCharacter(faceFrom, 1);
    expect(m.body).toBe(b.body);
    expect(m.scene).toBe(b.scene);
    expect(m.face.mouth).toBe(f.face.mouth);
    // Hat may be removed by a rule (helmet), otherwise it comes from the hat seed.
    if (m.outfit !== 'astronaut' && m.outfit !== 'diver') expect(m.hat).toBe(h.hat);
    expect(m.rarity).not.toBe('secret');
  });
});
