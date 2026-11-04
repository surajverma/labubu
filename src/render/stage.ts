import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { TUNABLES } from '../config';
import type { Quality } from './character';

export interface Backdrop {
  group: THREE.Group;
  skyTop: string;
  skyBottom: string;
  /** Light tint multipliers. */
  light?: { hemiSky?: string; hemiGround?: string; key?: string; keyIntensity?: number; rim?: string; ambient?: number };
  fog?: { color: string; near: number; far: number };
  update?(t: number, dt: number): void;
  dispose(): void;
}

export interface GestureHandlers {
  /** Vertical swipe on the character: +1 up, -1 down. */
  onSwipe?(dir: 1 | -1): void;
  onTap?(x: number, y: number): void;
  /** Return false to disable drag-rotate. */
  canRotate?(): boolean;
}

/**
 * Owns the single WebGL renderer, the camera, studio lights and the frame loop.
 * Screens borrow it: they put a backdrop + subjects into `world` and set framing.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  /** Rotated by drag gestures. Put the character in here. */
  readonly turntable = new THREE.Group();
  readonly world = new THREE.Group();
  private readonly hemi: THREE.HemisphereLight;
  private readonly key: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;
  private readonly fill: THREE.DirectionalLight;
  private readonly shadow: THREE.Mesh;
  private backdrop: Backdrop | null = null;
  private skyTex: THREE.CanvasTexture | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private bloomOn = false;
  private callbacks = new Set<(dt: number, t: number) => void>();
  private clock = new THREE.Clock();
  private running = false;
  private elapsed = 0;
  quality: Quality = 'high';

  // Framing.
  private frameHeight = 2.4;
  private frameWidth = 1.7;
  private aimY = 1.2;
  private yShift = 0;
  private zoom = 1;
  private targetZoom = 1;
  private spinVel = 0;
  private autoReturn = true;
  gestures: GestureHandlers = {};

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.setQuality('high');

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    room.dispose();
    pmrem.dispose();

    this.hemi = new THREE.HemisphereLight('#ffffff', '#d9b8a8', 0.85);
    this.key = new THREE.DirectionalLight('#fff3e6', 2.4);
    this.key.position.set(2.5, 4.5, 4.5);
    this.fill = new THREE.DirectionalLight('#dfe8ff', 0.6);
    this.fill.position.set(-4, 1.5, 3);
    this.rim = new THREE.DirectionalLight('#ffffff', 1.6);
    this.rim.position.set(-2.5, 3, -4.5);
    this.scene.add(this.hemi, this.key, this.fill, this.rim, this.world);
    this.world.add(this.turntable);

    // Soft baked contact shadow.
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(40,20,30,0.55)');
    g.addColorStop(0.45, 'rgba(40,20,30,0.28)');
    g.addColorStop(1, 'rgba(40,20,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const st = new THREE.CanvasTexture(cv);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.5),
      new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, toneMapped: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.016;
    this.shadow.renderOrder = 1;
    this.world.add(this.shadow);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindGestures();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const cap = q === 'low' ? 1 : q === 'medium' ? 1.5 : TUNABLES.maxPixelRatio;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.resize();
  }

  /** Show/hide the contact shadow under the subject. */
  setShadow(visible: boolean, scale = 1): void {
    this.shadow.visible = visible;
    this.shadow.scale.setScalar(scale);
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    this.applyFraming();
  }

  /** Frame a subject of the given size. yShift > 0 moves the subject up on screen (fraction of view). */
  frame(height: number, width: number, aimY: number, yShift = 0): void {
    this.frameHeight = height;
    this.frameWidth = width;
    this.aimY = aimY;
    this.yShift = yShift;
    this.applyFraming();
  }

  private applyFraming(): void {
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dH = (this.frameHeight / 2) / Math.tan(vfov / 2);
    const dW = (this.frameWidth / 2) / Math.tan(hfov / 2);
    const dist = Math.max(dH, dW) * this.zoom;
    const visibleH = 2 * Math.tan(vfov / 2) * dist;
    const aim = this.aimY - this.yShift * visibleH;
    this.camera.position.set(0, aim + dist * 0.14, dist);
    this.camera.lookAt(0, aim, 0);
  }

  setBackdrop(b: Backdrop | null): void {
    if (this.backdrop) {
      this.world.remove(this.backdrop.group);
      this.backdrop.dispose();
    }
    this.backdrop = b;
    if (this.skyTex) this.skyTex.dispose();
    this.skyTex = null;
    if (!b) {
      this.scene.background = new THREE.Color('#fff4ec');
      this.scene.fog = null;
      return;
    }
    this.world.add(b.group);
    this.applyBackdropLook(b);
  }

  /** Sky gradient, fog and light tints for a backdrop. */
  private applyBackdropLook(b: Backdrop, makeSky = true): void {
    if (makeSky) {
      const cv = document.createElement('canvas');
      cv.width = 4;
      cv.height = 256;
      const ctx = cv.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, b.skyTop);
      g.addColorStop(1, b.skyBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 256);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = tex;
      if (b === this.backdrop) this.skyTex = tex;
      this.scene.fog = b.fog ? new THREE.Fog(b.fog.color, b.fog.near, b.fog.far) : null;
    }
    const L = b.light ?? {};
    this.hemi.color.set(L.hemiSky ?? '#ffffff');
    this.hemi.groundColor.set(L.hemiGround ?? '#d9b8a8');
    this.hemi.intensity = (L.ambient ?? 1.1) * 0.78;
    this.key.color.set(L.key ?? '#fff3e6');
    this.key.intensity = (L.keyIntensity ?? 2.1) * 1.15;
    this.rim.color.set(L.rim ?? '#ffffff');
  }

  /** Bloom is reserved for Epic+ characters (and never on Low quality). */
  setBloom(on: boolean, strength = 0.45): void {
    on = on && this.quality !== 'low';
    this.bloomOn = on;
    if (on && !this.composer) {
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), strength, 0.6, 0.86);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) this.bloomPass.strength = strength;
  }

  onFrame(cb: (dt: number, t: number) => void): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  get isRunning(): boolean {
    return this.running;
  }

  resetView(): void {
    this.turntable.rotation.y = 0;
    this.spinVel = 0;
    this.zoom = this.targetZoom = 1;
    this.applyFraming();
  }

  private tick(): void {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;
    // Turntable inertia + gentle return to front.
    if (!this.dragging) {
      this.turntable.rotation.y += this.spinVel * dt;
      this.spinVel *= Math.pow(0.04, dt);
      if (this.autoReturn && Math.abs(this.spinVel) < 0.3) {
        const r = this.turntable.rotation.y;
        const nearest = Math.round(r / (Math.PI * 2)) * Math.PI * 2;
        this.turntable.rotation.y += (nearest - r) * Math.min(1, dt * 1.6);
      }
    }
    if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
      this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 10);
      this.applyFraming();
    }
    for (const cb of this.callbacks) cb(dt, this.elapsed);
    this.backdrop?.update?.(this.elapsed, dt);
    this.render();
  }

  render(): void {
    if (this.bloomOn && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // --- Gestures: drag to rotate, vertical flick to spin, pinch to zoom, tap. ---
  private dragging = false;
  private pointers = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
  private pinch0 = 0;
  private zoom0 = 1;
  private lastX = 0;
  private lastT = 0;
  private mode: 'none' | 'rotate' | 'swipe' | 'pinch' = 'none';

  private bindGestures(): void {
    const el = this.canvas;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch0 = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        this.zoom0 = this.targetZoom;
        this.mode = 'pinch';
      } else {
        this.mode = 'none';
        this.lastX = e.clientX;
        this.lastT = performance.now();
      }
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.mode === 'pinch' && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (this.pinch0 > 0) this.targetZoom = THREE.MathUtils.clamp(this.zoom0 * (this.pinch0 / d), 0.65, 1.35);
        return;
      }
      const dx = p.x - p.x0,
        dy = p.y - p.y0;
      if (this.mode === 'none' && Math.hypot(dx, dy) > 12) {
        this.mode = Math.abs(dy) > Math.abs(dx) * 1.2 ? 'swipe' : 'rotate';
      }
      if (this.mode === 'rotate' && (this.gestures.canRotate?.() ?? true)) {
        this.dragging = true;
        const now = performance.now();
        const ddx = e.clientX - this.lastX;
        this.turntable.rotation.y += ddx * 0.012;
        const dtm = Math.max(1, now - this.lastT);
        this.spinVel = (ddx * 0.012 * 1000) / dtm;
        this.lastX = e.clientX;
        this.lastT = now;
      }
    });
    const end = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!p) return;
      const dx = p.x - p.x0,
        dy = p.y - p.y0;
      const dtm = performance.now() - p.t0;
      if (this.mode === 'swipe' && Math.abs(dy) > 30) {
        this.gestures.onSwipe?.(dy < 0 ? 1 : -1);
      } else if (this.mode === 'none' && Math.hypot(dx, dy) < 12 && dtm < 400) {
        this.gestures.onTap?.(p.x, p.y);
      }
      if (this.pointers.size === 0) {
        this.dragging = false;
        this.mode = 'none';
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /**
   * Temporarily swaps in other content (for thumbnails/share cards), runs `fn`, then
   * restores everything. Nothing is shown on screen because it all happens in one task.
   */
  withContent<T>(backdrop: Backdrop | null, subject: THREE.Object3D, framing: [number, number, number, number], fn: () => T): T {
    const prevBackdrop = this.backdrop;
    const prevChildren = [...this.turntable.children];
    const prevFrame: [number, number, number, number] = [this.frameHeight, this.frameWidth, this.aimY, this.yShift];
    const prevRot = this.turntable.rotation.y;
    const prevZoom = this.zoom;
    const prevBloom = this.bloomOn;
    const prevBg = this.scene.background;
    const prevFog = this.scene.fog;
    prevChildren.forEach((c) => this.turntable.remove(c));
    if (prevBackdrop) this.world.remove(prevBackdrop.group);
    this.backdrop = null;
    this.bloomOn = false;
    if (backdrop) this.applyBackdropLook(backdrop);
    else {
      this.scene.background = new THREE.Color('#fff4ec');
      this.scene.fog = null;
    }
    if (backdrop) this.world.add(backdrop.group);
    this.turntable.add(subject);
    this.turntable.rotation.y = 0;
    this.zoom = 1;
    this.frameHeight = framing[0];
    this.frameWidth = framing[1];
    this.aimY = framing[2];
    this.yShift = framing[3];
    try {
      return fn();
    } finally {
      this.turntable.remove(subject);
      if (backdrop) this.world.remove(backdrop.group);
      const tmpBg = this.scene.background;
      if (tmpBg instanceof THREE.Texture && tmpBg !== prevBg) tmpBg.dispose();
      prevChildren.forEach((c) => this.turntable.add(c));
      this.backdrop = prevBackdrop;
      if (prevBackdrop) {
        this.world.add(prevBackdrop.group);
        this.applyBackdropLook(prevBackdrop, false);
      }
      this.scene.background = prevBg;
      this.scene.fog = prevFog;
      this.turntable.rotation.y = prevRot;
      this.zoom = prevZoom;
      this.bloomOn = prevBloom;
      [this.frameHeight, this.frameWidth, this.aimY, this.yShift] = prevFrame;
      this.applyFraming();
    }
  }

  /**
   * Renders the current scene into an image of the given size. Renders straight to the
   * canvas and copies it in the same task (so tone mapping matches the live view and the
   * resize is never shown on screen).
   */
  snapshotCanvas(width: number, height: number): HTMLCanvasElement {
    const pr = this.renderer.getPixelRatio();
    const w0 = this.canvas.clientWidth || window.innerWidth;
    const h0 = this.canvas.clientHeight || window.innerHeight;
    const oldAspect = this.camera.aspect;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.applyFraming();
    this.render();
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    cv.getContext('2d')!.drawImage(this.canvas, 0, 0, width, height);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w0, h0, false);
    this.camera.aspect = oldAspect;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w0, h0);
    this.applyFraming();
    this.render();
    return cv;
  }

  snapshot(width: number, height: number, type = 'image/webp'): string {
    return this.snapshotCanvas(width, height).toDataURL(type, 0.86);
  }
}
