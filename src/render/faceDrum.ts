import * as THREE from 'three';
import type { FaceSpec } from '../gen/types';
import { blobGeometry, type BlobParams } from './geometry';
import { drawFace, type FaceInk } from './face';

/**
 * The spinning face panel. The face is painted onto a drum that rotates around the
 * head's X axis (like the real face-changing toy). UV v = angle around X, so scrolling
 * the texture offset is a true drum rotation. The drum has N cells, one face each.
 */
export class FaceDrum {
  static readonly N = 4;
  readonly mesh: THREE.Mesh;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tex: THREE.CanvasTexture;
  private readonly blinkCanvas: HTMLCanvasElement;
  private readonly blinkCtx: CanvasRenderingContext2D;
  private readonly blinkTex: THREE.CanvasTexture;
  private readonly mat: THREE.MeshPhysicalMaterial;
  private readonly W: number;
  private readonly H: number;
  private cellFaces: (FaceSpec | null)[] = [null, null, null, null];
  private angle = 0;
  private blinking = false;

  constructor(
    head: BlobParams,
    private ink: FaceInk,
    resolution: number,
    roughness: number,
  ) {
    const N = FaceDrum.N;
    this.W = resolution;
    this.H = Math.round(resolution * (Math.PI * 2) / N / 2);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H * N;
    this.ctx = this.canvas.getContext('2d')!;
    this.blinkCanvas = document.createElement('canvas');
    this.blinkCanvas.width = Math.round(this.W / 2);
    this.blinkCanvas.height = Math.round((this.H * N) / 2);
    this.blinkCtx = this.blinkCanvas.getContext('2d')!;

    this.tex = this.makeTex(this.canvas);
    this.blinkTex = this.makeTex(this.blinkCanvas);

    const geo = blobGeometry(head, {
      widthSegments: 56,
      heightSegments: 44,
      phiStart: Math.PI / 2 - 1.35,
      phiLength: 2.7,
      thetaStart: Math.PI / 2 - 1.2,
      thetaLength: 2.4,
    });
    // Drum UVs + edge fade (vertex alpha).
    const dir = geo.getAttribute('dir') as THREE.BufferAttribute;
    const uv = new Float32Array(dir.count * 2);
    const col = new Float32Array(dir.count * 4);
    for (let i = 0; i < dir.count; i++) {
      const dx = dir.getX(i),
        dy = dir.getY(i),
        dz = dir.getZ(i);
      const a = Math.atan2(dy, dz);
      const h = Math.asin(THREE.MathUtils.clamp(dx, -1, 1));
      uv[i * 2] = 0.5 + h / 2;
      uv[i * 2 + 1] = a / (Math.PI * 2) + 0.5;
      const fadeV = 1 - THREE.MathUtils.smoothstep(Math.abs(a), 0.78, 1.0);
      const fadeH = 1 - THREE.MathUtils.smoothstep(Math.abs(h), 1.0, 1.25);
      col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = 1;
      col[i * 4 + 3] = fadeV * fadeH;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.scale(1.003, 1.003, 1.003);

    this.mat = new THREE.MeshPhysicalMaterial({
      map: this.tex,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      roughness,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    if (ink.glow) {
      this.mat.emissive = new THREE.Color('#9ff8ff');
      this.mat.emissiveMap = this.tex;
      this.mat.emissiveIntensity = 0.9;
    }
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.name = 'face';
  }

  private makeTex(cv: HTMLCanvasElement): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  /** Index of the cell currently facing front. */
  get frontCell(): number {
    const N = FaceDrum.N;
    return ((Math.round(this.angle / ((Math.PI * 2) / N)) % N) + N) % N;
  }

  get currentAngle(): number {
    return this.angle;
  }

  setInk(ink: FaceInk): void {
    this.ink = ink;
  }

  /** Paints a face into a cell. Call `commit()` after a batch of changes. */
  setCell(k: number, face: FaceSpec): void {
    const N = FaceDrum.N;
    const cell = ((k % N) + N) % N;
    this.cellFaces[cell] = face;
    const y0 = (N - cell - 1) * this.H;
    this.ctx.clearRect(0, y0, this.W, this.H);
    drawFace(this.ctx, face, this.ink, this.W / 2, y0 + this.H / 2, this.W / 2);
  }

  commit(): void {
    this.tex.needsUpdate = true;
    this.paintBlink();
  }

  private paintBlink(): void {
    const N = FaceDrum.N;
    const cell = this.frontCell;
    const face = this.cellFaces[cell];
    const s = 0.5;
    this.blinkCtx.clearRect(0, 0, this.blinkCanvas.width, this.blinkCanvas.height);
    if (!face) return;
    const y0 = (N - cell - 1) * this.H * s;
    drawFace(this.blinkCtx, face, this.ink, (this.W * s) / 2, y0 + (this.H * s) / 2, (this.W * s) / 2, true);
    this.blinkTex.needsUpdate = true;
  }

  /** Rotates the drum to an absolute angle (radians). */
  setAngle(a: number): void {
    this.angle = a;
    const N = FaceDrum.N;
    const off = a / (Math.PI * 2) - 0.5 + 0.5 / N;
    this.tex.offset.y = off;
    this.blinkTex.offset.y = off;
  }

  cellAngle(k: number): number {
    return (k * Math.PI * 2) / FaceDrum.N;
  }

  setBlink(on: boolean): void {
    if (on === this.blinking) return;
    this.blinking = on;
    this.mat.map = on ? this.blinkTex : this.tex;
    if (this.mat.emissiveMap) this.mat.emissiveMap = this.mat.map;
  }

  /** Renders a single face as a flat image (for UI icons). */
  static faceImage(face: FaceSpec, ink: FaceInk, size = 128): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    drawFace(ctx, face, ink, size / 2, size * 0.42, size * 0.75);
    return cv;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.tex.dispose();
    this.blinkTex.dispose();
    // Release canvas memory promptly on mobile.
    this.canvas.width = this.canvas.height = 0;
    this.blinkCanvas.width = this.blinkCanvas.height = 0;
  }
}
