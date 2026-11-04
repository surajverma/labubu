import * as THREE from 'three';
import { alignY, type BuildCtx } from '../buildCtx';
import { blobGeometry, capsule, latheProfile, taperedTube } from '../geometry';

type Builder = (c: BuildCtx) => void;

/** Places a pair of objects mirrored on the head at (az, el), sunk slightly into the surface. */
function pair(c: BuildCtx, az: number, el: number, make: (side: -1 | 1) => THREE.Object3D, sink = 0.04, tilt = 0): void {
  for (const s of [-1, 1] as const) {
    const a = c.head.anchor(az * s, el);
    const o = make(s);
    o.position.copy(a.pos).addScaledVector(a.normal, -sink);
    alignY(o, a.normal);
    if (tilt) o.rotateZ(-s * tilt);
    c.head.group.add(o);
  }
}

function earLen(c: BuildCtx, base: number): number {
  return c.spec.mods.shortEars ? base * 0.55 : base;
}

/** Rounded leaf shape (flattened blob). */
function leafGeo(len: number, w: number): THREE.BufferGeometry {
  const g = blobGeometry({ rx: w, ry: len / 2, rz: w * 0.28, egg: -0.35 }, { widthSegments: 20, heightSegments: 16 });
  g.translate(0, len / 2, 0);
  return g;
}

