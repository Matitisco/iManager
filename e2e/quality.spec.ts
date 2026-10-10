import { expect, test } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi, fetchInventory, fetchSales, fetchTradeIns } from './utils';

test('sets cosmetic quality on a used device and clears it when the device becomes new', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'quality');
  const model = `iPhone Calidad ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Calidad ${testInfo.parallelIndex}`);
  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('button', { name: 'Registrar equipo' }).click();

  const dialog = page.getByRole('dialog', { name: 'Registrar equipo' });
  await dialog.getByLabel('Modelo').fill(model);
  await dialog.getByLabel('Precio de venta').fill('1800');
  await expect(dialog.getByRole('group', { name: 'Calidad' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Usado', exact: true }).click();
  await dialog.getByRole('button', { name: 'Qué significa cada calidad' }).click();
  await expect(dialog.getByText('Sin marcas visibles a simple vista')).toBeVisible();
  await dialog.getByRole('button', { name: 'A+', exact: true }).click();
  await dialog.getByRole('button', { name: 'Guardar equipo' }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole('row').filter({ hasText: model });
  await expect(row.getByRole('cell', { name: 'A+' })).toBeVisible();
  await page.getByRole('button', { name: 'Filtrar calidad' }).click();
  await page.getByRole('dialog', { name: 'Filtrar calidad' }).getByRole('checkbox', { name: 'A+' }).check();
  await expect(row).toBeVisible();

  await row.click();
  const detail = page.getByRole('dialog', { name: new RegExp(model) });
  await expect(detail.getByText('A+', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();

  await row.click({ button: 'right' });
  await page.locator('.ctx').getByRole('button', { name: 'Editar' }).click();
  const editor = page.getByRole('dialog', { name: 'Editar equipo' });
  await editor.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await expect(editor.getByRole('group', { name: 'Calidad' })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(editor).toBeHidden();

  const { inventory } = await fetchInventory(request, email);
  expect(inventory.find((item) => item.model === model)).toMatchObject({ condition: 'NUEVO', grade: '' });
});

test('shows quality on a phone card and on a sale of a used device', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'quality-phone');
  const model = `iPhone Venta ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Calidad venta ${testInfo.parallelIndex}`);
  await createInventoryItemViaApi(request, email, {
    imei: String(Date.now()).padStart(15, '4').slice(-15),
    model,
    condition: 'USADO',
    grade: 'B',
    price: 2100,
    status: 'DISPONIBLE',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByTestId('sidebar-tab-inventory').click();
  const card = page.getByText(model).locator('xpath=ancestor::button[1]');
  await expect(card.getByText('Calidad B')).toBeVisible();

  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Filtros' });
  await filters.getByRole('checkbox', { name: 'B · Bueno' }).check();
  await filters.locator('.sheet-foot').getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByText(model)).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId('sidebar-tab-sales').click();
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  const sale = page.getByRole('dialog', { name: 'Registrar venta' });
  await sale.getByRole('combobox', { name: 'Equipo' }).fill(model);
  await page.getByRole('option', { name: new RegExp(model) }).click();
  await expect(sale.getByText('Calidad: B · Bueno')).toBeVisible();
  await sale.getByLabel('Cliente').fill(`Cliente ${Date.now()}`);
  await sale.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(sale).toBeHidden();

  await page.getByRole('row').filter({ hasText: model }).click();
  await expect(page.getByRole('dialog').getByText('B · Bueno')).toBeVisible();
  const { sales } = await fetchSales(request, email);
  expect(sales).toHaveLength(1);
});

test('records the quality of a device taken in a trade-in', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'quality-trade');
  const received = `Recibido ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Calidad canje ${testInfo.parallelIndex}`);
  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByRole('button', { name: 'Nuevo canje' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo canje' });
  await dialog.getByLabel('Cliente').fill(`Cliente ${Date.now()}`);
  await dialog.getByLabel('Equipo recibido').fill(received);
  await dialog.getByLabel('Valor tomado').fill('500');
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo entregado');
  await dialog.getByLabel('Precio completo de salida').fill('1200');
  await dialog.getByRole('button', { name: 'Qué significa cada calidad' }).click();
  await expect(dialog.getByText('Marcas moderadas')).toBeVisible();
  await dialog.getByRole('button', { name: 'B', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(dialog).toBeHidden();

  const trades = await fetchTradeIns(request, email);
  expect(trades.tradeIns[0]).toMatchObject({ deviceReceived: received, grade: 'B' });
  const { inventory } = await fetchInventory(request, email);
  expect(inventory.find((item) => item.model === received)).toMatchObject({ condition: 'USADO', grade: 'B' });

  await page.getByRole('row').filter({ hasText: received }).click();
  await expect(page.getByRole('dialog').getByText('B · Bueno')).toBeVisible();
});
