import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeskToast } from './toast';

const css = readFileSync(path.resolve(process.cwd(), 'src/desk/desk.css'), 'utf8').replace(/@import[^;]+;/, '');

const LONG_SUMMARY = 'Canje · total $ 950.000 · toma $ 350.000 · diferencia/deuda $ 0 · recibido en revisión';

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

async function mount(page: Page, message: string, width: number) {
  const html = renderToStaticMarkup(
    <div className="desk-app">
      <DeskToast message={message} show />
    </div>,
  );
  await page.setViewportSize({ width, height: 800 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><body style="margin:0">${html}`);
  await page.evaluate(() => document.fonts.ready);
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const toast = document.querySelector('.toast');
    const text = toast?.querySelector('span');
    if (!(toast instanceof HTMLElement) || !(text instanceof HTMLElement)) throw new Error('toast missing');
    const toastBox = toast.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(text);
    const textBox = range.getBoundingClientRect();
    return {
      text: text.textContent,
      toast: { x: toastBox.x, y: toastBox.y, width: toastBox.width, height: toastBox.height, right: toastBox.right, bottom: toastBox.bottom },
      textBox: { x: textBox.x, y: textBox.y, right: textBox.right, bottom: textBox.bottom },
      whiteSpace: getComputedStyle(toast).whiteSpace,
      scrollWidth: text.scrollWidth,
      clientWidth: text.clientWidth,
    };
  });
}

describe('desk toast', () => {
  it('keeps a long trade-in summary inside the toast on desktop and a 390px phone', async () => {
    const page = await browser.newPage();
    try {
      for (const width of [1280, 390]) {
        await mount(page, 'Listo', width);
        const short = await measure(page);
        await mount(page, LONG_SUMMARY, width);
        const long = await measure(page);
        const viewport = page.viewportSize();
        expect(long.text).toBe(LONG_SUMMARY);
        expect(long.whiteSpace).not.toBe('nowrap');
        expect(long.toast.x).toBeGreaterThanOrEqual(-1);
        expect(long.toast.right).toBeLessThanOrEqual((viewport?.width ?? width) + 1);
        expect(long.textBox.x).toBeGreaterThanOrEqual(long.toast.x - 1);
        expect(long.textBox.right).toBeLessThanOrEqual(long.toast.right + 1);
        expect(long.textBox.y).toBeGreaterThanOrEqual(long.toast.y - 1);
        expect(long.textBox.bottom).toBeLessThanOrEqual(long.toast.bottom + 1);
        expect(long.scrollWidth).toBeLessThanOrEqual(long.clientWidth + 1);
        expect(long.toast.width).toBeLessThanOrEqual(Math.min(400, width - 32) + 1);
        expect(long.toast.height).toBeGreaterThan(short.toast.height);
        expect(short.toast.x).toBeGreaterThanOrEqual(-1);
        expect(short.toast.right).toBeLessThanOrEqual(width + 1);
      }
    } finally {
      await page.close();
    }
  });
});