export const EARS: Record<string, Builder> = {
  none: () => {},

  bunny: (c) => {
    const L = earLen(c, 0.62);
    pair(c, 28, 55, (s) => {
      const g = new THREE.Group();
      const outer = c.mesh(blobGeometry({ rx: 0.13, ry: L / 2, rz: 0.08, egg: 0.1 }, { widthSegments: 24, heightSegments: 20 }), c.skin, g);
      outer.position.y = L / 2;
      const inner = c.mesh(blobGeometry({ rx: 0.075, ry: L * 0.38, rz: 0.05 }, { widthSegments: 18, heightSegments: 14 }), c.skinAlt, g);
      inner.position.set(0, L / 2 + 0.02, 0.045);
      g.rotation.z = s * 0.05;
      return g;
    }, 0.05, 0.1);
  },

  cat: (c) => {
    const L = earLen(c, 0.3);
    pair(c, 40, 50, () => {
      const g = new THREE.Group();
      const prof = (t: number) => 0.17 * Math.pow(1 - t, 0.85) * (0.6 + 0.4 * Math.sin(Math.min(1, t * 3) * Math.PI * 0.5)) + 0.01;
      const outer = c.mesh(latheProfile(L, prof, 18, 24), c.skin, g);
      outer.scale.z = 0.55;
      const inner = c.mesh(latheProfile(L * 0.78, (t) => prof(t) * 0.62, 14, 18), c.skinAlt, g);
      inner.scale.z = 0.4;
      inner.position.set(0, 0.04, 0.045);
      return g;
    }, 0.05, 0.15);
  },

  bear: (c) => {
    pair(c, 48, 42, () => {
      const g = new THREE.Group();
      const R = c.spec.mods.shortEars ? 0.12 : 0.16;
      const outer = c.mesh(blobGeometry({ rx: R, ry: R, rz: R * 0.55 }, { widthSegments: 24, heightSegments: 18 }), c.skin, g);
      outer.position.y = R * 0.6;
      const inner = c.mesh(blobGeometry({ rx: R * 0.6, ry: R * 0.6, rz: R * 0.25 }, { widthSegments: 18, heightSegments: 12 }), c.skinAlt, g);
      inner.position.set(0, R * 0.6, R * 0.38);
      return g;
    }, 0.04);
  },

  pointy: (c) => {
    // Long sideways elf-like ears.
    for (const s of [-1, 1] as const) {
      const a = c.head.anchor(80 * s, 8);
      const L = earLen(c, 0.42);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(s * L * 0.55, L * 0.05, -0.02),
        new THREE.Vector3(s * L, L * 0.38, -0.04),
      );
      const g = new THREE.Group();
      const m = c.mesh(taperedTube(curve, 0.11, 0.02, 24, 14), c.skin, g);
      m.scale.set(1, 1, 0.55);
      g.position.copy(a.pos).addScaledVector(a.normal, -0.06);
      c.head.group.add(g);
    }
  },

  horns: (c) => {
    pair(c, 34, 52, (s) => {
      const L = earLen(c, 0.3);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(s * 0.08, L * 0.6, 0),
        new THREE.Vector3(s * 0.02, L, -0.06),
      );
      const g = new THREE.Group();
      c.mesh(taperedTube(curve, 0.085, 0.015, 24, 14), c.kit.plastic(c.spec.palette.hatAlt, 0.3), g);
      return g;
    }, 0.02, 0.2);
  },

  antenna: (c) => {
    const g = new THREE.Group();
    const L = earLen(c, 0.34);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.06, L * 0.6, 0), new THREE.Vector3(0.12, L, 0.02));
    c.mesh(taperedTube(curve, 0.025, 0.02, 20, 10, false), c.kit.plastic(c.spec.palette.ink, 0.4), g);
    const ball = c.mesh(new THREE.SphereGeometry(0.075, 20, 14), c.kit.glow(c.spec.palette.accent, 0.6), g);
    ball.position.set(0.12, L, 0.02);
    const a = c.head.anchor(0, 90);
    g.position.copy(a.pos).addScaledVector(a.normal, -0.03);
    c.head.group.add(g);
  },

  sprout: (c) => {
    const g = new THREE.Group();
    const stemH = 0.16;
    const green = c.kit.vinyl('#5cc46a', 'glossy');
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.02, stemH * 0.6, 0), new THREE.Vector3(0.01, stemH, 0));
    c.mesh(taperedTube(curve, 0.028, 0.022, 16, 10, false), green, g);
    for (const s of [-1, 1]) {
      const leaf = c.mesh(leafGeo(0.24, 0.1), green, g);
      leaf.position.set(0.01, stemH - 0.01, 0);
      leaf.rotation.z = s * 1.05;
      leaf.rotation.y = s * 0.25;
    }
    const a = c.head.anchor(0, 90);
    g.position.copy(a.pos).addScaledVector(a.normal, -0.03);
    g.rotation.z = 0.08;
    c.head.group.add(g);
  },

  mouse: (c) => {
    pair(c, 55, 38, () => {
      const g = new THREE.Group();
      const R = c.spec.mods.shortEars ? 0.17 : 0.24;
      const outer = c.mesh(blobGeometry({ rx: R, ry: R, rz: 0.06 }, { widthSegments: 28, heightSegments: 18 }), c.skin, g);
      outer.position.y = R * 0.75;
      const inner = c.mesh(blobGeometry({ rx: R * 0.7, ry: R * 0.7, rz: 0.03 }, { widthSegments: 20, heightSegments: 12 }), c.skinAlt, g);
      inner.position.set(0, R * 0.75, 0.045);
      return g;
    }, 0.04, 0.15);
  },

  unicorn: (c) => {
    const L = earLen(c, 0.36);
    const g = new THREE.Group();
    const prof = (t: number) => 0.085 * (1 - t) + 0.008;
    const horn = c.mesh(latheProfile(L, prof, 24, 20), c.kit.plastic('#fff1b8', 0.25), g);
    horn.name = 'horn';
    // Spiral groove: a thin tube wrapping the horn.
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const r = prof(t) + 0.004;
      const a = t * Math.PI * 6;
      pts.push(new THREE.Vector3(Math.cos(a) * r, t * L * 0.95, Math.sin(a) * r));
    }
    c.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.008, 6), c.kit.plastic('#ffc4e1', 0.3), g);
    const a = c.head.anchor(0, 62);
    g.position.copy(a.pos).addScaledVector(a.normal, -0.04);
    alignY(g, a.normal.clone().lerp(new THREE.Vector3(0, 1, 0.3), 0.4));
    c.head.group.add(g);
    // Small side ears too.
    EARS.cat!({ ...c, spec: { ...c.spec, mods: { ...c.spec.mods, shortEars: true } } });
  },

  floppy: (c) => {
    for (const s of [-1, 1] as const) {
      const a = c.head.anchor(78 * s, 25);
      const g = new THREE.Group();
      const L = 0.42;
      const ear = c.mesh(blobGeometry({ rx: 0.14, ry: L / 2, rz: 0.06, egg: -0.2 }, { widthSegments: 24, heightSegments: 18 }), c.skin, g);
      ear.position.y = -L / 2 + 0.06;
      const inner = c.mesh(blobGeometry({ rx: 0.09, ry: L * 0.36, rz: 0.03 }, { widthSegments: 16, heightSegments: 12 }), c.skinAlt, g);
      inner.position.set(0, -L / 2 + 0.06, 0.04 * 1);
      g.position.copy(a.pos).addScaledVector(a.normal, -0.02);
      g.rotation.set(0, s * 1.35, s * 0.32);
      c.head.group.add(g);
    }
  },

  tufts: (c) => {
    pair(c, 30, 62, (s) => {
      const g = new THREE.Group();
      const m = c.skin;
      for (let i = 0; i < 3; i++) {
        const L = earLen(c, 0.2 - i * 0.04);
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(s * (0.02 + i * 0.03), L * 0.6, 0),
          new THREE.Vector3(s * (0.06 + i * 0.07), L, -0.02 + i * 0.03),
        );
        c.mesh(taperedTube(curve, 0.06, 0.01, 14, 10), m, g);
      }
      return g;
    }, 0.03);
  },

  // --- Phase 2 ---
  antlers: (c) => {
    pair(c, 32, 55, (s) => {
      const g = new THREE.Group();
      const mat = c.kit.plastic('#b98552', 0.55);
      const L = earLen(c, 0.36);
      const main = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.05, L * 0.5, 0), new THREE.Vector3(s * 0.12, L, -0.03));
      c.mesh(taperedTube(main, 0.045, 0.025, 18, 10), mat, g);
      for (const k of [0.45, 0.72]) {
        const p = main.getPoint(k);
        const br = new THREE.QuadraticBezierCurve3(p, p.clone().add(new THREE.Vector3(s * 0.08, 0.04, 0)), p.clone().add(new THREE.Vector3(s * 0.14, 0.12, 0.02)));
        c.mesh(taperedTube(br, 0.03, 0.018, 10, 8), mat, g);
      }
      return g;
    }, 0.02, 0.15);
  },

  fox: (c) => {
    const L = earLen(c, 0.42);
    pair(c, 36, 48, () => {
      const g = new THREE.Group();
      const prof = (t: number) => 0.2 * Math.pow(1 - t, 1.1) + 0.008;
      const outer = c.mesh(latheProfile(L, prof, 18, 24), c.skin, g);
      outer.scale.z = 0.5;
      const tip = c.mesh(latheProfile(L * 0.35, (t) => prof(0.65 + t * 0.35) * 1.06 + 0.004, 10, 20), c.kit.vinyl(c.spec.palette.ink, 'glossy'), g);
      tip.position.y = L * 0.65;
      tip.scale.z = 0.52;
      const inner = c.mesh(latheProfile(L * 0.7, (t) => prof(t) * 0.55, 12, 18), c.skinAlt, g);
      inner.scale.z = 0.35;
      inner.position.set(0, 0.03, 0.05);
      return g;
    }, 0.05, 0.22);
  },

  fins: (c) => {
    for (const s of [-1, 1] as const) {
      const a = c.head.anchor(85 * s, 15);
      const g = new THREE.Group();
      const fin = c.mesh(blobGeometry({ rx: 0.22, ry: 0.16, rz: 0.035, egg: 0.3 }, { widthSegments: 24, heightSegments: 16 }), c.kit.vinyl(c.spec.palette.skinAlt, 'pearl'), g);
      fin.position.x = s * 0.15;
      fin.rotation.z = s * 0.4;
      g.position.copy(a.pos).addScaledVector(a.normal, -0.05);
      g.rotation.y = s * 0.3;
      c.head.group.add(g);
    }
  },

  flowerbud: (c) => {
    const g = new THREE.Group();
    const green = c.kit.vinyl('#5cc46a', 'glossy');
    c.mesh(capsule(0.025, 0.12, 8), green, g).position.y = 0.06;
    const petal = c.kit.vinyl(c.spec.palette.accent, 'glossy');
    for (let i = 0; i < 6; i++) {
      const p = c.mesh(blobGeometry({ rx: 0.07, ry: 0.035, rz: 0.11 }, { widthSegments: 14, heightSegments: 10 }), petal, g);
      const a = (i / 6) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.09, 0.2, Math.sin(a) * 0.09);
      p.rotation.y = -a + Math.PI / 2;
      p.rotation.x = 0.35;
    }
    c.mesh(new THREE.SphereGeometry(0.055, 16, 12), c.kit.vinyl('#ffd23f', 'glossy'), g).position.y = 0.21;
    const a = c.head.anchor(0, 90);
    g.position.copy(a.pos).addScaledVector(a.normal, -0.03);
    g.rotation.z = -0.15;
    c.head.group.add(g);
  },

  bee: (c) => {
    pair(c, 22, 60, (s) => {
      const g = new THREE.Group();
      const L = earLen(c, 0.3);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.02, L * 0.7, 0.02), new THREE.Vector3(s * 0.12, L, 0.06));
      c.mesh(taperedTube(curve, 0.02, 0.016, 14, 8, false), c.kit.plastic(c.spec.palette.ink, 0.4), g);
      const b = c.mesh(new THREE.SphereGeometry(0.06, 16, 12), c.kit.plastic(c.spec.palette.ink, 0.3), g);
      b.position.set(s * 0.12, L, 0.06);
      return g;
    }, 0.03);
  },

  wings: (c) => {
    // Little feathered wing-ears.
    for (const s of [-1, 1] as const) {
      const a = c.head.anchor(82 * s, 30);
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const f = c.mesh(blobGeometry({ rx: 0.05, ry: 0.15 - i * 0.03, rz: 0.03, egg: -0.3 }, { widthSegments: 12, heightSegments: 10 }), c.kit.vinyl('#ffffff', 'pearl'), g);
        f.position.set(s * (0.04 + i * 0.05), 0.08 - i * 0.03, -i * 0.01);
        f.rotation.z = -s * (0.6 + i * 0.25);
      }
      g.position.copy(a.pos).addScaledVector(a.normal, -0.03);
      c.head.group.add(g);
    }
  },
};
