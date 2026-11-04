import { pickWeighted, type Rng } from '../rng';
import type { Palette } from './types';

export function hsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

/** Human colour name used for tags ("something red"). */
export function colorName(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  if (l >= 90 || (s < 14 && l > 60)) return 'white';
  if (l <= 22 || (s < 14 && l < 35)) return 'black';
  if (s < 14) return 'grey';
  if (h >= 345 || h < 15) return l > 72 ? 'pink' : 'red';
  if (h < 42) return l > 80 ? 'yellow' : 'orange';
  if (h < 68) return 'yellow';
  if (h < 170) return 'green';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

const r = (rng: Rng, a: number, b: number) => a + rng() * (b - a);

export type Harmony = Palette['harmony'];
const HARMONIES: { id: Exclude<Harmony, 'seasonal'>; w: number }[] = [
  { id: 'analogous', w: 4 },
  { id: 'complementary', w: 3 },
  { id: 'pastel', w: 3 },
  { id: 'neon', w: 1 },
];

/** Seasonal palettes (generator v2 variants). */
export const SEASONAL_PALETTES: Record<
  string,
  { name: string; colors: string[]; skins: string[] }
> = {
  diwali: {
    name: 'Diwali',
    colors: ['#ffb627', '#e2365b', '#ff7a1a', '#7a2a8f', '#ffd86b', '#2fa38f'],
    skins: ['#ffcf73', '#ff9a5c', '#f2789a', '#ffd9a0'],
  },
  holi: {
    name: 'Holi',
    colors: ['#ff4fa3', '#3fd17a', '#ffd23f', '#3fa2ff', '#a35cff', '#ff7a3f'],
    skins: ['#ffb3d9', '#b6f2c9', '#fff09a', '#b3dcff', '#d9c2ff'],
  },
  christmas: {
    name: 'Christmas',
    colors: ['#d93a3a', '#2f8f5a', '#ffffff', '#f3c443', '#1f5f3f'],
    skins: ['#ffe3e3', '#ffd2c2', '#e8f5e9', '#fff4e0'],
  },
  newyear: {
    name: 'New Year',
    colors: ['#f3c443', '#d9dee8', '#1f2a5a', '#ff5c8a', '#ffe9b8'],
    skins: ['#fff1cc', '#e6ebf5', '#ffd6e2', '#ffe9b8'],
  },
};

export function generatePalette(rng: Rng, seasonal?: string): Palette {
  if (seasonal && SEASONAL_PALETTES[seasonal]) return seasonalPalette(rng, seasonal);
  const harmony = pickWeighted(rng, HARMONIES, (h) => h.w).id;
  const H = rng() * 360;
  let skin: string,
    skinAlt: string,
    outfit: string,
    outfitAlt: string,
    hat: string,
    hatAlt: string,
    accent: string;
  // 6% chance of a mono vinyl (white, charcoal, or grey) skin.
  const mono = rng();
  switch (harmony) {
    case 'analogous': {
      const d = r(rng, 25, 45) * (rng() < 0.5 ? 1 : -1);
      skin = hsl(H, r(rng, 55, 78), r(rng, 66, 78));
      skinAlt = hsl(H + 8, r(rng, 35, 55), r(rng, 86, 92));
      outfit = hsl(H + d, r(rng, 55, 75), r(rng, 55, 68));
      outfitAlt = hsl(H + d * 2, r(rng, 60, 85), r(rng, 70, 82));
      hat = hsl(H - d, r(rng, 55, 80), r(rng, 58, 70));
      hatAlt = hsl(H - d * 2, r(rng, 30, 60), r(rng, 85, 94));
      accent = hsl(H + 180 + r(rng, -20, 20), r(rng, 70, 90), r(rng, 58, 66));
      break;
    }
    case 'complementary': {
      skin = hsl(H, r(rng, 55, 80), r(rng, 66, 78));
      skinAlt = hsl(H + 10, r(rng, 35, 55), r(rng, 86, 92));
      outfit = hsl(H + 180 + r(rng, -15, 15), r(rng, 55, 80), r(rng, 52, 64));
      outfitAlt = hsl(H + 30, r(rng, 65, 90), r(rng, 64, 76));
      hat = hsl(H + 180 + r(rng, -30, 30), r(rng, 60, 85), r(rng, 56, 68));
      hatAlt = hsl(H, r(rng, 20, 50), r(rng, 88, 95));
      accent = hsl(H + 150 + r(rng, 0, 60), r(rng, 70, 90), r(rng, 58, 66));
      break;
    }
    case 'pastel': {
      skin = hsl(H, r(rng, 50, 70), r(rng, 80, 87));
      skinAlt = hsl(H + 15, r(rng, 40, 60), r(rng, 92, 96));
      outfit = hsl(H + r(rng, 90, 270), r(rng, 45, 65), r(rng, 76, 84));
      outfitAlt = hsl(H + r(rng, 30, 330), r(rng, 45, 65), r(rng, 82, 90));
      hat = hsl(H + r(rng, 60, 300), r(rng, 45, 65), r(rng, 76, 84));
      hatAlt = hsl(H + r(rng, 0, 360), r(rng, 30, 50), r(rng, 90, 95));
      accent = hsl(H + r(rng, 120, 240), r(rng, 55, 75), r(rng, 70, 78));
      break;
    }
    case 'neon': {
      skin = hsl(H, r(rng, 85, 100), r(rng, 58, 66));
      skinAlt = hsl(H + 40, r(rng, 80, 100), r(rng, 80, 88));
      outfit = hsl(H + 120, r(rng, 85, 100), r(rng, 50, 58));
      outfitAlt = hsl(H + 240, r(rng, 85, 100), r(rng, 58, 66));
      hat = hsl(H + 240, r(rng, 85, 100), r(rng, 55, 62));
      hatAlt = hsl(H + 60, r(rng, 85, 100), r(rng, 70, 78));
      accent = hsl(H + 180, r(rng, 90, 100), r(rng, 55, 62));
      break;
    }
  }
  if (mono < 0.03) {
    skin = hsl(H, 10, 95);
    skinAlt = hsl(H, 30, 88);
  } else if (mono < 0.05) {
    skin = hsl(H, 8, 26);
    skinAlt = hsl(H, 12, 40);
  } else if (mono < 0.06) {
    skin = hsl(H, 6, 72);
    skinAlt = hsl(H, 8, 88);
  }
  return finishPalette({ skin, skinAlt, outfit, outfitAlt, hat, hatAlt, accent }, harmony, H);
}

function finishPalette(
  c: {
    skin: string;
    skinAlt: string;
    outfit: string;
    outfitAlt: string;
    hat: string;
    hatAlt: string;
    accent: string;
  },
  harmony: Harmony,
  H: number,
  seasonal?: string,
): Palette {
  const [sh, , sl] = hexToHsl(c.skin);
  const dark = sl < 42;
  const ink = dark ? '#fff4ea' : hsl(sh, 35, 16);
  // Blush: warm pink that still shows on pink skins.
  const pinkSkin = colorName(c.skin) === 'pink' || colorName(c.skin) === 'red';
  const blush = dark ? '#ff8fb1' : pinkSkin ? hsl(350, 80, 60) : hsl(352, 85, 74);
  void H;
  return { ...c, blush, ink, harmony, seasonal, colorTags: [] };
}

function seasonalPalette(rng: Rng, id: string): Palette {
  const sp = SEASONAL_PALETTES[id]!;
  const pickC = () => sp.colors[Math.floor(rng() * sp.colors.length)]!;
  const skin = sp.skins[Math.floor(rng() * sp.skins.length)]!;
  const [h] = hexToHsl(skin);
  return finishPalette(
    {
      skin,
      skinAlt: hsl(h, 40, 92),
      outfit: pickC(),
      outfitAlt: pickC(),
      hat: pickC(),
      hatAlt: pickC(),
      accent: pickC(),
    },
    'seasonal',
    h,
    id,
  );
}
