import * as THREE from 'three';
import { APP } from '../config';

/** Rounded box that keeps BoxGeometry UVs (so it can carry a printed texture). */
export function roundedBoxUV(w: number, h: number, d: number, r: number, seg = 6): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  const hw = w / 2 - r,
    hh = h / 2 - r,
    hd = d / 2 - r;
  const p = new THREE.Vector3();
  const inner = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    inner.set(THREE.MathUtils.clamp(p.x, -hw, hw), THREE.MathUtils.clamp(p.y, -hh, hh), THREE.MathUtils.clamp(p.z, -hd, hd));
    n.subVectors(p, inner);
    if (n.lengthSq() < 1e-10) n.fromBufferAttribute(nrm, i);
    n.normalize();
    p.copy(inner).addScaledVector(n, r);
    pos.setXYZ(i, p.x, p.y, p.z);
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

function boxArt(top: string, dots: string, label: string): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, top);
  g.addColorStop(1, new THREE.Color(top).lerp(new THREE.Color('#ffffff'), -0.12).getStyle());
  c.fillStyle = g;
  c.fillRect(0, 0, 512, 512);
  c.fillStyle = dots;
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      c.beginPath();
      c.arc(x * 64 + (y % 2) * 32, y * 64, 9, 0, Math.PI * 2);
      c.fill();
    }
  // Big friendly question mark badge.
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(256, 236, 120, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = top;
  c.font = 'bold 190px Fredoka, system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('?', 256, 246);
  c.fillStyle = '#ffffff';
  c.font = 'bold 44px Fredoka, system-ui, sans-serif';
  c.fillText(label, 256, 430);
  return cv;
}

export interface BlindBoxOptions {
  color?: string;
  dots?: string;
  ribbon?: string;
  label?: string;
}

/** The 3D blind box with idle, shake and pop animations. */
export class BlindBox {
  readonly group = new THREE.Group();
  private body: THREE.Mesh;
  private lid: THREE.Group;
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private texes: THREE.Texture[] = [];
  private shakeT = -1;
  private popT = -1;
  private idleT = 0;
  private lidVel = new THREE.Vector3();
  private lidSpin = 0;
  private sinkT = -1;
  readonly height = 1.25;

  constructor(o: BlindBoxOptions = {}) {
    const color = o.color ?? '#ff8a6b';
    const art = new THREE.CanvasTexture(boxArt(color, o.dots ?? 'rgba(255,255,255,0.35)', o.label ?? APP.name));
    art.colorSpace = THREE.SRGBColorSpace;
    art.anisotropy = 4;
    this.texes.push(art);
    const mat = new THREE.MeshPhysicalMaterial({ map: art, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const ribbonMat = new THREE.MeshPhysicalMaterial({ color: o.ribbon ?? '#ffd34d', roughness: 0.35, clearcoat: 1, sheen: 0.6 });
    this.mats.push(mat, ribbonMat);
    const W = 1.15,
      H = 1.0;
    const bodyGeo = roundedBoxUV(W, H, W, 0.09);
    this.geos.push(bodyGeo);
    this.body = new THREE.Mesh(bodyGeo, mat);
    this.body.position.y = H / 2;
    this.group.add(this.body);
    // A ribbon band around the base (sides stay clear for the "?" print).
    const band = roundedBoxUV(W + 0.03, 0.12, W + 0.03, 0.05, 2);
    this.geos.push(band);
    const bm = new THREE.Mesh(band, ribbonMat);
    bm.position.y = 0.1;
    this.group.add(bm);
    // Lid with bow.
    this.lid = new THREE.Group();
    this.lid.position.y = H + 0.05;
    const lidGeo = roundedBoxUV(W + 0.1, 0.2, W + 0.1, 0.07);
    this.geos.push(lidGeo);
    const lidMesh = new THREE.Mesh(lidGeo, mat);
    this.lid.add(lidMesh);
    for (const rot of [0, Math.PI / 2]) {
      const rg = roundedBoxUV(0.21, 0.22, W + 0.12, 0.03, 2);
      this.geos.push(rg);
      const rm = new THREE.Mesh(rg, ribbonMat);
      rm.rotation.y = rot;
      this.lid.add(rm);
    }
    for (const s of [-1, 1]) {
      const loop = new THREE.TorusGeometry(0.16, 0.06, 12, 24);
      this.geos.push(loop);
      const lm = new THREE.Mesh(loop, ribbonMat);
      lm.position.set(s * 0.15, 0.2, 0);
      lm.rotation.set(0, Math.PI / 2, s * 0.6);
      lm.scale.set(1, 1.2, 0.7);
      this.lid.add(lm);
    }
    const knot = new THREE.SphereGeometry(0.08, 16, 12);
    this.geos.push(knot);
    const km = new THREE.Mesh(knot, ribbonMat);
    km.position.y = 0.16;
    this.lid.add(km);
    this.group.add(this.lid);
  }

  shake(): void {
    this.shakeT = 0;
  }

  pop(): void {
    this.popT = 0;
    this.shakeT = -1;
    this.lidVel.set((Math.random() - 0.5) * 1.5, 5.5, 1.6);
    this.lidSpin = (Math.random() < 0.5 ? -1 : 1) * 5;
  }

  /** Box sinks into the floor after the reveal. */
  sink(): void {
    this.sinkT = 0;
  }

  get isPopped(): boolean {
    return this.popT >= 0;
  }

  update(dt: number): void {
    this.idleT += dt;
    if (this.popT < 0 && this.shakeT < 0) {
      this.group.rotation.y = Math.sin(this.idleT * 0.8) * 0.25 + 0.5;
      this.group.position.y = Math.sin(this.idleT * 2) * 0.03;
      this.group.rotation.z = 0;
    }
    if (this.shakeT >= 0) {
      this.shakeT += dt;
      const k = Math.min(1, this.shakeT / 1.4);
      const amp = 0.05 + k * 0.16;
      this.group.rotation.z = Math.sin(this.shakeT * 38) * amp;
      this.group.rotation.x = Math.cos(this.shakeT * 31) * amp * 0.5;
      this.group.position.y = Math.abs(Math.sin(this.shakeT * 19)) * 0.08 * k;
      this.lid.position.y = 1.05 + Math.abs(Math.sin(this.shakeT * 25)) * 0.05 * k;
    }
    if (this.popT >= 0) {
      this.popT += dt;
      this.group.rotation.z *= Math.pow(0.001, dt);
      this.group.rotation.x *= Math.pow(0.001, dt);
      this.lidVel.y -= 12 * dt;
      this.lid.position.addScaledVector(this.lidVel, dt);
      this.lid.rotation.x += this.lidSpin * dt * 0.4;
      this.lid.rotation.z += this.lidSpin * dt;
      if (this.lid.position.y < -2) this.lid.visible = false;
      // Squash on pop.
      const s = this.popT < 0.25 ? 1 + Math.sin((this.popT / 0.25) * Math.PI) * 0.12 : 1;
      this.body.scale.set(s, 2 - s, s);
    }
    if (this.sinkT >= 0) {
      this.sinkT += dt;
      const k = Math.min(1, this.sinkT / 0.6);
      const e = k * k;
      this.group.scale.setScalar(1 - e * 0.92);
      this.group.position.y = -e * 0.2;
      if (k >= 1) this.group.visible = false;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.texes.forEach((t) => t.dispose());
  }
}
