import * as THREE from 'three';
import type { CharacterSpec } from '../gen/types';
import { buildCharacter, type CharacterRig } from '../render/character';
import { buildBackdrop } from '../render/scenes';
import { EffectRunner, poof } from '../render/effects';
import type { Stage } from '../render/stage';
import { rarityRank } from '../gen/rarity';
import { Aura } from '../render/aura';

/**
 * Shows one character in its scene on the shared stage. Handles framing around UI insets,
 * the per-frame update, effects and clean disposal (no leaks across re-rolls).
 */
export interface SwapOptions {
  /** Called on every quarter turn (slot-reel ticks). */
  onTick?: () => void;
  /** Called when the old buddy vanishes in the poof. */
  onPoof?: () => void;
  /** Called when the new buddy's face drum lands. */
  onLand?: () => void;
  /** Face shown on the new buddy before its drum rolls to the real face. */
  startFace?: CharacterSpec['face'];
}

const OUT_S = 0.42;
const IN_S = 0.75;

export class CharacterView {
  rig: CharacterRig | null = null;
  private sceneId = '';
  private unsub: (() => void) | null = null;
  readonly effects: EffectRunner;
  private insets = { top: 140, bottom: 240 };
  private scaleIn = -1;
  private extra: ((dt: number, t: number) => void)[] = [];
  bloom = true;
  private aura: Aura | null = null;
  private swap: null | {
    phase: 'out' | 'in';
    t: number;
    spec: CharacterSpec;
    lastQuarter: number;
    opts: SwapOptions;
    resolve: () => void;
  } = null;

  constructor(private stage: Stage) {
    this.effects = new EffectRunner(stage.world);
  }

