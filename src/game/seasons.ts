import { daysBetween } from './time';
import { SEASONAL_PALETTES } from '../gen/palette';

/**
 * Seasonal palettes are active around these dates (local time). Diwali and Holi follow
 * the lunar calendar, so their dates are listed per year (verify/extend yearly).
 */
const DIWALI: Record<number, string> = { 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17', 2029: '2029-11-05', 2030: '2030-10-26' };
const HOLI: Record<number, string> = { 2026: '2026-03-04', 2027: '2027-03-22', 2028: '2028-03-11', 2029: '2029-03-01', 2030: '2030-03-20' };

export interface Season {
  id: keyof typeof SEASONAL_PALETTES;
  name: string;
  icon: string;
}

export const SEASONS: Record<string, Season> = {
  diwali: { id: 'diwali', name: 'Diwali', icon: '🪔' },
  holi: { id: 'holi', name: 'Holi', icon: '🎨' },
  christmas: { id: 'christmas', name: 'Christmas', icon: '🎄' },
  newyear: { id: 'newyear', name: 'New Year', icon: '🎆' },
};

function within(day: string, center: string | undefined, before: number, after: number): boolean {
  if (!center) return false;
  const d = daysBetween(center, day);
  return d >= -before && d <= after;
}

export function activeSeason(day: string): Season | null {
  const y = Number(day.slice(0, 4));
  const md = day.slice(5);
  if (within(day, DIWALI[y], 3, 2)) return SEASONS.diwali!;
  if (within(day, HOLI[y], 2, 1)) return SEASONS.holi!;
  if (md >= '12-31' || md <= '01-02') return SEASONS.newyear!;
  if (md >= '12-18' && md <= '12-27') return SEASONS.christmas!;
  return null;
}

/** Chance that a box opened during a season comes in the seasonal palette. */
export const SEASONAL_BOX_CHANCE = 0.4;
