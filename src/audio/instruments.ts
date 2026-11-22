import type { Inst } from './compose';

/**
 * Small synthesised instruments built from WebAudio nodes. Each call schedules one note
 * and cleans itself up (oscillators stop, nodes are garbage-collected once silent).
 * Works on both a live AudioContext and an OfflineAudioContext (for the dev preview).
 */

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuf(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 0.6);
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

/** A soft room: generated stereo impulse with an exponential tail. */
export function makeReverb(ctx: BaseAudioContext, seconds = 2.2, decay = 3.2): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const k = i / len;
      // Slight pre-delay and darker tail.
      d[i] = i < ctx.sampleRate * 0.012 ? 0 : (Math.random() * 2 - 1) * Math.pow(1 - k, decay);
    }
  }
  const c = ctx.createConvolver();
  c.buffer = ir;
  return c;
}

export interface Out {
  dry: AudioNode;
  /** Reverb send. */
  wet: AudioNode;
}

function env(
  ctx: BaseAudioContext,
  t: number,
  attack: number,
  peak: number,
  decay: number,
  sustain = 0.0001,
  hold = 0,
  release = 0.08,
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  if (hold > 0) {
    g.gain.setTargetAtTime(Math.max(0.0001, sustain), t + attack, decay / 3);
    g.gain.setTargetAtTime(0.0001, t + attack + hold, release / 3);
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  return g;
}

function osc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  hz: number,
  t: number,
  stop: number,
  detune = 0,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz, t);
  o.detune.value = detune;
  o.start(t);
  o.stop(stop);
  return o;
}

function send(node: AudioNode, out: Out, wet: number): void {
  node.connect(out.dry);
  if (wet > 0) {
    const s = node.context.createGain();
    s.gain.value = wet;
    node.connect(s).connect(out.wet);
  }
}

/**
 * Plays one note. `dur` is the written length in seconds (sustained instruments hold that
 * long; struck ones ring on by themselves).
 */
