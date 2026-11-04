import * as THREE from 'three';
import type { BuildCtx } from '../buildCtx';
import { blobGeometry, capsule, latheProfile, ring, type BlobOptions, type BlobParams } from '../geometry';

type Builder = (c: BuildCtx) => void;

function bodyShell(c: BuildCtx, scale: number, o: BlobOptions, extra: Partial<BlobParams> = {}): THREE.BufferGeometry {
  const p = c.body.params;
  return blobGeometry({ ...p, ...extra, rx: p.rx * scale, ry: p.ry * scale, rz: p.rz * scale }, { widthSegments: 56, heightSegments: 40, ...o });
}

function shell(c: BuildCtx, mat: THREE.Material, t0: number, t1: number, scale = 1.035, extra: Partial<BlobParams> = {}, phi?: [number, number]): THREE.Mesh {
  const o: BlobOptions = { thetaStart: Math.PI * t0, thetaLength: Math.PI * (t1 - t0) };
  if (phi) {
    o.phiStart = phi[0];
    o.phiLength = phi[1];
  }
  const m = c.mesh(bodyShell(c, scale, o, extra), mat, c.body.group);
  m.position.y = c.body.cy;
  return m;
}

/** Front patch centred on +z, angular width w (radians). */
function frontPatch(c: BuildCtx, mat: THREE.Material, t0: number, t1: number, w: number, scale = 1.045): THREE.Mesh {
  return shell(c, mat, t0, t1, scale, {}, [Math.PI / 2 - w / 2, w]);
}

/** Hem ring at a body latitude (theta fraction 0 top .. 1 bottom). */
function hem(c: BuildCtx, mat: THREE.Material, tFrac: number, tube = 0.03, scale = 1.04): THREE.Mesh {
  const p = c.body.params;
  const theta = Math.PI * tFrac;
  const y = Math.cos(theta);
  const sy = Math.sin(theta);
  // Approximate radius at that latitude using the blob deformation on the x axis.
  const d = new THREE.Vector3(sy, y, 0);
  const pt = c.body.anchor(90, 90 - tFrac * 180).pos;
  void d;
  const r = Math.abs(pt.x) * scale;
  const m = c.mesh(ring(r, tube, p.rz / p.rx), mat, c.body.group);
  m.position.y = pt.y;
  return m;
}

function sleeves(c: BuildCtx, mat: THREE.Material, frac = 0.65): void {
  for (const arm of c.body.arms) {
    const g = arm.geometry as THREE.CapsuleGeometry;
    const r = (g.parameters?.radius ?? 0.1) * 1.18;
    const len = (g.parameters?.height ?? 0.2) * frac;
    const s = c.mesh(capsule(r, len, 14), mat, arm.parent!);
    s.position.y = -len / 2 - 0.0;
  }
}

function pants(c: BuildCtx, mat: THREE.Material): void {
  for (const l of c.body.legs) l.material = mat;
}

function button(c: BuildCtx, mat: THREE.Material, az: number, el: number, r = 0.035): void {
  const a = c.body.anchor(az, el);
  const b = c.mesh(new THREE.CylinderGeometry(r, r, 0.02, 14), mat, c.body.group);
  b.position.copy(a.pos).addScaledVector(a.normal, 0.025);
  b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.normal);
}

function canvasTex(c: BuildCtx, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return c.kit.ownTexture(t);
}

function stripes(c: BuildCtx, a: string, b: string, n: number): THREE.Material {
  const t = canvasTex(c, 8, 256, (ctx) => {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.fillRect(0, (i * 256) / n, 8, 256 / n + 1);
    }
  });
  return c.kit.own(new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') }));
}

