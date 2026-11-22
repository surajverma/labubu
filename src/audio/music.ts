import { composeBar, midiToHz, MOODS, type Mood } from './compose';
import { makeReverb, playNote, type Out } from './instruments';

/**
 * Plays composed bars on a WebAudio graph:
 *   notes → dry / reverb → compressor → mood gain → destination
 * Mood changes wait for the next bar line so the music never jumps mid-phrase.
 */
export class MusicEngine {
  private out: Out;
  private moodGain: GainNode;
  private mood: Mood;
  private pending: Mood | null = null;
  private bar = 0;
  private nextBarT = 0;
  private prev = { deg: 7 };

  constructor(
    private ctx: BaseAudioContext,
    dest: AudioNode,
    moodId = 'cozy',
  ) {
    this.mood = MOODS[moodId] ?? MOODS.cozy!;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.moodGain = ctx.createGain();
    this.moodGain.gain.value = this.mood.gain ?? 1;
    const dry = ctx.createGain();
    const verb = makeReverb(ctx);
    const wetIn = ctx.createGain();
    const wetOut = ctx.createGain();
    wetOut.gain.value = 0.55;
    wetIn.connect(verb).connect(wetOut).connect(comp);
    dry.connect(comp);
    comp.connect(this.moodGain).connect(dest);
    this.out = { dry, wet: wetIn };
  }

  get moodId(): string {
    return (this.pending ?? this.mood).id;
  }

  /** Switch mood at the next bar line (no-op if already playing it). */
  setMood(id: string): void {
    const m = MOODS[id];
    if (!m || m.id === this.moodId) return;
    this.pending = m;
  }

  /** Start (or restart) the bar clock at time `t`. */
  start(t: number): void {
    this.nextBarT = t;
  }

  private barSeconds(m: Mood): number {
    return (60 / m.bpm) * 4;
  }

  /** Schedules every bar that starts before `until`. Catches up if it fell behind. */
  scheduleUntil(until: number): void {
    const now = this.ctx.currentTime;
    if (this.nextBarT < now - 0.05) this.nextBarT = now + 0.05;
    while (this.nextBarT < until) {
      if (this.pending) {
        this.mood = this.pending;
        this.pending = null;
        this.bar = 0;
        this.prev = { deg: 7 };
        this.moodGain.gain.setTargetAtTime(this.mood.gain ?? 1, this.nextBarT, 0.4);
      }
      const m = this.mood;
      const spb = this.barSeconds(m) / 16;
      for (const e of composeBar(m, this.bar, this.prev)) {
        playNote(
          this.ctx,
          this.out,
          e.inst,
          midiToHz(e.midi),
          this.nextBarT + e.step * spb,
          e.len * spb,
          e.vel,
        );
      }
      this.nextBarT += this.barSeconds(m);
      this.bar++;
    }
  }
}

/**
 * Renders `bars` bars of a mood offline (dev preview and level checks). Returns the
 * rendered buffer.
 */
export async function renderMood(
  moodId: string,
  bars = 8,
  sampleRate = 44100,
): Promise<AudioBuffer> {
  const m = MOODS[moodId] ?? MOODS.cozy!;
  const secs = (60 / m.bpm) * 4 * bars + 2.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = MUSIC_LEVEL;
  master.connect(ctx.destination);
  const eng = new MusicEngine(ctx, master, moodId);
  eng.start(0.05);
  eng.scheduleUntil((60 / m.bpm) * 4 * bars);
  return ctx.startRendering();
}

/** Base loudness of the music bus before the user's volume slider. */
export const MUSIC_LEVEL = 0.65;
