/**
 * Voice-activity segmenter: feed it the loudness (RMS) of each audio block and it tells
 * you when someone started and stopped talking. Pure logic so it can be unit-tested.
 */
export interface VadOptions {
  /** Seconds per block. */
  blockS: number;
  /** Silence that ends an utterance. */
  hangS?: number;
  /** Utterances shorter than this are ignored (coughs, taps). */
  minS?: number;
  /** Utterances are cut at this length. */
  maxS?: number;
  /** Absolute minimum loudness that counts as speech. */
  minLevel?: number;
}

export type VadEvent = 'start' | 'continue' | 'end' | 'discard' | 'silence';

export class VadSegmenter {
  private floor = 0.005;
  private talking = false;
  private quietFor = 0;
  private length = 0;
  private readonly o: Required<VadOptions>;

  constructor(o: VadOptions) {
    this.o = { hangS: 0.7, minS: 0.35, maxS: 6, minLevel: 0.018, ...o };
  }

  /** Current speech threshold: well above the background noise floor. */
  get threshold(): number {
    return Math.max(this.o.minLevel, this.floor * 3.2);
  }

  push(rms: number): VadEvent {
    const { blockS, hangS, minS, maxS } = this.o;
    const loud = rms > this.threshold;
    if (!this.talking) {
      // Track background noise only while nobody is talking.
      this.floor = this.floor * 0.97 + Math.min(rms, 0.05) * 0.03;
      if (!loud) return 'silence';
      this.talking = true;
      this.quietFor = 0;
      this.length = blockS;
      return 'start';
    }
    this.length += blockS;
    this.quietFor = loud ? 0 : this.quietFor + blockS;
    if (this.quietFor >= hangS || this.length >= maxS) {
      this.talking = false;
      const spoken = this.length - this.quietFor;
      return spoken >= minS ? 'end' : 'discard';
    }
    return 'continue';
  }

  reset(): void {
    this.talking = false;
    this.quietFor = 0;
    this.length = 0;
  }
}
