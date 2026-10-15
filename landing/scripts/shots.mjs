// Capturas del hero en varias posiciones de scroll (desktop 1440 / iPhone 390) y de la página con «reducir movimiento».
// Uso: npm run build && npm run preview  (en otra terminal)  →  CHROME_PATH=/ruta/a/chrome npm run shots
// BROWSER=webkit usa el WebKit de Playwright (motor de Safari; `npx playwright-core install webkit`).
import { mkdirSync } from 'node:fs';
import { chromium, webkit } from 'playwright-core';

const URL = process.env.LANDING_URL || 'http://localhost:4180/';
const OUT = process.env.SHOTS_DIR || 'shots';
const useWebkit = process.env.BROWSER === 'webkit';
const executablePath = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const prefix = useWebkit ? 'webkit-' : '';
mkdirSync(OUT, { recursive: true });

const DESKTOP = [0.05, 0.15, 0.25, 0.36, 0.48, 0.6, 0.72, 0.84, 0.99];
const MOBILE = [0, 0.3, 0.5, 0.75, 1];

const scrollHero = (page, p) =>
  page.evaluate((p) => {
    const hero = document.getElementById('hero');
    const total = hero.offsetHeight - hero.querySelector('.stick').offsetHeight;
    window.scrollTo({ top: hero.offsetTop + p * total, behavior: 'instant' });
  }, p);

const browser = useWebkit ? await webkit.launch() : await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const modes = [
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, DESKTOP],
  ['iphone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, MOBILE],
];
for (const [name, ctx, frames] of modes) {
  const context = await browser.newContext(ctx);
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  for (const [i, p] of frames.entries()) {
    await scrollHero(page, p);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${prefix}${name}-hero-${String(i + 1).padStart(2, '0')}-p${Math.round(p * 100)}.png` });
  }
  await context.close();

  const reduced = await browser.newContext({ ...ctx, reducedMotion: 'reduce' });
  const rp = await reduced.newPage();
  await rp.goto(URL, { waitUntil: 'networkidle' });
  await rp.evaluate(() => document.fonts.ready);
  await rp.evaluate(async () => {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  await rp.waitForTimeout(500);
  await rp.screenshot({ path: `${OUT}/${prefix}${name}-reduced-motion-hero.png` });
  await rp.addStyleTag({ content: '.nav{position:absolute!important}' });
  await rp.screenshot({ path: `${OUT}/${prefix}${name}-full-reduced-motion.png`, fullPage: true });
  await reduced.close();
}
await browser.close();
console.log('ok →', OUT);
