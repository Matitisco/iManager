import { openDeskSection } from './navigation';
import { expect, test } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi } from './utils';

// The quote is a fixture; sale persistence and section notices use the real API.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/commissions/exchange-rate', (route) => route.fulfill({ json: { exchangeRate: 1300 } }));
});

test('a sale highlights the sold phone in inventory and clears that section counter', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'section-notices');
  const model = `iPhone novedad ${Date.now()}`;
  const clientName = `Cliente novedad ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Notices ${testInfo.parallelIndex}`);
  await createInventoryItemViaApi(request, email, {
    imei: String(Date.now()).padStart(15, '6').slice(-15),
    model,
    price: 1500,
  });

  await page.getByTestId('sidebar-tab-sales').click();
  const sales = page.getByTestId('sales-screen');
  await expect(sales).toBeVisible();
  await sales.getByRole('button', { name: 'Registrar venta', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await dialog.getByLabel('Cliente').fill(clientName);
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill(model);
  await dialog.getByRole('option', { name: new RegExp(model) }).click();
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByTestId('nav-group-stock').getByLabel('1 aviso sin leer en Equipos')).toHaveText('1');
  await openDeskSection(page, 'inventory');
  const row = page.getByRole('row').filter({ hasText: model });
  await expect(page.getByTestId('section-notices')).toHaveCount(0);
  await expect(row.getByTestId('notice-dot')).toBeVisible();
  await expect(page.getByTestId('nav-group-stock').getByLabel('1 aviso sin leer en Equipos')).toHaveCount(0);
  await expect(row.getByTestId('notice-dot')).toBeVisible();

  await page.getByTestId('sidebar-tab-sales').click();
  await expect(sales).toBeVisible();
  await openDeskSection(page, 'inventory');
  await expect(page.getByRole('heading', { name: 'Inventario', exact: true })).toBeVisible();
  await expect(page.getByTestId('nav-group-stock').getByLabel('1 aviso sin leer en Equipos')).toHaveCount(0);
  await expect(page.getByTestId('notice-dot')).toHaveCount(0);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a sale highlights the sold phone on the phone list and clears the counter', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'section-notices-phone');
    const model = `iPhone celular ${Date.now()}`;
    const clientName = `Cliente celular ${Date.now()}`;
    await bootstrapStoreViaApi(page, request, email, `Notices Phone ${testInfo.parallelIndex}`);
    await createInventoryItemViaApi(request, email, {
      imei: String(Date.now() + 1).padStart(15, '5').slice(-15),
      model,
      price: 1800,
    });

    await page.getByTestId('sidebar-tab-sales').click();
    const sales = page.getByTestId('sales-screen');
    await expect(sales).toBeVisible();
    await sales.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar venta', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Registrar venta' });
    await dialog.getByLabel('Cliente').fill(clientName);
    await dialog.getByRole('combobox', { name: 'Equipo' }).fill(model);
    await dialog.getByRole('option', { name: new RegExp(model) }).click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByTestId('sidebar-tab-inventory').locator('.dcount')).toHaveText('1');
    await page.getByTestId('sidebar-tab-inventory').click();
    const list = page.getByTestId('phone-rows');
    await expect(page.getByTestId('section-notices')).toHaveCount(0);
    await expect(list.getByText(model, { exact: false })).toBeVisible();
    await expect(list.getByTestId('notice-dot')).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-inventory').locator('.dcount')).toHaveCount(0);
  });
});
