// Playwright smoke test: app loads, a box opens, the collection shows the new character,
// export → import round-trips, and Back/Escape navigates correctly.
// Usage: npm run build && npm run smoke   (starts its own vite preview)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4179;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});
const fail = (msg) => {
  console.error('SMOKE FAIL:', msg);
  process.exitCode = 1;
};
try {
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  // Collect the daily gift sheet that opens on launch (retry until it's gone).
  await page.waitForSelector('button:has-text("Collect!")', { timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 20 && (await page.$('#modal-root .sheet')); i++) {
    await page.click('#modal-root .sheet button.btn', { timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  console.log('✓ app loaded');

  await page.click('#tabbar [data-tab=box]');
  await page.click('text=Open a box');
  await page.mouse.click(200, 450);
  await page.waitForTimeout(100);
  await page.mouse.click(200, 450);
  await page.waitForSelector('.reveal', { timeout: 15000 });
  const name = (await page.textContent('.reveal .name'))?.trim();
  if (!name) fail('no name on reveal');
  console.log('✓ box opened:', name);

  await page.click('#tabbar [data-tab=book]');
  await page.waitForSelector('.tile', { timeout: 10000 });
  const tiles = await page.$$('.tile');
  if (tiles.length !== 1) fail(`expected 1 tile, got ${tiles.length}`);
  await page.waitForSelector('.tile img', { timeout: 30000 });
  await page.click('.tile');
  await page.waitForSelector('.screen .topbar h1');
  const detailName = (await page.textContent('.topbar h1'))?.trim();
  if (detailName !== name) fail(`detail shows "${detailName}", expected "${name}"`);
  console.log('✓ collection shows the new character');

  await page.keyboard.press('Escape');
  await page.waitForSelector('.tile');
  console.log('✓ back returns to the book');

  // Export.
  await page.click('#tabbar [data-tab=more]');
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text=Export save file'),
  ]);
  const dir = mkdtempSync(join(tmpdir(), 'sb-'));
  const file = join(dir, 'save.json');
  await dl.saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  if (exported.save.collection.length !== 1) fail('export missing character');
  console.log('✓ export');

  // Reset, then import.
  await page.click('text=Reset everything');
  await page.click('text=Delete everything');
  await page.waitForTimeout(500);
  await page.click('#tabbar [data-tab=more]');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('text=Import save file'),
  ]);
  await chooser.setFiles(file);
  await page.click('button:has-text("Replace")');
  await page.waitForTimeout(500);
  const count = await page.evaluate(() => window.__app.game.save.collection.length);
  if (count !== 1) fail(`import restored ${count} characters`);
  console.log('✓ import');

  if (errors.length) fail('page errors:\n' + errors.join('\n'));
  await browser.close();
} finally {
  server.kill();
}
if (!process.exitCode) console.log('SMOKE OK');
