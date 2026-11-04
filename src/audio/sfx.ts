import type { Rarity } from '../gen/types';

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
  private nextBeat = 0;
  private beat = 0;

  /** Must be called from a user gesture at least once (autoplay rules). */
  unlock(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.ctx.destination);
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
  poof(): void {
    if (!this.on) return;
    this.noise(0.45, 600, 0.6, 0.3, 0, 'lowpass');
    this.tone(500, 0.3, 'sine', 0.1, 0.05, 1200);
  }
  coin(): void {
    if (!this.on) return;
    this.tone(988, 0.08, 'square', 0.08);
    this.tone(1319, 0.25, 'square', 0.08, 0.08);
  }
  error(): void {
    if (!this.on) return;
    this.tone(220, 0.15, 'triangle', 0.15, 0, 180);
  }
  fanfare(r: Rarity): void {
    if (!this.on) return;
    const scales: Record<Rarity, number[]> = {
      common: [523, 659],
      rare: [523, 659, 784],
      epic: [523, 659, 784, 1047],
      legendary: [392, 523, 659, 784, 1047, 1319],
      secret: [392, 494, 587, 784, 988, 1175, 1568],
    };
    const notes = scales[r];
    notes.forEach((f, i) => {
      this.tone(f, 0.4, 'triangle', 0.16, i * 0.09);
      this.tone(f * 2, 0.3, 'sine', 0.05, i * 0.09 + 0.02);
    });
    if (r === 'legendary' || r === 'secret') {
      for (let i = 0; i < 10; i++)
        this.tone(2000 + Math.random() * 2000, 0.12, 'sine', 0.04, 0.5 + i * 0.06);
    }
  }

  // --- Music: a soft generated lullaby loop (pad + pluck), 8 bars. ---
  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private startMusic(): void {
    if (!this.ctx || !this.musicGain || this.musicTimer !== null) return;
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 1.5);
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 100);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx && this.musicGain)
      this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
  }

  private schedule(): void {
    if (!this.ctx || !this.musicGain) return;
    const spb = 60 / 84 / 2; // eighth notes at 84 bpm
    // I – vi – IV – V in C major.
    const chords = [
      [261.6, 329.6, 392.0],
      [220.0, 261.6, 329.6],
      [174.6, 220.0, 261.6],
      [196.0, 246.9, 293.7],
    ];
    while (this.nextBeat < this.ctx.currentTime + 0.3) {
      const bar = Math.floor(this.beat / 8) % 8;
      const ch = chords[Math.floor(bar / 2) % 4]!;
      const step = this.beat % 8;
      const when = this.nextBeat - this.ctx.currentTime;
      if (step === 0)
        ch.forEach((f) =>
          this.tone(f / 2, spb * 8, 'sine', 0.12, when, undefined, this.musicGain!),
        );
      const arp = [0, 1, 2, 1, 2, 0, 1, 2][step]!;
      if (step % 2 === 0 || Math.random() < 0.3)
        this.tone(ch[arp]! * 2, spb * 1.6, 'triangle', 0.08, when, undefined, this.musicGain!);
      this.nextBeat += spb;
      this.beat++;
    }
  }
}

export const sfx = new Sfx();
