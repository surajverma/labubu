import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Stage } from './render/stage';
import { buildCharacter } from './render/character';
import { CharacterView } from './ui/charView';
import { buildBackdrop } from './render/scenes';
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
  if (mode === 'icon') return iconArt(params);
  if (mode === 'leak') return void leakTest(params);
  if (mode === 'tris') return trisReport(params);
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
    const spec = generateCharacter(seed, v, params.get('variant') ?? undefined);
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

/**
 * ?dev=icon&shot=bust|full — renders the mascot on a transparent background for the app
 * icon, splash and store art (scripts/make-icons.py composites the final images).
 */
function iconArt(params: URLSearchParams): void {
  const size = Number(params.get('size') ?? 1024);
  const shot = params.get('shot') ?? 'bust';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.style.cssText = `width:${size}px;height:${size}px;display:block`;
  document.body.style.margin = '0';
  document.body.style.background = 'transparent';
  document.documentElement.style.background = 'transparent';
  document.getElementById('app')!.appendChild(canvas);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(size, size, false);
  r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight('#ffffff', '#d9b8a8', 0.85));
  const key = new THREE.DirectionalLight('#fff3e6', 2.6);
  key.position.set(2.5, 4.5, 4.5);
  const rim = new THREE.DirectionalLight('#ffffff', 1.6);
  rim.position.set(-2.5, 3, -4.5);
  scene.add(key, rim);
  const spec = JSON.parse(JSON.stringify(MASCOT)) as CharacterSpec;
  if (shot === 'bust') spec.outfit = 'none';
  const rig = buildCharacter(spec, { quality: 'high', faceRes: 1024 });
  rig.update(0, 0.6);
  scene.add(rig.root);
  const cam = new THREE.PerspectiveCamera(shot === 'bust' ? 24 : 26, 1, 0.1, 100);
  if (shot === 'bust') {
    cam.position.set(0, rig.headY + 0.25, 6.2);
    cam.lookAt(0, rig.headY + 0.08, 0);
  } else {
    cam.position.set(0, rig.height * 0.55, 7.6);
    cam.lookAt(0, rig.height * 0.5, 0);
  }
  r.render(scene, cam);
  (window as unknown as { __ready: boolean }).__ready = true;
}

/**
 * ?dev=leak&n=200 — re-rolls N random characters (with scene changes and poof effects) and
 * reports GPU resource counts + JS heap, plus the max triangles drawn in any frame.
 * scripts/perf.mjs asserts memory stays flat and triangles stay under budget.
 */
async function leakTest(params: URLSearchParams): Promise<void> {
  const n = Number(params.get('n') ?? 200);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
  document.body.appendChild(canvas);
  const stage = new Stage(canvas);
  stage.setQuality('high');
  const view = new CharacterView(stage);
  view.attach();
  const rng = rngFromString('leak');
  const info = stage.renderer.info;
  const gc = (window as unknown as { gc?: () => void }).gc;
  const heap = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
  const samples: { i: number; geometries: number; textures: number; heapMB: number }[] = [];
  let maxTris = 0;
  let maxTrisSeed = '';
  for (let i = 0; i < n; i++) {
    const spec = generateCharacter(randomSeed(rng), Number(params.get('v') ?? 2));
    view.swapWithPoof(spec);
    // A few frames so effects and disposal run.
    view.effects.update(0.5);
    view.effects.update(0.5);
    stage.render();
    if (info.render.triangles > maxTris) {
      maxTris = info.render.triangles;
      maxTrisSeed = spec.seed;
    }
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    if (i === 20 || i === n - 1 || i % 50 === 0) {
      gc?.();
      await new Promise((r) => setTimeout(r, 50));
      gc?.();
      samples.push({ i, geometries: info.memory.geometries, textures: info.memory.textures, heapMB: Math.round(heap() / 1e5) / 10 });
    }
  }
  view.effects.clear();
  stage.render();
  const result = { samples, maxTris, maxTrisSeed, programs: info.programs?.length ?? 0 };
  document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;top:0;left:0;background:#fff;font:12px monospace">${JSON.stringify(result, null, 1)}</pre>`);
  (window as unknown as { __result: unknown; __ready: boolean }).__result = result;
  (window as unknown as { __ready: boolean }).__ready = true;
}

/** ?dev=tris&seed=XXXX-XXXX — triangle count per mesh for one character + its scene. */
function trisReport(params: URLSearchParams): void {
  const seed = params.get('seed') ?? 'NUFF-3F4N';
  const spec = generateCharacter(seed, Number(params.get('v') ?? 2));
  const rig = buildCharacter(spec, { quality: 'high' });
  const rows: [string, number][] = [];
  const count = (o: THREE.Object3D, prefix: string) =>
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry;
      const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      rows.push([`${prefix}:${mesh.name || mesh.parent?.name || g.type}`, Math.round(n)]);
    });
  count(rig.root, 'char');
  const bd = buildBackdrop(spec.scene);
  count(bd.group, 'scene');
  rows.sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, r) => a + r[1], 0);
  const out = { seed, parts: [spec.body, spec.head, spec.ears, spec.hat, spec.outfit, spec.accessory, spec.scene], total, top: rows.slice(0, 15) };
  document.body.innerHTML = `<pre>${JSON.stringify(out, null, 1)}</pre>`;
  (window as unknown as { __result: unknown; __ready: boolean }).__result = out;
  (window as unknown as { __ready: boolean }).__ready = true;
}
