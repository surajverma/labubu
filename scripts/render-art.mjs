// Renders mascot art (transparent PNGs) used by scripts/make-icons.py. Needs vite preview on :4173.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const shot of ['bust', 'full']) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.goto(`http://localhost:4173/?dev=icon&shot=${shot}`);
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `art/mascot-${shot}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
