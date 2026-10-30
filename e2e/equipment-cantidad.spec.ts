import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { buildTestEmail, authHeaders } from './utils';
import { openDeskSection } from './navigation';
const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3100';
for (const width of [1440, 390]) test.describe(`Stock ${width}`, () => {
  test.use({ viewport: { width, height: width === 1440 ? 900 : 844 }, deviceScaleFactor: width === 1440 ? 1 : 2 });
  test('@smoke cantidad de stock y venta parcial', async ({ page, request }, info) => {
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
  const email = buildTestEmail(info, 'cantidad');
  await request.get(`${api}/api/me`, { headers: authHeaders(email) });
  const store = await request.post(`${api}/api/stores`, { headers: authHeaders(email), data: { name: 'Mayorista ficticio' } });
  expect(store.ok()).toBe(true);
  await request.patch(`${api}/api/stores/current`, { headers: authHeaders(email), data: { instagram: 'tienda.ficticia' } });
  await page.addInitScript(email => localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email })), email);
  await page.goto('/');
  await expect(page.locator('.desk-app')).toBeVisible();
  const saved = await request.post(`${api}/api/inventory/import`, { headers: authHeaders(email), data: { rows: [
    { model: '15 Pro', capacity: '128GB', quantity: 73, cost: 450, price: 650, currency: 'USD' },
    { model: '14 Pro', capacity: '256GB', quantity: 83, cost: 350, price: 500, currency: 'USD' },
  ] } });
  expect(saved.ok()).toBe(true);
  expect((await saved.json()).imported).toBe(2);
  await page.reload(); await openDeskSection(page, 'inventory');
  const shot = async (name: string) => {
    if (!process.env.CANTIDAD_SHOTS) return;
    await mkdir(process.env.CANTIDAD_SHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.CANTIDAD_SHOTS}/${name}-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  await expect(page.getByTestId('inventory-total')).toContainText('156 de 156');
  await shot('inventario');
  if (width === 1440) {
    const qty = page.getByRole('spinbutton', { name: 'Cantidad de 15 Pro' });
    await qty.fill('74'); await qty.press('Enter'); await expect(qty).toHaveValue('74');
  }
  await page.getByRole('button', { name: 'Registrar equipo', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Registrar equipo' });
  await expect(form.getByLabel('Cantidad')).toHaveValue('1');
  await form.getByLabel('Cantidad').scrollIntoViewIfNeeded(); await shot('alta');
  await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const title = page.getByText('15 Pro · 128GB', { exact: true }).first();
  await title.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Cantidad', { exact: true })).toHaveValue(width === 1440 ? '74' : '73');
  await page.getByRole('dialog').getByLabel('Cantidad', { exact: true }).scrollIntoViewIfNeeded(); await shot('edicion');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await title.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Vendido', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar estado', exact: true }).click();
  const sale = page.getByRole('dialog', { name: 'Registrar venta' });
  await expect(sale.getByLabel('Cantidad', { exact: true })).toHaveValue('1');
  await sale.getByLabel('Cantidad', { exact: true }).fill('3');
  await sale.getByLabel('Cantidad', { exact: true }).scrollIntoViewIfNeeded(); await shot('venta');
  await sale.getByRole('button', { name: 'Confirmar venta', exact: true }).click();
  await expect(sale).toBeHidden();
  const inventory = await request.get(`${api}/api/inventory`, { headers: authHeaders(email) });
  const items = (await inventory.json()).inventory;
  expect(items).toHaveLength(2);
  expect(items.find((item: { model: string }) => item.model === '15 Pro')).toMatchObject({ cantidad: width === 1440 ? 71 : 70, status: 'DISPONIBLE' });
});
});
