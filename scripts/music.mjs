// Renders every music mood offline and reports loudness; writes WAVs (as MP3-free 16-bit
// PCM) to the folder given as the first argument (default: no files).
// Usage: npm run build && node scripts/music.mjs [outDir]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4183;
const outDir = process.argv[2];
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});
try {
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`http://localhost:${PORT}/?dev=music`);
  await page.waitForFunction(() => window.__music, null, { timeout: 180000 });
  const res = await page.evaluate(() => window.__music);
  if (outDir) mkdirSync(outDir, { recursive: true });
  for (const [id, r] of Object.entries(res)) {
    const db = (20 * Math.log10(r.rms)).toFixed(1);
    console.log(`${id.padEnd(8)} peak ${r.peak.toFixed(2)}  rms ${db} dB  ${r.secs.toFixed(1)}s`);
    if (r.peak > 0.99) process.exitCode = 1;
    if (outDir) writeFileSync(join(outDir, `music-${id}.wav`), Buffer.from(r.wav, 'base64'));
  }
  await browser.close();
} finally {
  server.kill();
}
