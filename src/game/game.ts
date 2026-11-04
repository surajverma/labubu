import { generateCharacter, LATEST_GENERATOR_VERSION } from '../gen/generate';
import type { CharacterSpec } from '../gen/types';
import { loadSave, writeSave } from '../save/storage';
import { newSave, type OwnedCharacter, type SaveData } from '../save/schema';
import { drawBox, type BoxKind, type Draw } from './series';
import { ECONOMY, recycleValue } from './economy';
import { decodeGift, encodeGift, randomGiftId } from './gifts';
import type { Rng } from '../rng';

export function charKey(c: { seed: string; v: number; variant?: string }): string {
  return `${c.seed}|${c.v}|${c.variant ?? ''}`;
}

const specCache = new Map<string, CharacterSpec>();
export function specFor(c: { seed: string; v: number; variant?: string }): CharacterSpec {
  const k = charKey(c);
  let s = specCache.get(k);
  if (!s) {
    s = generateCharacter(c.seed, c.v, c.variant);
    if (specCache.size > 3000) specCache.clear();
    specCache.set(k, s);
  }
  return s;
}

export function displayName(o: OwnedCharacter): string {
  return o.nickname?.trim() || specFor(o).name;
}

function uid(): string {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return a[0]!.toString(36) + a[1]!.toString(36);
}

type Listener = (reason: string) => void;

/** Holds the save data and all game actions. UI listens for changes. */
export class Game {
  save: SaveData = newSave();
  private listeners = new Set<Listener>();
  private saveTimer: number | null = null;
  /** Hook for systems (sets, achievements) that react to changes. */
  readonly hooks: ((g: Game, reason: string) => void)[] = [];

  /** Content version unlocked in this build (Phase 1 = 1, Phase 2 = 2). */
  get contentVersion(): number {
    return LATEST_GENERATOR_VERSION;
  }

