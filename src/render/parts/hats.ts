import * as THREE from 'three';
import type { BuildCtx } from '../buildCtx';
import { blobGeometry, latheProfile, ring, type BlobOptions } from '../geometry';

type Builder = (c: BuildCtx) => void;

/** A shell that follows the head's shape (for fitted hats and hoods). */
function headShell(c: BuildCtx, scale: number, o: BlobOptions): THREE.BufferGeometry {
  const p = c.head.params;
  return blobGeometry({ ...p, rx: p.rx * scale, ry: p.ry * scale, rz: p.rz * scale }, { widthSegments: 56, heightSegments: 40, ...o });
}

/** Group placed at the top of the head, tilted slightly back. */
function topGroup(c: BuildCtx, sink = 0.08, tilt = -0.08): THREE.Group {
  const g = new THREE.Group();
  g.position.y = c.head.top - sink;
  g.rotation.x = tilt;
  c.head.group.add(g);
  return g;
}

function pompom(c: BuildCtx, parent: THREE.Object3D, y: number, r: number, color: string): void {
  const m = c.mesh(new THREE.IcosahedronGeometry(r, 3), c.kit.fabric(color), parent);
  m.position.y = y;
}

/** Stripe texture for lathe hats (v runs along the profile). */
function stripeTex(c: BuildCtx, a: string, b: string, n = 6): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 8;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? b : a;
    ctx.fillRect(0, (i * 128) / n, 8, 128 / n + 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return c.kit.ownTexture(t);
}

