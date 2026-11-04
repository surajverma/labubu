import type { FaceSpec } from '../gen/types';

/**
 * Face decals drawn with Canvas2D.
 *
 * Coordinate frame for every drawer: origin at the face centre, 1 unit = half the cell
 * width, +y points DOWN (canvas convention). On the head, 1 unit is roughly 1 radian.
 * The eye line sits at y ≈ 0, the mouth at y ≈ 0.32.
 */

export interface FaceInk {
  ink: string;
  blush: string;
  /** Iris tint for eyes that use colour. */
  iris: string;
  /** Head skin colour (used for eyelids and knock-outs). */
  skin: string;
  glow: boolean;
}

type Ctx = CanvasRenderingContext2D;
type Drawer = (c: Ctx, k: FaceInk, opt: { blink: boolean }) => void;

const TAU = Math.PI * 2;
const EYE_X = 0.34;
const EYE_Y = 0.02;
const LINE = 0.045;
const FACE_SCALE = 1.28;
const FACE_DROP = 0.1;

function stroke(c: Ctx, color: string, w = LINE): void {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}
function fill(c: Ctx, color: string): void {
  c.fillStyle = color;
  c.fill();
}
function circle(c: Ctx, x: number, y: number, r: number): void {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
}
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
}
function both(fn: (side: -1 | 1, x: number) => void): void {
  fn(-1, -EYE_X);
  fn(1, EYE_X);
}
function heartPath(c: Ctx, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y + s * 0.1, x - s * 0.8, y - s * 1.0, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.8, y - s * 1.0, x + s * 1.4, y + s * 0.1, x, y + s * 0.9);
  c.closePath();
}
function starPath(c: Ctx, x: number, y: number, r: number, pts = 5, inner = 0.48): void {
  c.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / pts;
    const rr = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr,
      py = y + Math.sin(a) * rr;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}
/** Rounded-star (softer) for stickers. */
function softStar(c: Ctx, x: number, y: number, r: number): void {
  starPath(c, x, y, r, 5, 0.55);
  c.lineJoin = 'round';
}
function highlight(c: Ctx, x: number, y: number, r: number): void {
  circle(c, x, y, r);
  fill(c, '#ffffff');
}
function closedArc(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  up: boolean,
  k: FaceInk,
  lw = LINE * 1.15,
): void {
  c.beginPath();
  if (up) c.arc(x, y + w * 0.5, w, Math.PI * 1.15, Math.PI * 1.85);
  else c.arc(x, y - w * 0.55, w, Math.PI * 0.15, Math.PI * 0.85);
  stroke(c, k.ink, lw);
}

/** Generic round eye with pupil + highlights; used by several designs. */
function shinyEye(c: Ctx, x: number, y: number, r: number, k: FaceInk, irisFrac = 0): void {
  ellipse(c, x, y, r, r * 1.12);
  fill(c, k.ink);
  if (irisFrac > 0) {
    const g = c.createRadialGradient(x, y + r * 0.45, r * 0.1, x, y + r * 0.3, r * 0.95);
    g.addColorStop(0, k.iris);
    g.addColorStop(1, k.ink);
    ellipse(c, x, y + r * 0.08, r * irisFrac, r * irisFrac * 1.1);
    c.fillStyle = g;
    c.fill();
  }
  highlight(c, x - r * 0.38, y - r * 0.42, r * 0.36);
  highlight(c, x + r * 0.35, y + r * 0.38, r * 0.15);
}

