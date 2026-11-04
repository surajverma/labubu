import { charKey, specFor } from '../game/game';
import { Thumbnailer } from '../render/thumbnails';
import type { Stage } from '../render/stage';
import { idbGet, idbSet } from './idb';

/** Bump when character visuals change so cached thumbnails are re-rendered. */
const THUMB_VERSION = 3;
const SIZE = 256;

type Req = { key: string; c: { seed: string; v: number; variant?: string }; resolve: (url: string) => void };

/**
 * Thumbnails are rendered once (one per frame, so the UI stays smooth) and cached in
 * IndexedDB as WebP data URLs.
 */
export class ThumbService {
  private queue: Req[] = [];
  private pending = new Map<string, Promise<string>>();
  private thumbnailer: Thumbnailer;
  private scheduled = false;
  private idleTimer: number | null = null;

  constructor(stage: Stage) {
    this.thumbnailer = new Thumbnailer(stage);
  }

  get(c: { seed: string; v: number; variant?: string }): Promise<string> {
    const key = `thumb:${THUMB_VERSION}:${charKey(c)}`;
    const p = this.pending.get(key);
    if (p) return p;
    const prom = idbGet(key).then(
      (hit) =>
        hit ??
        new Promise<string>((resolve) => {
          this.queue.push({ key, c, resolve });
          this.pump();
        }),
    );
    this.pending.set(key, prom);
    return prom;
  }

  /** Front-of-queue for visible tiles. */
  prioritise(c: { seed: string; v: number; variant?: string }): void {
    const key = `thumb:${THUMB_VERSION}:${charKey(c)}`;
    const i = this.queue.findIndex((q) => q.key === key);
    if (i > 0) this.queue.unshift(...this.queue.splice(i, 1));
  }

  private pump(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      const job = this.queue.shift();
      if (!job) return;
      let url = '';
      try {
        url = this.thumbnailer.render(specFor(job.c), SIZE);
      } catch (e) {
        console.warn('thumbnail failed', e);
      }
      job.resolve(url);
      if (url) void idbSet(job.key, url);
      if (this.queue.length) this.pump();
      else this.scheduleCleanup();
    });
  }

  private scheduleCleanup(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.thumbnailer.dispose(), 3000);
  }
}
