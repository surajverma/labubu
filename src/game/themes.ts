import { isoWeek } from './time';
import { hashString } from '../rng';

/** Weekly themed box: a guaranteed tag that rotates every ISO week (same for everyone). */
export const WEEKLY_THEMES: { tag: string; name: string; icon: string; color: string }[] = [
  { tag: 'space', name: 'Space Week', icon: '🚀', color: '#5b4bd1' },
  { tag: 'ocean', name: 'Ocean Week', icon: '🌊', color: '#2f9fd1' },
  { tag: 'cozy', name: 'Cozy Week', icon: '🧣', color: '#d9824f' },
  { tag: 'nature', name: 'Nature Week', icon: '🌿', color: '#3fae5a' },
  { tag: 'sweet', name: 'Sweet Week', icon: '🍭', color: '#ff6fae' },
  { tag: 'magic', name: 'Magic Week', icon: '🪄', color: '#8a5cff' },
  { tag: 'snow', name: 'Snow Week', icon: '❄️', color: '#5f9fe0' },
  { tag: 'party', name: 'Party Week', icon: '🎉', color: '#ff8a3f' },
  { tag: 'animal', name: 'Animal Week', icon: '🐾', color: '#c98a4f' },
  { tag: 'sparkly', name: 'Sparkle Week', icon: '✨', color: '#d1a72f' },
];

export function weeklyTheme(day: string): (typeof WEEKLY_THEMES)[number] {
  const h = hashString(`theme:${isoWeek(day)}`)[0];
  return WEEKLY_THEMES[h % WEEKLY_THEMES.length]!;
}
