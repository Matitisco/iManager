import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';

const css = readFileSync('src/desk/desk.css', 'utf8').replace(/^@import[^\n]*\n/, '');
let browser: Browser;

beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

describe('blue refresh animation CSS', () => {
  it.each([
    ['light', 'no-preference'], ['dark', 'no-preference'],
    ['light', 'reduce'], ['dark', 'reduce'],
  ] as const)('animates only the icon in %s mode with reduced motion %s', async (colorScheme, reducedMotion) => {
    const page = await browser.newPage({ colorScheme, reducedMotion });
    try {
      await page.setContent(`<!doctype html><style>${css}</style>
        <div class="desk-app"><div class="dolar compact ready">
          <button class="dolar-refresh"><svg width="15" height="15" class="dolar-refresh-spinning" stroke="currentColor"></svg></button>
        </div></div>`);
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, colorScheme);
      const icon = page.locator('.dolar-refresh svg');
      const animation = await icon.evaluate(node => {
        const style = getComputedStyle(node);
        return { name: style.animationName, duration: style.animationDuration, iterations: style.animationIterationCount, timing: style.animationTimingFunction };
      });
      if (reducedMotion === 'reduce') {
        expect(animation.name).toBe('none');
        expect(await icon.evaluate(node => node.getAnimations().length)).toBe(0);
      } else {
        expect(animation).toEqual({ name: 'dolar-refresh-spin', duration: '1s', iterations: 'infinite', timing: 'linear' });
        const frames = await icon.evaluate(node => (node.getAnimations()[0].effect as KeyframeEffect).getKeyframes());
        expect(frames.at(-1)?.transform).toBe('rotate(360deg)');
      }
      const button = page.locator('.dolar-refresh');
      expect(await button.evaluate(node => getComputedStyle(node).animationName)).toBe('none');
      expect(await icon.evaluate(node => getComputedStyle(node).color)).toBe(await button.evaluate(node => getComputedStyle(node).color));
      await icon.evaluate(node => node.classList.remove('dolar-refresh-spinning'));
      expect(await icon.evaluate(node => node.getAnimations().length)).toBe(0);
    } finally {
      await page.close();
    }
  });
});
