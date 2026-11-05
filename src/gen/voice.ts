import type { CharacterSpec } from './types';

export type NaturalVoice = 'normal' | 'funny' | 'robot' | 'deep';

const ROBOT_PARTS = new Set(['antenna', 'pixel', 'laser', 'astronaut', 'armor', 'diver']);
const DEEP_PARTS = new Set([
  'bear',
  'chonk',
  'viking',
  'crown',
  'tuxedo',
  'cowboy',
  'antlers',
  'piratecoat',
  'mustache',
]);
const FUNNY_PARTS = new Set([
  'tiny',
  'bunny',
  'mouse',
  'propeller',
  'party',
  'frog',
  'swirl',
  'dizzy',
  'tongue',
  'buck',
  'bee',
  'tufts',
]);

/**
 * A buddy's natural voice, from its look (deterministic: same buddy → same voice).
 * Robots and metal/space suits talk robot, bears and big or grand buddies talk deep,
 * tiny, bouncy or silly buddies talk funny; everyone else talks normal.
 */
export function voiceFor(s: CharacterSpec): NaturalVoice {
  const parts = [
    s.body,
    s.head,
    s.mods.hideEars ? '' : s.ears,
    s.hat,
    s.outfit,
    s.accessory,
    s.face.eyes,
    s.face.mouth,
  ];
  const score = { robot: 0, deep: 0, funny: 0 };
  for (const p of parts) {
    if (ROBOT_PARTS.has(p)) score.robot += 2;
    if (DEEP_PARTS.has(p)) score.deep += 1.5;
    if (FUNNY_PARTS.has(p)) score.funny += 1;
  }
  if (s.finish === 'metallic') score.robot += 3;
  if (s.tags.includes('robot')) score.robot += 1;
  if (s.tags.includes('silly')) score.funny += 1;
  if (s.tags.includes('royal')) score.deep += 1;
  const best = (Object.entries(score) as [NaturalVoice, number][]).sort((a, b) => b[1] - a[1])[0]!;
  return best[1] >= 1.5 ? best[0] : 'normal';
}
