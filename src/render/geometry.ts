import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Soft "vinyl" blob: a sphere deformed into superellipsoids, eggs, pears and beans.
 * All character heads and bodies use this so shapes stay smooth and chunky.
 */
export interface BlobParams {
  rx: number;
  ry: number;
  rz: number;
  /** Superellipse exponent: 2 = sphere, 3–4 = squircle. */
  power?: number;
  /** Positive = wider at the bottom (pear), negative = wider at top. */
  taper?: number;
  /** 0..1 flattens the bottom (so it sits on the ground). */
  flatBottom?: number;
  /** Shifts width up/down: positive makes the top fuller (egg upside-down). */
  egg?: number;
}

/** Deforms a unit-sphere direction into a point on the blob surface. */
export function blobPoint(
  p: BlobParams,
  d: THREE.Vector3,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const pw = p.power ?? 2;
  let x = d.x,
    y = d.y,
    z = d.z;
  if (pw !== 2) {
    const n = Math.pow(
      Math.pow(Math.abs(x), pw) + Math.pow(Math.abs(y), pw) + Math.pow(Math.abs(z), pw),
      1 / pw,
    );
    x /= n;
    y /= n;
    z /= n;
  }
  // Egg: scale horizontal radius by height.
  const egg = p.egg ?? 0;
  const taper = p.taper ?? 0;
  const hs = 1 + egg * y - taper * y;
  x *= hs;
  z *= hs;
  let yy = y;
  const fb = p.flatBottom ?? 0;
  if (fb > 0 && yy < 0) {
    // Smoothly squash the lower part to give a flat-ish base.
    const t = -yy;
    yy = -(t - fb * 0.55 * t * t * t);
    const widen = 1 + fb * 0.12 * t * t;
    x *= widen;
    z *= widen;
  }
  return out.set(x * p.rx, yy * p.ry, z * p.rz);
}

export interface BlobOptions {
  widthSegments?: number;
  heightSegments?: number;
  phiStart?: number;
  phiLength?: number;
  thetaStart?: number;
  thetaLength?: number;
}

/**
 * Builds the blob geometry. Stores the undeformed unit direction in attribute `dir`
 * (used for decal UVs). Normals are recomputed after welding seams so there are no
 * visible seams on glossy materials.
 */
export function blobGeometry(p: BlobParams, o: BlobOptions = {}): THREE.BufferGeometry {
  const full = o.phiLength === undefined && o.thetaLength === undefined;
  const g = new THREE.SphereGeometry(
    1,
    o.widthSegments ?? 64,
    o.heightSegments ?? 48,
    o.phiStart ?? 0,
    o.phiLength ?? Math.PI * 2,
    o.thetaStart ?? 0,
    o.thetaLength ?? Math.PI,
  );
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const dir = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const out = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    dir[i * 3] = v.x;
    dir[i * 3 + 1] = v.y;
    dir[i * 3 + 2] = v.z;
    blobPoint(p, v, out);
    pos.setXYZ(i, out.x, out.y, out.z);
  }
  g.setAttribute('dir', new THREE.BufferAttribute(dir, 3));
  if (full) {
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    const merged = mergeVertices(g, 1e-5);
    g.dispose();
    merged.computeVertexNormals();
    return merged;
  }
  g.computeVertexNormals();
  // Partial shells: use analytic-ish normals from a full blob to avoid edge shading errors.
  fixNormalsFromBlob(g, p);
  return g;
}

/** Replaces normals by finite-difference normals of the blob surface (smooth at shell edges). */
function fixNormalsFromBlob(g: THREE.BufferGeometry, p: BlobParams): void {
  const dir = g.getAttribute('dir') as THREE.BufferAttribute;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  const d = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < dir.count; i++) {
    d.fromBufferAttribute(dir, i);
    blobNormal(p, d, n);
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
}

const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
/** Surface normal of the blob at unit direction d (finite differences). */
export function blobNormal(
  p: BlobParams,
  d: THREE.Vector3,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const up = Math.abs(d.y) > 0.9 ? _t1.set(1, 0, 0) : _t1.set(0, 1, 0);
  const t = _t2.crossVectors(d, up).normalize();
  const b = up.crossVectors(d, t).normalize();
  const e = 0.002;
  blobPoint(p, _a.copy(d).addScaledVector(t, e).normalize(), _a);
  blobPoint(p, _b.copy(d).addScaledVector(b, e).normalize(), _b);
  blobPoint(p, _c.copy(d), _c);
  _a.sub(_c);
  _b.sub(_c);
  out.crossVectors(_a, _b).normalize();
  // Make sure it points outwards.
  if (out.dot(_c) < 0) out.negate();
  return out;
}

/** Point + outward normal on the blob for a direction given in degrees (azimuth from +z, elevation). */
export function blobAnchor(
  p: BlobParams,
  azimuthDeg: number,
  elevationDeg: number,
): { pos: THREE.Vector3; normal: THREE.Vector3 } {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const d = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  return { pos: blobPoint(p, d), normal: blobNormal(p, d) };
}

/** Capsule along Y, rounded. */
export function capsule(radius: number, length: number, seg = 24): THREE.BufferGeometry {
  return new THREE.CapsuleGeometry(radius, length, 8, seg);
}

/**
 * Lathe from a smooth radius profile r(t), t in [0,1] from bottom (y=0) to top (y=h).
 * Ends are closed by forcing r=0 at the extremes when `closed` is true.
 */
export function latheProfile(
  h: number,
  r: (t: number) => number,
  steps = 32,
  seg = 40,
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(new THREE.Vector2(Math.max(0.0001, r(t)), t * h));
  }
  return new THREE.LatheGeometry(pts, seg);
}

/** Tube with tapering radius along a curve. */
export function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  r0: number,
  r1: number,
  tubular = 32,
  radial = 16,
  roundTip = true,
): THREE.BufferGeometry {
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  // TubeGeometry vertices are laid out ring by ring: (tubular+1) rings of (radial+1) verts.
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, c);
    let r = r0 + (r1 - r0) * t;
    if (roundTip && t > 0.85) r *= Math.sqrt(Math.max(0, 1 - ((t - 0.85) / 0.15) ** 2)) * 0.9 + 0.1;
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, p.x, p.y, p.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Rounded box (soft cube) for blocky parts and props. */
export function roundedBox(
  w: number,
  h: number,
  d: number,
  r: number,
  seg = 4,
): THREE.BufferGeometry {
  // Superellipsoid approximation: cheap and always smooth.
  const g = blobGeometry(
    {
      rx: w / 2,
      ry: h / 2,
      rz: d / 2,
      power: Math.max(2.5, 2 + (Math.min(w, h, d) / (r * 2)) * 1.2),
    },
    {
      widthSegments: 12 + seg * 4,
      heightSegments: 8 + seg * 3,
    },
  );
  return g;
}

/** Torus ring used for hems, brims and collars. */
export function ring(radius: number, tube: number, scaleZ = 1): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(radius, tube, 12, 48);
  g.rotateX(Math.PI / 2);
  g.scale(1, 1, scaleZ);
  return g;
}