const EYES: Record<string, Drawer> = {
  dots: (c, k, o) =>
    both((_, x) =>
      o.blink
        ? closedArc(c, x, EYE_Y, 0.07, false, k)
        : (circle(c, x, EYE_Y, 0.082),
          fill(c, k.ink),
          highlight(c, x - 0.026, EYE_Y - 0.03, 0.024)),
    ),
  shiny: (c, k, o) =>
    both((_, x) =>
      o.blink
        ? closedArc(c, x, EYE_Y + 0.02, 0.12, false, k)
        : shinyEye(c, x, EYE_Y, 0.13, k, 0.75),
    ),
  sleepy: (c, k) =>
    both((s, x) => {
      c.beginPath();
      c.arc(x, EYE_Y - 0.04, 0.12, Math.PI * 0.12, Math.PI * 0.88);
      stroke(c, k.ink, LINE * 1.2);
      // Little lashes.
      for (const a of [0.25, 0.5, 0.75]) {
        const ang = Math.PI * a;
        const px = x + Math.cos(ang) * 0.12,
          py = EYE_Y - 0.04 + Math.sin(ang) * 0.12;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(ang) * 0.05 * (a === 0.5 ? 0.6 : 1) + s * 0, py + 0.045);
        stroke(c, k.ink, LINE * 0.7);
      }
    }),
  wink: (c, k, o) => {
    if (o.blink) closedArc(c, -EYE_X, EYE_Y, 0.12, false, k);
    else shinyEye(c, -EYE_X, EYE_Y, 0.12, k, 0.7);
    // Right eye: ">" shaped wink.
    c.beginPath();
    c.moveTo(EYE_X - 0.1, EYE_Y - 0.08);
    c.lineTo(EYE_X + 0.06, EYE_Y);
    c.lineTo(EYE_X - 0.1, EYE_Y + 0.08);
    stroke(c, k.ink, LINE * 1.2);
  },
  star: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      starPath(c, x, EYE_Y, 0.15);
      fill(c, '#ffd23f');
      starPath(c, x, EYE_Y, 0.15);
      stroke(c, k.ink, LINE * 0.9);
      highlight(c, x - 0.04, EYE_Y - 0.05, 0.03);
    }),
  heart: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      heartPath(c, x, EYE_Y, 0.12);
      fill(c, '#ff4f7b');
      heartPath(c, x, EYE_Y, 0.12);
      stroke(c, k.ink, LINE * 0.8);
      highlight(c, x - 0.05, EYE_Y - 0.03, 0.028);
    }),
  swirl: (c, k) =>
    both((s, x) => {
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const a = t * TAU * 2.2 * s;
        const r = 0.015 + t * 0.12;
        const px = x + Math.cos(a) * r,
          py = EYE_Y + Math.sin(a) * r;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      stroke(c, k.ink, LINE * 0.9);
    }),
  angry: (c, k, o) =>
    both((s, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.1, false, k);
      c.beginPath();
      c.moveTo(x - 0.11, EYE_Y - 0.02 - (s < 0 ? 0.05 : 0.0));
      c.lineTo(x + 0.11, EYE_Y - 0.02 - (s > 0 ? 0.05 : 0.0));
      c.quadraticCurveTo(x + 0.1, EYE_Y + 0.12, x, EYE_Y + 0.12);
      c.quadraticCurveTo(x - 0.1, EYE_Y + 0.12, x - 0.11, EYE_Y - 0.02 - (s < 0 ? 0.05 : 0));
      fill(c, k.ink);
      highlight(c, x - 0.03 * s, EYE_Y + 0.03, 0.025);
    }),
  happy: (c, k) => both((_, x) => closedArc(c, x, EYE_Y + 0.04, 0.11, true, k, LINE * 1.3)),
  lashes: (c, k, o) =>
    both((s, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y + 0.02, 0.12, false, k);
      shinyEye(c, x, EYE_Y + 0.01, 0.115, k, 0.7);
      for (const a of [-0.25, -0.05]) {
        const ang = Math.PI * (s > 0 ? -0.5 - a - 0.22 : -0.5 + a + 0.22);
        const px = x + Math.cos(ang) * 0.12,
          py = EYE_Y + Math.sin(ang) * 0.13;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(ang) * 0.07, py + Math.sin(ang) * 0.07);
        stroke(c, k.ink, LINE * 0.8);
      }
    }),
  ovals: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.08, false, k);
      ellipse(c, x, EYE_Y, 0.06, 0.12);
      fill(c, k.ink);
      highlight(c, x - 0.015, EYE_Y - 0.06, 0.022);
    }),
  sparkle: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y + 0.02, 0.14, false, k);
      ellipse(c, x, EYE_Y, 0.14, 0.17);
      fill(c, k.ink);
      const g = c.createLinearGradient(0, EYE_Y - 0.1, 0, EYE_Y + 0.17);
      g.addColorStop(0, k.ink);
      g.addColorStop(1, k.iris);
      ellipse(c, x, EYE_Y + 0.03, 0.115, 0.13);
      c.fillStyle = g;
      c.fill();
      highlight(c, x - 0.05, EYE_Y - 0.07, 0.055);
      highlight(c, x + 0.06, EYE_Y + 0.07, 0.025);
      starPath(c, x + 0.05, EYE_Y - 0.03, 0.035, 4, 0.35);
      fill(c, '#ffffff');
    }),
  dizzy: (c, k) =>
    both((_, x) => {
      c.beginPath();
      c.moveTo(x - 0.08, EYE_Y - 0.08);
      c.lineTo(x + 0.08, EYE_Y + 0.08);
      c.moveTo(x + 0.08, EYE_Y - 0.08);
      c.lineTo(x - 0.08, EYE_Y + 0.08);
      stroke(c, k.ink, LINE * 1.2);
    }),
  side: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      ellipse(c, x, EYE_Y, 0.12, 0.13);
      fill(c, '#ffffff');
      ellipse(c, x, EYE_Y, 0.12, 0.13);
      stroke(c, k.ink, LINE * 0.8);
      circle(c, x + 0.05, EYE_Y + 0.01, 0.065);
      fill(c, k.ink);
      highlight(c, x + 0.03, EYE_Y - 0.02, 0.02);
    }),
  button: (c, k) =>
    both((_, x) => {
      circle(c, x, EYE_Y, 0.11);
      fill(c, k.ink);
      for (const [dx, dy] of [
        [-0.035, -0.035],
        [0.035, -0.035],
        [-0.035, 0.035],
        [0.035, 0.035],
      ] as const) {
        circle(c, x + dx, EYE_Y + dy, 0.02);
        fill(c, k.skin);
      }
    }),
  lidded: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      c.save();
      c.beginPath();
      c.rect(x - 0.2, EYE_Y - 0.01, 0.4, 0.3);
      c.clip();
      shinyEye(c, x, EYE_Y, 0.12, k, 0.6);
      c.restore();
      c.beginPath();
      c.moveTo(x - 0.14, EYE_Y - 0.01);
      c.lineTo(x + 0.14, EYE_Y - 0.01);
      stroke(c, k.ink, LINE * 1.1);
    }),
  teary: (c, k, o) =>
    both((s, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      shinyEye(c, x, EYE_Y, 0.13, k, 0.75);
      // Wobbly bottom shine.
      ellipse(c, x, EYE_Y + 0.08, 0.09, 0.025);
      fill(c, 'rgba(160,220,255,0.85)');
      if (s > 0) {
        c.beginPath();
        c.moveTo(x + 0.1, EYE_Y + 0.12);
        c.quadraticCurveTo(x + 0.15, EYE_Y + 0.22, x + 0.1, EYE_Y + 0.25);
        c.quadraticCurveTo(x + 0.05, EYE_Y + 0.22, x + 0.1, EYE_Y + 0.12);
        fill(c, '#8fd3ff');
      }
    }),
  surprised: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      circle(c, x, EYE_Y, 0.135);
      fill(c, '#ffffff');
      circle(c, x, EYE_Y, 0.135);
      stroke(c, k.ink, LINE * 0.9);
      circle(c, x, EYE_Y, 0.045);
      fill(c, k.ink);
    }),
  cyclops: (c, k, o) => {
    if (o.blink) return closedArc(c, 0, EYE_Y, 0.2, false, k, LINE * 1.4);
    ellipse(c, 0, EYE_Y - 0.02, 0.21, 0.2);
    fill(c, '#ffffff');
    ellipse(c, 0, EYE_Y - 0.02, 0.21, 0.2);
    stroke(c, k.ink, LINE);
    shinyEye(c, 0, EYE_Y, 0.11, k, 0.75);
  },
  beady: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x * 0.8, EYE_Y, 0.06, false, k);
      circle(c, x * 0.8, EYE_Y, 0.055);
      fill(c, k.ink);
      highlight(c, x * 0.8 - 0.012, EYE_Y - 0.014, 0.012);
    }),
  glow: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      const g = c.createRadialGradient(x, EYE_Y, 0.01, x, EYE_Y, 0.2);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, '#8ff7ff');
      g.addColorStop(1, 'rgba(120,200,255,0)');
      circle(c, x, EYE_Y, 0.2);
      c.fillStyle = g;
      c.fill();
      ellipse(c, x, EYE_Y, 0.08, 0.11);
      fill(c, '#ffffff');
    }),
  // --- Phase 2 (generator v2) ---
  crescent: (c, k) => both((_, x) => closedArc(c, x, EYE_Y - 0.02, 0.11, false, k, LINE * 1.5)),
  pixel: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.1, false, k);
      c.fillStyle = k.ink;
      c.fillRect(x - 0.08, EYE_Y - 0.08, 0.16, 0.16);
      c.fillStyle = '#ffffff';
      c.fillRect(x - 0.06, EYE_Y - 0.06, 0.05, 0.05);
    }),
  sunglasses: (c, k) => {
    c.beginPath();
    c.roundRect(-0.52, EYE_Y - 0.1, 0.38, 0.2, 0.08);
    c.roundRect(0.14, EYE_Y - 0.1, 0.38, 0.2, 0.08);
    fill(c, '#1d1d2b');
    c.beginPath();
    c.moveTo(-0.14, EYE_Y - 0.04);
    c.quadraticCurveTo(0, EYE_Y - 0.08, 0.14, EYE_Y - 0.04);
    stroke(c, '#1d1d2b', LINE);
    c.beginPath();
    c.moveTo(-0.45, EYE_Y - 0.05);
    c.lineTo(-0.36, EYE_Y - 0.05);
    c.moveTo(0.22, EYE_Y - 0.05);
    c.lineTo(0.31, EYE_Y - 0.05);
    stroke(c, 'rgba(255,255,255,0.7)', LINE * 0.8);
    void k;
  },
  moon: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      circle(c, x, EYE_Y, 0.12);
      fill(c, k.ink);
      circle(c, x + 0.05, EYE_Y - 0.04, 0.1);
      fill(c, '#ffe58a');
    }),
  flower: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        circle(c, x + Math.cos(a) * 0.075, EYE_Y + Math.sin(a) * 0.075, 0.055);
        fill(c, k.iris);
      }
      circle(c, x, EYE_Y, 0.06);
      fill(c, k.ink);
      highlight(c, x - 0.02, EYE_Y - 0.02, 0.018);
    }),
  determined: (c, k, o) =>
    both((s, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      c.save();
      c.beginPath();
      c.moveTo(x - 0.2, EYE_Y - 0.04 + s * 0.04);
      c.lineTo(x + 0.2, EYE_Y - 0.04 - s * 0.04);
      c.lineTo(x + 0.2, EYE_Y + 0.3);
      c.lineTo(x - 0.2, EYE_Y + 0.3);
      c.clip();
      shinyEye(c, x, EYE_Y + 0.02, 0.12, k, 0.7);
      c.restore();
    }),
  tiny: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x * 0.9, EYE_Y, 0.04, false, k);
      circle(c, x * 0.9, EYE_Y + 0.02, 0.03);
      fill(c, k.ink);
    }),
  diamond: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      c.beginPath();
      c.moveTo(x, EYE_Y - 0.14);
      c.lineTo(x + 0.11, EYE_Y);
      c.lineTo(x, EYE_Y + 0.14);
      c.lineTo(x - 0.11, EYE_Y);
      c.closePath();
      fill(c, '#7fe7ff');
      stroke(c, k.ink, LINE * 0.8);
      highlight(c, x - 0.03, EYE_Y - 0.04, 0.025);
    }),
  stitched: (c, k) =>
    both((_, x) => {
      c.beginPath();
      c.moveTo(x - 0.11, EYE_Y);
      c.lineTo(x + 0.11, EYE_Y);
      stroke(c, k.ink, LINE);
      for (const dx of [-0.07, 0, 0.07]) {
        c.beginPath();
        c.moveTo(x + dx, EYE_Y - 0.05);
        c.lineTo(x + dx, EYE_Y + 0.05);
        stroke(c, k.ink, LINE * 0.8);
      }
    }),
  starry: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      shinyEye(c, x, EYE_Y, 0.14, k, 0.8);
      starPath(c, x, EYE_Y + 0.02, 0.06);
      fill(c, '#ffe066');
    }),
  laser: (c, k, o) =>
    both((_, x) => {
      if (o.blink) return closedArc(c, x, EYE_Y, 0.12, false, k);
      const g = c.createRadialGradient(x, EYE_Y, 0.01, x, EYE_Y, 0.19);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, '#ff6ad5');
      g.addColorStop(1, 'rgba(255,80,200,0)');
      circle(c, x, EYE_Y, 0.19);
      c.fillStyle = g;
      c.fill();
    }),
};

