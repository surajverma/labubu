import * as THREE from 'three';

/**
 * Baked ambient occlusion for a character, stored in vertex colours.
 *
 * Every part is approximated by a sphere (centre + size from its bounding box). Each vertex
 * is darkened by nearby parts it faces (analytic sphere occlusion) and by the ground. It
 * runs once per build (a few ms) and costs nothing per frame. Parts never occlude
 * themselves, and a part whose sphere contains the vertex (e.g. an outfit shell around the
 * body) is skipped, so shells don't darken what they wrap.
 */
export interface AOOptions {
  strength?: number;
  groundStrength?: number;
  /** Names of meshes that should not occlude anything (decals, glows…). */
  skip?: Set<string>;
}

interface Occluder {
  mesh: THREE.Mesh;
  c: THREE.Vector3;
  r: number;
}

const MAX_OCCLUDERS = 28;

export function bakeAO(root: THREE.Object3D, o: AOOptions = {}): void {
  const strength = o.strength ?? 0.7;
  const ground = o.groundStrength ?? 0.22;
  const skip = o.skip ?? new Set(['face', 'halo']);
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh && m.geometry.getAttribute('position')) meshes.push(m);
  });

  // Occluder spheres (world space).
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  let occ: Occluder[] = [];
  for (const m of meshes) {
    if (skip.has(m.name)) continue;
    const mat = m.material as THREE.Material;
    if (mat.transparent && (mat as THREE.MeshPhysicalMaterial).opacity < 0.9) continue;
    box.setFromObject(m);
    box.getSize(size);
    // Geometric mean of the half extents: a fair sphere for blobby parts.
    const r = Math.cbrt((size.x / 2) * (size.y / 2) * (size.z / 2));
    if (r < 0.025) continue;
    occ.push({ mesh: m, c: box.getCenter(new THREE.Vector3()), r });
  }
  occ = occ.sort((a, b) => b.r - a.r).slice(0, MAX_OCCLUDERS);

  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const d = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (const m of meshes) {
    const geo = m.geometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const nrm = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
    if (!nrm) continue;
    nm.getNormalMatrix(m.matrixWorld);
    const existing = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
    const itemSize = existing?.itemSize ?? 3;
    const col = existing ?? new THREE.BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      let sum = 0;
      for (const s of occ) {
        if (s.mesh === m) continue;
        d.subVectors(s.c, p);
        const l2 = d.lengthSq();
        if (l2 < s.r * s.r * 1.05) continue; // inside / wrapped by that part
        const l = Math.sqrt(l2);
        const facing = (n.x * d.x + n.y * d.y + n.z * d.z) / l;
        if (facing <= 0) continue;
        sum += facing * ((s.r * s.r) / l2);
      }
      let ao = 1 - Math.min(0.42, sum * strength);
      // Ground: low, down/sideways-facing surfaces get darker (contact).
      const h = THREE.MathUtils.clamp(p.y / 0.32, 0, 1);
      ao *= 1 - ground * (1 - h) * (0.55 - 0.45 * n.y);
      for (let k = 0; k < 3; k++)
        col.setComponent(i, k, (existing ? col.getComponent(i, k) : 1) * ao);
      if (itemSize === 4 && !existing) col.setComponent(i, 3, 1);
    }
    if (!existing) geo.setAttribute('color', col);
    col.needsUpdate = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mt of mats) {
      if (!(mt as THREE.MeshStandardMaterial).vertexColors) {
        (mt as THREE.MeshStandardMaterial).vertexColors = true;
        mt.needsUpdate = true;
      }
    }
  }
}