  attach(): void {
    if (this.unsub) return;
    this.unsub = this.stage.onFrame((dt, t) => {
      this.rig?.update(dt, t);
      if (this.swap) this.stepSwap(dt);
      if (this.scaleIn >= 0 && this.rig) {
        this.scaleIn += dt;
        const k = Math.min(1, this.scaleIn / 0.45);
        const s = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 7) : 1;
        this.rig.root.scale.setScalar(Math.max(0.01, s));
        if (k >= 1) this.scaleIn = -1;
      }
      // Spin propellers etc.
      this.rig?.root.traverse((o) => {
        if (o.name === 'spinner') o.rotation.y += dt * 9;
      });
      this.effects.update(dt);
      this.aura?.update(dt);
      for (const f of this.extra) f(dt, t);
    });
  }

  /** Extra per-frame callback owned by this view (cleared on detach). */
  onFrame(f: (dt: number, t: number) => void): void {
    this.extra.push(f);
  }

  detach(): void {
    if (this.swap) {
      this.swap.resolve();
      this.swap = null;
    }
    this.unsub?.();
    this.unsub = null;
    this.extra = [];
    this.effects.clear();
    this.clear();
  }

  private fill = 0.88;

  setInsets(top: number, bottom: number, fill = 0.88): void {
    this.insets = { top, bottom };
    this.fill = fill;
    this.frame();
  }

  frame(): void {
    if (!this.rig) return;
    const H = this.rig.height;
    this.stage.frameInsets(H, 2.0, H * 0.5, this.insets.top, this.insets.bottom, this.fill);
  }

  show(spec: CharacterSpec, opts: { animateIn?: boolean; scene?: boolean } = {}): CharacterRig {
    this.attach();
    if (this.rig) {
      this.rig.dispose();
      this.rig = null;
    }
    const wantScene = opts.scene === false ? 'studio' : spec.scene;
    if (wantScene !== this.sceneId) {
      this.stage.setBackdrop(buildBackdrop(wantScene));
      this.sceneId = wantScene;
    }
    const rig = buildCharacter(spec, { quality: this.stage.quality });
    this.stage.turntable.add(rig.root);
    this.rig = rig;
    this.stage.setShadow(true);
    this.aura?.dispose();
    this.aura = null;
    if (this.bloom && rarityRank(spec.rarity) >= 2) {
      this.aura = new Aura(spec.rarity, rig.height);
      this.stage.turntable.add(this.aura.group);
    }
    this.frame();
    if (opts.animateIn) {
      rig.root.scale.setScalar(0.01);
      this.scaleIn = 0;
    }
    return rig;
  }

  get busy(): boolean {
    return this.swap !== null || (this.rig?.isSpinning() ?? false);
  }

  /**
   * Everything re-roll, slot-machine style: the old buddy twirls faster and shrinks into a
   * poof, the new one spins in (decelerating, with ticks), bounces, and its face drum
   * rolls into place.
   */
  swapWithSpin(spec: CharacterSpec, opts: SwapOptions = {}): Promise<void> {
    if (this.swap || !this.rig) {
      this.swapWithPoof(spec);
      return Promise.resolve();
    }
    this.scaleIn = -1;
    return new Promise((resolve) => {
      this.swap = { phase: 'out', t: 0, spec, lastQuarter: 0, opts, resolve };
    });
  }

  private stepSwap(dt: number): void {
    const sw = this.swap!;
    const rig = this.rig;
    if (!rig) return;
    sw.t += dt;
    const root = rig.root;
    if (sw.phase === 'out') {
      const k = Math.min(1, sw.t / OUT_S);
      const angle = k * k * Math.PI * 3; // accelerating twirl
      root.rotation.y = angle;
      root.scale.setScalar(Math.max(0.05, 1 - 0.8 * k * k));
      root.position.y = Math.sin(k * Math.PI) * 0.25;
      this.quarterTicks(angle);
      if (k >= 1) {
        const at = new THREE.Vector3(0, rig.height * 0.5, 0.2);
        this.effects.add(poof(at, '#ffffff', 70, 1.1));
        this.effects.add(poof(at, '#ffe1d6', 30, 0.8));
        sw.opts.onPoof?.();
        const next = this.show(sw.spec);
        if (sw.opts.startFace) next.setFaceInstant(sw.opts.startFace);
        next.root.scale.setScalar(0.2);
        next.root.rotation.y = -Math.PI * 2.5;
        sw.phase = 'in';
        sw.t = 0;
        sw.lastQuarter = Math.floor(next.root.rotation.y / (Math.PI / 2));
      }
      return;
    }
    const k = Math.min(1, sw.t / IN_S);
    const e = 1 - Math.pow(1 - k, 3); // decelerating, like a slot reel
    const angle = -Math.PI * 2.5 * (1 - e);
    root.rotation.y = angle;
    const back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // easeOutBack
    root.scale.setScalar(Math.max(0.05, 0.2 + 0.8 * back));
    root.position.y = 0;
    this.quarterTicks(angle);
    if (k >= 1) {
      root.rotation.y = 0;
      root.scale.setScalar(1);
      this.swap = null;
      rig.hop(0.7);
      void rig.spinFace(sw.spec.face, {
        direction: 1,
        fillers: [],
        durationMs: 900,
        onTick: sw.opts.onTick,
        onLand: sw.opts.onLand,
      });
      sw.resolve();
    }
  }

  private quarterTicks(angle: number): void {
    const sw = this.swap!;
    const q = Math.floor(angle / (Math.PI / 2));
    if (q !== sw.lastQuarter) {
      sw.lastQuarter = q;
      sw.opts.onTick?.();
    }
  }

  /** Full re-roll with a poof transition. */
  swapWithPoof(spec: CharacterSpec): CharacterRig {
    const at = new THREE.Vector3(0, (this.rig?.height ?? 2) * 0.5, 0.2);
    this.effects.add(poof(at, '#ffffff', 70, 1.1));
    this.effects.add(poof(at, '#ffe1d6', 30, 0.8));
    return this.show(spec, { animateIn: true });
  }

  clear(): void {
    this.rig?.dispose();
    this.rig = null;
    this.aura?.dispose();
    this.aura = null;
  }

  /** Forget the current backdrop so the next show() rebuilds it. */
  resetScene(): void {
    this.sceneId = '';
  }
}
