import { describe, expect, it } from 'vitest';
import {
  chordDegrees,
  composeBar,
  degreeToMidi,
  midiToHz,
  moodForScene,
  MOODS,
  SCENE_MOOD,
} from '../src/audio/compose';
import { SCENES } from '../src/render/scenes';

describe('music composer', () => {
  it('maps every scene to a real mood', () => {
    for (const id of Object.keys(SCENES)) {
      expect(SCENE_MOOD[id], `scene ${id}`).toBeDefined();
      expect(MOODS[SCENE_MOOD[id]!]).toBeDefined();
    }
    expect(moodForScene('nope').id).toBe('cozy');
  });

  it('is deterministic for the same bar', () => {
    for (const m of Object.values(MOODS)) {
      const a = composeBar(m, 5, { deg: 7 });
      const b = composeBar(m, 5, { deg: 7 });
      expect(a).toEqual(b);
    }
  });

  it('loops every 16 bars', () => {
    const m = MOODS.beach!;
    expect(composeBar(m, 3, { deg: 7 })).toEqual(composeBar(m, 19, { deg: 7 }));
  });

  it('keeps notes inside the bar, in range and in key', () => {
    for (const m of Object.values(MOODS)) {
      const prev = { deg: 7 };
      for (let bar = 0; bar < 32; bar++) {
        for (const e of composeBar(m, bar, prev)) {
          expect(e.step).toBeGreaterThanOrEqual(0);
          expect(e.step).toBeLessThan(16);
          expect(e.len).toBeGreaterThan(0);
          expect(e.vel).toBeGreaterThan(0);
          expect(e.vel).toBeLessThanOrEqual(1);
          if (['kick', 'snap', 'shaker'].includes(e.inst) || e.part === 'approach') continue;
          expect(e.midi).toBeGreaterThanOrEqual(24);
          expect(e.midi).toBeLessThanOrEqual(100);
          const pc = (((e.midi - m.root) % 12) + 12) % 12;
          expect(m.scale, `${m.id} bar ${bar} ${e.inst}`).toContain(pc);
        }
      }
    }
  });

  it('melody moves smoothly (no leaps over an octave)', () => {
    for (const m of Object.values(MOODS)) {
      if (m.density === 0) continue;
      const prev = { deg: 7 };
      let last: number | null = null;
      let count = 0;
      for (let bar = 0; bar < 16; bar++) {
        for (const e of composeBar(m, bar, prev).filter((x) => x.part === 'melody')) {
          if (last !== null) expect(Math.abs(e.midi - last), m.id).toBeLessThanOrEqual(12);
          last = e.midi;
          count++;
        }
      }
      expect(count, m.id).toBeGreaterThan(10);
    }
  });

  it('box mood has no melody (just anticipation)', () => {
    const ev = composeBar(MOODS.box!, 0);
    expect(ev.some((e) => e.part === 'melody')).toBe(false);
  });

  it('scale and pitch helpers', () => {
    const m = MOODS.cozy!;
    expect(degreeToMidi(m, 0)).toBe(60);
    expect(degreeToMidi(m, 7)).toBe(72);
    expect(degreeToMidi(m, -1)).toBe(59);
    expect(chordDegrees(m, 0)).toEqual([0, 2, 4]);
    expect(midiToHz(69)).toBeCloseTo(440);
  });
});
