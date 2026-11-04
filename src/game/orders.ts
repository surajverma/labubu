import { encodeMix, generateCharacter, MIX_SLOTS, type MixSlot } from '../gen/generate';
import { partById } from '../gen/parts';
import type { CharacterSpec, Layer } from '../gen/types';
import { FACE_LAYERS } from '../gen/types';
import { pick, randomSeed, rngFromString, type Rng } from '../rng';
import { ECONOMY } from './economy';

export type ReqSlot =
  'face' | 'ears' | 'hat' | 'outfit' | 'accessory' | 'scene' | 'color' | 'body' | 'any';

export interface Requirement {
  slot: ReqSlot;
  /** Tag to match, or '*' = "any part" (not "none"). */
  tag: string;
}

export interface Order {
  id: string;
  title: string;
  customerSeed: string;
  reqs: Requirement[];
  spins: number;
  /** Chance (0–1) that a spin of a slot lands on a part that helps (higher = easier). */
  luck: number;
  street?: number;
  /** Coin multiplier per star. */
  multiplier: number;
}

/** Order slots shown in the UI, in display order. */
export const SLOTS: { id: MixSlot; label: string; icon: string }[] = [
  { id: 'F', label: 'Face', icon: '🙂' },
  { id: 'E', label: 'Ears', icon: '🐰' },
  { id: 'H', label: 'Hat', icon: '🎩' },
  { id: 'O', label: 'Outfit', icon: '👕' },
  { id: 'A', label: 'Holding', icon: '🎈' },
  { id: 'S', label: 'Scene', icon: '🏝️' },
  { id: 'C', label: 'Colours', icon: '🎨' },
  { id: 'B', label: 'Shape', icon: '🫘' },
];

const REQ_TO_SLOT: Record<Exclude<ReqSlot, 'any'>, MixSlot> = {
  face: 'F',
  ears: 'E',
  hat: 'H',
  outfit: 'O',
  accessory: 'A',
  scene: 'S',
  color: 'C',
  body: 'B',
};

function partTags(layer: Layer, id: string): readonly string[] {
  return partById(layer, id)?.tags ?? [];
}

export function meets(s: CharacterSpec, r: Requirement): boolean {
  switch (r.slot) {
    case 'face': {
      const tags = FACE_LAYERS.flatMap((l) => partTags(l, s.face[l]));
      return tags.includes(r.tag);
    }
    case 'ears':
      if (s.mods.hideEars || s.ears === 'none') return false;
      return r.tag === '*' || partTags('ears', s.ears).includes(r.tag);
    case 'hat':
    case 'outfit':
    case 'accessory': {
      const id = s[r.slot];
      if (id === 'none') return false;
      return r.tag === '*' || partTags(r.slot, id).includes(r.tag);
    }
    case 'scene':
      return partTags('scene', s.scene).includes(r.tag);
    case 'color':
      return s.palette.colorTags.includes(r.tag);
    case 'body':
      return [...partTags('body', s.body), ...partTags('head', s.head)].includes(r.tag);
    case 'any':
      return s.tags.includes(r.tag);
  }
}

// --- Labels ("sleepy face · pirate hat · snowy scene · something red") ---
const ADJ: Record<string, string> = {
  snow: 'snowy',
  ocean: 'sea',
  nature: 'leafy',
  space: 'space',
  sweet: 'sweet',
  food: 'foodie',
  sky: 'sky',
  city: 'city',
  cozy: 'cozy',
  angry: 'grumpy',
  love: 'loving',
  sparkly: 'sparkly',
  magic: 'magic',
  royal: 'royal',
  party: 'party',
  sporty: 'sporty',
  fancy: 'fancy',
  pirate: 'pirate',
  beach: 'beach',
  rain: 'rainy-day',
  school: 'school',
  hero: 'hero',
  animal: 'animal',
  sleepy: 'sleepy',
  happy: 'happy',
  cheeky: 'cheeky',
  silly: 'silly',
  cool: 'cool',
  cute: 'cute',
  shy: 'shy',
  sad: 'teary',
  surprised: 'surprised',
  calm: 'calm',
  spooky: 'spooky',
  night: 'night-time',
  studio: 'studio',
  chubby: 'chubby',
  tall: 'tall',
  flower: 'flowery',
  cat: 'cat',
  bunny: 'bunny',
  bear: 'bear',
  music: 'musical',
  art: 'arty',
};
const NOUN: Record<Exclude<ReqSlot, 'any' | 'color'>, string> = {
  face: 'face',
  ears: 'ears',
  hat: 'hat',
  outfit: 'outfit',
  accessory: 'thing to hold',
  scene: 'scene',
  body: 'body',
};

