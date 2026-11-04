import { Stage } from './render/stage';
import { Thumbnailer } from './render/thumbnails';
import { generateCharacter } from './gen/generate';
import { randomSeed, rngFromString } from './rng';
import { RARITY_INFO } from './gen/rarity';
import { MASCOT } from './gen/mascot';
import { PARTS } from './gen/parts';
import { applyRules } from './gen/rules';
import type { CharacterSpec, Layer } from './gen/types';

/** Dev-only pages: ?dev=sheet&n=24&v=1&key=abc renders a contact sheet of random characters. */
export function runDev(mode: string, params: URLSearchParams): void {
  if (mode === 'parts') return partsSheet(params);
  if (mode !== 'sheet') return;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:400px';
  document.body.appendChild(canvas);
  const stage = new Stage(canvas);
  const thumbs = new Thumbnailer(stage);
  const n = Number(params.get('n') ?? 24);
  const v = Number(params.get('v') ?? 1);
  const rng = rngFromString(params.get('key') ?? 'sheet');
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px;background:#222;font:11px system-ui;color:#fff';
  document.getElementById('app')!.appendChild(grid);
  const forced = params.get('seeds')?.split(',');
  for (let i = 0; i < n; i++) {
    const seed = forced?.[i] ?? randomSeed(rng);
    const spec = generateCharacter(seed, v);
    const cell = document.createElement('div');
    const img = new Image();
    img.src = thumbs.render(spec, 256);
    img.style.cssText = 'width:100%;display:block;border-radius:8px';
    const info = RARITY_INFO[spec.rarity];
    cell.innerHTML = `<div style="padding:2px 0">${spec.name} · <b style="color:${info.color === 'rainbow' ? '#ff7ad9' : info.color}">${info.label}</b><br>${seed} ${spec.body}/${spec.head}/${spec.ears}/${spec.hat}/${spec.outfit}/${spec.accessory}</div>`;
    cell.prepend(img);
    grid.appendChild(cell);
  }
  thumbs.dispose();
  (window as unknown as { __ready: boolean }).__ready = true;
}

/** ?dev=parts&layer=hat — every part of one layer on the mascot (look-review). */
function partsSheet(params: URLSearchParams): void {
  const layer = (params.get('layer') ?? 'hat') as Layer;
  const v = Number(params.get('v') ?? 2);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:400px';
  document.body.appendChild(canvas);
  const stage = new Stage(canvas);
  const thumbs = new Thumbnailer(stage);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px;background:#222;font:12px system-ui;color:#fff';
  document.getElementById('app')!.appendChild(grid);
  for (const p of PARTS[layer].filter((x) => x.since <= v)) {
    const spec: CharacterSpec = JSON.parse(JSON.stringify(MASCOT));
    spec.scene = 'studio';
    if (layer === 'eyes' || layer === 'brows' || layer === 'mouth' || layer === 'nose' || layer === 'cheeks') spec.face[layer] = p.id;
    else (spec as unknown as Record<string, string>)[layer] = p.id;
    if (layer === 'ears') spec.hat = 'none';
    if (layer !== 'outfit' && layer !== 'ears') spec.outfit = 'none';
    applyRules(spec);
    const cell = document.createElement('div');
    const img = new Image();
    img.src = thumbs.render(spec, 256, layer === 'scene');
    img.style.cssText = 'width:100%;display:block;border-radius:8px';
    cell.append(img, Object.assign(document.createElement('div'), { textContent: `${p.id} (v${p.since})` }));
    grid.appendChild(cell);
  }
  thumbs.dispose();
  (window as unknown as { __ready: boolean }).__ready = true;
}
