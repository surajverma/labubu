import * as THREE from 'three';
import type { BuildCtx } from '../buildCtx';
import { blobGeometry, capsule, latheProfile, ring, roundedBox, taperedTube } from '../geometry';

type Builder = (c: BuildCtx) => void;

/** Group at the right hand, slightly forward. */
function inHand(c: BuildCtx, left = false): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(left ? c.body.handL : c.body.hand).add(new THREE.Vector3(0, 0.02, 0.08));
  c.body.group.add(g);
  return g;
}

function stick(c: BuildCtx, g: THREE.Object3D, len: number, r: number, mat: THREE.Material): THREE.Mesh {
  const m = c.mesh(new THREE.CylinderGeometry(r, r, len, 10), mat, g);
  m.position.y = len / 2 - 0.05;
  return m;
}

export const ACCESSORIES: Record<string, Builder> = {
  none: () => {},

  balloon: (c) => {
    const g = inHand(c);
    const top = new THREE.Vector3(0.25, 1.35, -0.25);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 0.5, -0.1), new THREE.Vector3(0.15, 0.9, -0.15), top]);
    c.mesh(new THREE.TubeGeometry(curve, 40, 0.006, 4), c.kit.plastic('#ffffff', 0.6), g);
    const b = c.mesh(blobGeometry({ rx: 0.24, ry: 0.28, rz: 0.24, egg: 0.12 }, { widthSegments: 32, heightSegments: 24 }), c.kit.vinyl(c.spec.palette.accent, 'glossy'), g);
    b.position.copy(top).add(new THREE.Vector3(0, 0.28, 0));
    b.name = 'balloon';
    const knot = c.mesh(new THREE.ConeGeometry(0.035, 0.05, 10), c.kit.vinyl(c.spec.palette.accent, 'glossy'), g);
    knot.position.copy(top).add(new THREE.Vector3(0, 0.01, 0));
  },

  backpack: (c) => {
    const pal = c.spec.palette;
    const p = c.body.params;
    const pack = c.mesh(roundedBox(p.rx * 1.25, p.ry * 1.1, 0.24, 0.08), c.kit.fabric(pal.accent), c.body.group);
    pack.position.set(0, c.body.cy + 0.06, -p.rz - 0.08);
    const pocket = c.mesh(roundedBox(p.rx * 0.9, p.ry * 0.45, 0.1, 0.04), c.kit.fabric(pal.outfitAlt), c.body.group);
    pocket.position.set(0, c.body.cy - 0.1, -p.rz - 0.2);
    for (const s of [-1, 1]) {
      const a = c.body.anchor(s * 30, 60).pos.multiplyScalar(1.05);
      const b = c.body.anchor(s * 35, -10).pos.multiplyScalar(1.05);
      const back = new THREE.Vector3(s * p.rx * 0.4, c.body.cy + p.ry * 0.5, -p.rz - 0.04);
      const curve = new THREE.CatmullRomCurve3([back, a, b]);
      c.mesh(new THREE.TubeGeometry(curve, 20, 0.025, 6), c.kit.fabric(pal.accent), c.body.group);
    }
  },

  scarf: (c) => {
    const pal = c.spec.palette;
    const p = c.body.params;
    const top = c.body.cy + p.ry * 0.86;
    const r = c.body.anchor(90, 60).pos.x;
    const m = c.mesh(new THREE.TorusGeometry(Math.abs(r) * 0.92, 0.075, 14, 40), c.kit.fabric(pal.accent), c.body.group);
    m.rotation.x = Math.PI / 2;
    m.scale.set(1, (p.rz / p.rx) * 1.05, 1);
    m.position.y = top;
    const tail = c.mesh(capsule(0.07, 0.24, 10), c.kit.fabric(pal.accent), c.body.group);
    tail.position.set(0.15, top - 0.17, p.rz * 0.95);
    tail.rotation.z = 0.15;
    tail.scale.z = 0.5;
    // Fringe stripes.
    const stripe = c.mesh(ring(0.072, 0.012), c.kit.fabric(pal.outfitAlt), tail);
    stripe.position.y = -0.1;
  },

  wand: (c) => {
    const g = inHand(c);
    g.rotation.z = -0.4;
    g.scale.setScalar(1.4);
    stick(c, g, 0.42, 0.016, c.kit.plastic('#fdf6ff', 0.3));
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? 0.05 : 0.11;
      if (i === 0) star.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr);
      else star.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr);
    }
    const sg = new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 });
    sg.center();
    const s = c.mesh(sg, c.kit.glow('#ffd84d', 0.7), g);
    s.position.y = 0.42;
  },

  lollipop: (c) => {
    const g = inHand(c);
    g.rotation.z = -0.2;
    g.scale.setScalar(1.4);
    stick(c, g, 0.36, 0.014, c.kit.plastic('#ffffff', 0.5));
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = c.spec.palette.accent;
    ctx.lineWidth = 12;
    ctx.beginPath();
    for (let i = 0; i < 200; i++) {
      const a = i * 0.2;
      const r = i * 0.32;
      ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    ctx.stroke();
    const t = c.kit.ownTexture(new THREE.CanvasTexture(cv));
    t.colorSpace = THREE.SRGBColorSpace;
    const candy = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 40);
    const mat = c.kit.own(new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.15, clearcoat: 1 }));
    const disc = c.mesh(candy, mat, g);
    disc.rotation.x = Math.PI / 2;
    disc.position.y = 0.46;
  },

  umbrella: (c) => {
    const g = inHand(c);
    g.rotation.z = 0.32;
    g.rotation.x = -0.15;
    stick(c, g, 1.85, 0.016, c.kit.plastic('#4b3a33', 0.4));
    const canopy = latheProfile(0.26, (t) => 0.62 * Math.cos((t * Math.PI) / 2) + 0.01, 12, 8);
    const pos = canopy.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const scallop = 1 - 0.06 * Math.abs(Math.sin(a * 4));
      pos.setX(i, x * scallop);
      pos.setZ(i, z * scallop);
    }
    canopy.computeVertexNormals();
    const mat = c.kit.plastic(c.spec.palette.accent, 0.3);
    mat.side = THREE.DoubleSide;
    const cm = c.mesh(canopy, mat, g);
    cm.position.y = 1.76;
    c.mesh(new THREE.SphereGeometry(0.03, 10, 8), mat, g).position.y = 2.03;
    const hook = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(0.08, -0.12, 0));
    c.mesh(taperedTube(hook, 0.016, 0.016, 10, 6, false), c.kit.plastic('#4b3a33', 0.4), g);
  },

  bowtie: (c) => {
    const pal = c.spec.palette;
    const a = c.body.anchor(0, 48);
    const g = new THREE.Group();
    g.position.copy(a.pos).addScaledVector(a.normal, 0.05);
    g.scale.setScalar(1.3);
    c.body.group.add(g);
    for (const s of [-1, 1]) {
      const lobe = c.mesh(new THREE.ConeGeometry(0.075, 0.13, 4), c.kit.fabric(pal.accent), g);
      lobe.rotation.z = (s * Math.PI) / 2;
      lobe.position.x = s * 0.06;
      lobe.scale.z = 0.5;
    }
    c.mesh(new THREE.SphereGeometry(0.035, 10, 8), c.kit.fabric(pal.accent), g);
  },

  glasses: (c) => {
    const g = new THREE.Group();
    const a = c.head.anchor(0, 4);
    g.position.copy(a.pos).add(new THREE.Vector3(0, 0, 0.06));
    c.head.group.add(g);
    const frame = c.kit.plastic(c.spec.palette.accent, 0.25);
    for (const s of [-1, 1]) {
      const r = c.mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 32), frame, g);
      r.position.set(s * 0.22, 0, -0.02);
      r.rotation.y = s * 0.18;
      const lens = c.mesh(new THREE.CircleGeometry(0.125, 28), c.kit.glass('#ffffff'), g);
      lens.position.copy(r.position);
      lens.rotation.y = r.rotation.y;
    }
    const bridge = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.09, 0.02, -0.01), new THREE.Vector3(0, 0.06, 0.01), new THREE.Vector3(0.09, 0.02, -0.01));
    c.mesh(taperedTube(bridge, 0.016, 0.016, 10, 6, false), frame, g);
  },

  satchel: (c) => {
    const pal = c.spec.palette;
    const p = c.body.params;
    const bag = c.mesh(roundedBox(0.26, 0.2, 0.1, 0.04), c.kit.fabric(pal.accent), c.body.group);
    bag.position.set(p.rx * 0.95, c.body.cy - p.ry * 0.3, 0.12);
    bag.rotation.y = 0.9;
    const flap = c.mesh(roundedBox(0.27, 0.1, 0.11, 0.03), c.kit.fabric(pal.outfitAlt), bag);
    flap.position.y = 0.06;
    const strap = new THREE.CatmullRomCurve3([
      bag.position.clone().add(new THREE.Vector3(0, 0.08, 0)),
      c.body.anchor(-20, 40).pos.multiplyScalar(1.07),
      c.body.anchor(-50, 75).pos.multiplyScalar(1.07),
      c.body.anchor(-150, 30).pos.multiplyScalar(1.06),
      c.body.anchor(140, -5).pos.multiplyScalar(1.06),
      bag.position.clone().add(new THREE.Vector3(0.02, 0.08, -0.05)),
    ]);
    c.mesh(new THREE.TubeGeometry(strap, 60, 0.018, 6), c.kit.fabric(pal.accent), c.body.group);
  },

  // --- Phase 2 ---
  foamsword: (c) => {
    const g = inHand(c);
    g.rotation.z = -0.3;
    const blade = c.mesh(roundedBox(0.09, 0.6, 0.035, 0.03), c.kit.plastic('#7ec8ff', 0.4), g);
    blade.position.y = 0.38;
    c.mesh(roundedBox(0.24, 0.05, 0.06, 0.02), c.kit.plastic('#ffd23f'), g).position.y = 0.06;
    c.mesh(capsule(0.025, 0.08, 6), c.kit.plastic('#6b4b3a'), g).position.y = -0.02;
  },

  telescope: (c) => {
    const g = inHand(c);
    g.rotation.z = -1.0;
    const brass = c.kit.metal('#d2a24c');
    c.mesh(latheProfile(0.5, (t) => 0.05 + t * 0.03, 4, 20), brass, g).position.y = -0.1;
    c.mesh(ring(0.085, 0.015), c.kit.plastic('#4b3a33'), g).position.y = 0.38;
  },

  icecream: (c) => {
    const g = inHand(c);
    const cone = c.mesh(new THREE.ConeGeometry(0.08, 0.22, 16), c.kit.plastic('#e2a865', 0.7), g);
    cone.rotation.x = Math.PI;
    cone.position.y = 0.08;
    const cols = ['#ffd1dc', '#c9f2d0', '#fff1b8'];
    cols.forEach((col, i) => {
      const s = c.mesh(new THREE.SphereGeometry(0.09, 18, 12), c.kit.plastic(col, 0.6), g);
      s.position.y = 0.22 + i * 0.12;
    });
    c.mesh(new THREE.SphereGeometry(0.03, 10, 8), c.kit.plastic('#e8334a', 0.2), g).position.y = 0.55;
  },

  camera: (c) => {
    const g = inHand(c, true);
    const body = c.mesh(roundedBox(0.26, 0.17, 0.12, 0.04), c.kit.plastic('#2c2f3a', 0.4), g);
    body.position.y = 0.08;
    const lens = c.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 20), c.kit.plastic('#555c6e', 0.25), g);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.08, 0.08);
    c.mesh(new THREE.SphereGeometry(0.02, 8, 6), c.kit.glow('#ff5d5d', 1), g).position.set(0.09, 0.15, 0.05);
  },

  skateboard: (c) => {
    const board = c.mesh(roundedBox(0.9, 0.05, 0.28, 0.025), c.kit.plastic(c.spec.palette.accent, 0.4), c.root);
    board.position.set(0, 0.045, 0);
    for (const sx of [-0.3, 0.3])
      for (const sz of [-0.1, 0.1]) {
        const w = c.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.035, 12), c.kit.plastic('#fafafa'), c.root);
        w.rotation.x = Math.PI / 2;
        w.position.set(sx, 0.02, sz);
      }
    c.body.group.position.y += 0.07;
  },

  bubblewand: (c) => {
    const g = inHand(c);
    g.rotation.z = -0.35;
    stick(c, g, 0.3, 0.014, c.kit.plastic('#ff8fc7', 0.3));
    c.mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 24), c.kit.plastic('#ff8fc7', 0.3), g).position.y = 0.33;
    const bub = c.kit.own(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0, transmission: 0.95, iridescence: 1, iridescenceIOR: 1.3, transparent: true, opacity: 0.6, depthWrite: false }));
    for (let i = 0; i < 4; i++) {
      const b = c.mesh(new THREE.SphereGeometry(0.05 + i * 0.015, 18, 12), bub, g);
      b.position.set(0.12 + i * 0.12, 0.45 + i * 0.14, -0.05 * i);
    }
  },

  guitar: (c) => {
    const g = new THREE.Group();
    g.position.set(0.05, c.body.cy - 0.02, c.body.params.rz + 0.08);
    g.rotation.z = 0.8;
    c.body.group.add(g);
    const wood = c.kit.plastic(c.spec.palette.accent, 0.35);
    c.mesh(blobGeometry({ rx: 0.16, ry: 0.2, rz: 0.06, egg: -0.25 }, { widthSegments: 24, heightSegments: 16 }), wood, g);
    c.mesh(roundedBox(0.05, 0.42, 0.03, 0.015), c.kit.plastic('#4b3a33', 0.5), g).position.y = 0.32;
    const hole = c.mesh(new THREE.CircleGeometry(0.045, 20), c.kit.basic('#2a1b14'), g);
    hole.position.set(0, 0.02, 0.061);
  },

  teddy: (c) => {
    const g = inHand(c, true);
    const fur = c.kit.fabric('#c9915e');
    const b = c.mesh(new THREE.SphereGeometry(0.1, 16, 12), fur, g);
    b.position.y = 0.04;
    const h = c.mesh(new THREE.SphereGeometry(0.085, 16, 12), fur, g);
    h.position.y = 0.19;
    for (const s of [-1, 1]) c.mesh(new THREE.SphereGeometry(0.035, 10, 8), fur, g).position.set(s * 0.06, 0.26, 0);
    const snout = c.mesh(new THREE.SphereGeometry(0.03, 10, 8), c.kit.fabric('#f1d2b0'), g);
    snout.position.set(0, 0.18, 0.075);
  },
};
