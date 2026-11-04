// Performance checks on the built app (needs vite preview on :4173):
// 200 re-rolls keep GPU memory flat; triangle budget < 50k per frame.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const page = await browser.newPage({ viewport: { width: 300, height: 600 } });
page.on('pageerror', (e) => console.log('ERR', String(e)));
await page.goto('http://localhost:4173/?dev=leak&n=200');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
const r = await page.evaluate(() => window.__result);
console.log(JSON.stringify(r, null, 1));
const first = r.samples.find((s) => s.i === 20);
const last = r.samples[r.samples.length - 1];
let ok = true;
if (last.geometries > first.geometries + 40) { console.log('FAIL geometries grew', first.geometries, '→', last.geometries); ok = false; }
if (last.textures > first.textures + 6) { console.log('FAIL textures grew', first.textures, '→', last.textures); ok = false; }
if (r.maxTris > 50000) { console.log('FAIL triangles', r.maxTris, 'seed', r.maxTrisSeed); ok = false; }
console.log(ok ? 'PERF OK' : 'PERF FAIL');
process.exitCode = ok ? 0 : 1;
await browser.close();
