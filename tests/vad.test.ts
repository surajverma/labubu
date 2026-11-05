import { describe, expect, it } from 'vitest';
import { VadSegmenter } from '../src/audio/vad';

const B = 2048 / 48000;
function run(levels: number[]) {
  const v = new VadSegmenter({ blockS: B });
  return levels.map((l) => v.push(l));
}
const n = (s: number) => Math.round(s / B);

describe('voice activity segmenter', () => {
  it('ignores background noise', () => {
    const ev = run(Array(n(3)).fill(0.006));
    expect(ev.every((e) => e === 'silence')).toBe(true);
  });
  it('detects an utterance and ends it after a pause', () => {
    const ev = run([
      ...Array(n(1)).fill(0.004),
      ...Array(n(1.2)).fill(0.1),
      ...Array(n(1)).fill(0.004),
    ]);
    expect(ev.filter((e) => e === 'start').length).toBe(1);
    expect(ev.filter((e) => e === 'end').length).toBe(1);
    const end = ev.indexOf('end');
    // Ends ~0.7 s after the talking stops.
    expect(end * B).toBeGreaterThan(2.8);
    expect(end * B).toBeLessThan(3.1);
  });
  it('discards very short sounds', () => {
    const ev = run([
      ...Array(n(1)).fill(0.004),
      ...Array(n(0.1)).fill(0.2),
      ...Array(n(1.5)).fill(0.004),
    ]);
    expect(ev).toContain('discard');
    expect(ev).not.toContain('end');
  });
  it('cuts long speech at the maximum length', () => {
    const ev = run(Array(n(8)).fill(0.15));
    expect(ev.filter((e) => e === 'end').length).toBeGreaterThanOrEqual(1);
  });
});