export function reqLabel(r: Requirement): string {
  if (r.slot === 'color') return `something ${r.tag}`;
  if (r.slot === 'any') return `something ${ADJ[r.tag] ?? r.tag}`;
  if (r.tag === '*')
    return {
      hat: 'any hat',
      outfit: 'any outfit',
      accessory: 'holding something',
      ears: 'ears or horns',
      face: 'a face',
      scene: 'any scene',
      body: 'any body',
    }[r.slot];
  return `${ADJ[r.tag] ?? r.tag} ${NOUN[r.slot]}`;
}

// --- Running an order ---
export interface RunState {
  base: string;
  slots: Partial<Record<MixSlot, string>>;
  locks: MixSlot[];
  spinsLeft: number;
}

export function variantOf(st: RunState): string | undefined {
  return encodeMix(st.slots);
}

export function specOfRun(st: RunState, version: number): CharacterSpec {
  return generateCharacter(st.base, version, variantOf(st));
}

export function metCount(s: CharacterSpec, o: Order): number {
  return o.reqs.filter((r) => meets(s, r)).length;
}

/** Which requirements a slot can influence. */
function slotReqs(o: Order, slot: MixSlot): Requirement[] {
  return o.reqs.filter(
    (r) =>
      r.slot === 'any' ||
      (r.slot === 'color'
        ? slot === 'C' || slot === 'O' || slot === 'H' || slot === 'A'
        : REQ_TO_SLOT[r.slot] === slot),
  );
}

/**
 * Picks a new seed for one slot. With probability `luck` the spin lands on a part that
 * helps the order; otherwise it's a plain random pick. This keeps difficulty even across
 * rare and common tags and is tuned per street.
 */
export function spinSlot(st: RunState, slot: MixSlot, o: Order, rng: Rng, version: number): string {
  const reqs = slotReqs(o, slot);
  if (reqs.length && rng() < o.luck) {
    for (let i = 0; i < 300; i++) {
      const seed = randomSeed(rng);
      const s = generateCharacter(st.base, version, encodeMix({ ...st.slots, [slot]: seed }));
      if (reqs.some((r) => meets(s, r))) return seed;
    }
  }
  return randomSeed(rng);
}

export function spin(st: RunState, o: Order, rng: Rng, version: number): RunState {
  if (st.spinsLeft <= 0) return st;
  const slots = { ...st.slots };
  const next: RunState = { ...st, slots, spinsLeft: st.spinsLeft - 1 };
  for (const s of SLOTS) {
    if (st.locks.includes(s.id)) continue;
    slots[s.id] = spinSlot(next, s.id, o, rng, version);
  }
  return next;
}

export function newRun(o: Order, rng: Rng, version: number): RunState {
  // Start from a random buddy that doesn't already fill the whole order.
  for (let i = 0; i < 40; i++) {
    const base = randomSeed(rng);
    const st: RunState = { base, slots: {}, locks: [], spinsLeft: o.spins };
    if (metCount(specOfRun(st, version), o) < Math.max(1, o.reqs.length - 1)) return st;
  }
  return { base: randomSeed(rng), slots: {}, locks: [], spinsLeft: o.spins };
}

// --- Scoring ---
export interface Result {
  met: number;
  total: number;
  score: number;
  stars: 0 | 1 | 2 | 3;
  coins: number;
}

