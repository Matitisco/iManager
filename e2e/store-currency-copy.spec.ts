import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createClientViaApi, updateStoreViaApi } from './utils';

const SHOTS = process.env.STORE_CURRENCY_SHOTS?.trim();

async function mockDollar(page: Page) {
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({
    json: { compra: 1000, venta: 1200, fechaActualizacion: '2026-10-08T21:40:00-03:00' },
  }));
  await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({
    json: { blue: { value_buy: 1000, value_sell: 1200 }, last_update: '2026-10-08T21:10:00-03:00' },
  }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({
    json: { venta: '1200,00', valor_cierre_ant: '1200,00' },
  }));
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test('a dollar store prints US$ on trade copy and notices, desktop and phone', async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const email = buildTestEmail(testInfo, 'usd-copy');
  const clientName = 'Ana Pérez';
  await mockDollar(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootstrapStoreViaApi(page, request, email, `Dólar ${testInfo.parallelIndex}`);
  await updateStoreViaApi(request, email, { currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1200 });
  await createClientViaApi(request, email, { name: clientName });
  await page.reload();
  await expect(page.getByTestId('sidebar-tab-tradeins')).toBeVisible();

  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByRole('button', { name: 'Nuevo canje' }).click();
  const form = page.getByRole('dialog', { name: 'Nuevo canje' });
  await form.getByLabel('Cliente').fill(clientName);
  await form.getByRole('option', { name: clientName }).click();
  await form.getByLabel('Equipo recibido').fill('iPhone 11');
  await form.getByLabel('Valor tomado').fill('200');
  await form.getByRole('combobox', { name: 'Equipo' }).fill('iPhone 14');
  await form.getByLabel('Precio completo de salida').fill('1075');
  await expect(form.getByLabel('Diferencia')).toHaveValue('US$ 875');
  await expect(form.getByText('Diferencia a cobrar: US$ 875')).toBeVisible();
  await form.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(form).toBeHidden();
  await expect(page.locator('.toast.show')).toContainText('toma US$ 200');
  await expect(page.locator('.toast.show')).toContainText('total US$ 1.075');

  await expect(page.getByRole('cell', { name: /US\$ 200/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Dif\. US\$ 875/ })).toBeVisible();
  await shot(page, 'canjes-1440x900');

  await page.getByTestId('sidebar-tab-notifications').click();
  await expect(page.getByRole('button', { name: /toma US\$ 200/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /compró por US\$ 1\.075/ })).toBeVisible();
  await shot(page, 'notificaciones-1440x900');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByTestId('sidebar-tab-more').click();
  await page.getByTestId('sidebar-tab-notifications').click();
  await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible();
  await expect(page.getByTestId('notification-groups')).toContainText('toma US$ 200');
  await expect(page.getByTestId('notification-groups')).toContainText('compró por US$ 1.075');
  await shot(page, 'notificaciones-390x844');

  await page.getByTestId('page-back').click();
  await page.getByTestId('sidebar-tab-tradeins').click();
  await expect(page.getByTestId('tradeins-timeline')).toContainText('US$ 200');
  await expect(page.getByTestId('tradeins-timeline')).toContainText('dif. US$ 875');
  await shot(page, 'canjes-390x844');
});
