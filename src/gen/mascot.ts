import type { CharacterSpec } from './types';

/** Hand-tuned mascot "Buddy" — the app's reference character for look development. */
export const MASCOT: CharacterSpec = {
  generatorVersion: 1,
  seed: 'BUDY-2025',
  name: 'Buddy',
  rarity: 'rare',
  score: 0,
  finish: 'glossy',
  palette: {
    skin: '#ffb59c',
    skinAlt: '#fff1e4',
    outfit: '#6aa5ff',
    outfitAlt: '#ffd34d',
    hat: '#ff7a8a',
    hatAlt: '#ffffff',
    accent: '#7a5cff',
    blush: '#ff7f8e',
    ink: '#3a2430',
    harmony: 'complementary',
    colorTags: ['orange', 'blue'],
  },
  body: 'bean',
  head: 'round',
  ears: 'sprout',
  face: { eyes: 'shiny', brows: 'soft', mouth: 'smile', nose: 'dot', cheeks: 'blush' },
  hat: 'none',
  outfit: 'overalls',
  accessory: 'none',
  scene: 'studio',
  mods: {},
  tags: [],
};
