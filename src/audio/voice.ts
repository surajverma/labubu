import { sfx } from './sfx';
import { VadSegmenter } from './vad';

/**
 * "Repeat after me": listens to the microphone, detects when you stop talking and plays
 * it back in a buddy voice. Everything happens in memory on the device — audio is never
 * saved or sent anywhere.
 */
export const VOICES = [
  { id: 'normal', label: 'Normal', icon: '🙂' },
  { id: 'funny', label: 'Funny', icon: '🐿️' },
  { id: 'robot', label: 'Robot', icon: '🤖' },
  { id: 'deep', label: 'Deep', icon: '🐻' },
] as const;
export type VoiceId = (typeof VOICES)[number]['id'];

export type MimicState = 'off' | 'listening' | 'hearing' | 'speaking';

const BLOCK = 2048;
const PREROLL_S = 0.25;

export class VoiceMimic {
  voice: VoiceId = 'funny';
  /** 0..1 loudness of what the buddy is saying (for lip-sync). */
  level = 0;
  private stream: MediaStream | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private proc: ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private vad: VadSegmenter | null = null;
  private chunks: Float32Array[] = [];
  private preroll: Float32Array[] = [];
  private last: AudioBuffer | null = null;
  private playing: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private meter = new Float32Array(1024);
  private st: MimicState = 'off';
  private muteUntil = 0;

  constructor(private onState: (s: MimicState) => void) {}

  get state(): MimicState {
    return this.st;
  }

  get hasRecording(): boolean {
    return this.last !== null;
  }

  static supported(): boolean {
    return !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== 'undefined';
  }

  private set(s: MimicState): void {
    this.st = s;
    this.onState(s);
  }

  /** Asks for the microphone (first time) and starts listening. */
  async start(): Promise<void> {
    if (this.st !== 'off') return;
    sfx.unlock();
    const ctx = sfx.context;
    if (!ctx) throw new Error('Audio is not available');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.src = ctx.createMediaStreamSource(this.stream);
    this.proc = ctx.createScriptProcessor(BLOCK, 1, 1);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0; // keep the processor running without playing the mic
    this.vad = new VadSegmenter({ blockS: BLOCK / ctx.sampleRate });
    const prerollBlocks = Math.ceil((PREROLL_S * ctx.sampleRate) / BLOCK);
    this.proc.onaudioprocess = (e) => {
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      // Ignore the mic while the buddy talks (and a moment after), so it doesn't echo itself.
      if (this.st === 'speaking' || ctx.currentTime < this.muteUntil) return;
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!;
      const ev = this.vad!.push(Math.sqrt(sum / data.length));
      if (ev === 'silence') {
        this.preroll.push(data);
        if (this.preroll.length > prerollBlocks) this.preroll.shift();
      } else if (ev === 'start') {
        this.chunks = [...this.preroll, data];
        this.preroll = [];
        this.set('hearing');
      } else if (ev === 'continue') {
        this.chunks.push(data);
      } else if (ev === 'discard') {
        this.chunks = [];
        this.set('listening');
      } else if (ev === 'end') {
        this.chunks.push(data);
        this.last = this.toBuffer(ctx);
        this.chunks = [];
        this.play();
      }
    };
    this.src.connect(this.proc);
    this.proc.connect(this.sink).connect(ctx.destination);
    this.set('listening');
  }

  stop(): void {
    this.playing?.stop();
    this.playing = null;
    if (this.proc) this.proc.onaudioprocess = null;
    this.src?.disconnect();
    this.proc?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = this.src = this.proc = this.sink = null;
    this.chunks = [];
    this.preroll = [];
    this.level = 0;
    this.set('off');
  }

  private toBuffer(ctx: AudioContext): AudioBuffer {
    const len = this.chunks.reduce((a, c) => a + c.length, 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const out = buf.getChannelData(0);
    let off = 0;
    let peak = 0;
    for (const c of this.chunks) {
      out.set(c, off);
      off += c.length;
    }
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]!));
    // Normalise so quiet voices still come back loud and clear.
    const g = peak > 0 ? Math.min(6, 0.85 / peak) : 1;
    for (let i = 0; i < out.length; i++) out[i]! *= g;
    // Short fades avoid clicks.
    const f = Math.min(400, out.length >> 2);
    for (let i = 0; i < f; i++) {
      out[i]! *= i / f;
      out[out.length - 1 - i]! *= i / f;
    }
    return buf;
  }

  /** Plays the last recording again (e.g. after picking another voice). */
  replay(): void {
    if (this.last && this.st !== 'speaking') this.play();
  }

  private play(): void {
    const ctx = sfx.context;
    if (!ctx || !this.last) return;
    this.vad?.reset();
    const src = ctx.createBufferSource();
    src.buffer = this.last;
    const out = ctx.createGain();
    out.gain.value = 1;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    const nodes: AudioNode[] = [];
    switch (this.voice) {
      case 'funny':
        src.playbackRate.value = 1.6;
        break;
      case 'deep':
        src.playbackRate.value = 0.72;
        out.gain.value = 1.2;
        break;
      case 'robot': {
        // Ring modulator (voice × low sine) + metallic comb filter.
        const ring = ctx.createGain();
        ring.gain.value = 0;
        const carrier = ctx.createOscillator();
        carrier.frequency.value = 60;
        carrier.connect(ring.gain);
        carrier.start();
        carrier.stop(ctx.currentTime + this.last.duration + 0.5);
        const delay = ctx.createDelay(0.05);
        delay.delayTime.value = 0.009;
        const fb = ctx.createGain();
        fb.gain.value = 0.55;
        delay.connect(fb).connect(delay);
        src.connect(ring);
        ring.connect(delay);
        nodes.push(delay);
        out.gain.value = 1.6;
        break;
      }
      default:
        break;
    }
    const tail = nodes.length ? nodes[nodes.length - 1]! : src;
    tail.connect(out);
    if (this.voice === 'robot') {
      // Keep a little dry signal so words stay understandable.
      const dry = ctx.createGain();
      dry.gain.value = 0.25;
      src.connect(dry).connect(out);
    }
    out.connect(this.analyser);
    out.connect(ctx.destination);
    src.onended = () => {
      if (this.playing !== src) return;
      this.playing = null;
      this.level = 0;
      this.muteUntil = ctx.currentTime + 0.35;
      if (this.st !== 'off') this.set('listening');
    };
    this.playing = src;
    this.set('speaking');
    src.start();
  }

  /** Call every frame while speaking: updates `level` (0..1) for the mouth/head animation. */
  sample(): number {
    if (this.st !== 'speaking' || !this.analyser) {
      this.level *= 0.8;
      return this.level;
    }
    this.analyser.getFloatTimeDomainData(this.meter);
    let sum = 0;
    for (let i = 0; i < this.meter.length; i++) sum += this.meter[i]! * this.meter[i]!;
    const rms = Math.sqrt(sum / this.meter.length);
    const target = Math.min(1, rms * 4);
    this.level += (target - this.level) * 0.5;
    return this.level;
  }
}
