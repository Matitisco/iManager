import { expect, test } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi } from './utils';

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
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await dialog.getByLabel('Cliente').fill(clientName);
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill(model);
  await dialog.getByRole('option', { name: new RegExp(model) }).click();
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByLabel('1 en Inventario')).toHaveText('1');
  await page.getByTestId('sidebar-tab-inventory').click();
  const row = page.getByRole('row').filter({ hasText: model });
  await expect(page.getByTestId('section-notices')).toContainText('1 novedad');
  await expect(row.getByTestId('notice-reason')).toHaveText('Vendido');
  await expect(page.getByLabel('1 en Inventario')).toHaveCount(0);
  await expect(row.getByTestId('notice-reason')).toHaveText('Vendido');

  await page.getByTestId('sidebar-tab-sales').click();
  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByLabel('1 en Inventario')).toHaveCount(0);
  await expect(page.getByTestId('notice-reason')).toHaveCount(0);
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
    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar venta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Registrar venta' });
    await dialog.getByLabel('Cliente').fill(clientName);
    await dialog.getByRole('combobox', { name: 'Equipo' }).fill(model);
    await dialog.getByRole('option', { name: new RegExp(model) }).click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByLabel('1 en Inventario')).toHaveText('1');
    await page.getByTestId('sidebar-tab-inventory').click();
    const list = page.getByTestId('phone-rows');
    await expect(page.getByTestId('section-notices')).toContainText('1 novedad');
    await expect(list.getByText(model, { exact: false })).toBeVisible();
    await expect(list.getByTestId('notice-reason')).toHaveText('Vendido');
    await expect(page.getByLabel('1 en Inventario')).toHaveCount(0);
  });
});
