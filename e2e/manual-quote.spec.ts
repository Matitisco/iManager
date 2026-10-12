import { selectDeskOption } from './utils';
import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail } from './utils';

const ORDER_ERROR = 'La compra no puede ser mayor que la venta';
const SHOTS = process.env.MANUAL_QUOTE_SHOTS?.trim();

async function mockDollar(page: Page) {
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({
    json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-08T21:40:00-03:00' },
  }));
  await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({
    json: { blue: { value_buy: 1270, value_sell: 1290 }, last_update: '2026-10-08T21:10:00-03:00' },
  }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({
    json: { venta: '1300,00', valor_cierre_ant: '1290,00' },
  }));
}

async function rejectInvertedQuote(page: Page, dialogName: string) {
  const editor = page.getByRole('dialog', { name: dialogName });
  await expect(editor).toBeVisible();
  await selectDeskOption(page, editor.getByTestId('store-exchange-mode'), 'Manual, la carga la tienda');
  await editor.getByTestId('store-manual-buy').fill('1400');
  await editor.getByTestId('store-manual-sell').fill('1300');
  await editor.getByTestId('store-manual-sell').scrollIntoViewIfNeeded();
  await editor.getByRole('button', { name: 'Guardar' }).click();
  const error = editor.getByText(ORDER_ERROR).first();
  await error.scrollIntoViewIfNeeded();
  await expect(error).toBeVisible();
  await expect(editor).toBeVisible();
}

test.describe('desktop manual quote', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('keeps the store sheet open when compra is above venta', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'quote-desk');
    const store = `Cotizacion desk ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, store);
    await page.getByTestId('sidebar-tab-settings').click();
    await page.getByRole('button', { name: store }).click();
    await rejectInvertedQuote(page, 'Datos de la tienda');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/manual-quote-1440x900.png` });
  });
});

test.describe('phone manual quote', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the store sheet open when compra is above venta', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'quote-phone');
    const store = `Cotizacion ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, store);
    await page.getByTestId('sidebar-tab-more').click();
    await page.getByTestId('sidebar-tab-settings').click();
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
    await page.getByRole('button', { name: store }).click();
    await rejectInvertedQuote(page, 'Tienda');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/manual-quote-390x844.png` });
  });
});