const BROWS: Record<string, Drawer> = {
  none: () => {},
  soft: (c, k) =>
    both((_, x) => {
      c.beginPath();
      c.arc(x, -0.06, 0.12, Math.PI * 1.25, Math.PI * 1.75);
      stroke(c, k.ink, LINE * 0.9);
    }),
  thick: (c, k) =>
    both((s, x) => {
      ellipse(c, x, -0.2, 0.1, 0.035, s * 0.12);
      fill(c, k.ink);
    }),
  angry: (c, k) =>
    both((s, x) => {
      c.beginPath();
      c.moveTo(x - 0.1 * s, -0.25);
      c.lineTo(x + 0.08 * s, -0.16);
      stroke(c, k.ink, LINE * 1.3);
    }),
  worried: (c, k) =>
    both((s, x) => {
      c.beginPath();
      c.moveTo(x - 0.09 * s, -0.17);
      c.quadraticCurveTo(x, -0.22, x + 0.09 * s, -0.25);
      stroke(c, k.ink, LINE);
    }),
  raised: (c, k) =>
    both((_, x) => {
      c.beginPath();
      c.arc(x, -0.18, 0.1, Math.PI * 1.15, Math.PI * 1.85);
      stroke(c, k.ink, LINE);
    }),
  dots: (c, k) =>
    both((_, x) => {
      ellipse(c, x * 0.85, -0.22, 0.05, 0.03);
      fill(c, k.ink);
    }),
  unibrow: (c, k) => {
    c.beginPath();
    c.moveTo(-0.45, -0.19);
    c.quadraticCurveTo(-0.22, -0.26, 0, -0.2);
    c.quadraticCurveTo(0.22, -0.26, 0.45, -0.19);
    stroke(c, k.ink, LINE * 1.5);
  },
  // Phase 2
  sharp: (c, k) =>
    both((s, x) => {
      c.beginPath();
      c.moveTo(x - 0.11 * s, -0.17);
      c.lineTo(x + 0.02 * s, -0.25);
      c.lineTo(x + 0.11 * s, -0.2);
      stroke(c, k.ink, LINE);
    }),
  fluffy: (c, k) =>
    both((_, x) => {
      for (const dx of [-0.06, 0, 0.06]) {
        circle(c, x + dx, -0.21 - (dx === 0 ? 0.015 : 0), 0.035);
        fill(c, k.ink);
      }
    }),
  tilted: (c, k) => {
    c.beginPath();
    c.moveTo(-0.44, -0.24);
    c.lineTo(-0.24, -0.2);
    c.moveTo(0.24, -0.17);
    c.lineTo(0.44, -0.24);
    stroke(c, k.ink, LINE * 1.1);
  },
  wavy: (c, k) =>
    both((_, x) => {
      c.beginPath();
      c.moveTo(x - 0.1, -0.2);
      c.quadraticCurveTo(x - 0.05, -0.25, x, -0.2);
      c.quadraticCurveTo(x + 0.05, -0.15, x + 0.1, -0.2);
      stroke(c, k.ink, LINE * 0.9);
    }),
};

