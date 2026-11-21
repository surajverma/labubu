import * as THREE from 'three';
import type { MaterialKit } from './materials';
import type { Rng } from '../rng';

/**
 * Scene "life": one hero prop per scene plus small ambient motion (drifting clouds,
 * birds, twinkling stars, swimming fish, waves…). Kept separate from the base scene
 * designs, and cheap: a few hundred triangles and simple per-frame transforms.
 */
export interface LifeCtx {
  g: THREE.Group;
  kit: MaterialKit;
  rng: Rng;
  add(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x?: number,
    y?: number,
    z?: number,
  ): THREE.Mesh;
  updaters: ((t: number, dt: number) => void)[];
}

function group(c: LifeCtx, x: number, y: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  c.g.add(g);
  return g;
}

/** Adds a mesh into a sub-group (geometry is still tracked for disposal by c.add). */
function part(
  c: LifeCtx,
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = c.add(geo, mat, x, y, z);
  parent.add(m);
  return m;
}

// --- Ambient motion -------------------------------------------------------------------

/** A little bird that flaps across the sky every so often. */
function birds(c: LifeCtx, color = '#3a3a4a', y = 3.2, z = -6): void {
  const b = group(c, -20, y, z);
  const mat = c.kit.prop(color);
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = part(c, b, new THREE.BoxGeometry(0.34, 0.03, 0.12), mat, s * 0.16, 0, 0);
    wings.push(w);
  }
  part(c, b, new THREE.SphereGeometry(0.07, 8, 6), mat);
  let next = 2 + c.rng() * 4;
  let flying = false;
  let speed = 2.2;
  c.updaters.push((t, dt) => {
    if (!flying) {
      next -= dt;
      if (next <= 0) {
        flying = true;
        speed = (c.rng() < 0.5 ? 1 : -1) * (1.8 + c.rng());
        b.position.set(speed > 0 ? -9 : 9, y + (c.rng() - 0.5) * 1.2, z);
      }
      return;
    }
    b.position.x += speed * dt;
    b.position.y += Math.sin(t * 2) * 0.004;
    const flap = Math.sin(t * 14) * 0.6;
    wings[0]!.rotation.z = flap;
    wings[1]!.rotation.z = -flap;
    if (Math.abs(b.position.x) > 9.5) {
      flying = false;
      next = 6 + c.rng() * 8;
    }
  });
}

/** Slow drift for existing cloud groups in a scene. */
function driftClouds(c: LifeCtx): void {
  const clouds = c.g.children.filter(
    (o) => o instanceof THREE.Group && o.children.length >= 3 && o.position.y > 1.5,
  );
  const base = clouds.map((o) => o.position.x);
  c.updaters.push((t) =>
    clouds.forEach((o, i) => (o.position.x = base[i]! + Math.sin(t * 0.07 + i * 2) * 0.8)),
  );
}

/** Makes star point layers twinkle. */
function twinkle(c: LifeCtx): void {
  const pts = c.g.children.filter((o): o is THREE.Points => o instanceof THREE.Points);
  c.updaters.push((t) =>
    pts.forEach((p, i) => {
      const m = p.material as THREE.PointsMaterial;
      if (!m.map) m.size = 0.06 * (0.8 + Math.sin(t * 2.3 + i * 1.7) * 0.25);
    }),
  );
}

function shootingStar(c: LifeCtx): void {
  const s = c.add(
    new THREE.CylinderGeometry(0.012, 0.0, 0.9, 6),
    c.kit.basic('#fffbe0', { fog: false, transparent: true, opacity: 0 }),
    0,
    6,
    -9,
  );
  s.rotation.z = Math.PI / 2.6;
  let next = 3 + c.rng() * 5;
  let k = -1;
  c.updaters.push((_t, dt) => {
    const m = s.material as THREE.MeshBasicMaterial;
    if (k < 0) {
      next -= dt;
      m.opacity = 0;
      if (next <= 0) {
        k = 0;
        s.position.set(-3 + c.rng() * 6, 5.5 + c.rng(), -9);
      }
      return;
    }
    k += dt / 0.7;
    s.position.x += dt * 6;
    s.position.y -= dt * 3;
    m.opacity = Math.sin(Math.min(1, k) * Math.PI);
    if (k >= 1) {
      k = -1;
      next = 5 + c.rng() * 8;
    }
  });
}

