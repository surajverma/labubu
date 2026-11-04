/** Save data. Characters are stored as seeds + metadata, never as images. */

export const SAVE_VERSION = 1;

export interface OwnedCharacter {
  /** Unique id of this collection entry. */
  uid: string;
  seed: string;
  /** Generator version. */
  v: number;
  /** Generator variant (seasonal palette id), if any. */
  variant?: string;
  /** Series pool number (e.g. 1) and index in it, when it came from a box. */
  series?: number;
  index?: number;
  foundAt: number;
  nickname?: string;
  favourite: boolean;
  /** Number of copies owned (duplicates). */
  count: number;
  source: 'box' | 'starter' | 'gift' | 'order' | 'trade';
}

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  notifications: boolean;
  /** Hour (0–23) for the daily reminder. */
  notifyHour: number;
  quality: 'auto' | 'low' | 'medium' | 'high';
  /** Auto-detected quality from the first-launch benchmark. */
  detectedQuality?: 'low' | 'medium' | 'high';
  spinMode: 'face' | 'everything';
  reducedMotion: boolean;
}

export interface SaveData {
  saveVersion: number;
  createdAt: number;
  boxes: number;
  collection: OwnedCharacter[];
  /** uid shown on Home. */
  homeUid?: string;
  settings: Settings;
  stats: {
    boxesOpened: number;
    spins: number;
    secretsFound: number;
  };
  /** Earned set badges (set ids). */
  badges: string[];
  /** Dev menu unlocked. */
  dev: boolean;
  /** Things seen once (tutorials, permission prompts). */
  seen: string[];
}

export function defaultSettings(): Settings {
  return {
    sound: true,
    music: false,
    haptics: true,
    notifications: true,
    notifyHour: 18,
    quality: 'auto',
    spinMode: 'face',
    reducedMotion: false,
  };
}

export function newSave(now = Date.now()): SaveData {
  return {
    saveVersion: SAVE_VERSION,
    createdAt: now,
    boxes: 10,
    collection: [],
    settings: defaultSettings(),
    stats: { boxesOpened: 0, spins: 0, secretsFound: 0 },
    badges: [],
    dev: false,
    seen: [],
  };
}
