import * as THREE from 'three';
import { MaterialKit } from './materials';
import type { Backdrop } from './stage';
import { rngFromString, type Rng } from '../rng';

interface SceneCtx {
  g: THREE.Group;
  kit: MaterialKit;
  geos: THREE.BufferGeometry[];
  rng: Rng;
  add(geo: THREE.BufferGeometry, mat: THREE.Material, x?: number, y?: number, z?: number): THREE.Mesh;
  updaters: ((t: number, dt: number) => void)[];
}

type SceneDef = {
  skyTop: string;
  skyBottom: string;
  ground: string;
  light?: Backdrop['light'];
  fog?: Backdrop['fog'];
  build(c: SceneCtx): void;
};

function ground(c: SceneCtx, color: string, r = 14): void {
  const m = c.add(new THREE.CircleGeometry(r, 48), c.kit.prop(color, false), 0, 0, 0);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 0;
}

/** Display pedestal under the toy (round, soft). */
function pedestal(c: SceneCtx, color: string, trim?: string): void {
  const top = c.add(new THREE.CylinderGeometry(0.78, 0.82, 0.12, 48), c.kit.prop(color, false), 0, -0.05, 0);
  top.name = 'pedestal';
  if (trim) c.add(new THREE.TorusGeometry(0.8, 0.025, 8, 48), c.kit.plastic(trim, 0.4), 0, -0.01, 0).rotation.x = Math.PI / 2;
}

function tree(c: SceneCtx, x: number, z: number, s: number, leaf: string, trunk = '#9b6b4a'): void {
  c.add(new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.6 * s, 6), c.kit.prop(trunk), x, 0.3 * s, z);
  c.add(new THREE.IcosahedronGeometry(0.45 * s, 0), c.kit.prop(leaf), x, 0.85 * s, z);
  c.add(new THREE.IcosahedronGeometry(0.32 * s, 0), c.kit.prop(leaf), x + 0.15 * s, 1.15 * s, z + 0.05);
}

function pine(c: SceneCtx, x: number, z: number, s: number, col: string, snow = false): void {
  c.add(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.3 * s, 6), c.kit.prop('#7a5238'), x, 0.15 * s, z);
  for (let i = 0; i < 3; i++) {
    c.add(new THREE.ConeGeometry((0.5 - i * 0.12) * s, 0.55 * s, 7), c.kit.prop(col), x, (0.45 + i * 0.32) * s, z);
    if (snow) c.add(new THREE.ConeGeometry((0.3 - i * 0.07) * s, 0.2 * s, 7), c.kit.prop('#f4f8ff'), x, (0.68 + i * 0.32) * s, z);
  }
}

function cloud(c: SceneCtx, x: number, y: number, z: number, s: number, col = '#ffffff'): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  const m = c.kit.prop(col, false);
  for (const [dx, dy, r] of [
    [0, 0, 0.5],
    [0.5, -0.1, 0.38],
    [-0.5, -0.12, 0.36],
    [0.2, 0.25, 0.34],
  ] as const) {
    const g = new THREE.SphereGeometry(r * s, 16, 12);
    c.geos.push(g);
    const me = new THREE.Mesh(g, m);
    me.position.set(dx * s, dy * s, 0);
    grp.add(me);
  }
  grp.scale.z = 0.6;
  c.g.add(grp);
  return grp;
}

function particles(c: SceneCtx, n: number, color: string, size: number, area: [number, number, number], speed: number, drift = 0.2): void {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (c.rng() - 0.5) * area[0];
    pos[i * 3 + 1] = c.rng() * area[1];
    pos[i * 3 + 2] = -c.rng() * area[2] + 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  c.geos.push(geo);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const x = cv.getContext('2d')!;
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, '#ffffffff');
  gr.addColorStop(1, '#ffffff00');
  x.fillStyle = gr;
  x.fillRect(0, 0, 32, 32);
  const tex = c.kit.ownTexture(new THREE.CanvasTexture(cv));
  const mat = c.kit.own(new THREE.PointsMaterial({ color, size, map: tex, transparent: true, depthWrite: false, sizeAttenuation: true }));
  const pts = new THREE.Points(geo, mat);
  c.g.add(pts);
  c.updaters.push((t, dt) => {
    const a = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      let y = a.getY(i) + speed * dt;
      if (speed < 0 && y < 0) y += area[1];
      if (speed > 0 && y > area[1]) y -= area[1];
      a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(t + i) * drift * dt);
    }
    a.needsUpdate = true;
  });
}