function fishSchool(c: LifeCtx): void {
  const cols = ['#ffb347', '#ff6f91', '#7fd6ff'];
  for (let i = 0; i < 3; i++) {
    const f = group(c, 0, 1.2 + i * 0.6, -2.5 - i * 0.6, 0.9);
    const mat = c.kit.plastic(cols[i]!, 0.4);
    part(c, f, new THREE.SphereGeometry(0.16, 12, 8), mat).scale.set(1.5, 1, 0.7);
    const tail = part(c, f, new THREE.ConeGeometry(0.1, 0.18, 4), mat, -0.28, 0, 0);
    tail.rotation.z = Math.PI / 2;
    part(c, f, new THREE.SphereGeometry(0.03, 6, 4), c.kit.basic('#1d1d2b'), 0.15, 0.04, 0.07);
    const r = 2.6 + i * 0.5;
    const sp = 0.25 + i * 0.07;
    c.updaters.push((t) => {
      const a = t * sp + i * 2.1;
      f.position.x = Math.cos(a) * r;
      f.position.z = -3 + Math.sin(a) * 0.8;
      f.position.y = 1.2 + i * 0.6 + Math.sin(t * 1.5 + i) * 0.1;
      f.rotation.y = -a - Math.PI / 2 + Math.PI;
      tail.rotation.y = Math.sin(t * 9 + i) * 0.4;
    });
  }
}

// --- Hero props -----------------------------------------------------------------------

function sandcastle(c: LifeCtx, x: number, z: number): void {
  const g = group(c, x, 0, z, 1.1);
  const sand = c.kit.prop('#e9c98a');
  part(c, g, new THREE.CylinderGeometry(0.34, 0.4, 0.3, 8), sand, 0, 0.15, 0);
  for (const [dx, dz] of [
    [-0.3, 0],
    [0.3, 0],
    [0, -0.28],
  ] as const) {
    part(c, g, new THREE.CylinderGeometry(0.11, 0.13, 0.42, 7), sand, dx, 0.32, dz);
    part(c, g, new THREE.ConeGeometry(0.13, 0.16, 7), sand, dx, 0.6, dz);
  }
  part(
    c,
    g,
    new THREE.CylinderGeometry(0.004, 0.004, 0.3, 4),
    c.kit.prop('#7a5238'),
    0,
    0.82,
    -0.28,
  );
  const flag = part(
    c,
    g,
    new THREE.PlaneGeometry(0.14, 0.09),
    c.kit.prop('#ff6b6b'),
    0.07,
    0.92,
    -0.28,
  );
  (flag.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  c.updaters.push((t) => (flag.rotation.y = Math.sin(t * 3) * 0.3));
  const bucket = part(
    c,
    g,
    new THREE.CylinderGeometry(0.11, 0.08, 0.16, 12),
    c.kit.plastic('#3fa2ff', 0.4),
    0.55,
    0.08,
    0.2,
  );
  void bucket;
}

function snowman(c: LifeCtx, x: number, z: number): void {
  const g = group(c, x, 0, z, 1.05);
  const snow = c.kit.prop('#f7fbff', false);
  part(c, g, new THREE.SphereGeometry(0.32, 16, 12), snow, 0, 0.28, 0);
  part(c, g, new THREE.SphereGeometry(0.23, 16, 12), snow, 0, 0.74, 0);
  part(c, g, new THREE.SphereGeometry(0.16, 16, 12), snow, 0, 1.08, 0);
  const nose = part(
    c,
    g,
    new THREE.ConeGeometry(0.035, 0.16, 8),
    c.kit.prop('#ff8a3d'),
    0,
    1.08,
    0.2,
  );
  nose.rotation.x = Math.PI / 2;
  for (const s of [-1, 1])
    part(c, g, new THREE.SphereGeometry(0.022, 6, 4), c.kit.prop('#222'), s * 0.06, 1.13, 0.14);
  const scarf = part(
    c,
    g,
    new THREE.TorusGeometry(0.17, 0.045, 8, 20),
    c.kit.prop('#e23b3b'),
    0,
    0.93,
    0,
  );
  scarf.rotation.x = Math.PI / 2;
  part(c, g, new THREE.CylinderGeometry(0.12, 0.12, 0.16, 12), c.kit.prop('#2b2b3a'), 0, 1.27, 0);
  part(c, g, new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12), c.kit.prop('#2b2b3a'), 0, 1.2, 0);
}

