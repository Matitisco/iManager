import { expect, test } from '@playwright/test';
import { openDeskSection } from './navigation';
import { sheetAction } from './sheet-actions';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi, fetchSales, updateStoreViaApi } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
for (const width of [1440, 390]) {
  test.describe(`seña en venta ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('@smoke registra un encargue con seña ARS, muestra el saldo y lo cobra desde Ventas', async ({ page, request }, info) => {
      const email = buildTestEmail(info, `sale-deposit-${width}`);
      const headers = authHeaders(email);
      await bootstrapStoreViaApi(page, request, email, 'Señas ficticias');
      await updateStoreViaApi(request, email, { currency: 'USD', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1000 });
      const { client } = await createClientViaApi(request, email, { name: 'Cliente ficticio de seña', dni: '30111222' });
      await page.reload(); await openDeskSection(page, 'sales');
      const createButton = width === 390 ? page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar venta', exact: true }) : page.getByRole('button', { name: 'Registrar venta', exact: true });
      await createButton.click();
      const form = page.getByRole('dialog', { name: 'Registrar venta' });
      await form.getByRole('combobox', { name: 'Cliente', exact: true }).fill(client.name);
      await page.getByRole('option', { name: new RegExp(client.name) }).click();
      await form.getByRole('combobox', { name: 'Equipo', exact: true }).fill('Equipo por encargo ficticio');
      await form.getByLabel('Precio completo de salida').fill('500');
      await form.getByRole('button', { name: 'Seña', exact: true }).click();
      await form.getByRole('group', { name: 'Moneda de la seña' }).getByRole('button', { name: 'ARS', exact: true }).click();
      await form.getByLabel('Monto de la seña').fill('100000');
      await expect(form.getByLabel('Saldo a cobrar')).toHaveText('US$ 400');
      expect(await form.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await form.getByRole('button', { name: 'Confirmar venta' }).click(); await expect(form).toBeHidden();
      const sale = (await fetchSales(request, email)).sales[0];
      expect(sale).toMatchObject({ hasInitialDeposit: true, openBalance: 400, status: 'PENDIENTE' });
      const row = page.locator(width === 390 ? '.phone-row' : 'tbody tr').filter({ hasText: 'Equipo por encargo ficticio' });
      await expect(row).toContainText('Seña'); await row.click();
      const detail = page.getByRole('dialog').last();
      await expect(detail).toContainText('Seña al registrar la venta');
      await (await sheetAction(detail, 'Marcar cobrada')).click(); await expect(detail).toBeHidden();
      expect((await fetchSales(request, email)).sales[0]).toMatchObject({ status: 'COMPLETADA', openBalance: 0 });
      const receipts = await request.get(`${api}/api/clients/${client.id}/deposits`, { headers });
      expect((await receipts.json()).deposits).toEqual([expect.objectContaining({ amount: 100000, currency: 'ARS', usdAmount: 100, saleId: sale.id, status: 'APPLIED' })]);
      await page.reload();
      await expect(page.locator(width === 390 ? '.phone-row' : 'tbody tr').filter({ hasText: 'Equipo por encargo ficticio' })).toContainText('Completada');
    });
  });
}
