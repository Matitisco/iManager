import { expect, test as base, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { data, me } from './pwa/fixtures.mjs';
import { selectDeskOption } from './utils';
import { dimensionsFor, REPORT_TABS } from '../src/desk/report-breakdown';

const test = base.extend({
  page: async ({ playwright, baseURL }, use, testInfo) => {
    const mobile = testInfo.titlePath.some(title => title.includes('iPhone'));
    const browser = await (mobile ? playwright.webkit : playwright.chromium).launch();
    const page = await browser.newPage({ baseURL, viewport: mobile ? { width: 393, height: 852 } : { width: 1280, height: 800 }, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}) });
    try { await use(page); } finally { await browser.close(); }
  },
});

async function expectCenterFits(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.locator('.gdonut').evaluate((node) => {
    const svg = node.querySelector('svg')!.getBoundingClientRect();
    const label = node.querySelector('.gc b')!;
    const box = label.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(label);
    const text = range.getBoundingClientRect();
    const hole = svg.width * 72 / 132;
    return { hole, boxWidth: box.width, textWidth: text.width, left: text.left - (svg.left + (svg.width - hole) / 2), right: svg.left + (svg.width + hole) / 2 - text.right, fontSize: parseFloat(getComputedStyle(label).fontSize), clipped: label.scrollWidth > label.clientWidth + 1 };
  });
  expect(geometry.boxWidth).toBeLessThanOrEqual(geometry.hole);
  // Also check the actual glyph range: overflow:hidden alone must not pass.
  expect(geometry.textWidth).toBeLessThanOrEqual(geometry.hole - 8 + 1);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeGreaterThanOrEqual(0);
  expect(geometry.clipped).toBe(false);
  expect(geometry.fontSize).toBeGreaterThanOrEqual(11);
}

for (const mobile of [false, true]) {
  test.describe(`donut fits ${mobile ? 'iPhone' : 'desktop'}`, () => {
    for (const currency of ['ARS', 'USD'] as const) {
      test(`${currency} totals, every report and breakdown`, async ({ page }) => {
        test.setTimeout(120_000);
        let amount = currency === 'ARS' ? 750_000 : 8_000_000;
        const now = new Date();
        const date = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const iso = now.toISOString();
        await page.route('https://dolarapi.com/**', r => r.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: iso } }));
        await page.route('https://api.bluelytics.com.ar/**', r => r.fulfill({ json: { blue: { value_buy: 1280, value_sell: 1300 } } }));
        await page.route('https://mercados.ambito.com/**', r => r.fulfill({ json: { venta: '1300,00' } }));
        await page.route('**/api/**', route => {
          const path = new URL(route.request().url()).pathname;
          const totals = { ARS: currency === 'ARS' ? amount : 0, USD: currency === 'USD' ? amount : 0 };
          const response = path === '/api/me' ? { ...me, store: { ...me.store, name: 'Torta · Reportes', currency } } : {
            ...data,
            sales: [0.4, 0.6].map((share, i) => ({ id: `sale-${i}`, date, amount: amount * share, amountCurrency: currency, status: 'COMPLETADA', clientId: data.clients[i].id, clientName: i ? 'Luis Gómez' : 'Ana Pérez', deviceLabel: `iPhone ${i ? 14 : 13}`, saleNumber: i + 1, paymentMethod: i ? 'TRANSFERENCIA' : 'EFECTIVO' })),
            inventory: data.inventory.map(item => ({ ...item, createdAt: iso })),
            clients: data.clients.map(item => ({ ...item, createdAt: iso })),
            tradeIns: data.tradeIns.slice(0, 2).map(item => ({ ...item, date })),
            orders: [0, 1].map(i => ({ id: `repair-${i}`, repairNumber: i + 1, receivedAt: iso, device: `iPhone ${13 + i}`, status: i ? 'ENTREGADO' : 'RECIBIDO', technician: i ? 'Teo' : 'Mora', estimate: amount / 2, currency, fault: 'Pantalla', clientName: 'Ana Pérez' })),
            rows: [{ memberId: 'seller', name: 'Ana Pérez', period: iso.slice(0, 7), salesCount: 2, earned: totals, paid: totals, pending: totals, adjustmentsTotal: totals, converted: { earned: totals, paid: totals, pending: totals } }],
          };
          return route.fulfill({ json: response });
        });
        await page.goto('/');
        await page.getByTestId('login-email').fill('pwa.owner@imanager.test');
        await page.getByTestId('login-password').fill('test123456');
        await page.getByTestId('login-submit').click();
        const openReports = async () => {
          if (mobile) await page.getByTestId('sidebar-tab-more').click();
          await page.getByTestId('sidebar-tab-reports').click();
          await expect(page.locator('.gc b')).toBeVisible();
          await expect(page.locator('.gamount')).toContainText(new Intl.NumberFormat('es-AR').format(amount));
        };
        await openReports();
        await expectCenterFits(page);
        await expect(page.locator('.gc')).toHaveAttribute('aria-label', `total: ${currency === 'USD' ? 'US$' : '$'} ${new Intl.NumberFormat('es-AR').format(amount)}`);
        if (process.env.TORTA_SHOTS) {
          await mkdir(process.env.TORTA_SHOTS, { recursive: true });
          const card = page.locator('.gcard').filter({ has: page.locator('.gdonut') });
          await card.scrollIntoViewIfNeeded();
          await card.screenshot({ path: `${process.env.TORTA_SHOTS}/torta-after-${currency === 'USD' ? 'usd-' : ''}${mobile ? 'mobile' : 'desktop'}.png`, animations: 'disabled' });
        }
        await page.getByRole('button', { name: 'Transferencia: 60%', exact: true }).click();
        await expect(page.locator('.gc b')).toHaveText('60%');
        await expect(page.locator('.gc small')).toHaveText('Transferencia');
        await expectCenterFits(page);
        await page.getByRole('button', { name: 'Transferencia: 60%', exact: true }).click();
        for (const tab of REPORT_TABS) {
          await page.getByRole('group', { name: 'Tipo de reporte' }).getByRole('button', { name: tab, exact: true }).click();
          await expect(page.locator('.gc b')).not.toHaveText('—');
          for (const dimension of dimensionsFor(tab)) {
            await selectDeskOption(page, page.getByRole('combobox', { name: 'Columna de desglose' }), dimension.label);
            await expectCenterFits(page);
          }
          const slice = page.locator('.gdonut [role="button"]').first();
          await slice.press('Enter');
          await expect(page.locator('.gc b')).toHaveText(/^\d+%$/);
          await expectCenterFits(page);
          await slice.press('Enter');
        }
        for (const large of [12_345_678, 999_999, 987_654]) {
          amount = large;
          await page.reload();
          await openReports();
          await expectCenterFits(page);
        }
      });
    }
  });
}
