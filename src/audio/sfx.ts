import type { Rarity } from '../gen/types';
import { moodForScene } from './compose';
import { makeReverb, playNote } from './instruments';
import { MUSIC_LEVEL, MusicEngine } from './music';

/**
 * All sounds are synthesised at runtime with WebAudio (no audio files), so there are no
 * licensing questions. Sound effects and music have separate toggles.
 */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  soundOn = true;
  private musicOn = false;
  private musicTimer: number | null = null;
  private engine: MusicEngine | null = null;
  private mood = 'cozy';
  private duckGain: GainNode | null = null;
  private holds = new Map<string, number>();
  private duckSeq = 0;
  private sfxVol = 1;
  private musicVol = 0.8;
  /** Reverb send for sparkly effects (fanfares, landings). */
  private fxVerb: GainNode | null = null;

  /** The shared AudioContext (null until the first user gesture). */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Must be called from a user gesture at least once (autoplay rules). */
  unlock(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55 * this.sfxVol;
      this.master.connect(this.ctx.destination);
      this.fxVerb = this.ctx.createGain();
      this.fxVerb.gain.value = 0.35;
      this.fxVerb.connect(makeReverb(this.ctx, 1.6, 3)).connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.ctx.destination);
      this.duckGain = this.ctx.createGain();
      this.duckGain.connect(this.musicGain);
      this.applyDuck();
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.musicOn) this.startMusic();
  }

  /** Pause all audio (app in background). */
  suspend(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.3,
    when = 0,
    slideTo?: number,
    dest?: AudioNode,
  ): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(
    dur: number,
    freq: number,
    q = 1,
    vol = 0.3,
    when = 0,
    type: BiquadFilterType = 'bandpass',
  ): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  private get on(): boolean {
    return this.soundOn && !!this.ctx;
  }

  tick(): void {
    if (!this.on) return;
    this.tone(1800 + Math.random() * 400, 0.035, 'triangle', 0.12);
  }
  land(): void {
    if (!this.on) return;
    this.tone(220, 0.18, 'sine', 0.35, 0, 110);
    this.tone(880, 0.35, 'triangle', 0.12, 0.03);
    this.tone(1320, 0.3, 'sine', 0.08, 0.06);
  }
  tap(): void {
    if (!this.on) return;
    this.tone(660, 0.06, 'sine', 0.14, 0, 880);
  }
  shake(): void {
    if (!this.on) return;
    for (let i = 0; i < 4; i++) this.noise(0.05, 900 + i * 150, 4, 0.22, i * 0.07);
  }
  pop(): void {
    if (!this.on) return;
    this.noise(0.12, 1500, 0.8, 0.35);
    this.tone(300, 0.18, 'sine', 0.3, 0, 900);
  }
  /** Squeaky vinyl toy being squeezed. */
  squeak(): void {
    if (!this.on) return;
    this.tone(700, 0.09, 'sine', 0.16, 0, 1300);
    this.tone(1200, 0.12, 'triangle', 0.1, 0.08, 800);
  }
  /** Springy jump. */
  boing(): void {
    if (!this.on) return;
    this.tone(180, 0.35, 'sine', 0.25, 0, 520);
    this.tone(360, 0.25, 'triangle', 0.06, 0.02, 900);
  }
  /** Tiny giggle: quick rising blips. */
  giggle(): void {
    if (!this.on) return;
    [880, 1046, 932, 1175, 1046].forEach((f, i) =>
      this.tone(f, 0.06, 'sine', 0.12, i * 0.075, f * 1.12),
    );
  }
  /** Plasticky rattle for a wiggle. */
  rattle(): void {
    if (!this.on) return;
    for (let i = 0; i < 5; i++) this.noise(0.035, 2200 + i * 200, 6, 0.12, i * 0.06);
  }
  /** Sound for a tap reaction. */
  reaction(id: string | null): void {
    if (id === 'squish') this.squeak();
    else if (id === 'spinJump') this.boing();
    else if (id === 'giggle') this.giggle();
    else if (id === 'wiggle') this.rattle();
    else this.tap();
  }

  poof(): void {
    if (!this.on) return;
    this.noise(0.45, 600, 0.6, 0.3, 0, 'lowpass');
    this.tone(500, 0.3, 'sine', 0.1, 0.05, 1200);
  }
  coin(): void {
    if (!this.on) return;
    this.tone(988, 0.08, 'square', 0.06);
    this.tone(1319, 0.25, 'square', 0.06, 0.08);
    this.inst('bell', 100, 0.08, 0.2, 0.25);
  }
  error(): void {
    if (!this.on) return;
    this.tone(220, 0.15, 'triangle', 0.15, 0, 180);
  }
  /** Plays a synth instrument note on the effects bus (with a little room). */
  private inst(
    name: Parameters<typeof playNote>[2],
    midi: number,
    when: number,
    len: number,
    vel: number,
  ): void {
    if (!this.ctx || !this.master || !this.fxVerb) return;
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    playNote(
      this.ctx,
      { dry: this.master, wet: this.fxVerb },
      name,
      hz,
      this.ctx.currentTime + when,
      len,
      vel,
    );
  }

  /** Reveal fanfare: a short tune that grows with rarity. Music ducks underneath. */
  fanfare(r: Rarity): void {
    if (!this.on) return;
    this.duck(0.25, r === 'secret' ? 3.5 : 2.4);
    // Notes as MIDI (C major / G for big ones), with a held chord at the end.
    const runs: Record<Rarity, number[]> = {
      common: [72, 76, 79],
      rare: [72, 76, 79, 84],
      epic: [67, 72, 76, 79, 84],
      legendary: [67, 71, 74, 79, 83, 86],
      secret: [67, 71, 74, 79, 83, 86, 91],
    };
    const chordEnd: Record<Rarity, number[]> = {
      common: [60, 64, 67],
      rare: [60, 64, 67, 72],
      epic: [60, 64, 67, 72],
      legendary: [55, 59, 62, 67, 71],
      secret: [55, 59, 62, 66, 69, 74],
    };
    const notes = runs[r];
    const gap = r === 'common' ? 0.09 : 0.08;
    notes.forEach((m, i) => {
      this.inst('bell', m, i * gap, 0.3, 0.9);
      this.inst('marimba', m - 12, i * gap, 0.2, 0.55);
    });
    const tEnd = notes.length * gap;
    const rank = ['common', 'rare', 'epic', 'legendary', 'secret'].indexOf(r);
    for (const m of chordEnd[r]) {
      this.inst('keys', m, tEnd, 1.2, 0.6 + rank * 0.08);
      if (rank >= 2) this.inst('pad', m, tEnd, 1.6, 0.9);
    }
    this.inst('bass', chordEnd[r][0]! - 12, tEnd, 1.0, 0.8);
    if (rank >= 3) {
      this.inst('kick', 0, tEnd, 0.2, 0.9);
      for (let i = 0; i < 14; i++)
        this.inst('bell', 84 + [0, 4, 7, 11, 12, 16][i % 6]!, tEnd + 0.15 + i * 0.07, 0.2, 0.35);
    }
  }

  /**
   * Builds tension under a box shake: a rising filtered-noise swell plus a pitch
   * riser. Big rarities get a drum roll too.
   */
  riser(seconds: number, drumroll = false): void {
    if (!this.on || !this.ctx || !this.master || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.hold('riser', 0.3);
    window.setTimeout(() => this.hold('riser', null), (seconds + 0.6) * 1000);
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(4200, t + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + seconds);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.12);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + seconds + 0.2);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(880, t + seconds);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.06, t + seconds);
    og.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.1);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + seconds + 0.15);
    if (drumroll) {
      // Snare roll that speeds up.
      let when = seconds * 0.35;
      let gap = 0.11;
      while (when < seconds) {
        this.noise(0.06, 1800, 1.2, 0.05 + (when / seconds) * 0.12, when);
        when += gap;
        gap = Math.max(0.035, gap * 0.93);
      }
    }
  }

  /** Low "whoomp" when the lights drop for a big reveal. */
  dim(): void {
    if (!this.on) return;
    this.tone(90, 0.9, 'sine', 0.3, 0, 45);
    this.noise(0.8, 220, 0.7, 0.15, 0, 'lowpass');
  }

  // --- Music: composed per scene mood (see compose.ts / music.ts). ---
  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  /** Picks the music mood for a scene (switches at the next bar line). */
  setScene(scene: string): void {
    this.mood = moodForScene(scene).id;
    this.engine?.setMood(this.mood);
  }

  /** Sound-effect and music volumes, 0–1. */
  setVolumes(sfxVol: number, musicVol: number): void {
    this.sfxVol = sfxVol;
    this.musicVol = musicVol;
    if (!this.ctx) return;
    this.master?.gain.setTargetAtTime(0.55 * sfxVol, this.ctx.currentTime, 0.05);
    if (this.musicTimer !== null)
      this.musicGain?.gain.setTargetAtTime(MUSIC_LEVEL * musicVol, this.ctx.currentTime, 0.05);
  }

  /**
   * Lowers the music while something else needs the stage. `key` names the reason;
   * pass null to release it. The quietest active hold wins.
   */
  hold(key: string, level: number | null): void {
    if (level === null) this.holds.delete(key);
    else this.holds.set(key, level);
    this.applyDuck();
  }

  /** Briefly lowers the music (e.g. under a fanfare), then restores it. */
  duck(level: number, seconds: number): void {
    const key = `duck${++this.duckSeq}`;
    this.hold(key, level);
    window.setTimeout(() => this.hold(key, null), seconds * 1000);
  }

  private applyDuck(): void {
    if (!this.ctx || !this.duckGain) return;
    let lvl = 1;
    for (const v of this.holds.values()) lvl = Math.min(lvl, v);
    this.duckGain.gain.setTargetAtTime(lvl, this.ctx.currentTime, lvl < 1 ? 0.08 : 0.5);
  }

  private startMusic(): void {
    if (!this.ctx || !this.musicGain || !this.duckGain || this.musicTimer !== null) return;
    if (!this.engine) this.engine = new MusicEngine(this.ctx, this.duckGain, this.mood);
    else this.engine.setMood(this.mood);
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.setTargetAtTime(MUSIC_LEVEL * this.musicVol, this.ctx.currentTime, 0.6);
    this.engine.start(this.ctx.currentTime + 0.1);
    this.musicTimer = window.setInterval(() => this.schedule(), 60);
    this.schedule();
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx && this.musicGain)
      this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
  }

  private schedule(): void {
    if (!this.ctx || !this.engine || this.ctx.state !== 'running') return;
    this.engine.scheduleUntil(this.ctx.currentTime + 0.35);
  }
}

export const sfx = new Sfx();
