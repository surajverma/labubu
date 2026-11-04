import * as THREE from 'three';
import type { CharacterSpec, FaceSpec } from '../gen/types';
import { blobGeometry, capsule } from './geometry';
import { MaterialKit } from './materials';
import { BODY_SHAPES, HEAD_SHAPES, SMALL_BODIES } from './shapes';
import { FaceDrum } from './faceDrum';
import type { FaceInk } from './face';
import { makeAnchorFn, topOf, type BuildCtx } from './buildCtx';
import { EARS } from './parts/ears';
import { HATS } from './parts/hats';
import { OUTFITS } from './parts/outfits';
import { ACCESSORIES } from './parts/accessories';

export type Quality = 'low' | 'medium' | 'high';

export interface SpinOptions {
  /** +1 = face rolls upward (swipe up), -1 = downward. */
  direction: 1 | -1;
  /** Faces shown in passing cells (blurred past). */
  fillers: FaceSpec[];
  durationMs?: number;
  onTick?: () => void;
  onLand?: () => void;
}

export interface CharacterRig {
  spec: CharacterSpec;
  root: THREE.Group;
  /** Approximate total height (for camera framing). */
  height: number;
  /** Head centre height (for camera aim). */
  headY: number;
  update(dt: number, t: number): void;
  spinFace(face: FaceSpec, opts: SpinOptions): Promise<void>;
  isSpinning(): boolean;
  /** Squash-and-stretch hop (used on reveal and taps). */
  hop(strength?: number): void;
  setFaceInstant(face: FaceSpec): void;
  dispose(): void;
}

export function faceInkFor(spec: CharacterSpec): FaceInk {
  return {
    ink: spec.palette.ink,
    blush: spec.palette.blush,
    iris: spec.palette.accent,
    skin: spec.palette.skin,
    glow: Boolean(spec.mods.glowEyes),
  };
}

