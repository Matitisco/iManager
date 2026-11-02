import { expect, test } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi } from './utils';
import { openDeskSection } from './navigation';

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';

for (const width of [1440, 390]) {
  test.describe(`client purchases at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('revalidates four cached purchases after three more sales in the same store', async ({ page, request }, testInfo) => {
      const email = buildTestEmail(testInfo, `purchases-${width}`);
      await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1000, venta: 1000, fechaActualizacion: '2026-11-02T12:00:00Z' } }));
      await bootstrapStoreViaApi(page, request, email, 'iShop Baires ficticia');
      const { client } = await createClientViaApi(request, email, { name: 'Jose barrera', balanceCurrency: 'USD' });
      const headers = authHeaders(email);
      const stock = await request.post(`${apiBase}/api/inventory`, { headers, data: {
        model: 'iPhone 13', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 400, price: 600, currency: 'USD', cantidad: 20, status: 'DISPONIBLE',
      } });
      expect(stock.ok(), await stock.text()).toBeTruthy();
      const productId = (await stock.json()).inventoryItem.id;
      const quantities = [2, 3, 1, 2, 1, 3, 1];
      async function sell(i: number) {
        const response = await request.post(`${apiBase}/api/operations/sales`, { headers, data: {
          clientId: client.id, productId, date: '02/11/2026', cantidad: quantities[i], amount: 600 * quantities[i], currency: 'USD', exchangeRate: 1000, status: 'COMPLETADA', paymentMethod: 'EFECTIVO', requestKey: `client-purchases-${i}`,
        } });
        expect(response.ok(), await response.text()).toBeTruthy();
      }
      for (let i = 0; i < 4; i++) await sell(i);
      await page.reload();
      await openDeskSection(page, 'clients');
      const row = page.getByTestId(`client-row-${client.id}`);
      await expect(row).toBeVisible();
      // The app has loaded four sales. Subsequent writes happen outside its state.
      await row.click();
      await expect(page.getByTestId('client-purchase-count')).toHaveText('4');
      await page.getByRole('dialog', { name: 'Jose barrera', exact: true }).getByRole('button', { name: 'Cerrar', exact: true }).first().click();
      for (let i = 4; i < 7; i++) await sell(i);
      const stored = await request.get(`${apiBase}/api/sales`, { headers });
      expect((await stored.json()).sales.filter((sale: { clientId: string }) => sale.clientId === client.id)).toHaveLength(7);
      await row.click();
      await expect(page.getByTestId('client-purchase-count')).toHaveText('7');
      await expect(page.getByTestId('client-purchase-stats').locator('.dstat').filter({ hasText: 'Compras' })).toHaveText('Compras7');
      await expect(page.getByTestId('client-purchases').locator('.buy-item')).toHaveCount(3);
      await page.screenshot({ path: testInfo.outputPath('client-purchases-seven.png'), fullPage: true });
      await page.getByTestId('purchases-more').click();
      const purchases = page.getByRole('dialog', { name: width === 390 ? 'Compras' : 'Compras · Jose barrera', exact: true });
      await expect(purchases.locator('.buy-item')).toHaveCount(7);
      await expect(purchases.locator('.sale-quantity').filter({ hasText: 'x3' })).toHaveCount(2);
    });
  });
}