const MY = 0.33;
const MOUTHS: Record<string, Drawer> = {
  grin: (c, k) => {
    // Wide D-shaped smile with a neat row of flat (not pointy) teeth.
    c.beginPath();
    c.moveTo(-0.2, MY - 0.04);
    c.quadraticCurveTo(0, MY - 0.02, 0.2, MY - 0.04);
    c.quadraticCurveTo(0.18, MY + 0.16, 0, MY + 0.16);
    c.quadraticCurveTo(-0.18, MY + 0.16, -0.2, MY - 0.04);
    c.closePath();
    fill(c, '#5a2232');
    c.save();
    c.clip();
    c.fillStyle = '#ffffff';
    c.fillRect(-0.25, MY - 0.06, 0.5, 0.07);
    ellipse(c, 0, MY + 0.16, 0.1, 0.06);
    fill(c, '#ff7b8f');
    c.restore();
    c.beginPath();
    for (const dx of [-0.1, 0, 0.1]) {
      c.moveTo(dx, MY - 0.035);
      c.lineTo(dx, MY + 0.01);
    }
    stroke(c, 'rgba(90,34,50,0.45)', LINE * 0.4);
    c.beginPath();
    c.moveTo(-0.2, MY - 0.04);
    c.quadraticCurveTo(0, MY - 0.02, 0.2, MY - 0.04);
    c.quadraticCurveTo(0.18, MY + 0.16, 0, MY + 0.16);
    c.quadraticCurveTo(-0.18, MY + 0.16, -0.2, MY - 0.04);
    stroke(c, k.ink, LINE * 0.8);
  },
  smile: (c, k) => {
    c.beginPath();
    c.arc(0, MY - 0.07, 0.08, Math.PI * 0.2, Math.PI * 0.8);
    stroke(c, k.ink);
  },
  o: (c, k) => {
    ellipse(c, 0, MY + 0.02, 0.055, 0.07);
    fill(c, '#5a2232');
    ellipse(c, 0, MY + 0.02, 0.055, 0.07);
    stroke(c, k.ink, LINE * 0.7);
  },
  tongue: (c, k) => {
    c.beginPath();
    c.moveTo(-0.12, MY);
    c.quadraticCurveTo(0, MY + 0.06, 0.12, MY);
    stroke(c, k.ink);
    c.beginPath();
    c.moveTo(-0.045, MY + 0.03);
    c.lineTo(-0.045, MY + 0.09);
    c.arc(0.0, MY + 0.09, 0.045, Math.PI, 0, true);
    c.lineTo(0.045, MY + 0.03);
    fill(c, '#ff6f8a');
    stroke(c, k.ink, LINE * 0.6);
    c.beginPath();
    c.moveTo(0, MY + 0.05);
    c.lineTo(0, MY + 0.1);
    stroke(c, '#d94464', LINE * 0.4);
  },
  fang: (c, k) => {
    c.beginPath();
    c.moveTo(-0.13, MY - 0.02);
    c.quadraticCurveTo(-0.065, MY + 0.05, 0, MY - 0.01);
    c.quadraticCurveTo(0.065, MY + 0.05, 0.13, MY - 0.02);
    stroke(c, k.ink);
    c.beginPath();
    c.moveTo(0.04, MY + 0.008);
    c.lineTo(0.065, MY + 0.07);
    c.lineTo(0.09, MY + 0.012);
    fill(c, '#ffffff');
    stroke(c, k.ink, LINE * 0.5);
  },
  pout: (c, k) => {
    c.beginPath();
    c.arc(0, MY + 0.08, 0.07, Math.PI * 1.2, Math.PI * 1.8);
    stroke(c, k.ink);
  },
  cat: (c, k) => {
    c.beginPath();
    c.moveTo(-0.12, MY - 0.01);
    c.quadraticCurveTo(-0.06, MY + 0.07, 0, MY);
    c.quadraticCurveTo(0.06, MY + 0.07, 0.12, MY - 0.01);
    stroke(c, k.ink);
  },
  flat: (c, k) => {
    c.beginPath();
    c.moveTo(-0.08, MY + 0.01);
    c.lineTo(0.08, MY + 0.01);
    stroke(c, k.ink);
  },
  laugh: (c, k) => {
    c.beginPath();
    c.moveTo(-0.16, MY - 0.04);
    c.lineTo(0.16, MY - 0.04);
    c.quadraticCurveTo(0.15, MY + 0.17, 0, MY + 0.17);
    c.quadraticCurveTo(-0.15, MY + 0.17, -0.16, MY - 0.04);
    c.closePath();
    fill(c, '#5a2232');
    c.save();
    c.clip();
    ellipse(c, 0, MY + 0.16, 0.1, 0.07);
    fill(c, '#ff7b8f');
    c.restore();
    c.beginPath();
    c.moveTo(-0.16, MY - 0.04);
    c.lineTo(0.16, MY - 0.04);
    c.quadraticCurveTo(0.15, MY + 0.17, 0, MY + 0.17);
    c.quadraticCurveTo(-0.15, MY + 0.17, -0.16, MY - 0.04);
    stroke(c, k.ink, LINE * 0.8);
  },
  smirk: (c, k) => {
    c.beginPath();
    c.moveTo(-0.1, MY + 0.03);
    c.quadraticCurveTo(0.04, MY + 0.06, 0.12, MY - 0.03);
    stroke(c, k.ink);
  },
  wavy: (c, k) => {
    c.beginPath();
    c.moveTo(-0.14, MY);
    for (let i = 1; i <= 4; i++) {
      const x0 = -0.14 + (i - 0.5) * 0.07,
        x1 = -0.14 + i * 0.07;
      c.quadraticCurveTo(x0, MY + (i % 2 ? -0.04 : 0.04), x1, MY);
    }
    stroke(c, k.ink, LINE * 0.9);
  },
  kiss: (c, k) => {
    c.beginPath();
    c.moveTo(-0.01, MY - 0.06);
    c.quadraticCurveTo(0.08, MY - 0.03, 0.0, MY + 0.0);
    c.quadraticCurveTo(0.08, MY + 0.03, -0.01, MY + 0.06);
    stroke(c, k.ink);
  },
  frown: (c, k) => {
    c.beginPath();
    c.arc(0, MY + 0.1, 0.1, Math.PI * 1.25, Math.PI * 1.75);
    stroke(c, k.ink);
  },
  buck: (c, k) => {
    c.beginPath();
    c.moveTo(-0.12, MY - 0.03);
    c.quadraticCurveTo(0, MY + 0.04, 0.12, MY - 0.03);
    stroke(c, k.ink);
    c.beginPath();
    c.roundRect(-0.05, MY, 0.1, 0.08, 0.02);
    fill(c, '#ffffff');
    stroke(c, k.ink, LINE * 0.6);
    c.beginPath();
    c.moveTo(0, MY + 0.01);
    c.lineTo(0, MY + 0.075);
    stroke(c, k.ink, LINE * 0.45);
  },
  open: (c, k) => {
    c.beginPath();
    c.moveTo(-0.09, MY - 0.02);
    c.quadraticCurveTo(0, MY - 0.0, 0.09, MY - 0.02);
    c.quadraticCurveTo(0.07, MY + 0.09, 0, MY + 0.09);
    c.quadraticCurveTo(-0.07, MY + 0.09, -0.09, MY - 0.02);
    fill(c, '#5a2232');
    c.save();
    c.clip();
    ellipse(c, 0, MY + 0.09, 0.06, 0.04);
    fill(c, '#ff7b8f');
    c.restore();
    c.beginPath();
    c.moveTo(-0.09, MY - 0.02);
    c.quadraticCurveTo(0, MY - 0.0, 0.09, MY - 0.02);
    c.quadraticCurveTo(0.07, MY + 0.09, 0, MY + 0.09);
    c.quadraticCurveTo(-0.07, MY + 0.09, -0.09, MY - 0.02);
    stroke(c, k.ink, LINE * 0.7);
  },
  whistle: (c, k) => {
    circle(c, 0.04, MY + 0.02, 0.03);
    stroke(c, k.ink, LINE * 0.9);
  },
  zigzag: (c, k) => {
    c.beginPath();
    c.moveTo(-0.14, MY);
    for (let i = 1; i <= 6; i++) c.lineTo(-0.14 + i * (0.28 / 6), MY + (i % 2 ? 0.035 : -0.0));
    stroke(c, k.ink, LINE * 0.8);
  },
  gasp: (c, k) => {
    ellipse(c, 0, MY + 0.03, 0.08, 0.1);
    fill(c, '#5a2232');
    c.save();
    c.clip();
    ellipse(c, 0, MY + 0.12, 0.06, 0.04);
    fill(c, '#ff7b8f');
    c.restore();
    ellipse(c, 0, MY + 0.03, 0.08, 0.1);
    stroke(c, k.ink, LINE * 0.7);
  },
  // Phase 2
  bigsmile: (c, k) => {
    c.beginPath();
    c.arc(0, MY - 0.12, 0.16, Math.PI * 0.18, Math.PI * 0.82);
    stroke(c, k.ink, LINE * 1.1);
  },
  teeth: (c, k) => {
    c.beginPath();
    c.roundRect(-0.12, MY - 0.03, 0.24, 0.08, 0.04);
    fill(c, '#ffffff');
    stroke(c, k.ink, LINE * 0.7);
    c.beginPath();
    c.moveTo(-0.11, MY + 0.01);
    c.lineTo(0.11, MY + 0.01);
    for (const dx of [-0.06, 0, 0.06]) {
      c.moveTo(dx, MY - 0.025);
      c.lineTo(dx, MY + 0.045);
    }
    stroke(c, k.ink, LINE * 0.4);
  },
  drool: (c, k) => {
    c.beginPath();
    c.arc(0, MY - 0.06, 0.09, Math.PI * 0.2, Math.PI * 0.8);
    stroke(c, k.ink);
    c.beginPath();
    c.moveTo(0.06, MY + 0.02);
    c.quadraticCurveTo(0.09, MY + 0.12, 0.06, MY + 0.13);
    c.quadraticCurveTo(0.03, MY + 0.12, 0.06, MY + 0.02);
    fill(c, '#9fe0ff');
  },
  mustache: (c, k) => {
    c.beginPath();
    c.moveTo(0, MY - 0.03);
    c.bezierCurveTo(-0.08, MY - 0.08, -0.17, MY - 0.02, -0.19, MY - 0.06);
    c.bezierCurveTo(-0.17, MY + 0.04, -0.06, MY + 0.03, 0, MY);
    c.bezierCurveTo(0.06, MY + 0.03, 0.17, MY + 0.04, 0.19, MY - 0.06);
    c.bezierCurveTo(0.17, MY - 0.02, 0.08, MY - 0.08, 0, MY - 0.03);
    fill(c, k.ink);
  },
  heartlips: (c, k) => {
    heartPath(c, 0, MY + 0.02, 0.06);
    fill(c, '#ff4f7b');
    heartPath(c, 0, MY + 0.02, 0.06);
    stroke(c, k.ink, LINE * 0.5);
  },
  ooh: (c, k) => {
    ellipse(c, 0, MY + 0.02, 0.035, 0.045);
    fill(c, k.ink);
  },
  grimace: (c, k) => {
    c.beginPath();
    c.roundRect(-0.15, MY - 0.04, 0.3, 0.1, 0.03);
    fill(c, '#ffffff');
    stroke(c, k.ink, LINE * 0.7);
    c.beginPath();
    c.moveTo(-0.14, MY + 0.01);
    c.lineTo(0.14, MY + 0.01);
    stroke(c, k.ink, LINE * 0.4);
  },
  tongueside: (c, k) => {
    c.beginPath();
    c.arc(0, MY - 0.06, 0.09, Math.PI * 0.2, Math.PI * 0.8);
    stroke(c, k.ink);
    ellipse(c, 0.05, MY + 0.045, 0.035, 0.045, -0.4);
    fill(c, '#ff6f8a');
    ellipse(c, 0.05, MY + 0.045, 0.035, 0.045, -0.4);
    stroke(c, k.ink, LINE * 0.5);
  },
};

