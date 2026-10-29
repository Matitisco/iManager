import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

export async function launchBrowser() {
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const cached = existsSync(cache) ? readdirSync(cache)
    .filter((name) => name.startsWith('chromium-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    .flatMap((name) => [join(cache, name, 'chrome-linux', 'chrome'), join(cache, name, 'chrome-linux64', 'chrome')]) : [];
  const executablePath = [process.env.CHROME_PATH, ...cached, '/usr/bin/google-chrome', '/usr/local/bin/google-chrome']
    .find((path) => path && existsSync(path));
  return chromium.launch({ executablePath, args: ['--no-sandbox'] });
}

export async function loadPage(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Cargar también las imágenes fuera del viewport antes de capturar la página.
    for (const image of document.images) image.loading = 'eager';
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });
}