function dots(c: BuildCtx, bg: string, fg: string): THREE.Material {
  const t = canvasTex(c, 256, 128, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = fg;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 16; x++) {
        ctx.beginPath();
        ctx.arc(x * 16 + (y % 2) * 8 + 4, y * 16 + 8, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
  });
  return c.kit.own(new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') }));
}

/** A-line skirt/coat flaring from a latitude to the hem. */
function flare(c: BuildCtx, mat: THREE.Material, yTop: number, yBottom: number, rTop: number, rBottom: number, wobble = 0): THREE.Mesh {
  const h = yTop - yBottom;
  const g = latheProfile(h, (t) => rBottom + (rTop - rBottom) * Math.pow(t, 0.8), 12, 48);
  if (wobble > 0) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + wobble * Math.sin(a * 12) * (1 - pos.getY(i) / h);
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
    g.computeVertexNormals();
  }
  const m = c.mesh(g, mat, c.body.group);
  (mat as THREE.MeshPhysicalMaterial).side = THREE.DoubleSide;
  m.position.y = yBottom;
  m.scale.z = c.body.params.rz / c.body.params.rx;
  return m;
}

function bodyY(c: BuildCtx, tFrac: number): number {
  return c.body.anchor(90, 90 - tFrac * 180).pos.y;
}
function bodyR(c: BuildCtx, tFrac: number): number {
  return Math.abs(c.body.anchor(90, 90 - tFrac * 180).pos.x);
}

function helmet(c: BuildCtx, glassTint: string, ringColor: string): void {
  const hp = c.head.params;
  const R = Math.max(hp.rx, hp.ry, hp.rz) * 1.22;
  const g = c.mesh(new THREE.SphereGeometry(R, 48, 32), c.kit.glass(glassTint), c.head.group);
  g.position.y = 0.06;
  g.renderOrder = 5;
  g.name = 'helmet';
  const collar = c.mesh(ring(R * 0.62, 0.07), c.kit.plastic(ringColor, 0.3), c.head.group);
  collar.position.y = -R * 0.72 + 0.06;
}

/** Sphere with a circular window cut out at the front (+z), half-angle in radians. */
function sphereWithWindow(R: number, half: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(R, 48, 32).toNonIndexed();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const keep: number[] = [];
  const nrm: number[] = [];
  const cosH = Math.cos(half);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) v.add(new THREE.Vector3().fromBufferAttribute(pos, i + k));
    if (v.normalize().z > cosH) continue;
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i + k);
      keep.push(p.x, p.y, p.z);
      p.normalize();
      nrm.push(p.x, p.y, p.z);
    }
  }
  g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return out;
}

