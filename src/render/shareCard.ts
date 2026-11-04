import { APP } from '../config';
import type { CharacterSpec } from '../gen/types';
import { RARITY_INFO } from '../gen/rarity';
import { buildCharacter } from './character';
import { buildBackdrop } from './scenes';
import type { Stage } from './stage';

const W = 1080;
const H = 1350;

function rr(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** A share card: the buddy in its scene + name, rarity badge, seed code and app name. */
export function makeShareCard(stage: Stage, spec: CharacterSpec, name: string): HTMLCanvasElement {
  const rig = buildCharacter(spec, { quality: 'high' });
  rig.update(0, 0.6);
  const bd = buildBackdrop(spec.scene);
  let shot: HTMLCanvasElement;
  try {
    shot = stage.withContent(bd, rig.root, [rig.height * 1.25, 2.1, rig.height * 0.5, 0], () =>
      stage.snapshotCanvas(W, W),
    );
  } finally {
    rig.dispose();
    bd.dispose();
  }
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fff4ec';
  c.fillRect(0, 0, W, H);
  // Photo with rounded corners.
  c.save();
  rr(c, 40, 40, W - 80, W - 80, 56);
  c.clip();
  c.drawImage(shot, 40, 40, W - 80, W - 80);
  c.restore();
  // Rarity badge (icon + label, never colour alone).
  const info = RARITY_INFO[spec.rarity];
  const label = `${info.icon} ${info.label}`;
  c.font = '700 44px Fredoka, system-ui, sans-serif';
  const bw = c.measureText(label).width + 56;
  if (spec.rarity === 'secret') {
    const g = c.createLinearGradient(70, 0, 70 + bw, 0);
    ['#ff6b6b', '#ffc93c', '#5fd068', '#4aa8ff', '#b56bff'].forEach((col, i) =>
      g.addColorStop(i / 4, col),
    );
    c.fillStyle = g;
  } else c.fillStyle = info.color;
  rr(c, 70, 70, bw, 72, 36);
  c.fill();
  c.fillStyle = spec.rarity === 'legendary' ? '#4a3300' : '#ffffff';
  c.textBaseline = 'middle';
  c.fillText(label, 98, 108);
  // Name + seed + app.
  c.fillStyle = '#3a2430';
  c.textAlign = 'left';
  c.font = '700 76px Fredoka, system-ui, sans-serif';
  c.fillText(name.length > 20 ? name.slice(0, 19) + '…' : name, 70, W + 40);
  c.font = '600 40px ui-monospace, Menlo, monospace';
  c.fillStyle = '#7a6470';
  c.fillText(`Seed ${spec.seed}`, 70, W + 130);
  c.textAlign = 'right';
  c.font = '700 48px Fredoka, system-ui, sans-serif';
  c.fillStyle = '#3a2430';
  c.fillText('Spin', W - 70 - c.measureText('Buddies').width, W + 130);
  c.fillStyle = '#ff7a59';
  c.fillText(APP.name.replace('Spin', ''), W - 70, W + 130);
  return cv;
}
