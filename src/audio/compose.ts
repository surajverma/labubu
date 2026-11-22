import { rngFromString, type Rng } from '../rng';

/**
 * Pure music composition: turns a mood + bar number into note events. No WebAudio here,
 * so it is deterministic and unit-tested. The engine in music.ts plays the events.
 *
 * Time is counted in 16th notes; a bar is 16 steps.
 */

export type Inst =
  | 'pad'
  | 'bass'
  | 'bell'
  | 'pluck'
  | 'marimba'
  | 'flute'
  | 'chip'
  | 'keys'
  | 'kick'
  | 'snap'
  | 'shaker'
  | 'bubble';

export interface NoteEvent {
  /** Start, in 16th-note steps from the start of the bar (may be fractional for swing). */
  step: number;
  inst: Inst;
  /** MIDI note number (ignored for drums). */
  midi: number;
  /** Length in 16th-note steps. */
  len: number;
  /** 0–1 loudness. */
  vel: number;
  /** Which part of the arrangement the note belongs to. */
  part?: 'melody' | 'sprinkle' | 'approach';
}

export interface Mood {
  id: string;
  bpm: number;
  /** MIDI note of the key's root (around middle C). */
  root: number;
  /** Scale as semitone offsets from the root. */
  scale: number[];
  /** One chord per bar, as a scale degree (0-based) for the chord root; 8 bars loop. */
  chords: number[];
  /** Add the 7th to chords (jazzy). */
  sevenths?: boolean;
  lead: Inst;
  /** Arpeggio / accompaniment instrument, if any. */
  comp?: Inst;
  /** How the comp plays: rolling 8ths, offbeat stabs, or slow broken chords. */
  compStyle?: 'roll' | 'stab' | 'broken';
  pad?: boolean;
  bass?: 'root' | 'walk' | 'pulse';
  drums?: 'none' | 'soft' | 'bouncy' | 'lofi';
  shaker?: boolean;
  /** Extra sparkle instrument hits (bubbles under water, bells in snow). */
  sprinkle?: Inst;
  /** 0–1: how many melody notes per bar. */
  density: number;
  /** 0–0.5: delay of off-beat 16ths (0 = straight). */
  swing?: number;
  /** Music bus loudness for this mood. */
  gain?: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export const MOODS: Record<string, Mood> = {
  cozy: {
    id: 'cozy',
    bpm: 84,
    root: 60,
    scale: MAJOR,
    chords: [0, 5, 3, 4, 0, 5, 1, 4],
    lead: 'bell',
    comp: 'pluck',
    compStyle: 'broken',
    pad: true,
    bass: 'root',
    drums: 'none',
    density: 0.45,
  },
  beach: {
    id: 'beach',
    bpm: 100,
    root: 65,
    scale: MAJOR,
    chords: [0, 3, 4, 0, 5, 3, 4, 4],
    lead: 'marimba',
    comp: 'pluck',
    compStyle: 'stab',
    bass: 'pulse',
    drums: 'soft',
    shaker: true,
    density: 0.55,
    swing: 0.18,
    gain: 1.3,
  },
  winter: {
    id: 'winter',
    bpm: 70,
    root: 62,
    scale: MAJOR,
    chords: [0, 4, 5, 3, 0, 4, 3, 4],
    lead: 'bell',
    comp: 'keys',
    compStyle: 'broken',
    pad: true,
    bass: 'root',
    drums: 'none',
    sprinkle: 'bell',
    density: 0.35,
  },
  dreamy: {
    id: 'dreamy',
    bpm: 66,
    root: 62,
    scale: LYDIAN,
    chords: [0, 1, 0, 1, 5, 4, 0, 1],
    lead: 'flute',
    comp: 'bell',
    compStyle: 'roll',
    pad: true,
    bass: 'root',
    drums: 'none',
    density: 0.3,
    gain: 1.1,
  },
  bouncy: {
    id: 'bouncy',
    bpm: 116,
    root: 60,
    scale: MAJOR,
    chords: [0, 5, 3, 4, 0, 5, 3, 4],
    lead: 'chip',
    comp: 'marimba',
    compStyle: 'stab',
    bass: 'walk',
    drums: 'bouncy',
    density: 0.65,
    gain: 1.3,
  },
  folk: {
    id: 'folk',
    bpm: 92,
    root: 62,
    scale: DORIAN,
    chords: [0, 6, 0, 3, 0, 6, 2, 3],
    lead: 'flute',
    comp: 'pluck',
    compStyle: 'roll',
    bass: 'root',
    drums: 'soft',
    density: 0.5,
    swing: 0.12,
  },
  ocean: {
    id: 'ocean',
    bpm: 72,
    root: 57,
    scale: MINOR,
    chords: [0, 5, 2, 6, 0, 5, 3, 4],
    lead: 'keys',
    comp: 'bell',
    compStyle: 'broken',
    pad: true,
    bass: 'root',
    drums: 'none',
    sprinkle: 'bubble',
    density: 0.35,
  },
  lofi: {
    id: 'lofi',
    bpm: 78,
    root: 60,
    scale: MAJOR,
    chords: [1, 4, 0, 5, 1, 4, 0, 0],
    sevenths: true,
    lead: 'keys',
    comp: 'keys',
    compStyle: 'stab',
    bass: 'walk',
    drums: 'lofi',
    density: 0.4,
    swing: 0.28,
  },
  /** Box screen: quiet ticking anticipation (no melody). */
  box: {
    id: 'box',
    bpm: 96,
    root: 57,
    scale: MINOR,
    chords: [0, 0, 5, 5, 3, 3, 4, 4],
    lead: 'pluck',
    comp: 'marimba',
    compStyle: 'roll',
    pad: true,
    bass: 'pulse',
    drums: 'none',
    density: 0,
    gain: 1.2,
  },
};

/** Which mood plays for each scene. Unknown scenes fall back to cozy. */
export const SCENE_MOOD: Record<string, string> = {
  studio: 'cozy',
  bedroom: 'cozy',
  garden: 'cozy',
  beach: 'beach',
  sunset: 'beach',
  snowy: 'winter',
  crystal: 'winter',
  space: 'dreamy',
  clouds: 'dreamy',
  candy: 'bouncy',
  arcade: 'bouncy',
  forest: 'folk',
  autumn: 'folk',
  desert: 'folk',
  underwater: 'ocean',
  rooftop: 'lofi',
  boxroom: 'box',
};

export function moodForScene(scene: string): Mood {
  return MOODS[SCENE_MOOD[scene] ?? 'cozy'] ?? MOODS.cozy!;
}

/** MIDI note of a scale degree (any integer, wraps into octaves). */
export function degreeToMidi(m: Mood, degree: number): number {
  const n = m.scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return m.root + oct * 12 + m.scale[idx]!;
}

/** Chord tones (as scale degrees) for a bar. */
export function chordDegrees(m: Mood, bar: number): number[] {
  const r = m.chords[((bar % m.chords.length) + m.chords.length) % m.chords.length]!;
  return m.sevenths ? [r, r + 2, r + 4, r + 6] : [r, r + 2, r + 4];
}

/** Rhythm cells for the melody (16th-note onsets within a half bar of 8 steps). */
const CELLS: number[][] = [
  [0, 4],
  [0, 2, 4],
  [0, 3, 6],
  [0, 4, 6],
  [0, 2, 4, 6],
  [0],
  [2, 4, 6],
  [0, 6],
];

/**
 * Melody for one bar of a phrase. Phrases are 4 bars; the 16-bar form is A A' B A, so
 * tunes repeat enough to be hummable but vary over time.
 */
function melodyBar(m: Mood, bar: number, prev: { deg: number }): NoteEvent[] {
  if (m.density <= 0) return [];
  const section = Math.floor(bar / 4) % 4; // 0 A, 1 A', 2 B, 3 A
  const inPhrase = bar % 4;
  const theme = section === 2 ? 'B' : 'A';
  const rng: Rng = rngFromString(`${m.id}|${theme}|${inPhrase}`);
  // A' varies the last bar so the phrase answers instead of repeating.
  const vary = section === 1 && inPhrase === 3 ? rngFromString(`${m.id}|A2`) : null;
  const chord = chordDegrees(m, bar);
  const out: NoteEvent[] = [];
  const onsets: number[] = [];
  for (const half of [0, 8]) {
    const r = vary ?? rng;
    const busy = r() < m.density;
    const cell = busy ? CELLS[Math.floor(r() * CELLS.length)]! : [0];
    if (!busy && r() < 0.4) continue; // a rest
    for (const s of cell) onsets.push(half + s);
  }
  // Last bar of a phrase ends on a long chord tone.
  if (inPhrase === 3) {
    const keep = onsets.filter((s) => s < 8);
    onsets.length = 0;
    onsets.push(...keep, 8);
  }
  const base = 7; // melody sits an octave above the root
  let deg = prev.deg;
  onsets.forEach((s, i) => {
    const r = vary ?? rng;
    const strong = s % 4 === 0;
    if (strong || i === onsets.length - 1) {
      // Nearest chord tone to the previous note (in the melody octave).
      let best = deg,
        bestD = 99;
      for (const c of chord)
        for (const o of [-7, 0, 7]) {
          const d = base + c + o;
          const dist = Math.abs(d - deg) + (r() < 0.25 ? 1 : 0);
          if (dist < bestD && d >= base - 2 && d <= base + 9) {
            bestD = dist;
            best = d;
          }
        }
      deg = best;
    } else {
      deg += r() < 0.5 ? 1 : -1;
      if (r() < 0.2) deg += r() < 0.5 ? 1 : -1;
      deg = Math.max(base - 2, Math.min(base + 9, deg));
    }
    const next = onsets[i + 1] ?? 16;
    const len = Math.min(next - s, inPhrase === 3 && s === 8 ? 8 : 6);
    out.push({
      step: s,
      inst: m.lead,
      part: 'melody',
      midi: degreeToMidi(m, deg),
      len,
      vel: strong ? 0.75 : 0.55,
    });
  });
  prev.deg = deg;
  return out;
}

function compBar(m: Mood, bar: number): NoteEvent[] {
  if (!m.comp) return [];
  const chord = chordDegrees(m, bar).map((d) => degreeToMidi(m, d));
  const out: NoteEvent[] = [];
  if (m.compStyle === 'stab') {
    for (const s of [4, 12])
      chord.forEach((n) => out.push({ step: s, inst: m.comp!, midi: n, len: 2, vel: 0.4 }));
    if (bar % 2 === 1)
      chord.forEach((n) => out.push({ step: 14, inst: m.comp!, midi: n, len: 1, vel: 0.28 }));
  } else if (m.compStyle === 'broken') {
    const order = [0, 1, 2, 1];
    order.forEach((ci, i) =>
      out.push({
        step: i * 4,
        inst: m.comp!,
        midi: chord[ci]!,
        len: 4,
        vel: i === 0 ? 0.45 : 0.32,
      }),
    );
  } else {
    const order = [0, 1, 2, 1, 2, 0, 1, 2];
    order.forEach((ci, i) =>
      out.push({
        step: i * 2,
        inst: m.comp!,
        midi: chord[ci % chord.length]! + (i >= 4 ? 12 : 0),
        len: 2,
        vel: i % 2 === 0 ? 0.32 : 0.22,
      }),
    );
  }
  return out;
}

function bassBar(m: Mood, bar: number): NoteEvent[] {
  if (!m.bass) return [];
  const chord = chordDegrees(m, bar);
  const root = degreeToMidi(m, chord[0]!) - 24;
  if (m.bass === 'root') return [{ step: 0, inst: 'bass', midi: root, len: 16, vel: 0.5 }];
  if (m.bass === 'pulse')
    return [0, 6, 8, 14].map((s, i) => ({
      step: s,
      inst: 'bass' as Inst,
      midi: i === 2 ? root + 7 : root,
      len: 2,
      vel: i === 0 ? 0.65 : 0.45,
    }));
  // Walk: root, third, fifth, approach note to next bar's root.
  const next = degreeToMidi(m, chordDegrees(m, bar + 1)[0]!) - 24;
  const third = degreeToMidi(m, chord[1]!) - 24;
  const fifth = degreeToMidi(m, chord[2]!) - 24;
  const approach = next + (next > fifth ? -1 : 1);
  return [root, third, fifth, approach].map((n, i) => ({
    step: i * 4,
    inst: 'bass' as Inst,
    ...(i === 3 ? { part: 'approach' as const } : {}),
    midi: n,
    len: 3,
    vel: i === 0 ? 0.65 : 0.5,
  }));
}

function drumBar(m: Mood, bar: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  const d = m.drums ?? 'none';
  const add = (inst: Inst, step: number, vel: number): void => {
    out.push({ step, inst, midi: 0, len: 1, vel });
  };
  if (d === 'soft') {
    add('kick', 0, 0.55);
    add('kick', 8, 0.4);
    add('snap', 12, 0.25);
  } else if (d === 'bouncy') {
    for (const s of [0, 8]) add('kick', s, 0.6);
    if (bar % 2 === 1) add('kick', 10, 0.35);
    for (const s of [4, 12]) add('snap', s, 0.4);
  } else if (d === 'lofi') {
    add('kick', 0, 0.6);
    add('kick', 7, 0.35);
    add('kick', 10, 0.45);
    for (const s of [4, 12]) add('snap', s, 0.35);
  }
  if (m.shaker || d === 'lofi' || d === 'bouncy')
    for (let s = 0; s < 16; s += 2) add('shaker', s, s % 4 === 0 ? 0.22 : 0.14);
  return out;
}

function sprinkleBar(m: Mood, bar: number): NoteEvent[] {
  if (!m.sprinkle) return [];
  const rng = rngFromString(`${m.id}|sprinkle|${bar % 8}`);
  const out: NoteEvent[] = [];
  const n = Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const deg = 14 + Math.floor(rng() * 7);
    out.push({
      step: Math.floor(rng() * 16),
      inst: m.sprinkle,
      part: 'sprinkle',
      midi: degreeToMidi(m, deg),
      len: 4,
      vel: 0.18 + rng() * 0.12,
    });
  }
  return out;
}

/** Applies swing: off-beat 8ths (steps 2, 6, 10, 14) are delayed. */
function swingify(m: Mood, ev: NoteEvent[]): NoteEvent[] {
  const sw = m.swing ?? 0;
  if (!sw) return ev;
  return ev.map((e) => (e.step % 4 === 2 ? { ...e, step: e.step + sw * 2 } : e));
}

/**
 * Every note of bar `bar` (any non-negative integer; the music loops every 16 bars).
 * `prev` carries the melody's last note between bars so lines connect smoothly.
 */
export function composeBar(m: Mood, bar: number, prev = { deg: 7 }): NoteEvent[] {
  const b = bar % 16;
  const ev: NoteEvent[] = [];
  if (m.pad) {
    for (const d of chordDegrees(m, b))
      ev.push({ step: 0, inst: 'pad', midi: degreeToMidi(m, d) - 12, len: 16, vel: 0.5 });
  }
  ev.push(...bassBar(m, b), ...compBar(m, b), ...drumBar(m, b), ...sprinkleBar(m, b));
  ev.push(...melodyBar(m, b, prev));
  return swingify(m, ev).sort((a, b2) => a.step - b2.step);
}

export function midiToHz(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}
