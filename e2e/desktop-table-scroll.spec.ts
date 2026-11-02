import { expect, test, type Page } from '@playwright/test';
import { data, me } from './pwa/fixtures.mjs';
import { ROUTE } from '../src/desk/hash-route';

const sections = ['sales', 'inventory', 'clients', 'tradeins'] as const;

async function boot(page: Page, forceDesktop: boolean) {
  if (forceDesktop) {
    // Keep narrow CSS media queries active while rendering the desktop branch.
    await page.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window);
      window.matchMedia = query => {
        const result = matchMedia(query);
        if (query === '(max-width: 760px)') Object.defineProperty(result, 'matches', { value: false });
        return result;
      };
    });
  }
  const today = new Date().toLocaleDateString('sv-SE');
  const rows = Array.from({ length: 25 }, (_, index) => index);
  await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: new Date().toISOString() } }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === '/api/me' ? me : {
      ...data,
      inventory: rows.map(index => ({ ...data.inventory[index % data.inventory.length], id: `scroll-product-${index}` })),
      clients: rows.map(index => ({ ...data.clients[index % data.clients.length], id: `scroll-client-${index}` })),
      sales: rows.map(index => ({ id: `scroll-sale-${index}`, saleNumber: index + 1, date: today, clientId: 'scroll-client-0', productId: 'scroll-product-0', amount: 950000, unitPrice: 950000, amountCurrency: 'ARS', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' })),
      tradeIns: rows.map(index => ({ ...data.tradeIns[0], id: `scroll-trade-${index}`, tradeNumber: index + 1, date: today })),
      returns: [], drafts: [], suppliers: [], catalogs: {},
    } });
  });
  await page.goto('/');
  await page.getByTestId('login-email').fill('pwa.owner@imanager.test');
  await page.getByTestId('login-password').fill('test123456');
  await page.getByTestId('login-submit').click();
  await expect(page.locator('.desk-app')).toBeVisible();
}

for (const width of [470, 1024, 1440]) {
  test(`desktop tables contain horizontal scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await boot(page, width === 470);
    for (const section of sections) {
      await page.goto(`/#/${ROUTE[section]}`);
      const scroll = page.locator('.desktop-table-scroll');
      await expect(scroll).toBeVisible();
      await expect(scroll.locator('tbody tr').first()).toBeVisible();
      await expect(page.locator('.dpager')).toBeVisible();
      const geometry = await scroll.evaluate(node => {
        const table = node.querySelector('table')!;
        node.scrollLeft = node.scrollWidth;
        const box = node.getBoundingClientRect();
        const last = table.querySelector('tbody tr')!.lastElementChild!.getBoundingClientRect();
        return {
          width: node.clientWidth, content: node.scrollWidth, left: node.scrollLeft,
          overflow: getComputedStyle(node).overflowX,
          lastRight: last.right, right: box.right,
          pageWidth: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          stageLeft: document.querySelector('.stage')!.scrollLeft,
          cardRight: node.parentElement!.getBoundingClientRect().right,
          pagerInside: !!node.querySelector('.dpager'),
          headerInside: !!node.querySelector('.dch'),
        };
      });
      expect(geometry.overflow).toBe('auto');
      expect(geometry.lastRight).toBeLessThanOrEqual(geometry.right + 1);
      expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.stageLeft).toBe(0);
      expect(geometry.cardRight).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.pagerInside).toBe(false);
      expect(geometry.headerInside).toBe(false);
      if (width < 1440) {
        expect(geometry.content).toBeGreaterThan(geometry.width);
        expect(geometry.left).toBeGreaterThan(0);
      } else if (section === 'clients') {
        expect(geometry.content).toBe(geometry.width);
        expect(geometry.left).toBe(0);
      }
    }
  });
}

for (const width of [390, 470]) {
  test(`real mobile keeps cards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await boot(page, false);
    for (const section of sections) {
      await page.goto(`/#/${ROUTE[section]}`);
      await expect(page.locator('.dscreen')).toBeVisible();
      await expect(page.locator('.dscreen .phone-row').first()).toBeVisible();
      await expect(page.locator('.desktop-table-scroll')).toHaveCount(0);
      await expect(page.locator('.dscreen .dtable')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}