const easeOutBack = (t: number, s = 1.25) => {
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

export function buildCharacter(
  spec: CharacterSpec,
  opts: { quality?: Quality; faceRes?: number } = {},
): CharacterRig {
  const quality = opts.quality ?? 'high';
  const segScale = quality === 'low' ? 0.6 : quality === 'medium' ? 0.8 : 1;
  const kit = new MaterialKit(quality);
  const geos: THREE.BufferGeometry[] = [];
  const geo = <T extends THREE.BufferGeometry>(g: T): T => (geos.push(g), g);
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D) => {
    const me = new THREE.Mesh(geo(g), m);
    me.castShadow = false;
    parent.add(me);
    return me;
  };

  const pal = spec.palette;
  const skin = kit.vinyl(pal.skin, spec.finish);
  const skinAlt = kit.vinyl(pal.skinAlt, spec.finish === 'galaxy' ? 'glossy' : spec.finish);

  const root = new THREE.Group();
  root.name = `character:${spec.seed}`;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const bp = BODY_SHAPES[spec.body] ?? BODY_SHAPES.bean!;
  const hp = HEAD_SHAPES[spec.head] ?? HEAD_SHAPES.round!;
  const small = SMALL_BODIES.has(spec.body);
  const limbScale = small ? 0.85 : 1;

  // --- Legs & feet ---
  const legLen = 0.14 * limbScale;
  const legR = 0.12 * limbScale;
  const legTop = legLen + legR * 0.9;
  const legs: THREE.Mesh[] = [];
  const feet: THREE.Mesh[] = [];
  const legX = Math.min(bp.rx * 0.45, 0.22);
  for (const s of [-1, 1]) {
    const leg = mesh(capsule(legR, legLen, Math.round(20 * segScale)), skin, bodyGroup);
    leg.position.set(s * legX, legR + legLen / 2 + 0.02, 0);
    legs.push(leg);
    const foot = mesh(
      blobGeometry({ rx: legR * 1.18, ry: legR * 0.62, rz: legR * 1.45, flatBottom: 0.9 }, {
        widthSegments: Math.round(28 * segScale),
        heightSegments: Math.round(18 * segScale),
      }),
      skin,
      bodyGroup,
    );
    foot.position.set(s * legX * 1.02, legR * 0.55, legR * 0.35);
    feet.push(foot);
  }

  // --- Body ---
  const bodyCy = legTop + bp.ry * 0.82;
  const bodyMesh = mesh(
    blobGeometry(bp, { widthSegments: Math.round(64 * segScale), heightSegments: Math.round(48 * segScale) }),
    skin,
    bodyGroup,
  );
  bodyMesh.position.y = bodyCy;
  bodyMesh.name = 'body';
  // Belly patch (skinAlt), a soft oval on the front.
  const belly = mesh(
    blobGeometry(
      { ...bp, rx: bp.rx * 1.004, ry: bp.ry * 1.004, rz: bp.rz * 1.004 },
      { phiStart: Math.PI / 2 - 0.55, phiLength: 1.1, thetaStart: Math.PI * 0.42, thetaLength: Math.PI * 0.36, widthSegments: 20, heightSegments: 14 },
    ),
    skinAlt,
    bodyGroup,
  );
  belly.position.y = bodyCy;
  belly.name = 'belly';

  // --- Arms ---
  const arms: THREE.Mesh[] = [];
  const armR = 0.1 * limbScale;
  const armLen = 0.2 * limbScale;
  const shoulderY = bodyCy + bp.ry * 0.25;
  const hand = new THREE.Vector3();
  const handL = new THREE.Vector3();
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * bp.rx * 0.82, shoulderY, 0.02);
    pivot.rotation.z = s * 0.62;
    bodyGroup.add(pivot);
    const arm = mesh(capsule(armR, armLen, Math.round(18 * segScale)), skin, pivot);
    arm.position.y = -armLen / 2 - armR * 0.3;
    arm.name = s > 0 ? 'armR' : 'armL';
    arms.push(arm);
    // Hand tip in body space.
    const tip = new THREE.Vector3(0, -armLen - armR * 1.1, 0);
    pivot.updateMatrix();
    tip.applyMatrix4(pivot.matrix);
    (s > 0 ? hand : handL).copy(tip);
  }

  // --- Head ---
  const headGroup = new THREE.Group();
  const headBottom = -topOf({ ...hp, ry: hp.ry }) * (hp.flatBottom ? 0.85 : 1);
  const bodyTop = bodyCy + bp.ry;
  const headY = bodyTop + Math.abs(headBottom) * 0.8;
  headGroup.position.y = headY;
  root.add(headGroup);
  const headMesh = mesh(
    blobGeometry(hp, { widthSegments: Math.round(72 * segScale), heightSegments: Math.round(56 * segScale) }),
    skin,
    headGroup,
  );
  headMesh.name = 'head';

  const faceRes = opts.faceRes ?? (quality === 'high' ? 1024 : quality === 'medium' ? 768 : 512);
  const roughness = (skin as THREE.MeshPhysicalMaterial).roughness ?? 0.4;
  const drum = new FaceDrum(hp, faceInkFor(spec), faceRes, Math.min(roughness, 0.5));
  headGroup.add(drum.mesh);
  drum.setCell(0, spec.face);
  drum.setAngle(0);
  drum.commit();

  const ctx: BuildCtx = {
    spec,
    kit,
    skin,
    skinAlt,
    root,
    geo,
    mesh,
    head: { group: headGroup, params: hp, anchor: makeAnchorFn(hp), top: topOf(hp) },
    body: {
      group: bodyGroup,
      params: bp,
      cy: bodyCy,
      anchor: makeAnchorFn(bp, bodyCy),
      arms,
      legs,
      feet,
      hand,
      handL,
    },
  };

  if (!spec.mods.hideEars) (EARS[spec.ears] ?? EARS.none!)(ctx);
  (OUTFITS[spec.outfit] ?? OUTFITS.none!)(ctx);
  (HATS[spec.hat] ?? HATS.none!)(ctx);
  (ACCESSORIES[spec.accessory] ?? ACCESSORIES.none!)(ctx);
  if (spec.mods.halo) {
    const halo = mesh(new THREE.TorusGeometry(0.34, 0.035, 12, 48), kit.glow('#ffe27a', 2.2), headGroup);
    halo.rotation.x = Math.PI / 2 - 0.25;
    halo.position.y = ctx.head.top + 0.32;
    halo.name = 'halo';
  }

  const box = new THREE.Box3().setFromObject(root);
  const height = box.max.y;

  // --- Animation state ---
  let blinkTimer = 2 + Math.random() * 2;
  let blinkLeft = 0;
  let spin: null | {
    a0: number;
    a1: number;
    t: number;
    dur: number;
    lastCell: number;
    opts: SpinOptions;
    resolve: () => void;
    landed: boolean;
  } = null;
  let hopT = -1;
  let hopStrength = 1;
  const step = (Math.PI * 2) / FaceDrum.N;

  const rig: CharacterRig = {
    spec,
    root,
    height,
    headY,
    update(dt, t) {
      // Breathing / bob.
      const breath = Math.sin(t * 2.1);
      bodyGroup.scale.set(1 - breath * 0.006, 1 + breath * 0.012, 1 - breath * 0.006);
      headGroup.position.y = headY + breath * 0.012;
      headGroup.rotation.z = Math.sin(t * 0.7) * 0.035;
      headGroup.rotation.x = Math.sin(t * 0.53 + 1) * 0.02;
      // Hop squash.
      if (hopT >= 0) {
        hopT += dt;
        const d = 0.55;
        const k = Math.min(1, hopT / d);
        const up = Math.sin(k * Math.PI) * 0.18 * hopStrength;
        const squash = Math.sin(k * Math.PI * 2) * 0.06 * hopStrength * (1 - k);
        root.position.y = up;
        root.scale.set(1 + squash, 1 - squash, 1 + squash);
        if (k >= 1) {
          hopT = -1;
          root.position.y = 0;
          root.scale.set(1, 1, 1);
        }
      }
      // Spin.
      if (spin) {
        spin.t += dt * 1000;
        const k = Math.min(1, spin.t / spin.dur);
        const e = easeOutBack(k, 1.1);
        const a = spin.a0 + (spin.a1 - spin.a0) * e;
        drum.setAngle(a);
        const cell = Math.round(a / step);
        if (cell !== spin.lastCell) {
          spin.lastCell = cell;
          if (k < 0.92) spin.opts.onTick?.();
        }
        // Head wobble while spinning.
        headGroup.rotation.x += Math.sin(k * Math.PI) * 0.06 * spin.opts.direction;
        if (k >= 1) {
          drum.setAngle(spin.a1);
          drum.commit();
          const s = spin;
          spin = null;
          s.opts.onLand?.();
          rig.hop(0.45);
          s.resolve();
        }
      } else {
        // Blink.
        blinkTimer -= dt;
        if (blinkLeft > 0) {
          blinkLeft -= dt;
          if (blinkLeft <= 0) drum.setBlink(false);
        } else if (blinkTimer <= 0) {
          drum.setBlink(true);
          blinkLeft = 0.13;
          blinkTimer = 2.5 + Math.random() * 3.5;
        }
      }
    },
    spinFace(face, o) {
      if (spin) return Promise.resolve();
      drum.setBlink(false);
      const N = FaceDrum.N;
      const front = drum.frontCell;
      const n = 6 + Math.floor(Math.random() * 3); // 6..8 cells, never a multiple of N landing on itself
      const passes = n % N === 0 ? n + 1 : n;
      const target = front - o.direction * passes;
      const tCell = ((target % N) + N) % N;
      let fi = 0;
      for (let c = 0; c < N; c++) {
        if (c === front) continue;
        if (c === tCell) drum.setCell(c, face);
        else drum.setCell(c, o.fillers[fi++ % Math.max(1, o.fillers.length)] ?? face);
      }
      drum.commit();
      const a0 = drum.currentAngle;
      const a1 = Math.round(a0 / step) * step - o.direction * passes * step;
      return new Promise<void>((resolve) => {
        spin = { a0, a1, t: 0, dur: o.durationMs ?? 1100, lastCell: Math.round(a0 / step), opts: o, resolve, landed: false };
      });
    },
    isSpinning: () => spin !== null,
    hop(strength = 1) {
      hopT = 0;
      hopStrength = strength;
    },
    setFaceInstant(face) {
      drum.setCell(drum.frontCell, face);
      drum.commit();
    },
    dispose() {
      root.removeFromParent();
      for (const g of geos) g.dispose();
      drum.dispose();
      kit.dispose();
    },
  };
  return rig;
}
