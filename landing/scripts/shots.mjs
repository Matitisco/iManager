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

/** Un cuadro por estado del recorrido desktop (mitad de cada rango de `STATES`). */
const DESKTOP = [0.03, 0.14, 0.26, 0.4, 0.52, 0.65, 0.78, 0.97];
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
  if (name === 'iphone') {
    await page.evaluate(() => document.getElementById('mcards').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.evaluate(() => {
      const t = document.querySelector('.track');
      t.scrollTo({ left: t.children[1].offsetLeft - 20, behavior: 'instant' });
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${prefix}iphone-cards.png` });
  }
  // Página completa: el hero se colapsa a su primer cuadro (si no, son 5 pantallas de scroll fijo en blanco).
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 60));
    }
    await Promise.all([...document.images].map((i) => i.decode().catch(() => null)));
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.addStyleTag({ content: '.hero{height:auto!important}.hero .stick{position:relative!important}.nav{position:absolute!important}' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${prefix}${name}-full.png`, fullPage: true });
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
