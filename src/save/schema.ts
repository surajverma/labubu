/** Save data. Characters are stored as seeds + metadata, never as images. */

export const SAVE_VERSION = 2;

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
  /** Voice used when the buddy repeats what you say. */
  voice: 'normal' | 'funny' | 'robot' | 'deep';
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
    // v2
    coinsEarned: number;
    recycled: number;
    ordersPlayed: number;
    ordersThreeStar: number;
    dailyOrdersPlayed: number;
    maxStreak: number;
    boxesBought: number;
    gifted: number;
    giftsReceived: number;
  };
  // --- v2 (Phase 2) ---
  coins: number;
  /** Premium boxes waiting to be opened (from streak rewards). */
  premiumBoxes: number;
  daily: DailyState;
  orders: OrdersState;
  /** Earned achievement ids. */
  achievements: string[];
  /** Gift ids already redeemed on this device (Phase 3). */
  redeemedGifts: string[];
  /** Earned set badges (set ids). */
  badges: string[];
  /** Dev menu unlocked. */
  dev: boolean;
  /** Things seen once (tutorials, permission prompts). */
  seen: string[];
}

export interface DailyState {
  /** Local date (YYYY-MM-DD) of the last claimed daily box. */
  lastClaimDay: string | null;
  streak: number;
  /** ISO week id (YYYY-Www) in which the automatic streak freeze was used. */
  freezeUsedWeek: string | null;
  /** Highest wall-clock time ever seen (clock-change guard). */
  maxSeenTime: number;
  /** Day of the last login-coin grant. */
  lastLoginDay: string | null;
}

export interface OrdersState {
  /** Best stars per level id. */
  best: Record<string, number>;
  /** Daily order results by date. */
  daily: Record<string, { stars: number; score: number }>;
  tutorialDone: boolean;
}

export function defaultDaily(): DailyState {
  return {
    lastClaimDay: null,
    streak: 0,
    freezeUsedWeek: null,
    maxSeenTime: 0,
    lastLoginDay: null,
  };
}

export function defaultStats(): SaveData['stats'] {
  return {
    boxesOpened: 0,
    spins: 0,
    secretsFound: 0,
    coinsEarned: 0,
    recycled: 0,
    ordersPlayed: 0,
    ordersThreeStar: 0,
    dailyOrdersPlayed: 0,
    maxStreak: 0,
    boxesBought: 0,
    gifted: 0,
    giftsReceived: 0,
  };
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
    voice: 'funny',
  };
}

export function newSave(now = Date.now()): SaveData {
  return {
    saveVersion: SAVE_VERSION,
    createdAt: now,
    boxes: 10,
    collection: [],
    settings: defaultSettings(),
    stats: defaultStats(),
    badges: [],
    dev: false,
    seen: [],
    coins: 0,
    premiumBoxes: 0,
    daily: defaultDaily(),
    orders: { best: {}, daily: {}, tutorialDone: false },
    achievements: [],
    redeemedGifts: [],
  };
}