  async load(): Promise<void> {
    this.save = await loadSave();
  }

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Marks the save dirty, notifies listeners and persists soon. */
  changed(reason: string): void {
    for (const h of this.hooks) h(this, reason);
    for (const l of this.listeners) l(reason);
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), 250) as unknown as number;
  }

  async flush(): Promise<void> {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    await writeSave(this.save);
  }

  find(uidOrKey: string): OwnedCharacter | undefined {
    return this.save.collection.find((c) => c.uid === uidOrKey);
  }

  findByKey(c: { seed: string; v: number; variant?: string }): OwnedCharacter | undefined {
    const k = charKey(c);
    return this.save.collection.find((o) => charKey(o) === k);
  }

  /** Adds a character (or a duplicate copy). */
  addCharacter(
    c: { seed: string; v: number; variant?: string; series?: number; index?: number },
    source: OwnedCharacter['source'],
  ): { owned: OwnedCharacter; isNew: boolean } {
    const existing = this.findByKey(c);
    if (existing) {
      existing.count += 1;
      return { owned: existing, isNew: false };
    }
    const owned: OwnedCharacter = {
      uid: uid(),
      seed: c.seed,
      v: c.v,
      variant: c.variant,
      series: c.series,
      index: c.index,
      foundAt: Date.now(),
      favourite: false,
      count: 1,
      source,
    };
    this.save.collection.push(owned);
    if (!this.save.homeUid) this.save.homeUid = owned.uid;
    if (specFor(owned).rarity === 'secret') this.save.stats.secretsFound++;
    return { owned, isNew: true };
  }

  /** Removes one copy; removes the entry when it was the last. */
  removeOne(uidv: string): boolean {
    const o = this.find(uidv);
    if (!o) return false;
    if (o.count > 1) o.count -= 1;
    else {
      this.save.collection = this.save.collection.filter((x) => x.uid !== uidv);
      if (this.save.homeUid === uidv) this.save.homeUid = this.save.collection[0]?.uid;
    }
    return true;
  }

  addCoins(n: number, reason: string): void {
    if (n <= 0) return;
    this.save.coins += n;
    this.save.stats.coinsEarned += n;
    this.changed(`coins:${reason}`);
  }

  /** Recycle one duplicate copy for coins. Returns coins earned, or null if not allowed. */
  recycle(uidv: string): number | null {
    const o = this.find(uidv);
    if (!o || o.count < 2) return null;
    const value = recycleValue(specFor(o).rarity);
    if (value === null) return null;
    o.count -= 1;
    this.save.stats.recycled++;
    this.addCoins(value, 'recycle');
    return value;
  }

  /** Coins you would get for recycling every duplicate (keeps one of each). */
  duplicatesValue(): { coins: number; copies: number } {
    let coins = 0,
      copies = 0;
    for (const o of this.save.collection) {
      const v = recycleValue(specFor(o).rarity);
      if (v === null || o.count < 2) continue;
      coins += v * (o.count - 1);
      copies += o.count - 1;
    }
    return { coins, copies };
  }

  recycleAllDuplicates(): number {
    let total = 0;
    for (const o of this.save.collection) {
      const v = recycleValue(specFor(o).rarity);
      if (v === null) continue;
      while (o.count > 1) {
        o.count--;
        this.save.stats.recycled++;
        total += v;
      }
    }
    this.addCoins(total, 'recycle');
    return total;
  }

  /** Gifts one copy: removes it from the collection and returns the code to send. */
  async gift(uidv: string): Promise<string | null> {
    const o = this.find(uidv);
    if (!o) return null;
    const spec = specFor(o);
    const code = await encodeGift({ seed: o.seed, v: o.v, variant: o.variant, rarity: spec.rarity, giftId: randomGiftId() });
    this.removeOne(uidv);
    this.save.stats.gifted++;
    this.changed('gift-sent');
    return code;
  }

  /** Redeems a gift code once per device. */
  async redeem(code: string): Promise<{ ok: true; owned: OwnedCharacter; isNew: boolean } | { ok: false; message: string }> {
    const r = await decodeGift(code);
    if (!r.ok) return { ok: false, message: r.reason === 'format' ? 'That doesn’t look like a gift code.' : 'That code isn’t valid — check for typos.' };
    if (this.save.redeemedGifts.includes(r.gift.giftId)) return { ok: false, message: 'This gift was already opened on this phone.' };
    this.save.redeemedGifts.push(r.gift.giftId);
    const { owned, isNew } = this.addCharacter({ seed: r.gift.seed, v: r.gift.v, variant: r.gift.variant }, 'gift');
    this.save.stats.giftsReceived++;
    this.changed('gift');
    return { ok: true, owned, isNew };
  }

  /** Buys from the shop. Normal boxes go to your box pile; others are opened right away. */
  buy(kind: BoxKind): boolean {
    const price = kind === 'normal' ? ECONOMY.shop.box : kind === 'premium' ? ECONOMY.shop.premium : ECONOMY.shop.themed;
    if (this.save.coins < price) return false;
    this.save.coins -= price;
    this.save.stats.boxesBought++;
    if (kind === 'normal') this.save.boxes += 1;
    this.changed('buy');
    return true;
  }

  /**
   * Opens a box. Normal boxes use the box pile; premium boxes use the premium pile unless
   * `paid` (just bought); themed boxes are always bought.
   */
  openBox(kind: BoxKind, rng: Rng, opts: { tag?: string; variant?: string; paid?: boolean } = {}): { draw: Draw; owned: OwnedCharacter; isNew: boolean; spec: CharacterSpec } | null {
    if (kind === 'normal' && this.save.boxes <= 0) return null;
    if (kind === 'premium' && !opts.paid && this.save.premiumBoxes <= 0) return null;
    if (kind === 'normal') this.save.boxes -= 1;
    if (kind === 'premium' && !opts.paid) this.save.premiumBoxes -= 1;
    const draw = drawBox(kind, rng, opts);
    const { owned, isNew } = this.addCharacter(draw, 'box');
    this.save.stats.boxesOpened++;
    this.changed('box');
    return { draw, owned, isNew, spec: specFor(owned) };
  }

  homeCharacter(): OwnedCharacter | undefined {
    return (this.save.homeUid && this.find(this.save.homeUid)) || this.save.collection[0];
  }
}