const NY = 0.17;
const NOSES: Record<string, Drawer> = {
  none: () => {},
  dot: (c, k) => {
    ellipse(c, 0, NY, 0.03, 0.022);
    fill(c, k.ink);
  },
  heart: (c, k) => {
    heartPath(c, 0, NY, 0.04);
    fill(c, '#ff6f8a');
    void k;
  },
  triangle: (c, k) => {
    c.beginPath();
    c.moveTo(-0.04, NY - 0.02);
    c.lineTo(0.04, NY - 0.02);
    c.lineTo(0, NY + 0.025);
    c.closePath();
    fill(c, k.ink);
    c.lineJoin = 'round';
    stroke(c, k.ink, 0.02);
  },
  button: (c, k) => {
    ellipse(c, 0, NY, 0.055, 0.04);
    fill(c, '#ff9aa8');
    highlight(c, -0.015, NY - 0.012, 0.012);
    void k;
  },
  snout: (c, k) => {
    ellipse(c, 0, NY + 0.01, 0.08, 0.055);
    fill(c, '#ffb3c1');
    ellipse(c, 0, NY + 0.01, 0.08, 0.055);
    stroke(c, k.ink, LINE * 0.5);
    for (const dx of [-0.028, 0.028]) {
      ellipse(c, dx, NY + 0.01, 0.012, 0.02);
      fill(c, k.ink);
    }
  },
  // Phase 2
  star: (c) => {
    softStar(c, 0, NY, 0.045);
    fill(c, '#ffcf3f');
  },
  whiskers: (c, k) => {
    ellipse(c, 0, NY, 0.025, 0.018);
    fill(c, k.ink);
    both((s) => {
      for (const dy of [-0.02, 0.02]) {
        c.beginPath();
        c.moveTo(s * 0.46, NY + 0.06 + dy);
        c.lineTo(s * 0.62, NY + 0.04 + dy * 2);
        stroke(c, k.ink, LINE * 0.5);
      }
    });
  },
};

