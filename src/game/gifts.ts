import { generateCharacter, MIX_SLOTS, parseMix, encodeMix, type MixSlot } from '../gen/generate';
import { RARITIES, type Rarity } from '../gen/types';
import { SEED_ALPHABET } from '../rng';
import { SEASONAL_PALETTES } from '../gen/palette';

/**
 * Offline gift codes: GIFT-XXXX-XXXX-…
 *
 * Payload: [flags] [seed 5B] [rarity] [gift id 4B] [variant data] [HMAC-SHA256 truncated 4B]
 * The HMAC key ships inside the app, so this stops typos and casual tampering but is NOT
 * cheat-proof — good enough for friends. Each gift id can be redeemed once per device.
 */
const KEY = import.meta.env.VITE_GIFT_SECRET || 'spinbuddies-friends-gift-v1-7f3a9c';
const SEASON_IDS = Object.keys(SEASONAL_PALETTES);
const MIX_ORDER = Object.keys(MIX_SLOTS) as MixSlot[];

export interface Gift {
  seed: string;
  v: number;
  variant?: string;
  rarity: Rarity;
  giftId: string;
}

// --- base32 with the seed alphabet ---
function toBase32(bytes: Uint8Array): string {
  let bits = 0,
    value = 0,
    out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += SEED_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += SEED_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(s: string): Uint8Array | null {
  let bits = 0,
    value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const i = SEED_ALPHABET.indexOf(ch);
    if (i < 0) return null;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function seedToBytes(seed: string): Uint8Array {
  return fromBase32(seed.replace('-', ''))!;
}
function bytesToSeed(b: Uint8Array): string {
  const s = toBase32(b).slice(0, 8);
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

async function mac(data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new Uint8Array(data)));
  return sig.slice(0, 4);
}

export function randomGiftId(): string {
  const a = new Uint8Array(4);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function encodeGift(g: Gift): Promise<string> {
  const parts: number[] = [];
  let kind = 0;
  let extra: number[] = [];
  if (g.variant?.startsWith('mix:')) {
    kind = 2;
    const m = parseMix(g.variant) ?? {};
    let mask = 0;
    const seeds: number[] = [];
    MIX_ORDER.forEach((slot, i) => {
      if (m[slot]) {
        mask |= 1 << i;
        seeds.push(...seedToBytes(m[slot]!));
      }
    });
    extra = [mask, ...seeds];
  } else if (g.variant) {
    kind = 1;
    extra = [SEASON_IDS.indexOf(g.variant)];
  }
  parts.push(((g.v & 15) << 4) | (kind << 2));
  parts.push(...seedToBytes(g.seed));
  parts.push(RARITIES.indexOf(g.rarity));
  for (let i = 0; i < 4; i++) parts.push(parseInt(g.giftId.slice(i * 2, i * 2 + 2), 16));
  parts.push(...extra);
  const data = new Uint8Array(parts);
  const sig = await mac(data);
  const all = new Uint8Array([...data, ...sig]);
  const b32 = toBase32(all);
  return 'GIFT-' + (b32.match(/.{1,4}/g) ?? []).join('-');
}

export type DecodeResult = { ok: true; gift: Gift } | { ok: false; reason: 'format' | 'checksum' | 'mismatch' };

/** Validates a code. Accepts lower case, spaces, missing dashes and I/1 for L. */
export async function decodeGift(code: string): Promise<DecodeResult> {
  const clean = code
    .toUpperCase()
    .replace(/[\s_-]/g, '')
    .replace(/^GIFT/, '')
    .replace(/[I1]/g, 'L');
  const bytes = fromBase32(clean);
  if (!bytes || bytes.length < 15) return { ok: false, reason: 'format' };
  const data = bytes.slice(0, bytes.length - 4);
  const sig = bytes.slice(bytes.length - 4);
  const want = await mac(data);
  if (want.some((b, i) => b !== sig[i])) return { ok: false, reason: 'checksum' };
  const v = data[0]! >> 4;
  const kind = (data[0]! >> 2) & 3;
  const seed = bytesToSeed(data.slice(1, 6));
  const rarity = RARITIES[data[6]!];
  const giftId = [...data.slice(7, 11)].map((x) => x.toString(16).padStart(2, '0')).join('');
  let variant: string | undefined;
  if (kind === 1) variant = SEASON_IDS[data[11]!];
  if (kind === 2) {
    const mask = data[11]!;
    const m: Partial<Record<MixSlot, string>> = {};
    let off = 12;
    MIX_ORDER.forEach((slot, i) => {
      if (mask & (1 << i)) {
        m[slot] = bytesToSeed(data.slice(off, off + 5));
        off += 5;
      }
    });
    variant = encodeMix(m);
  }
  if (!rarity || v < 1 || v > 15) return { ok: false, reason: 'format' };
  // The stated rarity must match what the seed really generates (catches tampering).
  if (generateCharacter(seed, v, variant).rarity !== rarity) return { ok: false, reason: 'mismatch' };
  return { ok: true, gift: { seed, v, variant, rarity, giftId } };
}
