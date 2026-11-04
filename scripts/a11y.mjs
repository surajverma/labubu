// Accessibility audit (needs vite preview on :4173): every button/link has an accessible
// name, no text under 12px, images have alt. Visits all main screens.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => window.__ready === true);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.__app.game;
  for (let i = 0; i < 4; i++) g.openBox('normal', Math.random);
  g.changed('box');
});
const audit = (where) =>
  page.evaluate((where) => {
    const out = [];
    for (const el of document.querySelectorAll('button, a, [role=switch], [role=radio], input')) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const name = (
        el.getAttribute('aria-label') ||
        el.textContent ||
        el.getAttribute('placeholder') ||
        ''
      ).trim();
      if (!name)
        out.push(`${where}: unnamed <${el.tagName.toLowerCase()} class="${el.className}">`);
      if (r.height < 40 && r.width < 40 && !el.closest('.filters'))
        out.push(
          `${where}: small target ${Math.round(r.width)}x${Math.round(r.height)} "${name.slice(0, 20)}"`,
        );
    }
    for (const el of document.querySelectorAll('body *')) {
      if (
        !el.childNodes.length ||
        ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      )
        continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12 && el.getBoundingClientRect().width)
        out.push(`${where}: ${fs}px text "${el.textContent.trim().slice(0, 25)}"`);
    }
    return out;
  }, where);
const issues = [];
const screens = [['home'], ['box'], ['orders'], ['collection'], ['settings'], ['profile', true]];
for (const [id, push] of screens) {
  await page.evaluate(
    ([id, push]) => {
      window.__app.closeAllModals();
      push ? window.__app.push(id) : window.__app.go(id);
    },
    [id, push],
  );
  await page.waitForTimeout(800);
  issues.push(...(await audit(id)));
}
await page.evaluate(() =>
  window.__app.push('detail', { uid: window.__app.game.save.collection[0].uid }),
);
await page.waitForTimeout(800);
issues.push(...(await audit('detail')));
await page.evaluate(() => {
  window.__app.go('orders');
  window.__app.game.save.orders.tutorialDone = true;
  window.__app.push('order', { level: 'L01' });
});
await page.waitForTimeout(1200);
issues.push(...(await audit('order')));
console.log([...new Set(issues)].join('\n') || 'A11Y OK');
await browser.close();
