import type { CharacterSpec } from '../gen/types';
import { buildCharacter } from './character';
import { buildBackdrop } from './scenes';
import type { Backdrop, Stage } from './stage';

/** Framing used for character portraits: [height, width, aimY, yShift]. */
export function portraitFraming(height: number): [number, number, number, number] {
  return [height * 1.32, 2.0, height * 0.47, 0];
}

/**
 * Renders character thumbnails with the shared stage. Backdrops are cached per scene id for
 * a batch; call `dispose()` when the batch is done.
 */
export class Thumbnailer {
  private backdrops = new Map<string, Backdrop>();
  constructor(private stage: Stage) {}

  render(spec: CharacterSpec, size: number, withScene = true): string {
    const rig = buildCharacter(spec, { quality: 'medium', faceRes: 512 });
    rig.update(0, 0.6);
    let bd: Backdrop | null = null;
    if (withScene) {
      bd = this.backdrops.get(spec.scene) ?? null;
      if (!bd) {
        bd = buildBackdrop(spec.scene);
        this.backdrops.set(spec.scene, bd);
      }
    }
    try {
      return this.stage.withContent(bd, rig.root, portraitFraming(rig.height), () =>
        this.stage.snapshot(size, size),
      );
    } finally {
      rig.dispose();
    }
  }

  dispose(): void {
    for (const b of this.backdrops.values()) b.dispose();
    this.backdrops.clear();
  }
}
