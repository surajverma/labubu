import { describe, expect, it } from 'vitest';
import { decodeGift, encodeGift, randomGiftId } from '../src/game/gifts';
import { encodeMix, generateCharacter } from '../src/gen/generate';
import { SEED_ALPHABET } from '../src/rng';

const gift = (seed: string, v = 2, variant?: string) => ({
  seed,
  v,
  variant,
  rarity: generateCharacter(seed, v, variant).rarity,
  giftId: randomGiftId(),
});

describe('gift codes', () => {
  it('round-trips plain, seasonal and order (mix) characters', async () => {
    for (const g of [
      gift('K7Q2-MX9A'),
      gift('ABCD-EFGH', 1),
      gift('ZZZZ-2345', 2, 'diwali'),
      gift('ABCD-EFGH', 2, encodeMix({ H: 'K7Q2-MX9A', S: '2345-6789' })),
    ]) {
      const code = await encodeGift(g);
      expect(code).toMatch(/^GIFT-[2-9A-Z]{4}(-[2-9A-Z]{1,4})+$/);
      const r = await decodeGift(code);
      expect(r).toEqual({ ok: true, gift: g });
    }
  });
  it('accepts sloppy typing (case, spaces, no dashes)', async () => {
    const g = gift('K7Q2-MX9A');
    const code = await encodeGift(g);
    const r = await decodeGift(code.toLowerCase().replace(/-/g, ' '));
    expect(r.ok).toBe(true);
  });
  it('rejects typos and tampering', async () => {
    const g = gift('K7Q2-MX9A');
    const code = await encodeGift(g);
    let rejected = 0;
    // Change each character in turn: every single-character typo must be rejected.
    const body = code.replace(/-/g, '').slice(4);
    for (let i = 0; i < body.length; i++) {
      const c = body[i]!;
      const other = SEED_ALPHABET[(SEED_ALPHABET.indexOf(c) + 7) % 32]!;
      const typo = 'GIFT' + body.slice(0, i) + other + body.slice(i + 1);
      const r = await decodeGift(typo);
      if (!r.ok) rejected++;
    }
    expect(rejected).toBe(body.length);
    expect((await decodeGift('GIFT-HELLO')).ok).toBe(false);
    expect((await decodeGift('')).ok).toBe(false);
  });
  it('rejects a code whose rarity was changed (even with a valid MAC it would mismatch)', async () => {
    const g = gift('K7Q2-MX9A');
    const wrong = {
      ...g,
      rarity: (g.rarity === 'secret' ? 'common' : 'secret') as 'common' | 'secret',
    };
    const r = await decodeGift(await encodeGift(wrong));
    expect(r).toEqual({ ok: false, reason: 'mismatch' });
  });
});