function stars(c: SceneCtx, n: number, spread = 1): void {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (c.rng() - 0.5) * 22 * spread;
    pos[i * 3 + 1] = 1.5 + c.rng() * 9;
    pos[i * 3 + 2] = -6 - c.rng() * 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  c.geos.push(geo);
  const mat = c.kit.own(new THREE.PointsMaterial({ color: '#fff8e0', size: 0.06, sizeAttenuation: true, fog: false }));
  c.g.add(new THREE.Points(geo, mat));
}

export const SCENES: Record<string, SceneDef> = {
  studio: {
    skyTop: '#ffe9dc',
    skyBottom: '#fff6ef',
    ground: '#f7e4d7',
    fog: { color: '#fff3ea', near: 7, far: 16 },
    build(c) {
      ground(c, '#f7e4d7');
      pedestal(c, '#ffffff', '#f3c9b3');
      // Soft back panel arc.
      const arc = c.add(new THREE.CylinderGeometry(4.5, 4.5, 6, 48, 1, true, Math.PI * 0.75, Math.PI * 0.5), c.kit.prop('#ffe1d0', false), 0, 3, 0);
      (arc.material as THREE.MeshStandardMaterial).side = THREE.BackSide;
    },
  },
  beach: {
    skyTop: '#62c6f2',
    skyBottom: '#d9f4ff',
    ground: '#f6dca4',
    light: { key: '#fff1d6', keyIntensity: 2.4 },
    fog: { color: '#d9f4ff', near: 8, far: 20 },
    build(c) {
      ground(c, '#f6dca4');
      const sea = c.add(new THREE.PlaneGeometry(40, 10), c.kit.prop('#3fb6d9', false), 0, 0.01, -9);
      sea.rotation.x = -Math.PI / 2;
      const foam = c.add(new THREE.PlaneGeometry(40, 0.35), c.kit.prop('#e9fbff', false), 0, 0.015, -4.1);
      foam.rotation.x = -Math.PI / 2;
      // Palm tree.
      const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.1, 0, -2.4), new THREE.Vector3(-2.0, 1, -2.4), new THREE.Vector3(-1.7, 2.1, -2.4)]);
      c.add(new THREE.TubeGeometry(trunk, 8, 0.09, 6), c.kit.prop('#b88a5a'));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const leaf = c.add(new THREE.ConeGeometry(0.18, 1.1, 4), c.kit.prop('#3fae5a'), -1.7 + Math.cos(a) * 0.45, 2.0, -2.4 + Math.sin(a) * 0.45);
        leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
      }
      // Beach ball + shells.
      const ball = c.add(new THREE.IcosahedronGeometry(0.22, 1), c.kit.prop('#ff6b6b'), 1.5, 0.22, -0.9);
      ball.rotation.z = 0.4;
      c.add(new THREE.ConeGeometry(0.09, 0.12, 5), c.kit.prop('#ffb6c1'), -1.2, 0.04, 0.4).rotation.x = Math.PI / 2;
      const sun = c.add(new THREE.SphereGeometry(0.7, 20, 14), c.kit.basic('#fff2a8', { fog: false }), 2.6, 5.5, -10);
      void sun;
      cloud(c, -2.5, 4.6, -9, 1.2);
    },
  },
  snowy: {
    skyTop: '#1c2a5a',
    skyBottom: '#5b6fb0',
    ground: '#eef3ff',
    light: { hemiSky: '#b9c8ff', hemiGround: '#e4ecff', key: '#dfe6ff', keyIntensity: 1.6, rim: '#9fc0ff', ambient: 0.9 },
    fog: { color: '#5b6fb0', near: 8, far: 20 },
    build(c) {
      ground(c, '#eef3ff');
      pine(c, -1.9, -2.2, 1.4, '#2f7a5f', true);
      pine(c, 2.1, -3.0, 1.7, '#2a6b55', true);
      pine(c, -3.2, -4.5, 2.0, '#2a6b55', true);
      for (const [x, z, r] of [
        [1.4, -1.2, 0.35],
        [-1.2, -0.8, 0.25],
      ] as const)
        c.add(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), c.kit.prop('#ffffff', false), x, 0, z);
      c.add(new THREE.SphereGeometry(0.6, 24, 16), c.kit.basic('#fffbe6', { fog: false }), -2.2, 5.6, -10);
      stars(c, 120);
      particles(c, 160, '#ffffff', 0.07, [8, 5, 6], -0.35, 0.25);
    },
  },
  space: {
    skyTop: '#090a2a',
    skyBottom: '#3a1d6e',
    ground: '#7d6bb8',
    light: { hemiSky: '#b6a6ff', hemiGround: '#40306b', key: '#ffffff', keyIntensity: 2.0, rim: '#7fd8ff', ambient: 0.8 },
    build(c) {
      // Small planet surface with craters.
      const planet = c.add(new THREE.SphereGeometry(6, 48, 24), c.kit.prop('#7d6bb8', false), 0, -6, 0);
      void planet;
      for (const [x, z, r] of [
        [1.3, -0.9, 0.3],
        [-1.6, -1.6, 0.42],
        [0.6, -2.6, 0.25],
      ] as const) {
        const cr = c.add(new THREE.TorusGeometry(r, 0.06, 6, 20), c.kit.prop('#6a58a6', false), x, -0.01 - (x * x + z * z) * 0.05, z);
        cr.rotation.x = Math.PI / 2;
      }
      const ringed = new THREE.Group();
      ringed.position.set(2.4, 4.2, -8);
      c.g.add(ringed);
      const pm = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), c.kit.prop('#ffb36b', false));
      const rm = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.1, 6, 40), c.kit.prop('#ffe1a8', false));
      c.geos.push(pm.geometry, rm.geometry);
      rm.rotation.x = 1.2;
      ringed.add(pm, rm);
      const moon = c.add(new THREE.SphereGeometry(0.4, 18, 12), c.kit.prop('#cfd8ff', false), -2.6, 5.2, -8);
      void moon;
      stars(c, 260, 1.3);
      c.updaters.push((t) => (ringed.rotation.y = t * 0.1));
    },
  },
  bedroom: {
    skyTop: '#ffd9e6',
    skyBottom: '#fff0e6',
    ground: '#d9a77d',
    light: { key: '#ffe7cf', keyIntensity: 2.0 },
    build(c) {
      ground(c, '#d9a77d');
      const wall = c.add(new THREE.PlaneGeometry(14, 8), c.kit.prop('#ffd5e2', false), 0, 4, -3.2);
      void wall;
      const rug = c.add(new THREE.CircleGeometry(1.4, 40), c.kit.prop('#8fd1c8', false), 0, 0.01, 0);
      rug.rotation.x = -Math.PI / 2;
      const rug2 = c.add(new THREE.RingGeometry(1.15, 1.25, 40), c.kit.prop('#ffffff', false), 0, 0.012, 0);
      rug2.rotation.x = -Math.PI / 2;
      // Bed.
      c.add(new THREE.BoxGeometry(2.2, 0.5, 1.4), c.kit.prop('#ffffff', false), -2.2, 0.25, -2.4);
      c.add(new THREE.BoxGeometry(2.25, 0.18, 1.45), c.kit.prop('#a9c8ff', false), -2.2, 0.55, -2.4);
      c.add(new THREE.BoxGeometry(0.6, 0.2, 0.9), c.kit.prop('#fff7f0', false), -2.9, 0.72, -2.4);
      // Window with stars.
      c.add(new THREE.BoxGeometry(1.4, 1.2, 0.06), c.kit.prop('#ffffff', false), 1.7, 2.3, -3.15);
      c.add(new THREE.PlaneGeometry(1.2, 1.0), c.kit.basic('#2c3e8f'), 1.7, 2.3, -3.11);
      c.add(new THREE.CircleGeometry(0.15, 16), c.kit.basic('#fff3b0'), 1.95, 2.55, -3.1);
      // Lamp.
      c.add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), c.kit.prop('#e7c06b'), 2.0, 0.4, -1.8);
      c.add(new THREE.ConeGeometry(0.25, 0.3, 12, 1, true), c.kit.glow('#fff1c1', 0.6), 2.0, 0.9, -1.8);
      // Stars garland.
      for (let i = 0; i < 7; i++) c.add(new THREE.OctahedronGeometry(0.07, 0), c.kit.glow('#ffe27a', 0.8), -2.4 + i * 0.8, 3.3 - Math.sin((i / 6) * Math.PI) * 0.3, -3.1);
    },
  },
  candy: {
    skyTop: '#ffb3d9',
    skyBottom: '#fff0c9',
    ground: '#ffd6ea',
    light: { hemiSky: '#ffe0f0', key: '#fff0f6' },
    fog: { color: '#fff0c9', near: 8, far: 20 },
    build(c) {
      ground(c, '#ffd6ea');
      const lolli = (x: number, z: number, s: number, col: string) => {
        c.add(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 1.4 * s, 8), c.kit.prop('#ffffff'), x, 0.7 * s, z);
        const d = c.add(new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.1 * s, 24), c.kit.plastic(col, 0.25), x, 1.45 * s, z);
        d.rotation.x = Math.PI / 2;
        const sw = c.add(new THREE.TorusGeometry(0.22 * s, 0.05 * s, 8, 24), c.kit.plastic('#ffffff', 0.25), x, 1.45 * s, z + 0.055 * s);
        void sw;
      };
      lolli(-1.9, -2.2, 1.2, '#ff5fa2');
      lolli(2.2, -3, 1.5, '#7fd6ff');
      for (const [x, z, col] of [
        [1.3, -1.0, '#9ef0b0'],
        [-1.3, -1.2, '#ffd25f'],
        [0.6, -2.4, '#c9a3ff'],
      ] as const)
        c.add(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), c.kit.plastic(col, 0.2), x, 0, z);
      cloud(c, -2, 4.4, -8, 1.1, '#ffffff');
      cloud(c, 2.5, 5.2, -9, 0.9, '#fff3fb');
      pedestal(c, '#fff5fb', '#ff9ccc');
    },
  },
  forest: {
    skyTop: '#9fe0c9',
    skyBottom: '#eefbe8',
    ground: '#7fc47a',
    light: { hemiSky: '#e9ffe9', hemiGround: '#6ea86a', key: '#fff8dd' },
    fog: { color: '#eefbe8', near: 6, far: 18 },
    build(c) {
      ground(c, '#7fc47a');
      tree(c, -1.9, -2.0, 1.4, '#4fa860');
      tree(c, 2.3, -2.8, 1.8, '#3e9152');
      tree(c, -3.4, -4.6, 2.2, '#3e9152');
      tree(c, 3.4, -5.5, 2.4, '#4fa860');
      const shroom = (x: number, z: number, s: number) => {
        c.add(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.22 * s, 10), c.kit.prop('#fff6e6', false), x, 0.11 * s, z);
        c.add(new THREE.SphereGeometry(0.18 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), c.kit.plastic('#ff5f5f', 0.35), x, 0.2 * s, z);
      };
      shroom(1.2, -0.8, 1);
      shroom(1.45, -1.0, 0.7);
      shroom(-1.3, -0.5, 0.8);
      for (let i = 0; i < 9; i++) c.add(new THREE.IcosahedronGeometry(0.05, 0), c.kit.prop(['#fff', '#ffe066', '#ff9ecb'][i % 3]!), (c.rng() - 0.5) * 4, 0.03, -c.rng() * 2.5 + 0.3);
      particles(c, 30, '#fff7a8', 0.06, [6, 2.5, 4], 0.1, 0.3);
    },
  },
  rooftop: {
    skyTop: '#ff9a76',
    skyBottom: '#ffd9a6',
    ground: '#8d93a8',
    light: { key: '#ffd2b0', keyIntensity: 2.2, rim: '#ffb38a', hemiSky: '#ffd9c6' },
    fog: { color: '#ffd9a6', near: 8, far: 22 },
    build(c) {
      ground(c, '#8d93a8');
      for (let i = 0; i < 12; i++) {
        const w = 0.8 + c.rng() * 0.8,
          h = 1.5 + c.rng() * 3.5;
        const x = -6 + i * 1.1;
        c.add(new THREE.BoxGeometry(w, h, 0.8), c.kit.prop(['#6b5b95', '#7d6aa8', '#5a4d82'][i % 3]!), x, h / 2, -6 - (i % 2));
        for (let k = 0; k < 3; k++) c.add(new THREE.PlaneGeometry(0.12, 0.16), c.kit.basic('#ffe9a8'), x - 0.15 + k * 0.15, h * 0.4 + (k % 2) * 0.4, -5.59 - (i % 2));
      }
      // Rooftop ledge + antenna + water tower.
      c.add(new THREE.BoxGeometry(10, 0.3, 0.3), c.kit.prop('#a4a9bc'), 0, 0.15, -2.2);
      c.add(new THREE.CylinderGeometry(0.4, 0.4, 0.7, 10), c.kit.prop('#b0794f'), 2.3, 1.1, -2.8);
      c.add(new THREE.ConeGeometry(0.45, 0.3, 10), c.kit.prop('#8b5a3a'), 2.3, 1.6, -2.8);
      for (const sx of [-0.25, 0.25]) c.add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), c.kit.prop('#666a7a'), 2.3 + sx, 0.4, -2.8);
      c.add(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), c.kit.prop('#666a7a'), -2.0, 0.7, -2.3);
      c.add(new THREE.SphereGeometry(0.05, 8, 6), c.kit.glow('#ff5d5d', 1.5), -2.0, 1.42, -2.3);
      c.add(new THREE.SphereGeometry(0.9, 24, 16), c.kit.basic('#ffe2a0', { fog: false }), -1.2, 2.3, -12);
    },
  },
  underwater: {
    skyTop: '#0f5d8f',
    skyBottom: '#4fd1d9',
    ground: '#f0d9a8',
    light: { hemiSky: '#8fe8ff', hemiGround: '#2a7d8f', key: '#c9f6ff', keyIntensity: 1.8, rim: '#8ff0ff', ambient: 1.0 },
    fog: { color: '#2fa6c2', near: 5, far: 16 },
    build(c) {
      ground(c, '#f0d9a8');
      const weeds: THREE.Mesh[] = [];
      for (const [x, z, h, col] of [
        [-1.8, -1.8, 1.6, '#3fbf7f'],
        [-2.2, -2.4, 2.2, '#2fa66b'],
        [2.0, -2.2, 1.9, '#3fbf7f'],
        [2.5, -3.2, 2.4, '#2fa66b'],
      ] as const) {
        const w = c.add(new THREE.ConeGeometry(0.12, h, 5, 6), c.kit.prop(col), x, h / 2, z);
        weeds.push(w);
      }
      for (const [x, z, col] of [
        [1.3, -0.9, '#ff7f7f'],
        [-1.2, -1.0, '#ffb36b'],
      ] as const)
        c.add(new THREE.IcosahedronGeometry(0.22, 0), c.kit.prop(col), x, 0.12, z);
      c.add(new THREE.TorusGeometry(0.16, 0.06, 6, 5), c.kit.prop('#ff9ecb'), 0.8, 0.05, -1.6).rotation.x = Math.PI / 2;
      particles(c, 60, '#e9ffff', 0.09, [6, 5, 5], 0.4, 0.15);
      c.updaters.push((t) => weeds.forEach((w, i) => (w.rotation.z = Math.sin(t * 1.2 + i) * 0.12)));
    },
  },
  clouds: {
    skyTop: '#8fc9ff',
    skyBottom: '#ffeefa',
    ground: '#ffffff',
    light: { hemiSky: '#ffffff', hemiGround: '#e8eeff', key: '#fff6f0' },
    fog: { color: '#ffeefa', near: 6, far: 16 },
    build(c) {
      const base = cloud(c, 0, -0.45, 0, 2.2);
      void base;
      cloud(c, -2.2, 0.4, -2.8, 1.2);
      cloud(c, 2.4, 0.9, -3.5, 1.4);
      cloud(c, -1.0, 3.4, -7, 1.5);
      const arc = new THREE.Group();
      arc.position.set(0.4, 0, -6);
      c.g.add(arc);
      ['#ff8a8a', '#ffc46b', '#fff07a', '#8fe39a', '#7fc6ff', '#b89bff'].forEach((col, i) => {
        const t = new THREE.Mesh(new THREE.TorusGeometry(3.2 - i * 0.2, 0.1, 6, 40, Math.PI), c.kit.prop(col, false));
        c.geos.push(t.geometry);
        arc.add(t);
      });
    },
  },

  /** Not a character scene: the room where blind boxes are opened. */
  boxroom: {
    skyTop: '#ffcfe0',
    skyBottom: '#fff1e6',
    ground: '#ffe3d3',
    fog: { color: '#fff1e6', near: 7, far: 16 },
    build(c) {
      ground(c, '#ffe3d3');
      pedestal(c, '#ffffff', '#ffb3c7');
      const arc = c.add(new THREE.CylinderGeometry(4.5, 4.5, 6, 48, 1, true, Math.PI * 0.75, Math.PI * 0.5), c.kit.prop('#ffd6e4', false), 0, 3, 0);
      (arc.material as THREE.MeshStandardMaterial).side = THREE.BackSide;
      // Floating confetti shapes in the background.
      const cols = ['#ffd34d', '#7fd6ff', '#b89bff', '#ff8fb1', '#8fe39a'];
      const shapes: THREE.Mesh[] = [];
      for (let i = 0; i < 14; i++) {
        const geo = i % 3 === 0 ? new THREE.OctahedronGeometry(0.09, 0) : i % 3 === 1 ? new THREE.TorusGeometry(0.08, 0.03, 6, 14) : new THREE.IcosahedronGeometry(0.08, 0);
        const m = c.add(geo, c.kit.plastic(cols[i % cols.length]!, 0.3), (c.rng() - 0.5) * 5, 0.8 + c.rng() * 3, -1.5 - c.rng() * 2.5);
        shapes.push(m);
      }
      c.updaters.push((t) => shapes.forEach((m, i) => {
        m.rotation.x = t * 0.5 + i;
        m.rotation.y = t * 0.7 + i;
        m.position.y += Math.sin(t * 1.3 + i) * 0.002;
      }));
    },
  },

  // --- Phase 2 ---
  desert: {
    skyTop: '#ffb870',
    skyBottom: '#ffe8c2',
    ground: '#f2c58a',
    light: { key: '#ffe0b8', keyIntensity: 2.5 },
    fog: { color: '#ffe8c2', near: 8, far: 20 },
    build(c) {
      ground(c, '#f2c58a');
      const cactus = (x: number, z: number, s: number) => {
        const m = c.kit.prop('#5fae6b');
        c.add(new THREE.CapsuleGeometry(0.16 * s, 0.9 * s, 4, 8), m, x, 0.6 * s, z);
        c.add(new THREE.CapsuleGeometry(0.1 * s, 0.3 * s, 4, 8), m, x + 0.25 * s, 0.75 * s, z);
        c.add(new THREE.CapsuleGeometry(0.1 * s, 0.25 * s, 4, 8), m, x - 0.25 * s, 0.6 * s, z);
      };
      cactus(-1.9, -2.0, 1.2);
      cactus(2.3, -3.1, 1.5);
      for (const [x, z, s] of [
        [-4, -8, 3],
        [3, -9, 4],
      ] as const)
        c.add(new THREE.SphereGeometry(s, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), c.kit.prop('#eab478', false), x, -0.2, z);
      c.add(new THREE.SphereGeometry(0.8, 20, 14), c.kit.basic('#fff1b0', { fog: false }), 1.8, 4.6, -10);
    },
  },
  garden: {
    skyTop: '#b6e6ff',
    skyBottom: '#f6fff0',
    ground: '#8fd17f',
    fog: { color: '#f6fff0', near: 7, far: 18 },
    build(c) {
      ground(c, '#8fd17f');
      for (let i = 0; i < 14; i++) {
        const x = (c.rng() - 0.5) * 5,
          z = -0.6 - c.rng() * 3;
        if (Math.abs(x) < 0.9 && z > -1.2) continue;
        c.add(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 5), c.kit.prop('#3f8f4a'), x, 0.2, z);
        c.add(new THREE.IcosahedronGeometry(0.09, 0), c.kit.prop(['#ff7fae', '#ffd84d', '#ffffff', '#b28cff'][i % 4]!), x, 0.42, z);
      }
      // Fence.
      for (let i = -6; i <= 6; i++) c.add(new THREE.BoxGeometry(0.12, 0.7, 0.06), c.kit.prop('#ffffff'), i * 0.5, 0.35, -3.6);
      c.add(new THREE.BoxGeometry(6.6, 0.08, 0.05), c.kit.prop('#ffffff'), 0, 0.5, -3.58);
      particles(c, 20, '#ffe9a8', 0.05, [5, 2, 3], 0.05, 0.4);
    },
  },
  arcade: {
    skyTop: '#2a0f4f',
    skyBottom: '#5a1f8f',
    ground: '#2b2440',
    light: { hemiSky: '#c18bff', hemiGround: '#2b1d4a', key: '#ffd6ff', keyIntensity: 1.8, rim: '#47e5ff', ambient: 0.9 },
    build(c) {
      ground(c, '#2b2440');
      for (let i = -4; i <= 4; i++) {
        const l = c.add(new THREE.PlaneGeometry(0.04, 14), c.kit.basic('#ff4fd8'), i * 0.9, 0.012, -5);
        l.rotation.x = -Math.PI / 2;
      }
      const cab = (x: number, z: number, col: string) => {
        c.add(new THREE.BoxGeometry(0.8, 1.7, 0.7), c.kit.prop('#3a2d63', false), x, 0.85, z);
        c.add(new THREE.PlaneGeometry(0.6, 0.45), c.kit.glow(col, 1.2), x, 1.25, z + 0.36);
        c.add(new THREE.BoxGeometry(0.8, 0.22, 0.72), c.kit.glow(col, 0.8), x, 1.8, z);
      };
      cab(-2.0, -2.4, '#47e5ff');
      cab(2.1, -2.8, '#ff4fd8');
      cab(-3.0, -3.6, '#ffe14f');
      pedestal(c, '#3a2d63', '#47e5ff');
    },
  },
  autumn: {
    skyTop: '#ffcf9a',
    skyBottom: '#fff3df',
    ground: '#e6a35c',
    light: { key: '#ffe2c2' },
    fog: { color: '#fff3df', near: 7, far: 18 },
    build(c) {
      ground(c, '#e6a35c');
      tree(c, -1.9, -2.1, 1.5, '#e86a3a');
      tree(c, 2.3, -2.9, 1.8, '#f2a33a');
      tree(c, -3.3, -4.6, 2.1, '#d9502f');
      c.add(new THREE.SphereGeometry(0.25, 14, 10), c.kit.prop('#ff8a2a'), 1.3, 0.2, -0.9);
      particles(c, 40, '#ff9a4a', 0.09, [6, 4, 4], -0.25, 0.5);
    },
  },
  crystal: {
    skyTop: '#2b1f55',
    skyBottom: '#6a4fb0',
    ground: '#4a3a7a',
    light: { hemiSky: '#c9b6ff', hemiGround: '#3a2a6b', key: '#e9e0ff', rim: '#7fffe6', ambient: 0.9 },
    build(c) {
      ground(c, '#4a3a7a');
      for (const [x, z, h, col] of [
        [-1.8, -1.8, 1.2, '#7fe8ff'],
        [-2.1, -2.3, 1.8, '#c79bff'],
        [2.0, -2.0, 1.5, '#ff9be0'],
        [2.4, -2.8, 2.2, '#7fe8ff'],
        [1.2, -1.1, 0.5, '#c79bff'],
      ] as const) {
        const m = c.add(new THREE.OctahedronGeometry(h * 0.35, 0), c.kit.glow(col, 0.5), x, h * 0.3, z);
        m.scale.set(0.6, 1.6, 0.6);
      }
      particles(c, 40, '#e9e0ff', 0.06, [6, 4, 4], 0.12, 0.2);
      pedestal(c, '#5a4a8f', '#7fe8ff');
    },
  },
  sunset: {
    skyTop: '#5b4bb5',
    skyBottom: '#ff9e80',
    ground: '#8fbf6f',
    light: { key: '#ffc6a0', keyIntensity: 2.2, rim: '#ff9e80', hemiSky: '#ffc9d6' },
    fog: { color: '#ff9e80', near: 7, far: 20 },
    build(c) {
      c.add(new THREE.SphereGeometry(8, 40, 20), c.kit.prop('#8fbf6f', false), 0, -7.9, 0);
      c.add(new THREE.SphereGeometry(1.2, 24, 16), c.kit.basic('#ffd27a', { fog: false }), 0.5, 1.4, -12);
      tree(c, -2.0, -2.6, 1.3, '#4f8f5a');
      stars(c, 40);
    },
  },
};

export function buildBackdrop(id: string): Backdrop {
  const def = SCENES[id] ?? SCENES.studio!;
  const kit = new MaterialKit();
  const g = new THREE.Group();
  g.name = `scene:${id}`;
  const geos: THREE.BufferGeometry[] = [];
  const updaters: ((t: number, dt: number) => void)[] = [];
  const ctx: SceneCtx = {
    g,
    kit,
    geos,
    rng: rngFromString(`scene:${id}`),
    updaters,
    add(geo, mat, x = 0, y = 0, z = 0) {
      geos.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    },
  };
  def.build(ctx);
  return {
    group: g,
    skyTop: def.skyTop,
    skyBottom: def.skyBottom,
    light: def.light,
    fog: def.fog,
    update: (t, dt) => updaters.forEach((u) => u(t, dt)),
    dispose() {
      geos.forEach((x) => x.dispose());
      kit.dispose();
    },
  };
}
