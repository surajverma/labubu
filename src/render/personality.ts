import type { CharacterSpec } from '../gen/types';

/** Additive pose offsets applied on top of the idle breathing. */
export interface Pose {
  headYaw: number;
  headPitch: number;
  headRoll: number;
  bodyRoll: number;
  lift: number;
  /** Arm swing (radians), right and left, positive = raised outward. */
  armR: number;
  armL: number;
  squashY: number;
  mouthOpen: boolean;
}

export const NO_POSE: Pose = {
  headYaw: 0,
  headPitch: 0,
  headRoll: 0,
  bodyRoll: 0,
  lift: 0,
  armR: 0,
  armL: 0,
  squashY: 0,
  mouthOpen: false,
};

export type MoveId =
  'lookAround' | 'wave' | 'yawn' | 'dance' | 'shy' | 'nod' | 'bounce' | 'stretch';
export type ReactionId = 'wiggle' | 'squish' | 'spinJump' | 'giggle';

/** Smooth in/out envelope over a move (0 at the ends, 1 in the middle). */
const env = (k: number, edge = 0.18) => Math.min(1, k / edge, (1 - k) / edge);

export const MOVES: Record<MoveId, { dur: number; pose(k: number, t: number): Partial<Pose> }> = {
  lookAround: {
    dur: 2.4,
    pose: (k) => ({
      headYaw: Math.sin(k * Math.PI * 2) * 0.55 * env(k, 0.1),
      headPitch: -0.05 * env(k),
    }),
  },
  wave: {
    dur: 1.8,
    pose: (k, t) => ({
      armR: (1.9 + Math.sin(t * 14) * 0.3) * env(k, 0.2),
      headRoll: -0.1 * env(k),
      headYaw: 0.15 * env(k),
    }),
  },
  yawn: {
    dur: 2.2,
    pose: (k) => {
      const e = env(k, 0.3);
      return {
        headPitch: -0.28 * e,
        armR: 0.9 * e,
        armL: 0.9 * e,
        squashY: 0.03 * e,
        mouthOpen: e > 0.5,
      };
    },
  },
  stretch: {
    dur: 1.8,
    pose: (k) => ({
      armR: 2.3 * env(k, 0.3),
      armL: 2.3 * env(k, 0.3),
      lift: 0.04 * env(k, 0.3),
      squashY: -0.04 * env(k, 0.3),
    }),
  },
  dance: {
    dur: 2.6,
    pose: (k, t) => {
      const e = env(k, 0.12);
      return {
        bodyRoll: Math.sin(t * 9) * 0.13 * e,
        headRoll: -Math.sin(t * 9) * 0.12 * e,
        lift: Math.abs(Math.sin(t * 9)) * 0.06 * e,
        armR: (0.6 + Math.sin(t * 9) * 0.6) * e,
        armL: (0.6 - Math.sin(t * 9) * 0.6) * e,
      };
    },
  },
  shy: {
    dur: 2.0,
    pose: (k) => ({
      headRoll: 0.22 * env(k),
      headPitch: 0.14 * env(k),
      armR: -0.35 * env(k),
      armL: -0.35 * env(k),
      bodyRoll: 0.04 * env(k),
    }),
  },
  nod: { dur: 1.2, pose: (k) => ({ headPitch: Math.sin(k * Math.PI * 4) * 0.13 * env(k, 0.1) }) },
  bounce: {
    dur: 1.1,
    pose: (k) => ({
      lift: Math.abs(Math.sin(k * Math.PI * 2)) * 0.12,
      squashY: -Math.sin(k * Math.PI * 4) * 0.03,
      armR: 0.5 * env(k),
      armL: 0.5 * env(k),
    }),
  },
};

export const REACTIONS: Record<
  ReactionId,
  { dur: number; pose(k: number, t: number): Partial<Pose> & { spin?: number } }
> = {
  wiggle: {
    dur: 0.7,
    pose: (k, t) => ({
      bodyRoll: Math.sin(t * 34) * 0.16 * (1 - k),
      headRoll: -Math.sin(t * 34) * 0.1 * (1 - k),
    }),
  },
  squish: { dur: 0.65, pose: (k) => ({ squashY: Math.sin(k * Math.PI * 3) * 0.14 * (1 - k) }) },
  spinJump: {
    dur: 0.8,
    pose: (k) => ({
      lift: Math.sin(k * Math.PI) * 0.3,
      spin: (1 - Math.pow(1 - k, 2)) * Math.PI * 2,
      armR: 1.2 * Math.sin(k * Math.PI),
      armL: 1.2 * Math.sin(k * Math.PI),
    }),
  },
  giggle: {
    dur: 0.9,
    pose: (k, t) => ({
      headRoll: Math.sin(t * 26) * 0.09 * (1 - k),
      lift: Math.abs(Math.sin(t * 13)) * 0.04 * (1 - k),
      mouthOpen: Math.sin(t * 26) > 0 && k < 0.8,
    }),
  },
};

/** Idle moves that suit a buddy's look (weights). Everyone can look around and wave. */
export function movesFor(s: CharacterSpec): [MoveId, number][] {
  const t = new Set(s.tags);
  const out: [MoveId, number][] = [
    ['lookAround', 3],
    ['wave', 2],
    ['nod', 1],
  ];
  if (t.has('sleepy') || t.has('cozy')) out.push(['yawn', 4], ['stretch', 2]);
  if (t.has('party') || t.has('music') || t.has('happy') || t.has('silly'))
    out.push(['dance', 4], ['bounce', 3]);
  if (t.has('shy') || t.has('sad') || t.has('cute')) out.push(['shy', 3]);
  if (t.has('cool') || t.has('royal')) out.push(['nod', 3]);
  if (t.has('sporty') || t.has('hero')) out.push(['stretch', 3], ['bounce', 2]);
  return out;
}

export function pickWeighted<T>(items: [T, number][], r = Math.random()): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = r * total;
  for (const [it, w] of items) if ((x -= w) < 0) return it;
  return items[items.length - 1]![0];
}
