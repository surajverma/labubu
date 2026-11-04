/** Pure data types for characters. No Three.js here. */

export const RARITIES = ['common', 'rare', 'epic', 'legendary', 'secret'] as const;
export type Rarity = (typeof RARITIES)[number];

export const LAYERS = [
  'body',
  'head',
  'ears',
  'eyes',
  'brows',
  'mouth',
  'nose',
  'cheeks',
  'hat',
  'outfit',
  'accessory',
  'scene',
] as const;
export type Layer = (typeof LAYERS)[number];

/** Layers that make up the spinning face panel. */
export const FACE_LAYERS = ['eyes', 'brows', 'mouth', 'nose', 'cheeks'] as const;
export type FaceLayer = (typeof FACE_LAYERS)[number];

export type Finish = 'glossy' | 'matte' | 'pearl' | 'glitter' | 'metallic' | 'galaxy';

export interface PartDef {
  id: string;
  name: string;
  /** Relative pick weight (higher = more common). */
  weight: number;
  /** Tags used by sets and order challenges. */
  tags: readonly string[];
  /** First generator version that contains this part. */
  since: number;
  /** Only Secret characters can get this part. */
  secretOnly?: boolean;
}

export interface Palette {
  /** Main vinyl colour (skin). */
  skin: string;
  /** Secondary skin colour (belly, inner ears, paws). */
  skinAlt: string;
  /** Outfit main + trim. */
  outfit: string;
  outfitAlt: string;
  /** Hat main + trim. */
  hat: string;
  hatAlt: string;
  /** Accessory colour. */
  accent: string;
  /** Cheek blush. */
  blush: string;
  /** Face ink (outlines, pupils). */
  ink: string;
  /** Harmony rule used. */
  harmony: 'analogous' | 'complementary' | 'pastel' | 'neon' | 'seasonal';
  /** Named seasonal palette id when harmony = seasonal. */
  seasonal?: string;
  /** Colour-name tags for this palette (e.g. "red", "pink"). */
  colorTags: string[];
}

export interface FaceSpec {
  eyes: string;
  brows: string;
  mouth: string;
  nose: string;
  cheeks: string;
}

export interface CharacterSpec {
  generatorVersion: number;
  seed: string;
  name: string;
  rarity: Rarity;
  /** Surprisal score: higher = rarer. */
  score: number;
  finish: Finish;
  palette: Palette;
  body: string;
  head: string;
  ears: string;
  face: FaceSpec;
  hat: string;
  outfit: string;
  accessory: string;
  scene: string;
  /** Extra flags from compatibility rules / secret parts. */
  mods: {
    /** Ears drawn shorter (tall hat). */
    shortEars?: boolean;
    /** Ears hidden (hood / helmet). */
    hideEars?: boolean;
    /** Secret extras. */
    halo?: boolean;
    glowEyes?: boolean;
  };
  /** All tags from every part + palette + finish. */
  tags: string[];
}
