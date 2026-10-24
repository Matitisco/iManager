import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';

const css = readFileSync('src/desk/desk.css', 'utf8').replace(/^@import[^\n]*\n/, '');
let browser: Browser;

beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

describe('returns chips', () => {
  it.each([1440, 390])('preserves distinct active grouping and regular chip colors at %ipx', async width => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.setContent(`<!doctype html><style>${css}</style><div class="desk-app"><div class="returns-screen">
        <button class="gchip on">Fallas</button>
        <button class="gchip">Reclamos</button>
        <button class="gchip sm on">Proveedor</button>
        <button class="gchip sm">Compra</button>
      </div></div>`);
      const colors = await page.locator('.gchip').evaluateAll(chips => chips.map(chip => {
        const style = getComputedStyle(chip);
        return { background: style.backgroundColor, color: style.color, border: style.borderTopColor };
      }));
      expect(colors[0]).toMatchObject({ background: 'rgb(22, 24, 29)', color: 'rgb(255, 255, 255)' });
      expect(colors[2]).toEqual({ background: 'rgb(255, 244, 194)', color: 'rgb(22, 24, 29)', border: 'rgb(240, 213, 107)' });
      for (const index of [1, 3]) {
        expect(colors[index]).toMatchObject({ background: 'rgba(0, 0, 0, 0)', border: 'rgba(0, 0, 0, 0)' });
      }
    } finally {
      await page.close();
    }
  });
});