export function scoreRun(s: CharacterSpec, o: Order, spinsLeft: number): Result {
  const met = metCount(s, o);
  const total = o.reqs.length;
  const E = ECONOMY.orders;
  const all = met === total;
  const score =
    met * E.pointsPerRequirement +
    (all ? E.pointsPerRequirement + spinsLeft * E.pointsPerSpare : 0);
  const stars: Result['stars'] = all ? 3 : met >= total - 1 ? 2 : met * 2 >= total ? 1 : 0;
  return { met, total, score, stars, coins: stars * o.multiplier };
}

// --- Solver: proves an order can be completed ---
const SAMPLE = 500;
const candCache = new Map<string, string[]>();

/** Representative seeds for every distinct value a slot can take (sampled). */
function slotCandidates(slot: MixSlot, version: number): string[] {
  const k = `${slot}|${version}`;
  const hit = candCache.get(k);
  if (hit) return hit;
  const rng = rngFromString(`cand:${k}`);
  const seen = new Map<string, string>();
  const layers = MIX_SLOTS[slot] as readonly string[];
  for (let i = 0; i < SAMPLE; i++) {
    const seed = randomSeed(rng);
    const g = generateCharacter(seed, version);
    const val =
      slot === 'C'
        ? g.palette.colorTags.join(',') +
          '|' +
          [g.palette.skin, g.palette.outfit, g.palette.hat, g.palette.accent]
            .map((c) => c.slice(1, 2))
            .join('')
        : layers
            .map((l) =>
              (FACE_LAYERS as readonly string[]).includes(l)
                ? g.face[l as (typeof FACE_LAYERS)[number]]
                : (g as unknown as Record<string, string>)[l],
            )
            .join('|');
    if (!seen.has(val)) seen.set(val, seed);
  }
  const out = [...seen.values()];
  candCache.set(k, out);
  return out;
}

/**
 * Searches slot assignments (with the compatibility rules applied) for one that meets every
 * requirement. Returns the winning slot seeds, or null if the order is impossible.
 */
export function solve(
  o: Order,
  version: number,
  base = 'SOLV-ER22',
): Partial<Record<MixSlot, string>> | null {
  // Colour last: it can also be satisfied by outfit/hat/accessory colours.
  const own = (slot: MixSlot) =>
    o.reqs.filter((r) => r.slot !== 'any' && REQ_TO_SLOT[r.slot] === slot);
  const direct = SLOTS.map((x) => x.id).filter((id) => slotReqs(o, id).length);
  // Slots that can break other requirements through compatibility rules (hats hide top
  // ears, helmets remove hats and ears) must be searchable too.
  const ruleSlots: MixSlot[] = [];
  if (o.reqs.some((r) => r.slot === 'ears')) ruleSlots.push('H', 'O');
  if (o.reqs.some((r) => r.slot === 'hat')) ruleSlots.push('O');
  const relevant = [...new Set([...direct, ...ruleSlots])]
    // Rule-only slots first (so pruning sees their effect), colour last.
    .sort((a, b) => rank(a) - rank(b));
  function rank(x: MixSlot): number {
    return x === 'C' ? 2 : own(x).length ? 1 : 0;
  }
  const assign: Partial<Record<MixSlot, string>> = {};
  let tries = 0;
  const dfs = (i: number): boolean => {
    if (++tries > 40000) return false;
    if (i === relevant.length)
      return metCount(generateCharacter(base, version, encodeMix(assign)), o) === o.reqs.length;
    const slot = relevant[i]!;
    const mine = own(slot);
    let cands = slotCandidates(slot, version);
    if (!own(slot).length) {
      // Rule-only slot: try "no hat" / "no outfit" first — it removes every conflict.
      const layer = slot === 'H' ? 'hat' : 'outfit';
      cands = [...cands].sort(
        (a, b) =>
          Number(generateCharacter(b, version)[layer] === 'none') -
          Number(generateCharacter(a, version)[layer] === 'none'),
      );
    }
    for (const seed of [undefined, ...cands]) {
      if (seed) assign[slot] = seed;
      else delete assign[slot];
      // Prune: this slot's own requirements must hold already (colour may be fixed later).
      if (mine.length && slot !== 'C') {
        const s = generateCharacter(base, version, encodeMix(assign));
        if (!mine.every((r) => meets(s, r))) continue;
      }
      if (dfs(i + 1)) return true;
    }
    delete assign[slot];
    return false;
  };
  return dfs(0) ? { ...assign } : null;
}

