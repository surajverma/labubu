import * as THREE from 'three';
import type { Rarity } from '../gen/types';
import { RARITY_INFO, rarityRank } from '../gen/rarity';

/**
 * "Bloom" for Epic and above: a soft additive glow behind the buddy (+ light rays for
 * Legendary/Secret). Much cheaper than post-process bloom and never washes out vinyl.
 */
export class Aura {
  readonly group = new THREE.Group();
  private mats: THREE.MeshBasicMaterial[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private texes: THREE.Texture[] = [];
  private t = 0;

  constructor(
    private rarity: Rarity,
    height: number,
  ) {
    const rank = rarityRank(rarity);
    const color = RARITY_INFO[rarity].color === 'rainbow' ? '#ffffff' : RARITY_INFO[rarity].color;
    const glowTex = this.radial();
    const glow = this.plane(height * 1.4, glowTex, color, rank >= 3 ? 0.5 : 0.42);
    glow.position.set(0, height * 0.55, -0.9);
    if (rank >= 3) {
      const rays = this.plane(height * 2.1, this.raysTex(), color, 0.2);
      rays.position.set(0, height * 0.55, -1.0);
      rays.name = 'rays';
    }
  }

  private plane(size: number, map: THREE.Texture, color: string, opacity: number): THREE.Mesh {
    const g = new THREE.PlaneGeometry(size, size);
    const m = new THREE.MeshBasicMaterial({
      map,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    this.geos.push(g);
    this.mats.push(m);
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = -1;
    this.group.add(mesh);
    return mesh;
  }

  private radial(): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d')!;
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv);
    this.texes.push(t);
    return t;
  }

  private raysTex(): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d')!;
    c.translate(128, 128);
    for (let i = 0; i < 12; i++) {
      c.rotate((Math.PI * 2) / 12);
      const g = c.createLinearGradient(0, 0, 128, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(128, -14);
      c.lineTo(128, 14);
      c.closePath();
      c.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    this.texes.push(t);
    return t;
  }

  update(dt: number): void {
    this.t += dt;
    const pulse = 0.85 + Math.sin(this.t * 2) * 0.15;
    this.group.children.forEach((m, i) => {
      (m as THREE.Mesh).scale.setScalar(i === 0 ? pulse : 1);
      if (m.name === 'rays') m.rotation.z += dt * 0.25;
    });
    if (this.rarity === 'secret')
      this.mats.forEach((m, i) => m.color.setHSL((this.t * 0.15 + i * 0.3) % 1, 0.9, 0.5));
  }

  dispose(): void {
    this.group.removeFromParent();
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.texes.forEach((t) => t.dispose());
  }
}
