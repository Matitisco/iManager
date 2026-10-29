import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { launchBrowser, loadPage } from './browser.mjs';

const url = process.env.LANDING_URL || 'http://localhost:4181/';
const out = process.env.SHOTS_DIR || 'shots';
await mkdir(out, { recursive: true });
const browser = await launchBrowser();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 900 : 844 },
      deviceScaleFactor: 2,
      isMobile: width === 390,
    });
    const page = await context.newPage();
    await loadPage(page, url);
    await page.screenshot({ path: join(out, `a2-${width}.png`), fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`Capturas A2 → ${out}`);
