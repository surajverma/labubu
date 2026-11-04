// Captures 8 phone screenshots (2x) and frames them for the Play Store (1080×1920).
// Needs vite preview on :4173. Output: store/screenshots/*.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = 'store/screenshots';
mkdirSync(`${OUT}/raw`, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('ERR', String(e)));
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => window.__ready === true);
await page.waitForSelector('button:has-text("Collect!")', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/raw/7-daily.png` });
for (let i = 0; i < 20 && (await page.$('#modal-root .sheet')); i++) {
  await page.click('#modal-root .sheet button.btn', { timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(300);
}
// A nice collection to show.
await page.evaluate(() => {
  const g = window.__app.game;
  g.save.coins = 640;
  for (let i = 0; i < 14; i++) g.openBox(i % 3 ? 'normal' : 'premium', Math.random, { paid: true });
  g.save.orders.best = { L01: 3, L02: 3, L03: 2, L04: 3, L05: 1, L06: 2 };
  g.save.orders.tutorialDone = true;
  g.changed('box');
});
await page.waitForTimeout(6000); // let reward toasts finish
const settle = (ms = 2500) => page.waitForTimeout(ms);
const shot = async (n) => {
  await page.evaluate(() => window.__app.clearToasts());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/raw/${n}.png` });
};
await page.evaluate(() => window.__app.go('home'));
await settle(4000);
await shot('1-home');
await page.evaluate(() => window.__app.go('box', { kind: 'premium', paid: true }));
await settle(1500);
await page.click('text=Open it!');
await page.waitForTimeout(300);
await page.mouse.click(200, 450);
await page.waitForTimeout(100);
await page.mouse.click(200, 450);
await page.waitForSelector('.reveal');
await settle(4000);
await shot('2-reveal');
await page.evaluate(() => window.__app.go('collection'));
await page
  .waitForFunction(() => document.querySelectorAll('.tile img').length >= 9, null, {
    timeout: 60000,
  })
  .catch(() => {});
await settle(1500);
await shot('3-book');
await page.evaluate(() => {
  const g = window.__app.game;
  const best = [...g.save.collection].sort((a, b) => b.count - a.count)[0];
  window.__app.push('detail', { uid: g.save.collection[g.save.collection.length - 1].uid });
});
await settle(4000);
await shot('4-detail');
await page.evaluate(() => window.__app.go('orders'));
await settle(1500);
await shot('5-orders');
await page.evaluate(() => window.__app.push('order', { level: 'L04' }));
await settle(2500);
await page.click('button:has-text("Spin")');
await settle(9000);
await shot('6-order');
await page.evaluate(() => window.__app.push('profile'));
await settle(4000);
await shot('8-profile');
await browser.close();

// --- Frame them ---
const captions = {
  '1-home': ['Spin the face!', 'Swipe or shake to change expressions'],
  '2-reveal': ['Open blind boxes', 'Every buddy is a surprise'],
  '3-book': ['Fill your book', 'Thousands of buddies to collect'],
  '4-detail': ['Chunky 3D toys', 'Spin them, name them, share them'],
  '5-orders': ['Take orders', '30 levels on 3 streets + a daily order'],
  '6-order': ['Lock & spin', 'Build exactly what customers want'],
  '7-daily': ['Daily gifts', 'Free boxes and streak rewards'],
  '8-profile': ['Earn badges', 'Complete sets and achievements'],
};
const font = readFileSync(
  'node_modules/@fontsource/fredoka/files/fredoka-latin-700-normal.woff2',
).toString('base64');
const b2 = await chromium.launch();
const fp = await b2.newPage({ viewport: { width: 1080, height: 1920 } });
for (const [name, [t, s]] of Object.entries(captions)) {
  const img = readFileSync(`${OUT}/raw/${name}.png`).toString('base64');
  await fp.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: F; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 700; }
    body { margin:0; width:1080px; height:1920px; background: linear-gradient(160deg,#8f73ff 0%,#c58bff 45%,#ff9a7a 100%); font-family: F, sans-serif; overflow:hidden; }
    h1 { color:#fff; font-size:84px; text-align:center; margin:110px 40px 10px; text-shadow:0 4px 0 rgba(60,20,80,.25); }
    p { color:#fff; opacity:.92; font-size:44px; text-align:center; margin:0 40px; }
    .phone { position:absolute; left:50%; top:420px; transform:translateX(-50%); width:700px; height:1554px; background:#1d1525; border-radius:84px; padding:22px; box-shadow:0 40px 80px rgba(40,10,60,.35); }
    .phone img { width:100%; height:100%; border-radius:64px; display:block; object-fit:cover; object-position:top; }
  </style></head><body><h1>${t}</h1><p>${s}</p><div class="phone"><img src="data:image/png;base64,${img}"></div></body></html>`);
  await fp.evaluate(() => document.fonts.ready);
  await fp.waitForTimeout(200);
  await fp.screenshot({ path: `${OUT}/${name}.png` });
  console.log('framed', name);
}
await b2.close();
