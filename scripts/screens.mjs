// Drives the built app (vite preview on :4173) and saves screenshots.
// Usage: node scripts/screens.mjs [outDir] [prefix]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'docs/screens';
const prefix = process.argv[3] ?? 'app';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = async (name, wait = 600) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${prefix}-${name}.png` }); console.log('shot', name); };
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForSelector('button:has-text("Collect!")', { timeout: 4000 }).then((b) => b.click()).catch(() => {});
await page.waitForTimeout(400);
await shot('home', 1500);
await page.click('#tabbar [data-tab=box]');
await shot('box', 1200);
await page.click('text=Open a box');
await shot('box-shaking', 700);
await page.waitForSelector('.reveal', { timeout: 15000 });
await shot('box-reveal', 1500);
// Open a few more for the book.
for (let i = 0; i < 5; i++) {
  await page.click('text=/Open another/');
  await page.waitForTimeout(300);
  await page.mouse.click(200, 450); // skip
  await page.waitForTimeout(100);
  await page.mouse.click(200, 450);
  await page.waitForSelector('.reveal', { timeout: 15000 });
}
await page.click('#tabbar [data-tab=book]');
await page.waitForTimeout(800);
await page.waitForFunction(() => document.querySelectorAll('.tile img').length >= 3, null, { timeout: 30000 }).catch(() => {});
await shot('collection', 800);
await page.click('.tile');
await shot('detail', 1500);
await page.click('[aria-label=Back]');
await page.click('text=Sets');
await shot('sets', 500);
await page.click('#tabbar [data-tab=home]');
await shot('home-after', 1500);
await page.click('#tabbar [data-tab=more]');
await shot('settings', 500);
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
await browser.close();
