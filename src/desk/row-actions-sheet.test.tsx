import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';

const css = readFileSync(path.resolve(process.cwd(), 'src/desk/desk.css'), 'utf8').replace(/^@import[^\n]*\n/, '');

const tab = `<nav class="mtab" data-testid="mobile-tab-bar" aria-label="Secciones"><button class="on" type="button">Inicio</button><button type="button">Inventario</button><button type="button">Ventas</button><button type="button">Más</button></nav>`;

const actionSheet = `<div class="ov ctxov"><div class="ctx"><div class="sheet-grab" aria-hidden="true"></div><div class="ctxh">iPhone 13 · 128 GB</div><button type="button">Editar</button><button class="danger" type="button">Eliminar</button></div></div>`;

const formSheet = `<div class="ov"><div class="sheet" role="dialog" aria-label="Registrar equipo"><div class="sheet-grab" aria-hidden="true"></div><div class="sheet-scroll"><h3>Registrar equipo</h3></div><div class="sheet-foot"><div class="sacts"><button type="button">Cancelar</button><button type="button">Guardar equipo</button></div></div></div></div>`;

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

async function mount(page: Page, body: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><body style="margin:0"><div class="desk-app">${body}</div>`);
  await page.evaluate(async () => {
    const animations = document.getAnimations();
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function actionSheetBox(page: Page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('.ov.ctxov');
    const ctx = document.querySelector('.ctx');
    const tabNode = document.querySelector('.mtab');
    if (!(overlay instanceof HTMLElement) || !(ctx instanceof HTMLElement) || !(tabNode instanceof HTMLElement)) {
      throw new Error('missing action sheet');
    }
    const overlayBox = overlay.getBoundingClientRect();
    const ctxBox = ctx.getBoundingClientRect();
    const tabBox = tabNode.getBoundingClientRect();
    const x = tabBox.left + tabBox.width / 2;
    const y = tabBox.top + Math.min(tabBox.height / 2, Math.max(0, ctxBox.bottom - tabBox.top - 4));
    const hit = document.elementsFromPoint(x, y);
    const style = getComputedStyle(ctx);
    return {
      overlayTop: overlayBox.top,
      overlayBottom: overlayBox.bottom,
      overlayLeft: overlayBox.left,
      overlayRight: overlayBox.right,
      ctxBottom: ctxBox.bottom,
      ctxWidth: ctxBox.width,
      height: window.innerHeight,
      width: document.documentElement.clientWidth,
      scrim: getComputedStyle(overlay).backgroundColor,
      radius: `${style.borderTopLeftRadius} ${style.borderBottomLeftRadius}`,
      sheetIndex: hit.findIndex((node) => node === ctx || ctx.contains(node)),
      tabIndex: hit.findIndex((node) => node === tabNode || tabNode.contains(node)),
    };
  });
}

describe('row action sheet', () => {
  it('covers the footer and darkens the page at 390x844', async () => {
    const page = await browser.newPage();
    try {
      await mount(page, `${tab}${actionSheet}`, 390, 844);
      const box = await actionSheetBox(page);
      expect(box.overlayTop).toBeLessThanOrEqual(1);
      expect(box.overlayLeft).toBeLessThanOrEqual(1);
      expect(box.overlayRight).toBeGreaterThanOrEqual(box.width - 1);
      expect(box.overlayBottom).toBeGreaterThanOrEqual(box.height - 1);
      expect(box.ctxBottom).toBeGreaterThanOrEqual(box.height - 1);
      expect(box.ctxWidth).toBeGreaterThan(box.width - 8);
      expect(box.scrim).toBe('rgba(17, 17, 17, 0.45)');
      expect(box.radius).toBe('24px 0px');
      expect(box.sheetIndex).toBeGreaterThanOrEqual(0);
      expect(box.tabIndex).toBeGreaterThan(box.sheetIndex);
    } finally {
      await page.close();
    }
  });

  it('keeps the registrar sheet above the footer at 390x844', async () => {
    const page = await browser.newPage();
    try {
      await mount(page, `${tab}${formSheet}`, 390, 844);
      const placed = await page.evaluate(() => {
        const sheet = document.querySelector('.sheet')!.getBoundingClientRect();
        const tabNode = document.querySelector('.mtab')!.getBoundingClientRect();
        const overlay = document.querySelector('.ov')!.getBoundingClientRect();
        return { sheetBottom: sheet.bottom, tabTop: tabNode.top, overlayBottom: overlay.bottom, height: window.innerHeight };
      });
      expect(placed.overlayBottom).toBeLessThanOrEqual(placed.tabTop + 1);
      expect(placed.sheetBottom).toBeLessThanOrEqual(placed.tabTop + 1);
      expect(placed.overlayBottom).toBeLessThan(placed.height - 40);
    } finally {
      await page.close();
    }
  });

  it('keeps a floating menu on desktop at 1440x900', async () => {
    const page = await browser.newPage();
    try {
      const desktop = `<aside class="side"></aside><div class="ov ctxov"><div class="ctx" style="top: 120px; left: 280px"><div class="ctxh">iPhone 13 · 128 GB</div><button type="button">Editar</button><button class="danger" type="button">Eliminar</button></div></div>`;
      await mount(page, desktop, 1440, 900);
      const box = await page.evaluate(() => {
        const overlay = document.querySelector('.ov.ctxov') as HTMLElement;
        const ctx = document.querySelector('.ctx') as HTMLElement;
        const ctxBox = ctx.getBoundingClientRect();
        const style = getComputedStyle(ctx);
        return {
          position: style.position,
          width: ctxBox.width,
          top: ctxBox.top,
          bottom: ctxBox.bottom,
          height: window.innerHeight,
          scrim: getComputedStyle(overlay).backgroundColor,
          radius: `${style.borderTopLeftRadius} ${style.borderBottomLeftRadius}`,
          tab: document.querySelector('.mtab'),
        };
      });
      expect(box.tab).toBeNull();
      expect(box.position).toBe('fixed');
      expect(box.width).toBeGreaterThan(180);
      expect(box.width).toBeLessThan(280);
      expect(box.top).toBeGreaterThan(80);
      expect(box.bottom).toBeLessThan(box.height - 200);
      expect(box.scrim).toBe('rgba(22, 24, 29, 0.08)');
      expect(box.radius).toBe('18px 18px');
    } finally {
      await page.close();
    }
  });
});