export function playNote(
  ctx: BaseAudioContext,
  out: Out,
  inst: Inst,
  hz: number,
  t: number,
  dur: number,
  vel: number,
): void {
  const v = Math.max(0.01, Math.min(1, vel));
  switch (inst) {
    case 'pad': {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(500, t);
      f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5);
      f.frequency.linearRampToValueAtTime(600, t + dur);
      f.Q.value = 0.4;
      const g = env(ctx, t, Math.min(1.2, dur * 0.4), 0.05 * v, 0.6, 0.04 * v, dur, 1.4);
      const end = t + dur + 1.6;
      osc(ctx, 'sawtooth', hz, t, end, -9).connect(f);
      osc(ctx, 'sawtooth', hz, t, end, 9).connect(f);
      osc(ctx, 'sine', hz / 2, t, end).connect(f);
      f.connect(g);
      send(g, out, 0.6);
      break;
    }
    case 'bass': {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 520;
      const g = env(ctx, t, 0.012, 0.26 * v, 0.3, 0.13 * v, Math.max(0.08, dur - 0.02), 0.25);
      const end = t + dur + 0.3;
      osc(ctx, 'sine', hz, t, end).connect(f);
      const o2 = osc(ctx, 'triangle', hz * 2, t, end);
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      o2.connect(g2).connect(f);
      f.connect(g);
      send(g, out, 0.05);
      break;
    }
    case 'bell': {
      // Music-box / glockenspiel: inharmonic partials with fast-decaying highs.
      const end = t + 2.2;
      const partials: [number, number, number][] = [
        [1, 0.14, 1.8],
        [2.76, 0.05, 0.5],
        [5.4, 0.025, 0.18],
        [2, 0.035, 0.9],
      ];
      for (const [ratio, amp, dec] of partials) {
        const g = env(ctx, t, 0.003, amp * v, dec);
        osc(ctx, 'sine', hz * ratio, t, end).connect(g);
        send(g, out, 0.45);
      }
      break;
    }
    case 'pluck': {
      // Soft guitar/ukulele: bright attack closing quickly.
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3800, t);
      f.frequency.exponentialRampToValueAtTime(500, t + 0.35);
      f.Q.value = 1.2;
      const g = env(ctx, t, 0.004, 0.13 * v, 0.9);
      const end = t + 1.1;
      osc(ctx, 'triangle', hz, t, end).connect(f);
      const o2 = osc(ctx, 'sawtooth', hz, t, end, 6);
      const g2 = ctx.createGain();
      g2.gain.value = 0.35;
      o2.connect(g2).connect(f);
      f.connect(g);
      send(g, out, 0.3);
      break;
    }
    case 'marimba': {
      const end = t + 0.9;
      const g = env(ctx, t, 0.003, 0.2 * v, 0.55);
      osc(ctx, 'sine', hz, t, end).connect(g);
      const g2 = env(ctx, t, 0.002, 0.07 * v, 0.06);
      osc(ctx, 'sine', hz * 4, t, end).connect(g2);
      send(g, out, 0.22);
      send(g2, out, 0.1);
      break;
    }
    case 'flute': {
      const hold = Math.max(0.12, dur);
      const g = env(ctx, t, 0.07, 0.11 * v, 0.2, 0.085 * v, hold, 0.18);
      const end = t + hold + 0.4;
      const o = osc(ctx, 'sine', hz, t, end);
      // Gentle delayed vibrato.
      const lfo = osc(ctx, 'sine', 5.2, t, end);
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(hz * 0.006, t + 0.35);
      lfo.connect(depth).connect(o.frequency);
      o.connect(g);
      const o3 = osc(ctx, 'triangle', hz * 2, t, end);
      const g3 = ctx.createGain();
      g3.gain.value = 0.12;
      o3.connect(g3).connect(g);
      // Breath.
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf(ctx);
      const bf = ctx.createBiquadFilter();
      bf.type = 'bandpass';
      bf.frequency.value = hz * 2;
      bf.Q.value = 2;
      const bg = env(ctx, t, 0.03, 0.025 * v, 0.15);
      n.connect(bf).connect(bg);
      n.start(t);
      n.stop(t + 0.3);
      send(g, out, 0.4);
      send(bg, out, 0.2);
      break;
    }
    case 'chip': {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2400;
      const hold = Math.max(0.06, dur * 0.8);
      const g = env(ctx, t, 0.004, 0.06 * v, 0.1, 0.04 * v, hold, 0.05);
      const end = t + hold + 0.2;
      osc(ctx, 'square', hz, t, end).connect(f);
      f.connect(g);
      send(g, out, 0.15);
      break;
    }
    case 'keys': {
      // Electric piano: two-operator FM with a decaying index (bell-ish "tine").
      const end = t + Math.max(1.2, dur + 0.6);
      const car = osc(ctx, 'sine', hz, t, end);
      const mod = osc(ctx, 'sine', hz, t, end);
      const idx = ctx.createGain();
      idx.gain.setValueAtTime(hz * 1.6, t);
      idx.gain.exponentialRampToValueAtTime(hz * 0.08, t + 0.5);
      mod.connect(idx).connect(car.frequency);
      const g = env(ctx, t, 0.005, 0.12 * v, 0.5, 0.05 * v, Math.max(0.2, dur), 0.4);
      car.connect(g);
      // Slight stereo-ish chorus via a detuned copy.
      const car2 = osc(ctx, 'sine', hz, t, end, 7);
      const g2 = ctx.createGain();
      g2.gain.value = 0.35;
      car2.connect(g2).connect(g);
      send(g, out, 0.3);
      break;
    }
    case 'kick': {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      const g = env(ctx, t, 0.003, 0.5 * v, 0.28);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.35);
      send(g, out, 0);
      break;
    }
    case 'snap': {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf(ctx);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1900;
      f.Q.value = 1.4;
      const g = env(ctx, t, 0.002, 0.22 * v, 0.11);
      n.connect(f).connect(g);
      n.start(t, Math.random() * 0.3);
      n.stop(t + 0.15);
      send(g, out, 0.25);
      break;
    }
    case 'shaker': {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf(ctx);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6500;
      const g = env(ctx, t, 0.008, 0.09 * v, 0.05);
      n.connect(f).connect(g);
      n.start(t, Math.random() * 0.3);
      n.stop(t + 0.08);
      send(g, out, 0.1);
      break;
    }
    case 'bubble': {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(hz * 0.5, t);
      o.frequency.exponentialRampToValueAtTime(hz * 1.4, t + 0.09);
      const g = env(ctx, t, 0.004, 0.1 * v, 0.12);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.2);
      send(g, out, 0.5);
      break;
    }
  }
}