const CY = 0.18;
const CX = 0.5;
const CHEEKS: Record<string, Drawer> = {
  none: () => {},
  blush: (c, k) =>
    both((s) => {
      const g = c.createRadialGradient(s * CX, CY, 0.0, s * CX, CY, 0.12);
      g.addColorStop(0, k.blush);
      g.addColorStop(0.6, k.blush + 'cc');
      g.addColorStop(1, k.blush + '00');
      ellipse(c, s * CX, CY, 0.12, 0.08);
      c.fillStyle = g;
      c.fill();
    }),
  freckles: (c, k) =>
    both((s) => {
      for (const [dx, dy] of [
        [-0.04, -0.02],
        [0.04, -0.03],
        [0.0, 0.03],
        [0.07, 0.03],
      ] as const) {
        circle(c, s * (CX - 0.02) + dx, CY + dy, 0.014);
        fill(c, '#b5714f');
      }
      void k;
    }),
  hearts: (c) =>
    both((s) => {
      heartPath(c, s * CX, CY, 0.045);
      fill(c, '#ff7b9c');
    }),
  stars: (c) =>
    both((s) => {
      softStar(c, s * CX, CY, 0.055);
      fill(c, '#ffd23f');
      softStar(c, s * CX, CY, 0.055);
      stroke(c, '#ffffff', 0.012);
    }),
  lines: (c, k) =>
    both((s) => {
      for (const dx of [-0.05, 0, 0.05]) {
        c.beginPath();
        c.moveTo(s * CX + dx - 0.02, CY + 0.035);
        c.lineTo(s * CX + dx + 0.02, CY - 0.035);
        stroke(c, k.blush, LINE * 0.6);
      }
    }),
  // Phase 2
  swirls: (c, k) =>
    both((s) => {
      c.beginPath();
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const a = t * TAU * 1.6;
        const r = 0.01 + t * 0.05;
        const px = s * CX + Math.cos(a) * r,
          py = CY + Math.sin(a) * r;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      stroke(c, k.blush, LINE * 0.55);
    }),
  bandaid: (c) => {
    c.save();
    c.translate(CX, CY);
    c.rotate(-0.5);
    c.beginPath();
    c.roundRect(-0.08, -0.03, 0.16, 0.06, 0.03);
    fill(c, '#f2c79b');
    c.fillStyle = '#e3aa79';
    c.fillRect(-0.025, -0.025, 0.05, 0.05);
    c.restore();
    both((s) => {
      if (s < 0) {
        const g = c.createRadialGradient(-CX, CY, 0, -CX, CY, 0.11);
        g.addColorStop(0, '#ff8fa3aa');
        g.addColorStop(1, '#ff8fa300');
        ellipse(c, -CX, CY, 0.11, 0.07);
        c.fillStyle = g;
        c.fill();
      }
    });
  },
  rainbow: (c) =>
    both((s) => {
      const cols = ['#ff6b6b', '#ffc93c', '#5fd068', '#4aa8ff'];
      cols.forEach((col, i) => {
        c.beginPath();
        c.arc(s * CX, CY + 0.04, 0.07 - i * 0.015, Math.PI, 0);
        stroke(c, col, 0.014);
      });
    }),
  dots: (c, k) =>
    both((s) => {
      circle(c, s * CX, CY, 0.045);
      fill(c, k.blush);
    }),
};

