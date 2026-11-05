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

  constructor(private stage: Stage) {
    this.effects = new EffectRunner(stage.world);
  }

  attach(): void {
    if (this.unsub) return;
    this.unsub = this.stage.onFrame((dt, t) => {
      this.rig?.update(dt, t);
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
    return this.rig?.isSpinning() ?? false;
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