function rocket(c: LifeCtx, x: number, z: number): void {
  const g = group(c, x, 0, z, 1);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(
      new THREE.Vector2(0.22 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.95) + 0.005, t * 1.3),
    );
  }
  part(c, g, new THREE.LatheGeometry(pts, 16), c.kit.plastic('#f4f6fb', 0.35), 0, 0.15, 0);
  part(c, g, new THREE.CircleGeometry(0.08, 16), c.kit.plastic('#7fd6ff', 0.1), 0, 0.85, 0.215);
  for (let i = 0; i < 3; i++) {
    const fin = part(
      c,
      g,
      new THREE.BoxGeometry(0.03, 0.28, 0.2),
      c.kit.plastic('#ff5f5f', 0.35),
      0,
      0.3,
      0,
    );
    fin.rotation.y = (i / 3) * Math.PI * 2;
    fin.translateZ(0.2);
  }
  const flame = part(
    c,
    g,
    new THREE.ConeGeometry(0.1, 0.25, 10),
    c.kit.glow('#ffb347', 1.4),
    0,
    0.05,
    0,
  );
  flame.rotation.x = Math.PI;
  c.updaters.push((t) => {
    flame.scale.y = 0.8 + Math.sin(t * 30) * 0.2;
    g.position.y = Math.sin(t * 1.2) * 0.04 + 0.05;
  });
}

function toyBlocks(c: LifeCtx, x: number, z: number): void {
  const cols = ['#ff6b6b', '#ffd34d', '#5fd068', '#4aa8ff', '#b56bff'];
  const g = group(c, x, 0, z, 1);
  const stack: [number, number, number, number][] = [
    [0, 0.11, 0, 0.1],
    [0.24, 0.11, 0.05, -0.2],
    [0.12, 0.33, 0.02, 0.4],
    [-0.22, 0.11, 0.1, 0.3],
  ];
  stack.forEach(([bx, by, bz, ry], i) => {
    const b = part(
      c,
      g,
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      c.kit.plastic(cols[i % cols.length]!, 0.45),
      bx,
      by,
      bz,
    );
    b.rotation.y = ry;
  });
}

function cupcake(c: LifeCtx, x: number, z: number): void {
  const g = group(c, x, 0, z, 1.3);
  part(
    c,
    g,
    new THREE.CylinderGeometry(0.24, 0.18, 0.26, 12),
    c.kit.plastic('#ff8fb1', 0.5),
    0,
    0.13,
    0,
  );
  for (let i = 0; i < 3; i++)
    part(
      c,
      g,
      new THREE.SphereGeometry(0.24 - i * 0.07, 16, 10),
      c.kit.plastic('#fff4f8', 0.3),
      0,
      0.3 + i * 0.12,
      0,
    );
  part(c, g, new THREE.SphereGeometry(0.06, 12, 8), c.kit.plastic('#e8334a', 0.15), 0, 0.68, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const sp = part(
      c,
      g,
      new THREE.CapsuleGeometry(0.012, 0.03, 2, 4),
      c.kit.plastic(['#5fd068', '#4aa8ff', '#ffd34d'][i % 3]!, 0.3),
      Math.cos(a) * 0.15,
      0.44,
      Math.sin(a) * 0.15,
    );
    sp.rotation.z = a;
  }
}

function tent(c: LifeCtx, x: number, z: number): void {
  const g = group(c, x, 0, z, 1.2);
  const canvasMat = c.kit.prop('#ff9a5c');
  const t = part(c, g, new THREE.ConeGeometry(0.6, 0.8, 4, 1, true), canvasMat, 0, 0.4, 0);
  t.rotation.y = Math.PI / 4;
  (t.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  part(c, g, new THREE.PlaneGeometry(0.34, 0.5), c.kit.prop('#5a3a2a'), 0, 0.25, 0.3).rotation.x =
    -0.6;
  // Little campfire with flickering flame.
  for (let i = 0; i < 4; i++) {
    const log = part(
      c,
      g,
      new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6),
      c.kit.prop('#7a5238'),
      0.7,
      0.04,
      0.4,
    );
    log.rotation.set(Math.PI / 2, (i / 4) * Math.PI, 0.3);
  }
  const fire = part(
    c,
    g,
    new THREE.ConeGeometry(0.09, 0.22, 8),
    c.kit.glow('#ffa53d', 1.6),
    0.7,
    0.14,
    0.4,
  );
  c.updaters.push((tt) => {
    fire.scale.set(1 + Math.sin(tt * 17) * 0.1, 0.85 + Math.sin(tt * 23) * 0.2, 1);
  });
}

