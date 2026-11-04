import { ECONOMY } from './economy';
import type { Order, ReqSlot } from './orders';

export interface Street {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export const STREETS: Street[] = [
  { id: 1, name: 'Sprinkle Street', icon: '🧁', color: '#ff8a6b' },
  { id: 2, name: 'Maple Lane', icon: '🍁', color: '#f2a33a' },
  { id: 3, name: 'Starlight Avenue', icon: '🌟', color: '#7a5cff' },
];

type R = [ReqSlot, string];
const L = (
  n: number,
  title: string,
  reqs: R[],
  spins: number,
  street: number,
  luck: number,
): Order => ({
  id: `L${String(n).padStart(2, '0')}`,
  title,
  customerSeed: `CUST-${String(n).padStart(2, '0')}${'ABCDEFGHJK'[n % 10]}${'MNPQRSTUVW'[(n * 3) % 10]}`,
  reqs: reqs.map(([slot, tag]) => ({ slot, tag })),
  spins,
  luck,
  street,
  multiplier: ECONOMY.orders.streetMultiplier[street - 1]!,
});

/** 30 handcrafted orders. Difficulty rises: more requirements, fewer spins, harder tags. */
export const LEVELS: Order[] = [
  // --- Street 1: 3 requirements, generous spins ---
  L(
    1,
    'Sunny Picnic',
    [
      ['face', 'happy'],
      ['hat', '*'],
      ['scene', 'beach'],
    ],
    10,
    1,
    0.42,
  ),
  L(
    2,
    'Cozy Morning',
    [
      ['face', 'sleepy'],
      ['outfit', 'cozy'],
      ['color', 'blue'],
    ],
    10,
    1,
    0.42,
  ),
  L(
    3,
    'Pirate Party',
    [
      ['hat', 'pirate'],
      ['scene', 'beach'],
      ['color', 'red'],
    ],
    10,
    1,
    0.42,
  ),
  L(
    4,
    'Snow Day',
    [
      ['hat', 'cozy'],
      ['scene', 'snow'],
      ['face', 'happy'],
    ],
    9,
    1,
    0.42,
  ),
  L(
    5,
    'Story Time',
    [
      ['accessory', 'school'],
      ['face', 'sleepy'],
      ['scene', 'cozy'],
    ],
    9,
    1,
    0.42,
  ),
  L(
    6,
    'Space Cadet',
    [
      ['outfit', 'space'],
      ['face', 'cheeky'],
      ['scene', 'space'],
    ],
    9,
    1,
    0.42,
  ),
  L(
    7,
    'Garden Helper',
    [
      ['ears', 'nature'],
      ['scene', 'nature'],
      ['color', 'green'],
    ],
    9,
    1,
    0.42,
  ),
  L(
    8,
    'Birthday Bash',
    [
      ['hat', 'party'],
      ['accessory', 'party'],
      ['face', 'happy'],
    ],
    8,
    1,
    0.42,
  ),
  L(
    9,
    'Rainy Walk',
    [
      ['outfit', 'rain'],
      ['accessory', 'rain'],
      ['color', 'yellow'],
    ],
    8,
    1,
    0.42,
  ),
  L(
    10,
    'Night Owl',
    [
      ['scene', 'night'],
      ['face', 'sleepy'],
      ['outfit', '*'],
    ],
    8,
    1,
    0.42,
  ),
  // --- Street 2: mostly 4 requirements ---
  L(
    11,
    'Royal Visit',
    [
      ['hat', 'royal'],
      ['outfit', 'fancy'],
      ['face', 'happy'],
      ['color', 'purple'],
    ],
    8,
    2,
    0.34,
  ),
  L(
    12,
    'Beach Day',
    [
      ['scene', 'beach'],
      ['outfit', 'beach'],
      ['face', 'cool'],
      ['accessory', '*'],
    ],
    6,
    2,
    0.34,
  ),
  L(
    13,
    'Ocean Friend',
    [
      ['outfit', 'ocean'],
      ['scene', 'ocean'],
      ['ears', 'animal'],
      ['face', 'silly'],
    ],
    6,
    2,
    0.34,
  ),
  L(
    14,
    'Sweet Shop',
    [
      ['accessory', 'sweet'],
      ['scene', 'sweet'],
      ['face', 'cute'],
      ['color', 'pink'],
    ],
    8,
    2,
    0.34,
  ),
  L(
    15,
    'Chef Special',
    [
      ['hat', 'food'],
      ['outfit', 'food'],
      ['face', 'happy'],
    ],
    6,
    2,
    0.34,
  ),
  L(
    16,
    'Magic Show',
    [
      ['hat', 'magic'],
      ['accessory', 'magic'],
      ['face', 'surprised'],
      ['color', 'purple'],
    ],
    8,
    2,
    0.34,
  ),
  L(
    17,
    'Sports Day',
    [
      ['hat', 'sporty'],
      ['outfit', 'sporty'],
      ['face', 'cheeky'],
      ['scene', 'city'],
    ],
    6,
    2,
    0.34,
  ),
  L(
    18,
    'Snowball Fight',
    [
      ['scene', 'snow'],
      ['outfit', 'cozy'],
      ['face', 'cheeky'],
      ['color', 'white'],
    ],
    6,
    2,
    0.34,
  ),
  L(
    19,
    'Cloud Nine',
    [
      ['scene', 'sky'],
      ['accessory', 'sky'],
      ['face', 'love'],
    ],
    6,
    2,
    0.34,
  ),
  L(
    20,
    'Bedtime',
    [
      ['outfit', 'sleepy'],
      ['scene', 'cozy'],
      ['face', 'sleepy'],
      ['ears', 'bear'],
    ],
    6,
    2,
    0.34,
  ),
  // --- Street 3: 4–5 requirements, few spins ---
  L(
    21,
    "Captain's Orders",
    [
      ['hat', 'pirate'],
      ['outfit', 'pirate'],
      ['scene', 'ocean'],
      ['face', 'cool'],
    ],
    5,
    3,
    0.3,
  ),
  L(
    22,
    'Starry Gala',
    [
      ['hat', 'royal'],
      ['outfit', 'fancy'],
      ['accessory', 'fancy'],
      ['scene', 'night'],
      ['face', 'sparkly'],
    ],
    6,
    3,
    0.3,
  ),
  L(
    23,
    'Hero Time',
    [
      ['outfit', 'hero'],
      ['face', 'cool'],
      ['scene', 'city'],
      ['color', 'red'],
    ],
    6,
    3,
    0.3,
  ),
  L(
    24,
    'Bunny Hop',
    [
      ['ears', 'bunny'],
      ['face', 'cute'],
      ['scene', 'nature'],
      ['color', 'pink'],
      ['hat', '*'],
    ],
    6,
    3,
    0.3,
  ),
  L(
    25,
    'Space Walk',
    [
      ['outfit', 'space'],
      ['scene', 'space'],
      ['face', 'surprised'],
      ['color', 'blue'],
    ],
    7,
    3,
    0.3,
  ),
  L(
    26,
    'Cozy Cabin',
    [
      ['hat', 'cozy'],
      ['outfit', 'cozy'],
      ['accessory', 'cozy'],
      ['scene', 'snow'],
      ['face', 'sleepy'],
    ],
    5,
    3,
    0.3,
  ),
  L(
    27,
    'Spooky Night',
    [
      ['ears', 'spooky'],
      ['face', 'spooky'],
      ['scene', 'night'],
      ['color', 'purple'],
    ],
    5,
    3,
    0.3,
  ),
  L(
    28,
    'Art Class',
    [
      ['hat', 'art'],
      ['accessory', 'school'],
      ['face', 'calm'],
      ['color', 'yellow'],
      ['scene', 'studio'],
    ],
    6,
    3,
    0.3,
  ),
  L(
    29,
    'Tea Party',
    [
      ['hat', 'fancy'],
      ['face', 'cute'],
      ['accessory', 'sweet'],
      ['outfit', 'cozy'],
      ['color', 'pink'],
    ],
    6,
    3,
    0.3,
  ),
  L(
    30,
    'Grand Parade',
    [
      ['hat', 'party'],
      ['accessory', 'party'],
      ['face', 'happy'],
      ['scene', 'city'],
      ['color', 'orange'],
    ],
    6,
    3,
    0.3,
  ),
];

export function streetStars(best: Record<string, number>, street: number): number {
  return LEVELS.filter((l) => l.street === street).reduce((a, l) => a + (best[l.id] ?? 0), 0);
}

export function totalStars(best: Record<string, number>): number {
  return LEVELS.reduce((a, l) => a + (best[l.id] ?? 0), 0);
}

export function streetUnlocked(best: Record<string, number>, street: number): boolean {
  return totalStars(best) >= ECONOMY.orders.unlockStars[street - 1]!;
}

/** A level is playable when its street is unlocked and the previous level has ≥1 star. */
export function levelUnlocked(best: Record<string, number>, idx: number): boolean {
  const l = LEVELS[idx]!;
  if (!streetUnlocked(best, l.street!)) return false;
  const firstOfStreet = LEVELS.findIndex((x) => x.street === l.street);
  return idx === firstOfStreet || (best[LEVELS[idx - 1]!.id] ?? 0) > 0;
}
