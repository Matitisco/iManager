// Chequeo de layout del hero en varios tamaños: el teléfono nunca pisa el copy en mobile, no se sale
// de la pantalla, y en desktop no quedan bandas vacías arriba del copy ni antes de #problema.
// Uso: npm run build && npm run preview  (en otra terminal)  →  npm run check:layout
// BIGTEXT simula el escalado de texto del sistema en Android (~130 %). Sale con código 1 si algo falla.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL = process.env.LANDING_URL || 'http://localhost:4180/';
const OUT = process.env.SHOTS_DIR || 'shots/layout';
const executablePath = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
mkdirSync(OUT, { recursive: true });

const MOBILE = [[360, 740], [390, 844], [412, 915], [430, 932], [360, 640]];
const MOBILE_BIGTEXT = [[412, 915], [360, 740]];
const DESKTOP = [[1280, 800], [1440, 900], [1920, 1080], [1024, 1366], [980, 2000]];
const MOBILE_SHOTS = [0, 0.3, 0.5, 0.75, 1];
const DESKTOP_SHOTS = [0, 0.15, 0.36, 0.72, 0.95];
const BIGTEXT_CSS = '.cap.c-entero .t1{font-size:50px!important}.cap.c-entero p.l{font-size:21px!important}.cap .trust{font-size:17px!important}.cap .ctas .btn{font-size:18px!important}.tag{font-size:15px!important}';
const MIN_GAP = 12;
/** Bandas vacías tolerables: lo que deja el propio wireframe (≈18 % del alto a 1440×900). */
const maxBand = (h) => Math.max(160, h * 0.2);

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log('  ✗', msg);
};

const scrollHero = (page, p) =>
  page.evaluate((p) => {
    const hero = document.getElementById('hero');
    const total = hero.offsetHeight - hero.querySelector('.stick').offsetHeight;
    window.scrollTo({ top: hero.offsetTop + p * total, behavior: 'instant' });
  }, p);

const measure = (page) =>
  page.evaluate(() => {
    const shown = (e) => getComputedStyle(e).display !== 'none';
    const planes = [...document.querySelectorAll('.plane')].filter(shown).map((e) => e.getBoundingClientRect());
    const tags = [...document.querySelectorAll('.show-tags .tag')].map((e) => e.getBoundingClientRect());
    const cap = document.querySelector('.cap.on');
    const all = [...planes, ...tags];
    return {
      copyTop: cap.firstElementChild.getBoundingClientRect().top,
      copyBottom: cap.lastElementChild.getBoundingClientRect().bottom,
      copyOpacity: +getComputedStyle(document.querySelector('.copy')).opacity,
      phoneTop: Math.min(...planes.map((r) => r.top)),
      contentBottom: Math.max(...all.map((r) => r.bottom)),
      left: Math.min(...all.map((r) => r.left)),
      right: Math.max(...all.map((r) => r.right)),
      navBottom: document.querySelector('.nav').getBoundingClientRect().bottom,
      problema: document.getElementById('problema').getBoundingClientRect().top,
      vw: innerWidth,
    };
  });

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const runs = [
  ...MOBILE.map(([w, h]) => ({ w, h, mob: true })),
  ...MOBILE_BIGTEXT.map(([w, h]) => ({ w, h, mob: true, big: true })),
  ...DESKTOP.map(([w, h]) => ({ w, h, mob: false })),
];
for (const { w, h, mob, big } of runs) {
  const name = `${mob ? 'mobile' : 'desktop'}-${w}x${h}${big ? '-texto-grande' : ''}`;
  console.log(name);
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (big) await page.addStyleTag({ content: BIGTEXT_CSS });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  if (mob) {
    let worst = Infinity;
    for (let i = 0; i <= 40; i++) {
      await scrollHero(page, i / 40);
      await page.waitForTimeout(250);
      const m = await measure(page);
      if (m.copyOpacity > 0.02) worst = Math.min(worst, m.phoneTop - m.copyBottom);
      if (m.left < 0 || m.right > m.vw) fail(`${name} p=${(i / 40).toFixed(3)}: se sale de la pantalla (${Math.round(m.left)}…${Math.round(m.right)})`);
    }
    console.log(`  separación mínima teléfono↔copy visible: ${Math.round(worst)}px`);
    if (worst < MIN_GAP) fail(`${name}: el teléfono pisa el copy (${Math.round(worst)}px)`);
  }

  for (const [i, p] of (mob ? MOBILE_SHOTS : DESKTOP_SHOTS).entries()) {
    await scrollHero(page, p);
    await page.waitForTimeout(800);
    const m = await measure(page);
    if (!mob && p === 0) {
      const band = Math.min(m.copyTop, m.phoneTop) - m.navBottom;
      console.log(`  aire entre nav y contenido: ${Math.round(band)}px`);
      if (band > maxBand(h)) fail(`${name}: banda vacía arriba (${Math.round(band)}px)`);
    }
    await page.screenshot({ path: `${OUT}/${name}-${String(i + 1).padStart(2, '0')}-p${Math.round(p * 100)}.png` });
  }

  if (!mob) {
    await page.evaluate(() => {
      const pr = document.getElementById('problema');
      window.scrollTo({ top: pr.offsetTop - innerHeight * 0.6, behavior: 'instant' });
    });
    await page.waitForTimeout(800);
    const m = await measure(page);
    const gap = m.problema - Math.max(m.contentBottom, m.copyBottom);
    console.log(`  hueco entre el final del hero y #problema: ${Math.round(gap)}px`);
    if (gap > maxBand(h)) fail(`${name}: hueco antes de #problema (${Math.round(gap)}px)`);
    await page.screenshot({ path: `${OUT}/${name}-06-fin-del-hero.png` });
  }
  await context.close();
}
await browser.close();
console.log(failures.length ? `\n${failures.length} problema(s)` : '\nok →', OUT);
process.exit(failures.length ? 1 : 0);
