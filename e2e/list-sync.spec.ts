import { expect, test } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi, fetchInventory } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';

test('a section change drops a device deleted elsewhere, and another page follows a local delete', async ({ page, context, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'list-sync');
  await bootstrapStoreViaApi(page, request, email, 'iManager · Listas');
  const headers = authHeaders(email);
  const stale = await createInventoryItemViaApi(request, email, { imei: '359111111111111', model: 'Pixel Viejo', price: 400000 });
  const shared = await createInventoryItemViaApi(request, email, { imei: '359222222222222', model: 'Pixel Compartido', price: 500000 });
  await page.reload();
  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByText('Pixel Viejo')).toBeVisible();
  await expect(page.getByText('Pixel Compartido')).toBeVisible();

  expect((await request.delete(`${api}/api/inventory/${stale.inventoryItem.id}`, { headers })).status()).toBe(204);
  await expect(page.getByText('Pixel Viejo')).toBeVisible();
  const refreshed = page.waitForResponse((response) => response.url().includes('/api/inventory') && response.request().method() === 'GET' && response.ok());
  await page.getByTestId('sidebar-tab-sales').click();
  await refreshed;
  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByText('Pixel Viejo')).toHaveCount(0);
  await expect(page.getByText('Pixel Compartido')).toBeVisible();

  const other = await context.newPage();
  await other.goto('/');
  const settled = other.waitForResponse((response) => response.url().includes('/api/inventory') && response.request().method() === 'GET' && response.ok());
  await other.getByTestId('sidebar-tab-inventory').click();
  await settled;
  await expect(other.getByText('Pixel Compartido')).toBeVisible();
  const record = page.getByRole('row').filter({ hasText: 'Pixel Compartido' });
  await record.click({ button: 'right' });
  await page.locator('.ctx').getByRole('button', { name: 'Eliminar', exact: true }).click();
  const synced = other.waitForResponse((response) => response.url().includes('/api/inventory') && response.request().method() === 'GET' && response.ok());
  await page.getByRole('dialog', { name: 'Eliminar registro' }).getByRole('button', { name: 'Eliminar', exact: true }).click();
  await synced;
  await expect(other.getByText('Pixel Compartido')).toHaveCount(0);
  expect((await fetchInventory(request, email)).inventory.map((item) => item.model)).not.toContain('Pixel Compartido');
  await other.close();
});

test('a refresh keeps the text typed in an open sale', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'list-sync-draft');
  await bootstrapStoreViaApi(page, request, email, 'iManager · Borrador');
  await page.getByTestId('sidebar-tab-sales').click();
  await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  const client = page.getByRole('combobox', { name: 'Cliente' });
  await client.fill('Borrador sin guardar');
  const refreshed = page.waitForResponse((response) => response.url().includes('/api/sales') && response.request().method() === 'GET' && response.ok());
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await refreshed;
  await expect(client).toHaveValue('Borrador sin guardar');
  await expect(page.getByRole('dialog', { name: 'Registrar venta' })).toBeVisible();
});
