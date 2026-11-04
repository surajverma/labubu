import type { CharacterSpec } from './types';

/**
 * Compatibility rules: prevent ugly or impossible combos. They run after part picks and
 * only adjust the spec (they never re-roll), so they are deterministic per seed.
 * Returns the ids of rules that fired (for tests and debugging).
 */
export const TOP_EARS = new Set(['sprout', 'antenna', 'unicorn', 'flowerbud']);
export const TALL_EARS = new Set(['bunny', 'horns', 'tufts', 'fox', 'antlers', 'bee', 'cat']);
export const SIDE_EARS = new Set(['pointy', 'floppy', 'fins', 'wings', 'mouse']);
/** Hats that cover the crown of the head. */
export const CROWN_HATS = new Set([
  'bucket',
  'beanie',
  'crown',
  'pirate',
  'cap',
  'tophat',
  'party',
  'chef',
  'beret',
  'propeller',
  'witch',
  'cowboy',
  'viking',
  'santa',
  'straw',
  'frog',
]);
export const TALL_HATS = new Set(['tophat', 'chef', 'party', 'witch', 'crown']);
export const HELMET_OUTFITS = new Set(['astronaut', 'diver']);

export function applyRules(s: CharacterSpec): string[] {
  const fired: string[] = [];
  // A helmet replaces the hat and hides the ears.
  if (HELMET_OUTFITS.has(s.outfit)) {
    if (s.hat !== 'none') fired.push('helmet-replaces-hat');
    s.hat = 'none';
    s.mods.hideEars = true;
    if (s.accessory === 'glasses') {
      s.accessory = 'none';
      fired.push('helmet-no-glasses');
    }
  }
  // A hood hides the ears.
  if (s.hat === 'hood') {
    s.mods.hideEars = true;
    fired.push('hood-hides-ears');
  }
  // Frog hat and viking helmet bring their own "ears".
  if (s.hat === 'frog' || (s.hat === 'viking' && s.ears === 'horns')) {
    s.mods.hideEars = true;
    fired.push('hat-own-ears');
  }
  // Ears that grow out of the top of the head can't poke through a hat.
  if (TOP_EARS.has(s.ears) && CROWN_HATS.has(s.hat)) {
    s.mods.hideEars = true;
    fired.push('top-ears-under-hat');
  }
  // Long ears + tall hat → shorten the ears.
  if (TALL_EARS.has(s.ears) && (TALL_HATS.has(s.hat) || CROWN_HATS.has(s.hat))) {
    s.mods.shortEars = true;
    fired.push('short-ears-under-hat');
  }
  // Earmuffs sit where side ears are.
  if (s.hat === 'earmuffs' && (SIDE_EARS.has(s.ears) || s.ears === 'floppy')) {
    s.mods.hideEars = true;
    fired.push('earmuffs-hide-side-ears');
  }
  // Glasses don't go over one big eye or shades.
  if (s.accessory === 'glasses' && (s.face.eyes === 'cyclops' || s.face.eyes === 'sunglasses')) {
    s.accessory = 'none';
    fired.push('no-glasses-over-eye');
  }
  // A cape and a backpack fight for the same spot.
  if (s.outfit === 'cape' && s.accessory === 'backpack') {
    s.accessory = 'none';
    fired.push('cape-no-backpack');
  }
  // Swim ring + scarf/satchel look odd together.
  if (s.outfit === 'swimring' && (s.accessory === 'scarf' || s.accessory === 'satchel')) {
    s.accessory = 'none';
    fired.push('swimring-no-scarf');
  }
  // Wizard robe reaches the floor: no skateboard.
  if ((s.outfit === 'wizard' || s.outfit === 'labcoat') && s.accessory === 'skateboard') {
    s.accessory = 'none';
    fired.push('robe-no-skateboard');
  }
  return fired;
}
