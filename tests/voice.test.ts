import { describe, expect, it } from 'vitest';
import { voiceFor } from '../src/gen/voice';
import { generateCharacter } from '../src/gen/generate';
import { randomSeed, rngFromString } from '../src/rng';

describe('natural voices', () => {
  const base = generateCharacter('ABCD-EFGH', 2);
  const plain = {
    ...base,
    body: 'bean',
    head: 'round',
    ears: 'none',
    hat: 'none',
    outfit: 'none',
    accessory: 'none',
    finish: 'glossy' as const,
    face: { ...base.face, eyes: 'dots', mouth: 'smile' },
    tags: [],
    mods: {},
  };
  it('follows the look', () => {
    expect(voiceFor(plain)).toBe('normal');
    expect(voiceFor({ ...plain, ears: 'antenna' })).toBe('robot');
    expect(voiceFor({ ...plain, finish: 'metallic' })).toBe('robot');
    expect(voiceFor({ ...plain, ears: 'bear', body: 'chonk' })).toBe('deep');
    expect(voiceFor({ ...plain, body: 'tiny', ears: 'bunny' })).toBe('funny');
  });
  it('is deterministic and gives a mix of voices', () => {
    const rng = rngFromString('voices');
    const counts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      const s = generateCharacter(randomSeed(rng), 2);
      expect(voiceFor(s)).toBe(voiceFor(generateCharacter(s.seed, 2)));
      counts[voiceFor(s)] = (counts[voiceFor(s)] ?? 0) + 1;
    }
    for (const v of ['normal', 'funny', 'robot', 'deep'])
      expect(counts[v] ?? 0, v).toBeGreaterThan(150);
  });
});
