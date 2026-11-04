/**
 * Seeded randomness and seed codes.
 *
 * Seed codes are 8 base32 characters shown as `XXXX-XXXX`. The alphabet drops
 * look-alike characters (0, 1, I, O), so codes are easy to read aloud and type.
 */

export const SEED_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const SEED_LENGTH = 8;

export type Rng = () => number;

/** 32-bit string hash (cyrb-style) producing four independent state words. */
export function hashString(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** sfc32 PRNG: fast, good quality, 128-bit state. Returns floats in [0, 1). */
export function sfc32(a: number, b: number, c: number, d: number): Rng {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Deterministic RNG from any string key. Warms up a few rounds. */
export function rngFromString(key: string): Rng {
  const [a, b, c, d] = hashString(key);
  const r = sfc32(a, b, c, d);
  for (let i = 0; i < 12; i++) r();
  return r;
}

export function randInt(rng: Rng, minIncl: number, maxIncl: number): number {
  return minIncl + Math.floor(rng() * (maxIncl - minIncl + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick from empty array');
  return arr[Math.floor(rng() * arr.length)]!;
}

/** Weighted pick; weights must be >= 0 with a positive sum. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (t: T) => number): T {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) throw new Error('pickWeighted: no positive weights');
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r < 0) return it;
  }
  return items[items.length - 1]!;
}

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Random seed code (`XXXX-XXXX`) from a given RNG (default: crypto/Math.random). */
export function randomSeed(rng?: Rng): string {
  let s = '';
  for (let i = 0; i < SEED_LENGTH; i++) {
    let v: number;
    if (rng) v = Math.floor(rng() * 32);
    else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      v = crypto.getRandomValues(new Uint8Array(1))[0]! & 31;
    } else v = Math.floor(Math.random() * 32);
    s += SEED_ALPHABET[v];
  }
  return formatSeed(s);
}

export function formatSeed(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

/**
 * Normalises user input: ignores case, spaces and dashes, and reads I/1 as L.
 * Returns the formatted code, or null if invalid (0 and O are never valid).
 */
export function normalizeSeed(input: string): string | null {
  const s = input
    .toUpperCase()
    .replace(/[\s_-]/g, '')
    .replace(/[I1]/g, 'L');
  if (s.length !== SEED_LENGTH) return null;
  for (const ch of s) if (!SEED_ALPHABET.includes(ch)) return null;
  return formatSeed(s);
}

export function isValidSeed(seed: string): boolean {
  return normalizeSeed(seed) === seed;
}
