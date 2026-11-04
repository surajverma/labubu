import type { BlobParams } from './geometry';

/** Body shapes (blob params). The body sits on short legs; y is relative to its centre. */
export const BODY_SHAPES: Record<string, BlobParams> = {
  bean: { rx: 0.47, ry: 0.5, rz: 0.42, flatBottom: 0.5, taper: 0.12 },
  capsule: { rx: 0.4, ry: 0.6, rz: 0.38, power: 2.5, flatBottom: 0.3 },
  ball: { rx: 0.52, ry: 0.5, rz: 0.48, flatBottom: 0.35 },
  pear: { rx: 0.48, ry: 0.52, rz: 0.44, flatBottom: 0.55, taper: 0.32 },
  squarish: { rx: 0.48, ry: 0.5, rz: 0.42, power: 3.2, flatBottom: 0.2 },
  tiny: { rx: 0.36, ry: 0.38, rz: 0.34, flatBottom: 0.4, taper: 0.1 },
  // Phase 2
  chonk: { rx: 0.6, ry: 0.5, rz: 0.5, flatBottom: 0.55, taper: 0.2 },
  noodle: { rx: 0.34, ry: 0.66, rz: 0.32, power: 2.2, flatBottom: 0.3, taper: 0.08 },
};

export const HEAD_SHAPES: Record<string, BlobParams> = {
  round: { rx: 0.66, ry: 0.61, rz: 0.6 },
  wide: { rx: 0.82, ry: 0.58, rz: 0.6, power: 2.2 },
  egg: { rx: 0.66, ry: 0.72, rz: 0.62, egg: 0.16 },
  squircle: { rx: 0.72, ry: 0.63, rz: 0.6, power: 3.1 },
  bun: { rx: 0.74, ry: 0.6, rz: 0.62, flatBottom: 0.55, egg: -0.12 },
  // Phase 2
  peanut: { rx: 0.64, ry: 0.7, rz: 0.6, power: 2.3, egg: -0.08 },
  gem: { rx: 0.72, ry: 0.66, rz: 0.6, power: 2.7, egg: 0.25 },
};

/** Body shapes that are small (limbs get scaled). */
export const SMALL_BODIES = new Set(['tiny', 'noodle']);