/** Slots a sensible player would lock: those whose own requirements are all met right now. */
export function greedyLocks(s: CharacterSpec, o: Order): MixSlot[] {
  return SLOTS.map((x) => x.id).filter((id) => {
    const own = o.reqs.filter((r) => r.slot !== 'any' && REQ_TO_SLOT[r.slot] === id);
    return own.length > 0 && own.every((r) => meets(s, r));
  });
}

/** Greedy player: locks slots that currently help, spins the rest. Returns stars. */
export function simulateGreedy(o: Order, rng: Rng, version: number): Result {
  let st = newRun(o, rng, version);
  for (;;) {
    const s = specOfRun(st, version);
    const res = scoreRun(s, o, st.spinsLeft);
    if (res.met === res.total || st.spinsLeft <= 0) return res;
    st = { ...st, locks: greedyLocks(s, o) };
    st = spin(st, o, rng, version);
  }
}

// --- Daily order: same for everyone, seeded by the date ---
const DAILY_POOL: Requirement[] = [
  { slot: 'face', tag: 'sleepy' },
  { slot: 'face', tag: 'happy' },
  { slot: 'face', tag: 'cheeky' },
  { slot: 'face', tag: 'silly' },
  { slot: 'face', tag: 'love' },
  { slot: 'face', tag: 'surprised' },
  { slot: 'face', tag: 'cool' },
  { slot: 'hat', tag: '*' },
  { slot: 'hat', tag: 'cozy' },
  { slot: 'hat', tag: 'pirate' },
  { slot: 'hat', tag: 'party' },
  { slot: 'hat', tag: 'royal' },
  { slot: 'outfit', tag: 'cozy' },
  { slot: 'outfit', tag: '*' },
  { slot: 'outfit', tag: 'sporty' },
  { slot: 'outfit', tag: 'fancy' },
  { slot: 'accessory', tag: '*' },
  { slot: 'accessory', tag: 'party' },
  { slot: 'accessory', tag: 'school' },
  { slot: 'scene', tag: 'snow' },
  { slot: 'scene', tag: 'beach' },
  { slot: 'scene', tag: 'space' },
  { slot: 'scene', tag: 'nature' },
  { slot: 'scene', tag: 'ocean' },
  { slot: 'color', tag: 'red' },
  { slot: 'color', tag: 'blue' },
  { slot: 'color', tag: 'green' },
  { slot: 'color', tag: 'pink' },
  { slot: 'color', tag: 'yellow' },
  { slot: 'ears', tag: 'animal' },
  { slot: 'ears', tag: '*' },
];

export function dailyOrder(day: string, version: number): Order {
  const rng = rngFromString(`daily-order:${day}:v${version}`);
  for (let attempt = 0; attempt < 30; attempt++) {
    const n = 3 + Math.floor(rng() * 2);
    const reqs: Requirement[] = [];
    const usedSlots = new Set<ReqSlot>();
    while (reqs.length < n) {
      const r = pick(rng, DAILY_POOL);
      if (usedSlots.has(r.slot)) continue;
      usedSlots.add(r.slot);
      reqs.push(r);
    }
    const o: Order = {
      id: `daily:${day}`,
      title: 'Daily order',
      customerSeed: randomSeed(rng),
      reqs,
      spins: 8,
      luck: 0.32,
      multiplier: ECONOMY.orders.dailyOrderMultiplier,
    };
    if (solve(o, version)) return o;
  }
  // Fallback that is always solvable.
  return {
    id: `daily:${day}`,
    title: 'Daily order',
    customerSeed: randomSeed(rng),
    reqs: [
      { slot: 'hat', tag: '*' },
      { slot: 'scene', tag: 'beach' },
      { slot: 'color', tag: 'blue' },
    ],
    spins: 8,
    luck: 0.32,
    multiplier: ECONOMY.orders.dailyOrderMultiplier,
  };
}