function chest(c: LifeCtx, x: number, z: number): void {
  const g = group(c, x, 0, z, 1.1);
  const wood = c.kit.prop('#9b6b3a');
  const gold = c.kit.metal('#f2c14e');
  part(c, g, new THREE.BoxGeometry(0.5, 0.28, 0.32), wood, 0, 0.14, 0);
  const lid = new THREE.Group();
  lid.position.set(0, 0.28, -0.16);
  g.add(lid);
  const top = part(
    c,
    lid,
    new THREE.CylinderGeometry(0.16, 0.16, 0.5, 12, 1, false, 0, Math.PI),
    wood,
    0,
    0,
    0.16,
  );
  top.rotation.z = Math.PI / 2;
  part(c, g, new THREE.BoxGeometry(0.06, 0.1, 0.02), gold, 0, 0.24, 0.17);
  for (let i = 0; i < 5; i++)
    part(
      c,
      g,
      new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10),
      gold,
      -0.12 + i * 0.06,
      0.29,
      0.02,
    );
  c.updaters.push((t) => (lid.rotation.x = -0.35 - Math.max(0, Math.sin(t * 0.8)) * 0.25));
}

function hotAirBalloon(c: LifeCtx, x: number, z: number): void {
  const g = group(c, x, 2.6, z, 1);
  const cols = ['#ff6b6b', '#ffd34d'];
  for (let i = 0; i < 8; i++) {
    const seg = part(
      c,
      g,
      new THREE.SphereGeometry(0.55, 6, 12, (i / 8) * Math.PI * 2, Math.PI / 4),
      c.kit.prop(cols[i % 2]!, false),
      0,
      0,
      0,
    );
    seg.scale.y = 1.15;
  }
  part(c, g, new THREE.BoxGeometry(0.22, 0.16, 0.22), c.kit.prop('#9b6b3a'), 0, -0.9, 0);
  c.updaters.push((t) => {
    g.position.y = 2.6 + Math.sin(t * 0.6) * 0.15;
    g.position.x = x + Math.sin(t * 0.13) * 0.4;
  });
}

function blinkLight(c: LifeCtx): void {
  const lights = c.g.children.filter(
    (o): o is THREE.Mesh =>
      o instanceof THREE.Mesh && (o.material as THREE.MeshStandardMaterial).emissiveIntensity > 1.2,
  );
  c.updaters.push((t) =>
    lights.forEach(
      (m) =>
        ((m.material as THREE.MeshStandardMaterial).emissiveIntensity =
          Math.sin(t * 3) > 0 ? 1.8 : 0.3),
    ),
  );
}

function waves(c: LifeCtx): void {
  const foam = c.g.children.find(
    (o) =>
      o instanceof THREE.Mesh && (o.geometry as THREE.PlaneGeometry).parameters?.height === 0.35,
  );
  if (!foam) return;
  const z0 = foam.position.z;
  c.updaters.push((t) => {
    foam.position.z = z0 + Math.sin(t * 0.9) * 0.18;
    foam.scale.y = 1 + Math.sin(t * 0.9 + 1) * 0.4;
  });
}

/** Per-scene extras: hero prop + ambient life. */
export const SCENE_LIFE: Record<string, (c: LifeCtx) => void> = {
  studio: () => {},
  beach: (c) => (sandcastle(c, 1.55, -1.7), waves(c), driftClouds(c), birds(c, '#3a3a4a', 3.6)),
  snowy: (c) => (snowman(c, -1.25, -1.7), twinkle(c), shootingStar(c)),
  space: (c) => (rocket(c, 1.7, -2.0), twinkle(c), shootingStar(c)),
  bedroom: (c) => toyBlocks(c, 1.3, -1.2),
  candy: (c) => (cupcake(c, 1.45, -1.6), driftClouds(c)),
  forest: (c) => (tent(c, 1.9, -2.6), birds(c, '#3a4a3a', 3)),
  rooftop: (c) => (blinkLight(c), birds(c, '#4a3a4a', 3.5, -5)),
  underwater: (c) => (chest(c, -1.4, -1.5), fishSchool(c)),
  clouds: (c) => (hotAirBalloon(c, 2.1, -4), driftClouds(c), birds(c, '#5a5a7a', 2.4, -5)),
  desert: (c) => birds(c, '#5a3a2a', 3.8),
  garden: (c) => birds(c, '#3a4a3a', 3),
  arcade: (c) => blinkLight(c),
  autumn: (c) => birds(c, '#4a3a2a', 3.2),
  crystal: (c) => twinkle(c),
  sunset: (c) => (twinkle(c), birds(c, '#3a2a3a', 2.8, -7)),
};