export const FACE_DRAWERS = {
  eyes: EYES,
  brows: BROWS,
  mouth: MOUTHS,
  nose: NOSES,
  cheeks: CHEEKS,
};

/** Draws a full face centred at (cx, cy) with unit = `unit` pixels. */
export function drawFace(
  ctx: Ctx,
  face: FaceSpec,
  ink: FaceInk,
  cx: number,
  cy: number,
  unit: number,
  blink = false,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(unit, unit);
  // Vinyl-toy faces sit a little low with big features.
  ctx.translate(0, FACE_DROP);
  ctx.scale(FACE_SCALE, FACE_SCALE);
  const o = { blink };
  (CHEEKS[face.cheeks] ?? CHEEKS.none!)(ctx, ink, o);
  (NOSES[face.nose] ?? NOSES.none!)(ctx, ink, o);
  (MOUTHS[face.mouth] ?? MOUTHS.smile!)(ctx, ink, o);
  if (ink.glow && !blink) {
    ctx.shadowColor = 'rgba(140,240,255,0.9)';
    ctx.shadowBlur = unit * 0.08;
  }
  (EYES[face.eyes] ?? EYES.dots!)(ctx, ink, o);
  ctx.shadowBlur = 0;
  (BROWS[face.brows] ?? BROWS.none!)(ctx, ink, o);
  ctx.restore();
}