export const HATS: Record<string, Builder> = {
  none: () => {},

  bucket: (c) => {
    const pal = c.spec.palette;
    const mat = c.kit.fabric(pal.hat);
    const crown = c.mesh(headShell(c, 1.06, { thetaStart: 0, thetaLength: Math.PI * 0.36 }), mat, c.head.group);
    crown.rotation.x = -0.08;
    const g = topGroup(c, c.head.params.ry * 0.25, -0.08);
    const rx = c.head.params.rx * 1.02;
    const brim = c.mesh(
      latheProfile(0.16, (t) => rx * (0.95 + t * 0.32), 8, 48),
      c.kit.fabric(pal.hat),
      g,
    );
    brim.scale.set(1, -1, c.head.params.rz / c.head.params.rx);
    brim.position.y = 0.02;
    const band = c.mesh(ring(rx * 0.96, 0.035, c.head.params.rz / c.head.params.rx), c.kit.fabric(pal.hatAlt), g);
    band.position.y = 0.03;
  },

  beanie: (c) => {
    const pal = c.spec.palette;
    const mat = c.kit.fabric(pal.hat);
    const crown = c.mesh(headShell(c, 1.05, { thetaStart: 0, thetaLength: Math.PI * 0.4 }), mat, c.head.group);
    crown.rotation.x = -0.06;
    const g = topGroup(c, c.head.params.ry * 0.3, -0.06);
    const rx = c.head.params.rx * 0.98;
    const cuff = c.mesh(ring(rx, 0.07, c.head.params.rz / c.head.params.rx), c.kit.fabric(pal.hatAlt), g);
    cuff.position.y = -0.0;
    cuff.scale.y = 1.4;
    pompom(c, crown, c.head.top * 1.05 + 0.08, 0.13, pal.hatAlt);
  },

  crown: (c) => {
    const g = topGroup(c, 0.1, -0.05);
    const gold = c.kit.metal('#f3c443');
    const r = c.head.params.rx * 0.5;
    c.mesh(latheProfile(0.2, (t) => r * (1 + t * 0.1), 4, 40), gold, g).scale.z = 0.9;
    const pts = 5;
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2 + Math.PI / 2;
      const ball = c.mesh(new THREE.SphereGeometry(0.05, 14, 10), gold, g);
      ball.position.set(Math.cos(a) * r * 1.1, 0.3, Math.sin(a) * r * 1.0);
      const spike = c.mesh(new THREE.ConeGeometry(0.06, 0.14, 12), gold, g);
      spike.position.set(Math.cos(a) * r * 1.08, 0.22, Math.sin(a) * r * 0.98);
    }
    const gem = c.mesh(new THREE.OctahedronGeometry(0.06, 0), c.kit.plastic('#e8336e', 0.1), g);
    gem.position.set(0, 0.1, r * 0.98);
    gem.scale.z = 0.5;
  },

  pirate: (c) => {
    const pal = c.spec.palette;
    const g = topGroup(c, 0.12, -0.1);
    const dark = c.kit.fabric(pal.hat);
    const rx = c.head.params.rx;
    // Tricorn: a squat dome plus an upturned wide brim.
    c.mesh(blobGeometry({ rx: rx * 0.72, ry: 0.26, rz: rx * 0.66, flatBottom: 0.8 }, { widthSegments: 40, heightSegments: 24 }), dark, g).position.y = 0.06;
    const brim = c.mesh(latheProfile(0.2, (t) => rx * (0.7 + t * 0.55), 8, 3), dark, g);
    brim.rotation.y = Math.PI / 6;
    brim.scale.set(1, 1, 0.95);
    brim.position.y = -0.02;
    const trim = c.mesh(new THREE.TorusGeometry(rx * 0.72, 0.025, 8, 3), c.kit.metal('#f3c443'), g);
    trim.rotation.x = Math.PI / 2;
    trim.rotation.z = Math.PI / 6;
    trim.position.y = 0.0;
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? 0.035 : 0.08;
      if (i === 0) star.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr);
      else star.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr);
    }
    const sg = new THREE.ExtrudeGeometry(star, { depth: 0.02, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
    const st = c.mesh(sg, c.kit.metal('#f3c443'), g);
    st.position.set(0, 0.14, rx * 0.64);
  },

  hood: (c) => {
    // Hood: wraps the back and sides of the head with a face opening. Ears are hidden.
    const pal = c.spec.palette;
    const mat = c.kit.fabric(pal.hat);
    const shell = c.mesh(
      headShell(c, 1.12, { phiStart: Math.PI / 2 + 1.05, phiLength: Math.PI * 2 - 2.1, thetaStart: 0, thetaLength: Math.PI * 0.82 }),
      mat,
      c.head.group,
    );
    shell.material = mat;
    (mat as THREE.MeshPhysicalMaterial).side = THREE.DoubleSide;
    // Soft rim around the face opening.
    const rimPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const el = -45 + (i / 40) * 180;
      const az = el > 90 ? 180 - el : el;
      void az;
      const t = i / 40;
      const ang = -Math.PI * 0.35 + t * Math.PI * 1.7;
      const a = c.head.anchor(Math.sin(ang) * 61, Math.cos(ang) * 62 - 6);
      rimPts.push(a.pos.multiplyScalar(1.1));
    }
    c.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts), 60, 0.04, 10), mat, c.head.group);
    // Little round hood ears so hoods still look cute.
    for (const s of [-1, 1]) {
      const a = c.head.anchor(45 * s, 52);
      const e = c.mesh(blobGeometry({ rx: 0.13, ry: 0.13, rz: 0.07 }, { widthSegments: 18, heightSegments: 12 }), mat, c.head.group);
      e.position.copy(a.pos).multiplyScalar(1.15);
      e.lookAt(e.position.clone().multiplyScalar(2));
    }
  },

  flower: (c) => {
    const g = new THREE.Group();
    const a = c.head.anchor(-42, 46);
    g.position.copy(a.pos);
    g.lookAt(a.pos.clone().add(a.normal));
    c.head.group.add(g);
    g.scale.setScalar(1.55);
    const petal = c.kit.vinyl(c.spec.palette.hat, 'glossy');
    for (let i = 0; i < 5; i++) {
      const p = c.mesh(blobGeometry({ rx: 0.085, ry: 0.13, rz: 0.035, egg: 0.2 }, { widthSegments: 16, heightSegments: 12 }), petal, g);
      const ang = (i / 5) * Math.PI * 2;
      p.position.set(Math.sin(ang) * 0.11, Math.cos(ang) * 0.11, 0.02);
      p.rotation.z = -ang;
    }
    c.mesh(new THREE.SphereGeometry(0.075, 18, 12), c.kit.vinyl(c.spec.palette.hatAlt, 'glossy'), g).position.z = 0.05;
  },

  cap: (c) => {
    const pal = c.spec.palette;
    const crown = c.mesh(headShell(c, 1.05, { thetaStart: 0, thetaLength: Math.PI * 0.34 }), c.kit.fabric(pal.hat), c.head.group);
    crown.rotation.x = -0.1;
    const a = c.head.anchor(0, 38);
    const visor = c.mesh(blobGeometry({ rx: c.head.params.rx * 0.62, ry: 0.035, rz: 0.3, egg: 0 }, { widthSegments: 36, heightSegments: 10, thetaStart: 0, thetaLength: Math.PI }), c.kit.fabric(pal.hatAlt), c.head.group);
    visor.position.copy(a.pos).add(new THREE.Vector3(0, 0.0, 0.12));
    visor.rotation.x = 0.12;
    const btn = c.mesh(new THREE.SphereGeometry(0.045, 12, 8), c.kit.fabric(pal.hatAlt), crown);
    btn.position.y = c.head.top * 1.05;
  },

  tophat: (c) => {
    const pal = c.spec.palette;
    const g = topGroup(c, 0.08, -0.1);
    const r = c.head.params.rx * 0.46;
    const mat = c.kit.fabric(pal.hat);
    c.mesh(latheProfile(0.5, (t) => r * (0.96 + 0.08 * t), 6, 40), mat, g);
    const lid = c.mesh(new THREE.CircleGeometry(r * 1.04, 40), mat, g);
    lid.rotation.x = -Math.PI / 2;
    lid.position.y = 0.5;
    const brim = c.mesh(blobGeometry({ rx: r * 1.75, ry: 0.035, rz: r * 1.6 }, { widthSegments: 40, heightSegments: 10 }), mat, g);
    brim.position.y = 0.02;
    const band = c.mesh(latheProfile(0.09, () => r * 0.99 + 0.012, 2, 40), c.kit.fabric(pal.hatAlt), g);
    band.position.y = 0.05;
  },

  party: (c) => {
    const pal = c.spec.palette;
    const g = topGroup(c, 0.06, -0.05);
    g.rotation.z = 0.18;
    g.scale.setScalar(1.3);
    const tex = stripeTex(c, pal.hat, pal.hatAlt, 7);
    const m = c.kit.own(new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.45, clearcoat: 0.6 }));
    c.mesh(latheProfile(0.48, (t) => 0.22 * (1 - t) + 0.01, 12, 36), m, g);
    pompom(c, g, 0.5, 0.075, pal.hatAlt);
  },

  chef: (c) => {
    const g = topGroup(c, 0.1, -0.06);
    const white = c.kit.fabric('#fbfbf7');
    const r = c.head.params.rx * 0.52;
    c.mesh(latheProfile(0.2, () => r, 2, 40), white, g);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const puff = c.mesh(new THREE.SphereGeometry(0.2, 20, 14), white, g);
      puff.position.set(Math.cos(a) * r * 0.55, 0.34, Math.sin(a) * r * 0.5);
    }
    c.mesh(new THREE.SphereGeometry(0.22, 20, 14), white, g).position.y = 0.42;
  },

  beret: (c) => {
    const pal = c.spec.palette;
    const g = topGroup(c, 0.12, -0.15);
    g.rotation.z = -0.25;
    const rx = c.head.params.rx * 0.86;
    c.mesh(blobGeometry({ rx, ry: 0.13, rz: rx * 0.95, flatBottom: 0.7 }, { widthSegments: 40, heightSegments: 20 }), c.kit.fabric(pal.hat), g).position.y = 0.06;
    c.mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.08, 10), c.kit.fabric(pal.hat), g).position.y = 0.21;
  },

  propeller: (c) => {
    const pal = c.spec.palette;
    const crown = c.mesh(headShell(c, 1.05, { thetaStart: 0, thetaLength: Math.PI * 0.3 }), c.kit.fabric(pal.hat), c.head.group);
    crown.rotation.x = -0.05;
    const g = topGroup(c, 0.02, -0.05);
    c.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), c.kit.metal('#cfd6e3'), g).position.y = 0.06;
    const prop = new THREE.Group();
    prop.position.y = 0.13;
    prop.name = 'spinner';
    g.add(prop);
    for (const s of [-1, 1]) {
      const blade = c.mesh(blobGeometry({ rx: 0.17, ry: 0.015, rz: 0.055 }, { widthSegments: 16, heightSegments: 8 }), c.kit.plastic(s > 0 ? pal.hatAlt : pal.accent, 0.3), prop);
      blade.position.x = s * 0.16;
      blade.rotation.x = s * 0.3;
    }
    c.mesh(new THREE.SphereGeometry(0.035, 12, 8), c.kit.plastic(pal.hatAlt), prop);
  },

  bow: (c) => {
    const pal = c.spec.palette;
    const g = new THREE.Group();
    const a = c.head.anchor(35, 55);
    g.position.copy(a.pos);
    g.lookAt(a.pos.clone().add(a.normal));
    g.rotateZ(0.3);
    g.scale.setScalar(1.5);
    c.head.group.add(g);
    const m = c.kit.vinyl(pal.hat, 'glossy');
    for (const s of [-1, 1]) {
      const lobe = c.mesh(blobGeometry({ rx: 0.14, ry: 0.1, rz: 0.06, egg: 0 }, { widthSegments: 18, heightSegments: 12 }), m, g);
      lobe.position.x = s * 0.12;
      lobe.rotation.z = s * -0.25;
    }
    c.mesh(new THREE.SphereGeometry(0.06, 14, 10), m, g).position.z = 0.03;
  },

  // --- Phase 2 ---
  witch: (c) => {
    const pal = c.spec.palette;
    const g = topGroup(c, 0.1, -0.12);
    const mat = c.kit.fabric(pal.hat);
    const rx = c.head.params.rx;
    c.mesh(blobGeometry({ rx: rx * 1.25, ry: 0.035, rz: rx * 1.2 }, { widthSegments: 40, heightSegments: 10 }), mat, g);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(new THREE.Vector3(Math.sin(t * 2.4) * 0.12 * t * t, t * 0.7, -0.12 * t * t));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 30, 1, 20);
    const pos = tube.getAttribute('position') as THREE.BufferAttribute;
    const cc = new THREE.Vector3(),
      v = new THREE.Vector3();
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      curve.getPointAt(t, cc);
      const r = 0.34 * (1 - t) + 0.01;
      for (let j = 0; j <= 20; j++) {
        const idx = i * 21 + j;
        v.fromBufferAttribute(pos, idx).sub(cc).multiplyScalar(r).add(cc);
        pos.setXYZ(idx, v.x, v.y, v.z);
      }
    }
    tube.computeVertexNormals();
    c.mesh(tube, mat, g);
    c.mesh(ring(0.33, 0.035), c.kit.fabric(pal.hatAlt), g).position.y = 0.05;
  },

  cowboy: (c) => {
    const pal = c.spec.palette;
    const g = topGroup(c, 0.1, -0.1);
    const mat = c.kit.fabric(pal.hat);
    const rx = c.head.params.rx;
    const brim = c.mesh(latheProfile(0.14, (t) => rx * (0.5 + t * 0.85), 8, 48), mat, g);
    brim.scale.set(1, -1, 0.9);
    brim.position.y = 0.12;
    const b2 = c.mesh(latheProfile(0.08, (t) => rx * (1.35 - t * 0.0), 3, 48), mat, g);
    b2.position.y = 0.0;
    b2.scale.set(1, 1, 0.9);
    c.mesh(blobGeometry({ rx: rx * 0.55, ry: 0.28, rz: rx * 0.5, power: 2.5, flatBottom: 0.8 }, { widthSegments: 32, heightSegments: 20 }), mat, g).position.y = 0.12;
    c.mesh(ring(rx * 0.55, 0.03, 0.9), c.kit.fabric(pal.hatAlt), g).position.y = 0.06;
  },

  viking: (c) => {
    const crown = c.mesh(headShell(c, 1.06, { thetaStart: 0, thetaLength: Math.PI * 0.38 }), c.kit.metal('#b8c0cc'), c.head.group);
    void crown;
    const g = topGroup(c, c.head.params.ry * 0.3, 0);
    c.mesh(ring(c.head.params.rx * 0.96, 0.045, c.head.params.rz / c.head.params.rx), c.kit.metal('#d9a441'), g);
    for (const s of [-1, 1]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(s * c.head.params.rx * 0.85, 0.12, 0),
        new THREE.Vector3(s * (c.head.params.rx + 0.25), 0.2, 0),
        new THREE.Vector3(s * (c.head.params.rx + 0.22), 0.5, -0.02),
      );
      const tube = new THREE.TubeGeometry(curve, 20, 1, 12);
      const pos = tube.getAttribute('position') as THREE.BufferAttribute;
      const cc = new THREE.Vector3(),
        v = new THREE.Vector3();
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        curve.getPointAt(t, cc);
        const r = 0.075 * (1 - t) + 0.01;
        for (let j = 0; j <= 12; j++) {
          const idx = i * 13 + j;
          v.fromBufferAttribute(pos, idx).sub(cc).multiplyScalar(r).add(cc);
          pos.setXYZ(idx, v.x, v.y, v.z);
        }
      }
      tube.computeVertexNormals();
      c.mesh(tube, c.kit.plastic('#fff3d6', 0.35), g);
    }
  },

  santa: (c) => {
    const crown = c.mesh(headShell(c, 1.05, { thetaStart: 0, thetaLength: Math.PI * 0.36 }), c.kit.fabric('#e23b3b'), c.head.group);
    void crown;
    const g = topGroup(c, c.head.params.ry * 0.25, -0.1);
    c.mesh(ring(c.head.params.rx * 0.98, 0.08, c.head.params.rz / c.head.params.rx), c.kit.fabric('#ffffff'), g);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0.05, 0.42, -0.05), new THREE.Vector3(0.32, 0.3, -0.2));
    const tube = new THREE.TubeGeometry(curve, 20, 1, 14);
    const pos = tube.getAttribute('position') as THREE.BufferAttribute;
    const cc = new THREE.Vector3(),
      v = new THREE.Vector3();
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      curve.getPointAt(t, cc);
      const r = 0.28 * (1 - t) + 0.02;
      for (let j = 0; j <= 14; j++) {
        const idx = i * 15 + j;
        v.fromBufferAttribute(pos, idx).sub(cc).multiplyScalar(r).add(cc);
        pos.setXYZ(idx, v.x, v.y, v.z);
      }
    }
    tube.computeVertexNormals();
    c.mesh(tube, c.kit.fabric('#e23b3b'), g);
    pompom(c, g, 0, 0.09, '#ffffff');
    g.children[g.children.length - 1]!.position.set(0.33, 0.28, -0.2);
  },

  tiara: (c) => {
    const g = topGroup(c, 0.14, -0.35);
    const silver = c.kit.metal('#e8ecf5');
    const arc = new THREE.TorusGeometry(c.head.params.rx * 0.7, 0.02, 8, 40, Math.PI);
    const m = c.mesh(arc, silver, g);
    m.rotation.x = 0;
    m.rotation.z = 0;
    m.position.y = -0.12;
    for (let i = -2; i <= 2; i++) {
      const gem = c.mesh(new THREE.OctahedronGeometry(i === 0 ? 0.07 : 0.04, 0), c.kit.plastic(i === 0 ? '#7fd4ff' : '#ffb3e6', 0.05), g);
      const a = Math.PI / 2 + i * 0.32;
      gem.position.set(Math.cos(a) * c.head.params.rx * 0.7, Math.sin(a) * c.head.params.rx * 0.7 - 0.08, 0);
    }
  },

  straw: (c) => {
    const pal = c.spec.palette;
    const g = topGroup(c, 0.12, -0.08);
    const mat = c.kit.fabric('#f1d58a');
    const rx = c.head.params.rx;
    c.mesh(blobGeometry({ rx: rx * 1.45, ry: 0.03, rz: rx * 1.4 }, { widthSegments: 44, heightSegments: 10 }), mat, g);
    c.mesh(blobGeometry({ rx: rx * 0.62, ry: 0.22, rz: rx * 0.58, flatBottom: 0.9 }, { widthSegments: 32, heightSegments: 18 }), mat, g).position.y = 0.02;
    c.mesh(ring(rx * 0.62, 0.035, 0.94), c.kit.fabric(pal.hatAlt), g).position.y = 0.05;
  },

  earmuffs: (c) => {
    const pal = c.spec.palette;
    const r = c.head.params.rx;
    const band = c.mesh(new THREE.TorusGeometry(r * 1.02, 0.03, 8, 40, Math.PI), c.kit.plastic(pal.hatAlt), c.head.group);
    band.position.y = 0.02;
    for (const s of [-1, 1]) {
      const muff = c.mesh(new THREE.IcosahedronGeometry(0.17, 3), c.kit.fabric(pal.hat), c.head.group);
      muff.position.set(s * r * 1.02, 0.0, 0);
      muff.scale.set(0.6, 1, 1);
    }
  },

  frog: (c) => {
    const crown = c.mesh(headShell(c, 1.07, { thetaStart: 0, thetaLength: Math.PI * 0.42 }), c.kit.fabric('#6fcf5f'), c.head.group);
    void crown;
    for (const s of [-1, 1]) {
      const a = c.head.anchor(28 * s, 58);
      const eye = c.mesh(new THREE.SphereGeometry(0.13, 18, 14), c.kit.fabric('#6fcf5f'), c.head.group);
      eye.position.copy(a.pos).multiplyScalar(1.07);
      const w = c.mesh(new THREE.SphereGeometry(0.085, 16, 12), c.kit.plastic('#ffffff', 0.3), c.head.group);
      w.position.copy(a.pos).multiplyScalar(1.07).add(new THREE.Vector3(0, 0.02, 0.07));
      const p = c.mesh(new THREE.SphereGeometry(0.045, 12, 8), c.kit.plastic('#1e1e28', 0.2), c.head.group);
      p.position.copy(w.position).add(new THREE.Vector3(0, 0.0, 0.055));
    }
  },
};
