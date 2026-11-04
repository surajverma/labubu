import { generateCharacter, LATEST_GENERATOR_VERSION } from '../gen/generate';
import type { CharacterSpec } from '../gen/types';
import { loadSave, writeSave } from '../save/storage';
import { newSave, type OwnedCharacter, type SaveData } from '../save/schema';
import { drawBox, type BoxKind, type Draw } from './series';
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
    this.saveTimer = window.setTimeout(() => this.flush(), 250);
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

  openBox(kind: BoxKind, rng: Rng, opts: { tag?: string; variant?: string } = {}): { draw: Draw; owned: OwnedCharacter; isNew: boolean; spec: CharacterSpec } | null {
    if (kind === 'normal' && this.save.boxes <= 0) return null;
    if (kind === 'normal') this.save.boxes -= 1;
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
