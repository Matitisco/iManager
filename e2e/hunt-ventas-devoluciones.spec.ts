import { expect, test } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
const app = process.env.PLAYWRIGHT_APP_BASE_URL?.trim() || 'http://127.0.0.1:4173';
for (const value of [api, app]) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname)) throw new Error('QA hunt requires local services');
}

for (const width of [1440, 390]) {
  test.describe(`QA devoluciones ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('devuelve una unidad en USD y conserva acumulado ARS, stock y margen tras recargar', async ({ page, request }, info) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
      });
      const email = buildTestEmail(info, 'hunt-returns');
      await bootstrapStoreViaApi(page, request, email, 'Tienda ficticia QA');
      const headers = authHeaders(email);
      const config = await request.patch(`${api}/api/stores/current`, { headers, data: { currency: 'ARS', exchangeMode: 'manual', manualBuy: 1250, manualSell: 1250 } });
      expect(config.ok()).toBeTruthy();
      const { client } = await createClientViaApi(request, email, { name: 'Cliente cuenta en pesos', dni: '30111222' });
      const item = await request.post(`${api}/api/inventory`, { headers, data: {
        model: 'iPhone lote QA', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%',
        cost: 60, price: 100, currency: 'USD', cantidad: 10, status: 'DISPONIBLE',
      } });
      expect(item.status()).toBe(201);
      const productId = (await item.json()).inventoryItem.id;
      const sold = await request.post(`${api}/api/operations/sales`, { headers, data: {
        productId, clientId: client.id, cantidad: 4, amount: 400, currency: 'USD', exchangeRate: 1250, status: 'COMPLETADA', paymentMethod: 'EFECTIVO',
      } });
      expect(sold.status()).toBe(201);
      const saleId = (await sold.json()).sale.id;
      await page.goto('/#/comercial/devoluciones');
      await page.reload();
      await page.getByRole('button', { name: 'Nuevo reclamo', exact: true }).first().click();
      const form = page.getByRole('dialog', { name: 'Nuevo reclamo', exact: true });
      await form.getByRole('combobox', { name: 'Venta', exact: true }).click();
      await page.getByRole('option', { name: /Cliente cuenta en pesos.*iPhone lote QA/ }).click();
      await form.getByLabel('Cantidad a devolver').fill('1');
      await form.getByLabel('Motivo', { exact: true }).fill('Una de cuatro unidades falla al cargar');
      await form.getByRole('button', { name: 'Abrir reclamo', exact: true }).click();
      await expect(form).toBeHidden();
      const claims = await (await request.get(`${api}/api/returns`, { headers })).json();
      const claim = claims.returns.find((row: { saleId: string }) => row.saleId === saleId);
      await page.getByTestId(`return-${claim.id}`).click();
      const detail = page.getByRole('dialog');
      await detail.getByRole('button', { name: 'Cambiar estado', exact: true }).click();
      await detail.getByRole('button', { name: 'Resuelto', exact: true }).click();
      await detail.getByRole('button', { name: 'Reintegro', exact: true }).click();
      await expect(detail.getByLabel('Importe', { exact: true })).toHaveValue('100');
      await detail.getByRole('button', { name: 'En revisión', exact: true }).scrollIntoViewIfNeeded();
      await expect(detail.getByRole('button', { name: 'En revisión', exact: true })).toBeInViewport();
      await expect(detail.getByRole('button', { name: 'Guardar', exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: info.outputPath(`resolucion-${width}.png`) });
      await detail.getByRole('button', { name: 'Guardar', exact: true }).click();
      await expect(detail).toBeHidden();
      await page.reload();
      await expect(page.getByTestId(`return-${claim.id}`)).toBeVisible();
      const clients = await (await request.get(`${api}/api/clients`, { headers })).json();
      expect(clients.clients.find((row: { id: string }) => row.id === client.id).totalSpent).toBe(375000);
      const inventory = await (await request.get(`${api}/api/inventory`, { headers })).json();
      expect(inventory.inventory.find((row: { id: string }) => row.id === productId).cantidad).toBe(6);
      expect(inventory.inventory.reduce((sum: number, row: { cantidad: number }) => sum + row.cantidad, 0)).toBe(7);
      const overview = await (await request.get(`${api}/api/reports/overview?rangeKey=all_time`, { headers })).json();
      expect(overview.overview.summary).toMatchObject({ revenue: 375000, grossProfit: 150000, returnsAmount: 125000 });
      expect(errors).toEqual([]);
    });
  });
}
