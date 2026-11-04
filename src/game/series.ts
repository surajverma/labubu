import { generateCharacter } from '../gen/generate';
import { RARITY_ODDS } from '../gen/rarity';
import { RARITIES, type CharacterSpec, type Rarity } from '../gen/types';
import { pickWeighted, randomSeed, rngFromString, type Rng } from '../rng';

/**
 * Blind boxes draw from a finite, numbered *series pool* (like a real blind-box series),
 * so duplicates exist and recycling them makes sense. Tier quotas match the stated odds
 * exactly. Home spins and Order challenges still explore the full seed space.
 */
export interface SeriesDef {
  id: number;
  name: string;
  /** Generator version used for this series. */
  version: number;
  size: number;
}

export const SERIES: SeriesDef[] = [{ id: 1, name: 'Series 1', version: 1, size: 1000 }];

export function latestSeries(): SeriesDef {
  return SERIES[SERIES.length - 1]!;
}

export interface PoolEntry {
  seed: string;
  index: number;
  rarity: Rarity;
  tags: string[];
}

export interface Pool {
  series: SeriesDef;
  entries: PoolEntry[];
  byTier: Record<Rarity, PoolEntry[]>;
}

const pools = new Map<number, Pool>();

export function quotas(size: number): Record<Rarity, number> {
  const q = {} as Record<Rarity, number>;
  let used = 0;
  for (const r of RARITIES) {
    if (r === 'common') continue;
    q[r] = Math.max(1, Math.round(size * RARITY_ODDS[r]));
    used += q[r];
  }
  q.common = size - used;
  return q;
}

/** Deterministic pool for a series (same on every device). */
export function getPool(seriesId: number): Pool {
  const cached = pools.get(seriesId);
  if (cached) return cached;
  const series = SERIES.find((s) => s.id === seriesId);
  if (!series) throw new Error(`Unknown series ${seriesId}`);
  const q = quotas(series.size);
  const rng = rngFromString(`series:${series.id}`);
  const byTier = Object.fromEntries(RARITIES.map((r) => [r, [] as PoolEntry[]])) as Record<Rarity, PoolEntry[]>;
  const entries: PoolEntry[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (entries.length < series.size && guard++ < 2_000_000) {
    const seed = randomSeed(rng);
    if (seen.has(seed)) continue;
    seen.add(seed);
    const spec = generateCharacter(seed, series.version);
    if (byTier[spec.rarity].length >= q[spec.rarity]) continue;
    const e: PoolEntry = { seed, index: 0, rarity: spec.rarity, tags: spec.tags };
    byTier[spec.rarity].push(e);
    entries.push(e);
  }
  // Number the series #1..#N, rarest last (like a checklist).
  entries.sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || a.seed.localeCompare(b.seed));
  entries.forEach((e, i) => (e.index = i + 1));
  const pool = { series, entries, byTier };
  pools.set(seriesId, pool);
  return pool;
}

export type BoxKind = 'normal' | 'premium' | 'themed';

export interface Draw {
  seed: string;
  v: number;
  series: number;
  index: number;
  rarity: Rarity;
  variant?: string;
}

/** Draws one box result. Premium boxes never give Commons; themed boxes guarantee a tag. */
export function drawBox(kind: BoxKind, rng: Rng, opts: { tag?: string; seriesId?: number; variant?: string } = {}): Draw {
  const pool = getPool(opts.seriesId ?? latestSeries().id);
  const tiers = RARITIES.filter((r) => kind !== 'premium' || r !== 'common');
  const tier = pickWeighted(rng, tiers, (r) => RARITY_ODDS[r]);
  let list = pool.byTier[tier];
  if (kind === 'themed' && opts.tag) {
    const tagged = list.filter((e) => e.tags.includes(opts.tag!));
    if (tagged.length) list = tagged;
    else {
      // Fall back to any tier that has the tag (rarest-first never; nearest commoner tier).
      const any = pool.entries.filter((e) => e.tags.includes(opts.tag!));
      if (any.length) list = any;
    }
  }
  const e = list[Math.floor(rng() * list.length)]!;
  return { seed: e.seed, v: pool.series.version, series: pool.series.id, index: e.index, rarity: e.rarity, variant: opts.variant };
}

export function specOf(d: { seed: string; v: number; variant?: string }): CharacterSpec {
  return generateCharacter(d.seed, d.v, d.variant);
}
