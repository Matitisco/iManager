import { expect, test } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi } from './utils';
const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
for (const phone of [false, true]) {
  test.describe(`return sales ${phone ? 'mobile' : 'desktop'}`, () => {
    test.use({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
    test('opens from cold lists, retries and persists a partial pending USD claim', async ({ page, request }, info) => {
      const email = buildTestEmail(info, 'return-sales');
      await bootstrapStoreViaApi(page, request, email, 'Mayorista ficticia');
      const headers = authHeaders(email);
      const { client } = await createClientViaApi(request, email, { name: 'Cliente mayorista', dni: '30111222' });
      const item = await request.post(`${api}/api/inventory`, { headers, data: { model: 'iPhone 13', capacity: '128GB', color: '', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 300, price: 500, currency: 'USD', cantidad: 8, status: 'DISPONIBLE' } });
      expect(item.status()).toBe(201);
      const productId = (await item.json()).inventoryItem.id;
      const sale = await request.post(`${api}/api/operations/sales`, { headers, data: { productId, clientId: client.id, cantidad: 3, amount: 1500, currency: 'USD', exchangeRate: 1000, status: 'PENDIENTE', paymentMethod: 'EFECTIVO', date: '2026-10-30' } });
      expect(sale.status()).toBe(201);
      const saleId = (await sale.json()).sale.id;
      // Reproduce a fresh mobile session whose global sales read fails.
      await page.route('**/api/sales', route => route.abort());
      let fail = true;
      await page.route('**/api/returns/eligible-sales', route => fail ? route.fulfill({ status: 503, json: { error: 'No se pudieron cargar las ventas' } }) : route.continue());
      await page.goto('/#/comercial/devoluciones');
      await page.reload();
      await page.getByRole('button', { name: 'Nuevo reclamo', exact: true }).first().click();
      const form = page.getByRole('dialog', { name: 'Nuevo reclamo', exact: true });
      await expect(form.getByRole('alert')).toBeVisible();
      await expect(form.getByRole('button', { name: 'Abrir reclamo', exact: true })).toBeDisabled();
      fail = false;
      await form.getByRole('button', { name: 'Reintentar', exact: true }).click();
      await form.getByRole('combobox', { name: 'Venta', exact: true }).click();
      await page.getByRole('option', { name: /Cliente mayorista.*iPhone 13.*30\/10\/2026/ }).click();
      await form.getByRole('spinbutton', { name: 'Cantidad a devolver' }).fill('1');
      await form.getByLabel('Motivo', { exact: true }).fill('Una unidad no enciende');
      await form.getByRole('button', { name: 'Abrir reclamo', exact: true }).click();
      await expect(form).toBeHidden();
      const saved = await (await request.get(`${api}/api/returns`, { headers })).json();
      expect(saved.returns).toEqual([expect.objectContaining({ saleId, cantidad: 1, refundable: 0 })]);
      await page.reload();
      await expect(page.getByTestId(`return-${saved.returns[0].id}`)).toBeVisible();
      const available = await (await request.get(`${api}/api/returns/eligible-sales`, { headers })).json();
      expect(available.sales).toContainEqual(expect.objectContaining({ id: saleId, remainingQuantity: 2 }));
      const inventory = await (await request.get(`${api}/api/inventory`, { headers })).json();
      expect(inventory.inventory.find((row: { id: string }) => row.id === productId)).toMatchObject({ cantidad: 5, status: 'DISPONIBLE' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone ? 390 : 1440);
    });
  });
}