export const OUTFITS: Record<string, Builder> = {
  none: () => {},

  overalls: (c) => {
    const pal = c.spec.palette;
    const denim = c.kit.fabric(pal.outfit);
    shell(c, denim, 0.5, 1.0);
    frontPatch(c, denim, 0.28, 0.52, 1.0);
    hem(c, c.kit.fabric(pal.outfitAlt), 0.5, 0.022, 1.045);
    pants(c, denim);
    // Straps over the shoulders.
    for (const s of [-1, 1]) {
      const f = c.body.anchor(s * 26, 38).pos;
      const top = c.body.anchor(s * 40, 75).pos.multiplyScalar(1.06);
      const back = c.body.anchor(s * 150, 30).pos;
      const curve = new THREE.CatmullRomCurve3([f.clone().multiplyScalar(1.04), top, back.clone().multiplyScalar(1.04)]);
      curve.points.forEach((p) => (p.y += 0));
      c.mesh(new THREE.TubeGeometry(curve, 24, 0.028, 8), denim, c.body.group).scale.set(1, 1, 1);
      button(c, c.kit.metal('#f2c14e'), s * 26, 38, 0.03);
    }
    // Pocket.
    const pocket = frontPatch(c, c.kit.fabric(pal.outfitAlt), 0.34, 0.46, 0.42, 1.055);
    pocket.name = 'pocket';
  },

  hoodie: (c) => {
    const pal = c.spec.palette;
    const m = c.kit.fabric(pal.outfit);
    shell(c, m, 0.1, 0.82);
    hem(c, c.kit.fabric(pal.outfitAlt), 0.82, 0.04);
    sleeves(c, m, 0.8);
    frontPatch(c, c.kit.fabric(pal.outfitAlt), 0.5, 0.72, 0.9, 1.05).name = 'pocket';
    // Bunched hood behind the neck.
    const hood = c.mesh(ring(bodyR(c, 0.12) * 0.95, 0.09, c.body.params.rz / c.body.params.rx), m, c.body.group);
    hood.position.y = bodyY(c, 0.12);
    for (const s of [-1, 1]) {
      const a = c.body.anchor(s * 12, 55).pos.multiplyScalar(1.06);
      const cord = c.mesh(capsule(0.012, 0.14, 6), c.kit.fabric('#ffffff'), c.body.group);
      cord.position.copy(a).add(new THREE.Vector3(0, -0.08, 0.01));
    }
  },

  raincoat: (c) => {
    const pal = c.spec.palette;
    const m = c.kit.plastic(pal.outfit, 0.25);
    shell(c, m, 0.1, 0.55);
    flare(c, m, bodyY(c, 0.55), bodyY(c, 0.95) - 0.02, bodyR(c, 0.55) * 1.04, bodyR(c, 0.9) * 1.18);
    sleeves(c, m, 0.85);
    const collar = c.mesh(ring(bodyR(c, 0.12) * 1.02, 0.05, c.body.params.rz / c.body.params.rx), m, c.body.group);
    collar.position.y = bodyY(c, 0.12);
    for (const el of [30, 5, -20]) button(c, c.kit.plastic(pal.outfitAlt, 0.3), 0, el, 0.04);
  },

  astronaut: (c) => {
    const pal = c.spec.palette;
    const white = c.kit.fabric('#f4f6fb');
    shell(c, white, 0.08, 1.0);
    sleeves(c, white, 0.95);
    pants(c, white);
    for (const f of c.body.feet) f.material = c.kit.plastic('#9aa3b5', 0.4);
    const panel = c.mesh(blobGeometry({ rx: 0.17, ry: 0.11, rz: 0.05, power: 3 }, { widthSegments: 20, heightSegments: 12 }), c.kit.plastic('#cfd5e2', 0.3), c.body.group);
    const a = c.body.anchor(0, 18);
    panel.position.copy(a.pos).addScaledVector(a.normal, 0.02);
    panel.lookAt(panel.position.clone().add(a.normal));
    for (let i = 0; i < 3; i++) {
      const b = c.mesh(new THREE.SphereGeometry(0.025, 10, 8), c.kit.glow([pal.accent, '#ff5d5d', '#5dff9d'][i]!, 0.8), panel);
      b.position.set(-0.08 + i * 0.08, 0, 0.045);
    }
    hem(c, c.kit.plastic(pal.outfit, 0.3), 0.62, 0.04);
    helmet(c, '#e8f6ff', '#cfd5e2');
  },

  dress: (c) => {
    const pal = c.spec.palette;
    const m = c.kit.fabric(pal.outfit);
    shell(c, m, 0.12, 0.5);
    flare(c, m, bodyY(c, 0.5), bodyY(c, 0.9) - 0.04, bodyR(c, 0.5) * 1.03, bodyR(c, 0.85) * 1.32, 0.03);
    hem(c, c.kit.fabric(pal.outfitAlt), 0.5, 0.028);
    for (const arm of c.body.arms) {
      const puff = c.mesh(new THREE.SphereGeometry(0.14, 16, 12), m, arm.parent!);
      puff.position.y = -0.04;
    }
    const bow = c.body.anchor(0, 20);
    for (const s of [-1, 1]) {
      const lobe = c.mesh(blobGeometry({ rx: 0.07, ry: 0.05, rz: 0.03 }, { widthSegments: 12, heightSegments: 8 }), c.kit.fabric(pal.outfitAlt), c.body.group);
      lobe.position.copy(bow.pos).addScaledVector(bow.normal, 0.04).add(new THREE.Vector3(s * 0.06, 0, 0));
    }
  },

  jersey: (c) => {
    const pal = c.spec.palette;
    const m = c.kit.fabric(pal.outfit);
    shell(c, m, 0.1, 0.62);
    hem(c, c.kit.fabric(pal.outfitAlt), 0.1, 0.035);
    sleeves(c, c.kit.fabric(pal.outfitAlt), 0.45);
    const num = String(1 + (c.spec.seed.charCodeAt(2) % 99));
    const t = canvasTex(c, 256, 256, (ctx) => {
      ctx.fillStyle = pal.outfitAlt;
      ctx.font = 'bold 150px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(num, 128, 136);
      ctx.fillText(num, 128, 136);
    });
    const mat = c.kit.own(new THREE.MeshPhysicalMaterial({ map: t, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
    frontPatch(c, mat, 0.26, 0.6, 1.2, 1.04).name = 'number';
    // Shorts.
    shell(c, c.kit.fabric(pal.outfitAlt), 0.62, 1.0, 1.03);
  },

  sweater: (c) => {
    const pal = c.spec.palette;
    const m = stripes(c, pal.outfit, pal.outfitAlt, 12);
    shell(c, m, 0.1, 0.8);
    hem(c, c.kit.fabric(pal.outfit), 0.8, 0.04);
    hem(c, c.kit.fabric(pal.outfit), 0.1, 0.05);
    sleeves(c, c.kit.fabric(pal.outfit), 0.8);
  },

  tutu: (c) => {
    const pal = c.spec.palette;
    const m = c.kit.fabric(pal.outfit);
    shell(c, m, 0.15, 0.62);
    const tulle = c.kit.own(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(pal.outfitAlt), roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffffff'), transparent: true, opacity: 0.92 }));
    flare(c, tulle, bodyY(c, 0.55), bodyY(c, 0.66), bodyR(c, 0.55) * 1.04, bodyR(c, 0.62) * 1.6, 0.08);
    flare(c, tulle, bodyY(c, 0.6), bodyY(c, 0.7), bodyR(c, 0.6) * 1.04, bodyR(c, 0.66) * 1.45, 0.08);
  },

  pajamas: (c) => {
    const pal = c.spec.palette;
    const m = dots(c, pal.outfit, pal.outfitAlt);
    shell(c, m, 0.1, 1.0);
    sleeves(c, c.kit.fabric(pal.outfit), 0.9);
    pants(c, c.kit.fabric(pal.outfit));
    for (const el of [40, 15, -10]) button(c, c.kit.plastic('#ffffff', 0.3), 0, el, 0.03);
  },

  cape: (c) => {
    const pal = c.spec.palette;
    const m = c.kit.fabric(pal.outfit);
    (m as THREE.MeshPhysicalMaterial).side = THREE.DoubleSide;
    const top = bodyY(c, 0.1);
    const h = top - 0.08;
    const rT = bodyR(c, 0.12) * 1.05;
    const g = new THREE.CylinderGeometry(rT, rT * 1.9, h, 36, 8, true, Math.PI * 0.6, Math.PI * 0.8);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = 0.5 - y / h;
      pos.setZ(i, pos.getZ(i) - t * t * 0.1);
    }
    g.computeVertexNormals();
    const cape = c.mesh(g, m, c.body.group);
    cape.position.y = top - h / 2;
    cape.rotation.y = Math.PI;
    cape.scale.z = 0.85;
    hem(c, c.kit.fabric(pal.outfitAlt), 0.1, 0.045);
    const clasp = c.mesh(new THREE.SphereGeometry(0.05, 12, 8), c.kit.metal('#f2c14e'), c.body.group);
    clasp.position.copy(c.body.anchor(0, 78).pos).multiplyScalar(1.06);
  },

  sailor: (c) => {
    const pal = c.spec.palette;
    shell(c, c.kit.fabric('#fbfbf8'), 0.1, 0.62);
    shell(c, c.kit.fabric(pal.outfit), 0.62, 1.0, 1.03);
    hem(c, c.kit.fabric(pal.outfit), 0.62, 0.025, 1.045);
    // Collar flap on the back and front "V".
    shell(c, c.kit.fabric(pal.outfit), 0.08, 0.36, 1.05, {}, [Math.PI * 1.5 - 0.9, 1.8]);
    const knot = c.body.anchor(0, 48);
    const k = c.mesh(blobGeometry({ rx: 0.06, ry: 0.045, rz: 0.04 }, { widthSegments: 12, heightSegments: 8 }), c.kit.fabric('#e8424d'), c.body.group);
    k.position.copy(knot.pos).addScaledVector(knot.normal, 0.04);
    for (const s of [-1, 1]) {
      const tail = c.mesh(capsule(0.03, 0.1, 6), c.kit.fabric('#e8424d'), c.body.group);
      tail.position.copy(k.position).add(new THREE.Vector3(s * 0.04, -0.08, 0));
      tail.rotation.z = s * 0.3;
    }
    sleeves(c, c.kit.fabric('#fbfbf8'), 0.45);
  },

  apron: (c) => {
    const pal = c.spec.palette;
    const m = c.kit.fabric(pal.outfit);
    frontPatch(c, m, 0.25, 0.95, 1.5, 1.04);
    frontPatch(c, c.kit.fabric(pal.outfitAlt), 0.6, 0.75, 0.7, 1.052).name = 'pocket';
    const top = c.body.anchor(0, 62).pos;
    const neck: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      neck.push(new THREE.Vector3(Math.sin(a) * bodyR(c, 0.08) * 1.02, bodyY(c, 0.08) + 0.0 - Math.cos(a) * 0.08 * (1 + Math.cos(a)), Math.cos(a) * bodyR(c, 0.08) * 0.95));
    }
    void top;
    c.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(neck, true), 40, 0.02, 6, true), m, c.body.group);
    hem(c, m, 0.55, 0.02, 1.045);
  },

  swimring: (c) => {
    const pal = c.spec.palette;
    const t = canvasTex(c, 512, 16, (ctx) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#ffffff' : pal.outfit;
        ctx.fillRect(i * 64, 0, 64, 16);
      }
    });
    const mat = c.kit.own(new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }));
    const r = bodyR(c, 0.62);
    const tor = c.mesh(new THREE.TorusGeometry(r * 1.08, 0.13, 20, 56), mat, c.body.group);
    tor.rotation.x = Math.PI / 2;
    tor.position.y = bodyY(c, 0.62);
    tor.scale.set(1, c.body.params.rz / c.body.params.rx + 0.1, 1);
  },

  // --- Phase 2 ---
  tuxedo: (c) => {
    shell(c, c.kit.fabric('#24232b'), 0.1, 0.92);
    frontPatch(c, c.kit.fabric('#fbfbf8'), 0.1, 0.62, 0.55, 1.045);
    sleeves(c, c.kit.fabric('#24232b'), 0.85);
    const a = c.body.anchor(0, 62);
    for (const s of [-1, 1]) {
      const lobe = c.mesh(blobGeometry({ rx: 0.07, ry: 0.045, rz: 0.03 }, { widthSegments: 12, heightSegments: 8 }), c.kit.fabric('#e23b5a'), c.body.group);
      lobe.position.copy(a.pos).addScaledVector(a.normal, 0.05).add(new THREE.Vector3(s * 0.06, 0, 0));
    }
    for (const el of [30, 5]) button(c, c.kit.plastic('#24232b', 0.2), 0, el, 0.022);
  },

  piratecoat: (c) => {
    const pal = c.spec.palette;
    const m = c.kit.fabric(pal.outfit);
    shell(c, m, 0.1, 0.55);
    flare(c, m, bodyY(c, 0.55), bodyY(c, 0.95), bodyR(c, 0.55) * 1.04, bodyR(c, 0.9) * 1.2);
    sleeves(c, m, 0.85);
    hem(c, c.kit.fabric('#3a2a1e'), 0.55, 0.04, 1.05);
    for (const el of [35, 15]) for (const s of [-1, 1]) button(c, c.kit.metal('#f2c14e'), s * 18, el, 0.028);
  },

  diver: (c) => {
    const m = c.kit.fabric('#f2b630');
    shell(c, m, 0.08, 1.0);
    sleeves(c, m, 0.95);
    pants(c, m);
    const hp = c.head.params;
    const R = Math.max(hp.rx, hp.ry, hp.rz) * 1.2;
    const brass = c.kit.metal('#d2a24c');
    const dome = c.mesh(sphereWithWindow(R, 0.72), brass, c.head.group);
    dome.position.y = 0.06;
    const rim = c.mesh(new THREE.TorusGeometry(R * Math.sin(0.72), 0.05, 10, 40), brass, c.head.group);
    rim.position.set(0, 0.06, R * Math.cos(0.72));
    const collar = c.mesh(ring(R * 0.62, 0.08), brass, c.head.group);
    collar.position.y = -R * 0.72 + 0.06;
    for (const s of [-1, 1]) {
      const bolt = c.mesh(new THREE.SphereGeometry(0.04, 10, 8), brass, c.head.group);
      bolt.position.set(s * R * 0.72, 0.06, R * 0.7);
    }
  },

  puffer: (c) => {
    const pal = c.spec.palette;
    const m = c.kit.plastic(pal.outfit, 0.45);
    shell(c, m, 0.1, 0.86, 1.03);
    for (const f of [0.25, 0.42, 0.59, 0.76]) hem(c, m, f, 0.06, 1.03);
    sleeves(c, m, 0.85);
    const collar = c.mesh(ring(bodyR(c, 0.1) * 1.0, 0.07, c.body.params.rz / c.body.params.rx), c.kit.plastic(pal.outfitAlt, 0.45), c.body.group);
    collar.position.y = bodyY(c, 0.1);
  },

  labcoat: (c) => {
    const m = c.kit.fabric('#fbfcff');
    shell(c, m, 0.1, 0.55);
    flare(c, m, bodyY(c, 0.55), bodyY(c, 0.98), bodyR(c, 0.55) * 1.04, bodyR(c, 0.92) * 1.1);
    sleeves(c, m, 0.9);
    const p = frontPatch(c, c.kit.fabric('#e9edf6'), 0.3, 0.42, 0.3, 1.05);
    p.rotation.y = 0.35;
    for (let i = 0; i < 2; i++) {
      const pen = c.mesh(capsule(0.012, 0.08, 6), c.kit.plastic(['#3f7bff', '#ff4d6d'][i]!), c.body.group);
      const a = c.body.anchor(20 + i * 6, 42);
      pen.position.copy(a.pos).addScaledVector(a.normal, 0.04);
    }
  },

  wizard: (c) => {
    const pal = c.spec.palette;
    const t = canvasTex(c, 256, 256, (ctx) => {
      ctx.fillStyle = pal.outfit;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#ffe27a';
      for (let i = 0; i < 14; i++) {
        const x = (i * 71) % 256,
          y = (i * 113) % 256;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          const r = k % 2 ? 5 : 12;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.fill();
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const m = c.kit.own(new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.8, sheen: 1, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide }));
    shell(c, m, 0.1, 0.5);
    flare(c, m, bodyY(c, 0.5), 0.02, bodyR(c, 0.5) * 1.04, bodyR(c, 0.85) * 1.3);
    sleeves(c, m, 0.95);
  },

  armor: (c) => {
    const steel = c.kit.metal('#c3cad6');
    shell(c, steel, 0.12, 0.7, 1.04);
    for (const f of [0.3, 0.5]) hem(c, c.kit.metal('#9aa3b2'), f, 0.025, 1.05);
    sleeves(c, steel, 0.5);
    for (const arm of c.body.arms) {
      const pad = c.mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel, arm.parent!);
      pad.position.y = 0.0;
    }
    const emblem = c.body.anchor(0, 20);
    const e = c.mesh(new THREE.OctahedronGeometry(0.06, 0), c.kit.plastic(c.spec.palette.accent, 0.2), c.body.group);
    e.position.copy(emblem.pos).addScaledVector(emblem.normal, 0.05);
  },

  leafskirt: (c) => {
    const green = c.kit.vinyl('#58b85c', 'glossy');
    const y = bodyY(c, 0.6);
    const r = bodyR(c, 0.6);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const leaf = c.mesh(blobGeometry({ rx: 0.08, ry: 0.16, rz: 0.025, egg: -0.3 }, { widthSegments: 12, heightSegments: 10 }), green, c.body.group);
      leaf.position.set(Math.sin(a) * r * 1.05, y - 0.1, Math.cos(a) * r * (c.body.params.rz / c.body.params.rx) * 1.05);
      leaf.rotation.y = a;
      leaf.rotation.x = 0.25;
    }
  },
};
