import { expect, test, type Page } from '@playwright/test';
import { buildTestEmail, loginViaUi } from './utils';

async function mockDollar(page: Page) {
  await page.route('https://dolarapi.com/v1/dolares/blue', (route) => route.fulfill({
    json: { compra: 1000, venta: 1200, fechaActualizacion: '2026-10-08T21:40:00-03:00' },
  }));
  await page.route('https://dolarapi.com/v1/dolares/oficial', (route) => route.fulfill({
    json: { compra: 800, venta: 900, fechaActualizacion: '2026-10-08T21:40:00-03:00' },
  }));
  await page.route('https://dolarapi.com/v1/dolares/bolsa', (route) => route.fulfill({
    json: { compra: 1100, venta: 1300, fechaActualizacion: '2026-10-08T21:40:00-03:00' },
  }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({
    json: { venta: '1200,00', valor_cierre_ant: '1200,00' },
  }));
}

test('configures the store currency and converts a saved price', async ({ page }, testInfo) => {
  const email = buildTestEmail(testInfo, 'currency');
  const storeName = `Moneda ${testInfo.parallelIndex}`;
  const model = `iPhone Moneda ${Date.now()}`;
  await mockDollar(page);
  await loginViaUi(page, email);

  await page.getByTestId('onboarding-store-name').fill(storeName);
  await page.getByTestId('onboarding-currency').selectOption('USD');
  await page.getByTestId('onboarding-exchange-mode').selectOption('auto');
  await page.getByTestId('onboarding-exchange-source').selectOption('blue');
  await page.getByTestId('onboarding-submit').click();
  const skipContact = page.getByRole('button', { name: 'Ahora no' });
  if (await skipContact.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) {
    await skipContact.click();
  }

  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('button', { name: 'Registrar equipo' }).click();
  await page.getByLabel('Modelo').fill(model);
  await page.getByLabel('Precio de venta').fill('100');
  await page.getByRole('button', { name: 'Guardar equipo' }).click();
  await expect(page.getByRole('button', { name: 'Guardar equipo' })).toBeHidden();
  await expect(page.getByText('US$ 100').first()).toBeVisible();

  await page.getByRole('button', { name: 'Configuración' }).click();
  await page.getByRole('button', { name: storeName }).click();
  await page.getByTestId('store-currency').selectOption('ARS');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Datos de la tienda' })).toBeHidden();

  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByText('$ 120.000').first()).toBeVisible();

  await page.getByRole('button', { name: 'Configuración' }).click();
  await page.getByRole('button', { name: storeName }).click();
  await page.getByTestId('store-exchange-mode').selectOption('manual');
  await page.getByTestId('store-manual-buy').fill('500');
  await page.getByTestId('store-manual-sell').fill('700');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Datos de la tienda' })).toBeHidden();

  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByText('$ 70.000').first()).toBeVisible();

  await page.getByRole('button', { name: 'Configuración' }).click();
  await page.getByRole('button', { name: storeName }).click();
  await page.getByTestId('store-manual-buy').fill('');
  await page.getByTestId('store-manual-sell').fill('');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByTestId('fx-warning')).toBeVisible();

  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByTestId('fx-warning')).toBeVisible();
  await expect(page.getByText('US$ 100').first()).toBeVisible();
  await expect(page.getByText('$ 70.000')).toHaveCount(0);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the buy/sell toggle inside the dollar sheet', async ({ page }, testInfo) => {
    const email = buildTestEmail(testInfo, 'currency-phone');
    await mockDollar(page);
    await loginViaUi(page, email);
    await page.getByTestId('onboarding-store-name').fill(`Celular ${testInfo.parallelIndex}`);
    await page.getByTestId('onboarding-submit').click();
    const skipContact = page.getByRole('button', { name: 'Ahora no' });
    if (await skipContact.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) {
      await skipContact.click();
    }

    await expect(page.getByTestId('blue-widget')).toHaveAttribute('data-state', 'ready');
    await page.getByTestId('blue-widget').click();
    await page.getByTestId('blue-usd').fill('100');
    const sheet = await page.locator('.dolar-sheet').boundingBox();
    const side = await page.getByTestId('blue-rate-side').boundingBox();
    expect(sheet).toBeTruthy();
    expect(side).toBeTruthy();
    expect(side!.x).toBeGreaterThanOrEqual(sheet!.x - 1);
    expect(side!.x + side!.width).toBeLessThanOrEqual(sheet!.x + sheet!.width + 1);
    await expect(page.getByTestId('blue-rate-side')).toHaveText(/al precio de venta/);
  });
});
