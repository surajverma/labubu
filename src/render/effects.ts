import * as THREE from 'three';

let dotTex: THREE.Texture | null = null;
function dot(): THREE.Texture {
  if (dotTex) return dotTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const x = cv.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(cv);
  return dotTex;
}

export interface Effect {
  object: THREE.Object3D;
  /** Returns false when finished. */
  update(dt: number): boolean;
  dispose(): void;
}

/** Soft cloud "poof" burst used for the Everything re-roll. */
export function poof(at: THREE.Vector3, color = '#ffffff', count = 60, scale = 1): Effect {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const d = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() * 0.9 - 0.2,
      Math.random() - 0.5,
    ).normalize();
    vel.push(d.multiplyScalar((1.2 + Math.random() * 1.6) * scale));
    pos[i * 3] = at.x + d.x * 0.2;
    pos[i * 3 + 1] = at.y + d.y * 0.2;
    pos[i * 3 + 2] = at.z + d.z * 0.2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.55 * scale,
    map: dot(),
    transparent: true,
    depthWrite: false,
    opacity: 1,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = 10;
  let t = 0;
  return {
    object: pts,
    update(dt) {
      t += dt;
      const a = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const v = vel[i]!;
        v.multiplyScalar(Math.pow(0.04, dt));
        a.setXYZ(i, a.getX(i) + v.x * dt, a.getY(i) + v.y * dt + 0.15 * dt, a.getZ(i) + v.z * dt);
      }
      a.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - t / 0.8);
      mat.size = (0.55 + t * 0.6) * scale;
      return t < 0.8;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** Confetti / sparkles for reveals. */
export function sparkles(at: THREE.Vector3, colors: string[], count = 90, life = 1.8): Effect {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const vel: THREE.Vector3[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const up = 2.5 + Math.random() * 2.5;
    vel.push(
      new THREE.Vector3(
        Math.cos(a) * (0.6 + Math.random() * 1.6),
        up,
        Math.sin(a) * (0.6 + Math.random() * 1.2),
      ),
    );
    pos.set([at.x, at.y, at.z], i * 3);
    c.set(colors[i % colors.length]!);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.12,
    map: dot(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = 11;
  let t = 0;
  return {
    object: pts,
    update(dt) {
      t += dt;
      const p = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const v = vel[i]!;
        v.y -= 4.2 * dt;
        v.multiplyScalar(Math.pow(0.5, dt));
        p.setXYZ(
          i,
          p.getX(i) + v.x * dt,
          Math.max(0.02, p.getY(i) + v.y * dt),
          p.getZ(i) + v.z * dt,
        );
      }
      p.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - Math.max(0, t - life * 0.6) / (life * 0.4));
      return t < life;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** Light beam rising from the box in the rarity colour. */
export function beam(
  at: THREE.Vector3,
  color: string,
  rainbow = false,
): Effect & { setStrength(s: number): void } {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 256;
  const x = cv.getContext('2d')!;
  const g = x.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 256);
  // Horizontal soft edges.
  const e = x.createLinearGradient(0, 0, 64, 0);
  e.addColorStop(0, 'rgba(0,0,0,1)');
  e.addColorStop(0.3, 'rgba(0,0,0,0)');
  e.addColorStop(0.7, 'rgba(0,0,0,0)');
  e.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = e;
  x.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(cv);
  const group = new THREE.Group();
  group.position.copy(at);
  const mats: THREE.MeshBasicMaterial[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const cols = rainbow ? ['#ff6b6b', '#ffc93c', '#5fd068', '#4aa8ff', '#b56bff'] : [color];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.CylinderGeometry(0.55 + i * 0.18, 0.35 + i * 0.1, 4.5, 32, 1, true);
    geo.translate(0, 2.25, 0);
    const m = new THREE.MeshBasicMaterial({
      map: tex,
      color: cols[i % cols.length],
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geo, m);
    mesh.renderOrder = 9;
    group.add(mesh);
    mats.push(m);
    geos.push(geo);
  }
  let t = 0;
  let strength = 1;
  return {
    object: group,
    setStrength(s: number) {
      strength = s;
    },
    update(dt) {
      t += dt;
      group.rotation.y += dt * 0.8;
      mats.forEach((m, i) => (m.opacity = Math.min(1, t * 2.5) * strength * (0.55 - i * 0.12)));
      if (rainbow) mats.forEach((m, i) => m.color.setHSL((t * 0.25 + i * 0.2) % 1, 0.9, 0.6));
      return strength > 0.001;
    },
    dispose() {
      geos.forEach((g2) => g2.dispose());
      mats.forEach((m) => m.dispose());
      tex.dispose();
    },
  };
}

/** Runs effects in a scene graph and disposes finished ones. */
export class EffectRunner {
  private list: Effect[] = [];
  constructor(private parent: THREE.Object3D) {}
  add<T extends Effect>(e: T): T {
    this.parent.add(e.object);
    this.list.push(e);
    return e;
  }
  update(dt: number): void {
    this.list = this.list.filter((e) => {
      const alive = e.update(dt);
      if (!alive) {
        e.object.removeFromParent();
        e.dispose();
      }
      return alive;
    });
  }
  clear(): void {
    for (const e of this.list) {
      e.object.removeFromParent();
      e.dispose();
    }
    this.list = [];
  }
}
