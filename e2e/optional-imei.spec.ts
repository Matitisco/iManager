import { expect, test } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, fetchInventory } from './utils';

test('saves equipment, a trade-in and a repair without an IMEI on desktop', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'optional-imei-desk');
  const model = `Sin IMEI ${Date.now()}`;
  const received = `Canje sin IMEI ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `IMEI opcional ${testInfo.parallelIndex}`);

  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('button', { name: 'Registrar equipo' }).click();
  const equipment = page.getByRole('dialog', { name: 'Registrar equipo' });
  await expect(equipment.getByLabel('IMEI (opcional)')).toHaveValue('');
  await equipment.getByLabel('IMEI (opcional)').fill('12345');
  await equipment.getByLabel('Modelo').fill(model);
  await equipment.getByLabel('Color').fill('Azul');
  await equipment.getByLabel('Precio de venta').fill('1400');
  await equipment.getByRole('button', { name: 'Guardar equipo' }).click();
  await expect(equipment.getByText('El IMEI tiene 15 dígitos')).toBeVisible();

  await equipment.getByLabel('IMEI (opcional)').fill('');
  await equipment.getByRole('button', { name: 'Guardar equipo' }).click();
  await expect(equipment).toBeHidden();

  const { inventory } = await fetchInventory(request, email);
  expect(inventory.find((item) => item.model === model)).toMatchObject({ imei: '' });

  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByRole('button', { name: 'Nuevo canje' }).click();
  const trade = page.getByRole('dialog', { name: 'Nuevo canje' });
  await expect(trade.getByLabel('IMEI (opcional)')).toHaveValue('');
  await trade.getByLabel('Cliente').fill(`Cliente ${Date.now()}`);
  await trade.getByLabel('Equipo recibido').fill(received);
  await trade.getByLabel('Valor tomado').fill('100');
  await trade.getByRole('combobox', { name: 'Equipo' }).fill('Equipo libre');
  await trade.getByLabel('Precio completo de salida').fill('900');
  await page.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(trade).toBeHidden();

  await page.getByTestId('sidebar-tab-service').click();
  await page.getByRole('button', { name: 'Nueva orden' }).click();
  const repair = page.getByRole('dialog', { name: 'Nueva orden de reparación' });
  await expect(repair.getByLabel('IMEI (opcional)')).toHaveValue('');
  await repair.getByRole('combobox').fill(`Cliente orden ${Date.now()}`);
  await repair.getByPlaceholder('iPhone 13').fill('iPhone 12');
  await repair.getByRole('button', { name: 'Pantalla' }).click();
  await repair.getByRole('button', { name: 'Crear orden' }).click();
  await expect(repair).toBeHidden();
  await expect(page.getByText('iPhone 12')).toBeVisible();
});

test.describe('optional IMEI on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('saves equipment and a repair without an IMEI', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'optional-imei-phone');
    const model = `Cel sin IMEI ${Date.now()}`;
    await bootstrapStoreViaApi(page, request, email, `IMEI cel ${testInfo.parallelIndex}`);

    await page.getByTestId('sidebar-tab-inventory').click();
    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar equipo' }).click();
    const equipment = page.getByRole('dialog', { name: 'Registrar equipo' });
    await expect(equipment.getByLabel('IMEI (opcional)')).toBeVisible();
    await equipment.getByLabel('Modelo').fill(model);
    await equipment.getByLabel('Color').fill('Verde');
    await equipment.getByLabel('Precio de venta').fill('900');
    await equipment.locator('.sheet-foot').getByRole('button', { name: 'Guardar equipo' }).click();
    await expect(equipment).toBeHidden();

    const { inventory } = await fetchInventory(request, email);
    expect(inventory.find((item) => item.model === model)).toMatchObject({ imei: '' });

    await page.getByTestId('sidebar-tab-more').click();
    await page.getByTestId('sidebar-tab-service').click();
    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Nueva orden' }).click();
    const repair = page.getByRole('dialog', { name: 'Nueva orden de reparación' });
    await expect(repair.getByLabel('IMEI (opcional)')).toBeVisible();
    await repair.getByRole('combobox').fill(`Cliente cel ${Date.now()}`);
    await repair.getByPlaceholder('iPhone 13').fill('Pixel 7');
    await repair.getByRole('button', { name: 'Batería' }).click();
    await repair.locator('.sheet-foot').getByRole('button', { name: 'Crear orden' }).click();
    await expect(repair).toBeHidden();
    await expect(page.getByText('Pixel 7')).toBeVisible();
  });
});
