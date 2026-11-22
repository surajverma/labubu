import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Stage } from './render/stage';
import { buildCharacter } from './render/character';
import { CharacterView } from './ui/charView';
import { buildBackdrop } from './render/scenes';
import { getPool } from './game/series';
import { APP } from './config';
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
  if (mode === 'feature') return void featureGraphic();
  if (mode === 'moves') return movesSheet();
  if (mode === 'music') return void musicLab();
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
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px;background:#222;font:11px system-ui;color:#fff';
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
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px;background:#222;font:12px system-ui;color:#fff';
  document.getElementById('app')!.appendChild(grid);
  for (const p of PARTS[layer].filter((x) => x.since <= v)) {
    const spec: CharacterSpec = JSON.parse(JSON.stringify(MASCOT));
    spec.scene = 'studio';
    if (
      layer === 'eyes' ||
      layer === 'brows' ||
      layer === 'mouth' ||
      layer === 'nose' ||
      layer === 'cheeks'
    )
      spec.face[layer] = p.id;
    else (spec as unknown as Record<string, string>)[layer] = p.id;
    if (layer === 'ears') spec.hat = 'none';
    if (layer !== 'outfit' && layer !== 'ears') spec.outfit = 'none';
    applyRules(spec);
    const cell = document.createElement('div');
    const img = new Image();
    img.src = thumbs.render(spec, 256, layer === 'scene');
    img.style.cssText = 'width:100%;display:block;border-radius:8px';
    cell.append(
      img,
      Object.assign(document.createElement('div'), { textContent: `${p.id} (v${p.since})` }),
    );
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
  const r = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
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
  for (const l of ['eyes', 'mouth', 'brows', 'nose', 'cheeks'] as const) {
    const v = params.get(l);
    if (v) spec.face[l] = v;
  }
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
  const heap = () =>
    (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
  const samples: { i: number; geometries: number; textures: number; heapMB: number }[] = [];
  let maxTris = 0;
  let maxShadowFrame = 0;
  let maxTrisSeed = '';
  for (let i = 0; i < n; i++) {
    const spec = generateCharacter(randomSeed(rng), Number(params.get('v') ?? 2));
    view.swapWithPoof(spec);
    // A few frames so effects and disposal run.
    view.effects.update(0.5);
    view.effects.update(0.5);
    // Every 4th re-roll also refreshes the shadow map (as the live loop does every 3rd frame).
    const withShadow = i % 4 === 0 && stage.renderer.shadowMap.enabled;
    if (withShadow) stage.renderer.shadowMap.needsUpdate = true;
    stage.render();
    if (withShadow) maxShadowFrame = Math.max(maxShadowFrame, info.render.triangles);
    if (!withShadow && info.render.triangles > maxTris) {
      maxTris = info.render.triangles;
      maxTrisSeed = spec.seed;
    }
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    if (i === 20 || i === n - 1 || i % 50 === 0) {
      gc?.();
      await new Promise((r) => setTimeout(r, 50));
      gc?.();
      samples.push({
        i,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        heapMB: Math.round(heap() / 1e5) / 10,
      });
    }
  }
  view.effects.clear();
  stage.render();
  const result = {
    samples,
    maxTris,
    maxTrisSeed,
    maxShadowFrame,
    programs: info.programs?.length ?? 0,
  };
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre style="position:fixed;top:0;left:0;background:#fff;font:12px monospace">${JSON.stringify(result, null, 1)}</pre>`,
  );
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
  const out = {
    seed,
    parts: [spec.body, spec.head, spec.ears, spec.hat, spec.outfit, spec.accessory, spec.scene],
    total,
    top: rows.slice(0, 15),
  };
  document.body.innerHTML = `<pre>${JSON.stringify(out, null, 1)}</pre>`;
  (window as unknown as { __result: unknown; __ready: boolean }).__result = out;
  (window as unknown as { __ready: boolean }).__ready = true;
}

/** ?dev=feature — Play Store feature graphic (1024×500): five buddies + title. */
async function featureGraphic(): Promise<void> {
  await Promise.all([
    document.fonts.load('700 80px Fredoka'),
    document.fonts.load('600 30px Fredoka'),
  ]);
  const W = 1024,
    H = 500;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:-9999px;width:1024px;height:500px';
  document.body.appendChild(canvas);
  const stage = new Stage(canvas);
  const pool = getPool(2);
  const picks = [
    pool.byTier.epic[3]!,
    pool.byTier.rare[7]!,
    pool.byTier.legendary[1]!,
    pool.byTier.rare[2]!,
  ];
  const group = new THREE.Group();
  const rigs = [MASCOT, ...picks.map((p) => generateCharacter(p.seed, 2))].map((spec) =>
    buildCharacter({ ...spec, scene: 'studio' }, { quality: 'high' }),
  );
  const xs = [0, -1.75, 1.75, -3.4, 3.4];
  rigs.forEach((r, i) => {
    r.update(0, 0.6 + i);
    r.root.position.set(xs[i]!, 0, i === 0 ? 0.4 : -0.4 - Math.abs(xs[i]!) * 0.15);
    r.root.rotation.y = -xs[i]! * 0.12;
    r.root.scale.setScalar(i === 0 ? 1.05 : 0.9);
    group.add(r.root);
  });
  const bd = buildBackdrop('boxroom');
  const shot = stage.withContent(bd, group, [3.0, 8.6, 1.1, -0.16], () =>
    stage.snapshotCanvas(W, H),
  );
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const c = out.getContext('2d')!;
  c.drawImage(shot, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, 170);
  g.addColorStop(0, 'rgba(255,244,236,0.95)');
  g.addColorStop(1, 'rgba(255,244,236,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, 170);
  c.textAlign = 'center';
  c.font = '700 84px Fredoka';
  c.fillStyle = '#3a2430';
  const t1 = 'Spin';
  const t2 = APP.name.replace('Spin', '');
  const w1 = c.measureText(t1).width,
    w2 = c.measureText(t2).width;
  c.textAlign = 'left';
  c.fillText(t1, W / 2 - (w1 + w2) / 2, 92);
  c.fillStyle = '#ff7a59';
  c.fillText(t2, W / 2 - (w1 + w2) / 2 + w1, 92);
  c.textAlign = 'center';
  c.font = '600 30px Fredoka';
  c.fillStyle = '#7a6470';
  c.fillText('Spin faces · Open blind boxes · Collect & swap', W / 2, 136);
  out.id = 'out';
  out.style.cssText = 'display:block';
  document.body.replaceChildren(out);
  document.body.style.margin = '0';
  (window as unknown as { __ready: boolean }).__ready = true;
}

/** ?dev=moves — every personality move and tap reaction, frozen near its peak. */
function movesSheet(): void {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:-9999px;width:400px;height:400px';
  document.body.appendChild(canvas);
  const stage = new Stage(canvas);
  const grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px;background:#222;font:12px system-ui;color:#fff';
  document.getElementById('app')!.appendChild(grid);
  const items: [string, (r: ReturnType<typeof buildCharacter>) => number][] = [
    ...(['lookAround', 'wave', 'yawn', 'stretch', 'dance', 'shy', 'nod', 'bounce'] as const).map(
      (m) =>
        [m, (r: ReturnType<typeof buildCharacter>) => (r.perform(m), 0.42)] as [
          string,
          (r: ReturnType<typeof buildCharacter>) => number,
        ],
    ),
    ['tap: random ×4', (r) => (r.react(), 0.3)],
  ];
  const spec = { ...MASCOT, outfit: 'none' };
  for (const [label, start] of items) {
    for (let rep = 0; rep < (label.startsWith('tap') ? 4 : 1); rep++) {
      const rig = buildCharacter(spec, { quality: 'medium', faceRes: 512 });
      const frac = start(rig);
      // Advance to the chosen moment of the move.
      for (let i = 0; i < 40; i++) rig.update((frac * 2.2) / 40, 0.6 + (i * frac * 2.2) / 40);
      const url = stage.withContent(
        null,
        rig.root,
        [rig.height * 1.5, 2.6, rig.height * 0.5, 0],
        () => stage.snapshot(256, 256),
      );
      rig.dispose();
      const cell = document.createElement('div');
      const img = new Image();
      img.src = url;
      img.style.cssText = 'width:100%;display:block;border-radius:8px';
      cell.append(img, Object.assign(document.createElement('div'), { textContent: label }));
      grid.appendChild(cell);
    }
  }
  (window as unknown as { __ready: boolean }).__ready = true;
}

/**
 * ?dev=music — renders each mood offline, shows loudness numbers, and offers WAV
 * downloads. `window.__music` holds results (and base64 WAVs) for scripts.
 */
async function musicLab(): Promise<void> {
  const { MOODS } = await import('./audio/compose');
  const { renderMood } = await import('./audio/music');
  const root = document.getElementById('app')!;
  root.style.cssText = 'padding:16px;font:14px system-ui;background:#fff;overflow:auto';
  const out: Record<string, { peak: number; rms: number; secs: number; wav: string }> = {};
  for (const id of Object.keys(MOODS)) {
    const buf = await renderMood(id, 16);
    let peak = 0,
      sum = 0;
    const n = buf.length;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const a = Math.abs(d[i]!);
        if (a > peak) peak = a;
        sum += d[i]! * d[i]!;
      }
    }
    const rms = Math.sqrt(sum / (n * buf.numberOfChannels));
    const wav = toWav(buf);
    const b64 = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] ?? '');
      r.readAsDataURL(wav);
    });
    out[id] = { peak, rms, secs: buf.duration, wav: b64 };
    const row = document.createElement('div');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(wav);
    a.download = `music-${id}.wav`;
    a.textContent = `${id}: peak ${peak.toFixed(2)}, rms ${(20 * Math.log10(rms)).toFixed(1)} dB`;
    row.appendChild(a);
    root.appendChild(row);
  }
  (window as unknown as { __music: typeof out }).__music = out;
}

function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  data.setUint32(4, 36 + n * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  str(36, 'data');
  data.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c]![i]!));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  return new Blob([data], { type: 'audio/wav' });
}
