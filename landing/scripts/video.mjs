// Graba un recorrido de scroll por el hero (desktop 1440 y iPhone 390) y reporta la cadencia de frames.
// Uso: npm run preview (otra terminal) → node scripts/video.mjs  (requiere ffmpeg para el .mp4)
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL = process.env.LANDING_URL || 'http://localhost:4180/';
const OUT = process.env.SHOTS_DIR || 'shots';
const executablePath = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const runs = [
  ['desktop', { viewport: { width: 1440, height: 900 } }, 16000],
  ['iphone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 7000],
];
for (const [name, ctx, ms] of runs) {
  const context = await browser.newContext({ ...ctx, recordVideo: { dir: `${OUT}/.video`, size: ctx.viewport } });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const stats = await page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const hero = document.getElementById('hero');
        const end = hero.offsetTop + hero.offsetHeight - hero.querySelector('.stick').offsetHeight + 40;
        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        const deltas = [];
        let t0 = 0;
        let last = 0;
        const step = (t) => {
          if (!t0) t0 = last = t;
          deltas.push(t - last);
          last = t;
          const k = Math.min(1, (t - t0) / ms);
          window.scrollTo(0, end * ease(k));
          if (k < 1) requestAnimationFrame(step);
          else {
            const d = deltas.slice(1).sort((a, b) => a - b);
            const avg = d.reduce((s, x) => s + x, 0) / d.length;
            resolve({ frames: d.length, avgMs: +avg.toFixed(2), p95Ms: +d[Math.floor(d.length * 0.95)].toFixed(2), over33: d.filter((x) => x > 33.4).length });
          }
        };
        requestAnimationFrame(step);
      }),
    ms,
  );
  console.log(name, JSON.stringify(stats));
  await page.waitForTimeout(800);
  const video = page.video();
  await context.close();
  const webm = `${OUT}/${name}-scroll.webm`;
  renameSync(await video.path(), webm);
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', webm.replace('.webm', '.mp4')]);
  } catch {
    console.warn('ffmpeg no disponible: queda el .webm');
  }
}
await browser.close();
