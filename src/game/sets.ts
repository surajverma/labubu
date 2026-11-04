import type { CharacterSpec, Layer, Rarity } from '../gen/types';
import { FACE_LAYERS } from '../gen/types';

export interface SetDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Content version that introduces the set (1 = Phase 1, 2 = Phase 2). */
  since: number;
  need: number;
  /** Characters that count towards the set (for filtering the book). */
  matches(s: CharacterSpec): boolean;
  /** How many of `need` are satisfied by a collection. */
  progress(specs: CharacterSpec[]): number;
  coins: number;
}

const byTag = (id: string, name: string, icon: string, tag: string, need: number, since: number, desc?: string, coins = 100): SetDef => ({
  id,
  name,
  icon,
  since,
  need,
  coins,
  description: desc ?? `Collect ${need} buddies with ${tag} things`,
  matches: (s) => s.tags.includes(tag),
  progress: (specs) => Math.min(need, specs.filter((s) => s.tags.includes(tag)).length),
});

function layerValue(s: CharacterSpec, layer: Layer): string {
  return (FACE_LAYERS as readonly string[]).includes(layer) ? s.face[layer as (typeof FACE_LAYERS)[number]] : (s as unknown as Record<string, string>)[layer]!;
}

const distinct = (id: string, name: string, icon: string, layer: Layer, need: number, since: number, desc: string, coins = 150): SetDef => ({
  id,
  name,
  icon,
  since,
  need,
  coins,
  description: desc,
  matches: (s) => layerValue(s, layer) !== 'none',
  progress: (specs) => Math.min(need, new Set(specs.map((s) => layerValue(s, layer)).filter((v) => v !== 'none')).size),
});

const RAINBOW = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const LADDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const SETS: SetDef[] = [
  byTag('space-crew', 'Space Crew', '🚀', 'space', 5, 1, 'Collect 5 buddies with space parts'),
  distinct('hat-collector', 'Hat Collector', '🎩', 'hat', 10, 1, 'Find 10 different hats'),
  byTag('animal-pals', 'Animal Pals', '🐾', 'animal', 6, 1, 'Collect 6 buddies with animal ears or faces'),
  byTag('cozy-club', 'Cozy Club', '🧣', 'cozy', 5, 1, 'Collect 5 cozy buddies'),
  {
    id: 'rainbow',
    name: 'Rainbow',
    icon: '🌈',
    since: 1,
    need: RAINBOW.length,
    coins: 150,
    description: 'Find a red, orange, yellow, green, blue and purple buddy',
    matches: (s) => RAINBOW.some((c) => s.palette.colorTags.includes(c)),
    progress: (specs) => RAINBOW.filter((c) => specs.some((s) => s.palette.colorTags.includes(c))).length,
  },
  byTag('ocean-friends', 'Ocean Friends', '🌊', 'ocean', 5, 1, 'Collect 5 buddies who love the sea'),
  {
    id: 'rarity-ladder',
    name: 'Rarity Ladder',
    icon: '🪜',
    since: 1,
    need: LADDER.length,
    coins: 200,
    description: 'Own a Common, Rare, Epic and Legendary buddy',
    matches: (s) => LADDER.includes(s.rarity),
    progress: (specs) => LADDER.filter((r) => specs.some((s) => s.rarity === r)).length,
  },
  distinct('many-moods', 'Many Moods', '😺', 'eyes', 8, 1, 'Find 8 different kinds of eyes'),
  // --- Phase 2 ---
  byTag('snow-squad', 'Snow Squad', '❄️', 'snow', 5, 2, 'Collect 5 snowy buddies'),
  byTag('magic-circle', 'Magic Circle', '🪄', 'magic', 5, 2, 'Collect 5 magical buddies'),
  byTag('royal-court', 'Royal Court', '👑', 'royal', 3, 2, 'Collect 3 royal buddies', 200),
  byTag('sweet-tooth', 'Sweet Tooth', '🍭', 'food', 5, 2, 'Collect 5 buddies who love snacks'),
  distinct('scene-explorer', 'Scene Explorer', '🗺️', 'scene', 10, 2, 'Find buddies in 10 different scenes', 200),
  distinct('outfit-closet', 'Outfit Closet', '👗', 'outfit', 12, 2, 'Find 12 different outfits', 200),
  byTag('sparkle-squad', 'Sparkle Squad', '✨', 'sparkly', 5, 2, 'Collect 5 sparkly buddies'),
  {
    id: 'secret-keeper',
    name: 'Secret Keeper',
    icon: '🔮',
    since: 2,
    need: 1,
    coins: 300,
    description: 'Find a Secret buddy',
    matches: (s) => s.rarity === 'secret',
    progress: (specs) => (specs.some((s) => s.rarity === 'secret') ? 1 : 0),
  },
];

export function setProgress(set: SetDef, specs: CharacterSpec[]): { have: number; need: number; done: boolean } {
  const have = set.progress(specs);
  return { have, need: set.need, done: have >= set.need };
}
