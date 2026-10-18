import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { initials } from '../src/desk/format';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createInventoryItemViaApi, fetchSales } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
async function post(request: APIRequestContext, email: string, path: string, data: object) {
  const response = await request.post(`${api}/api${path}`, { headers: authHeaders(email), data });
  expect(response.ok(), `${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}
async function salesTab(page: Page) {
  await page.getByTestId('sidebar-tab-sales').click();
  await expect(page.getByTestId('sales-screen')).toBeVisible();
}

export function editSaleSellerTests(phone: boolean) {
  for (const variant of ['usd-in-ars', 'ars-in-usd', 'trade-deposit', 'pending'] as const) {
    test(`seller edit persists and commissions refresh · ${variant}`, async ({ page, request }, info) => {
      const email = buildTestEmail(info, 'edit-sale-seller');
      await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1200, venta: 1234.56 } }));
      await bootstrapStoreViaApi(page, request, email, 'Editar vendedor');
      const currency = variant === 'ars-in-usd' ? 'ARS' : 'USD';
      const activeCurrency = variant === 'ars-in-usd' ? 'USD' : 'ARS';
      const settings = await request.patch(`${api}/api/stores/current`, { headers: authHeaders(email), data: { currency: activeCurrency, exchangeMode: 'manual', manualBuy: 1200, manualSell: 1234.56 } });
      expect(settings.ok(), await settings.text()).toBeTruthy();
      const sellers = await request.get(`${api}/api/commissions/sellers`, { headers: authHeaders(email) });
      expect(sellers.ok()).toBeTruthy();
      const seller = (await sellers.json()).sellers[0] as { id: string; name: string };
      await post(request, email, '/commissions/rules', { rate: 10, basis: 'SALE_PERCENT', effectiveFrom: '2025-01-01T00:00:00Z' });
      const { inventoryItem } = await createInventoryItemViaApi(request, email, { imei: '359123456789012', model: 'Equipo vendedor', price: 1500.31, cost: 900 });
      const { client } = await createClientViaApi(request, email, { name: 'Cliente vendedor', dni: '30123456', phone: '2615551234', email: 'cliente-vendedor@example.test' });
      let depositId: string | undefined;
      if (variant === 'trade-deposit') {
        const { deposit } = await post(request, email, `/clients/${client.id}/deposits`, { amount: 50, currency, exchangeRate: 1234.56, method: 'EFECTIVO', requestKey: `deposit-${info.testId}` });
        depositId = deposit.id;
      }
      const { sale } = await post(request, email, '/operations/sales', {
        clientId: client.id, productId: inventoryItem.id, amount: 1500.31, currency, exchangeRate: 1234.56,
        status: variant === 'pending' ? 'PENDIENTE' : 'COMPLETADA', paymentMethod: 'EFECTIVO',
        ...(depositId ? { depositIds: [depositId], tradeIn: { deviceReceived: 'Equipo recibido', takeValue: 300.21 } } : {}),
      });
      expect(sale.sellerMemberId).toBeNull();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await salesTab(page);
      const row = () => page.getByTestId('sales-screen').locator(phone ? '.phone-row' : 'tbody tr').filter({ hasText: 'Equipo vendedor' });
      if (phone) await expect(row().locator('.av-c')).toHaveText('');
      else await expect(row()).toContainText('Sin vendedor');
      await row().click();
      let detail = page.getByRole('dialog', { name: /V-/ });
      await expect(detail.getByText('Vendedor', { exact: true }).locator('..')).toContainText('Sin vendedor');
      await detail.getByRole('button', { name: 'Editar', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Editar operación' });
      await editor.getByRole('combobox', { name: 'Vendedor', exact: true }).click();
      await page.getByRole('option').filter({ hasText: seller.name }).click();
      const saved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/operations/sales/sales/${sale.id}`));
      await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      const response = await saved;
      expect(response.status(), await response.text()).toBe(200);
      expect(response.request().postDataJSON()).toMatchObject({ sellerMemberId: seller.id, amount: 1500.31, currency });
      await expect(editor).toBeHidden();
      // Both projections update immediately, before reloading.
      if (phone) await expect(row().locator('.av-c')).toHaveText(initials(seller.name));
      else await expect(row()).toContainText(seller.name);
      await row().click();
      detail = page.getByRole('dialog', { name: /V-/ });
      await expect(detail.getByText('Vendedor', { exact: true }).locator('..')).toContainText(seller.name);
      await page.keyboard.press('Escape');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await salesTab(page);
      if (phone) await expect(row().locator('.av-c')).toHaveText(initials(seller.name));
      else await expect(row()).toContainText(seller.name);
      await row().click();
      detail = page.getByRole('dialog', { name: /V-/ });
      await expect(detail.getByText('Vendedor', { exact: true }).locator('..')).toContainText(seller.name);
      await page.keyboard.press('Escape');
      const persisted = (await fetchSales(request, email)).sales.find(item => item.id === sale.id);
      expect(persisted).toMatchObject({ sellerMemberId: seller.id, amount: 1500.31, amountCurrency: currency, status: sale.status, clientId: client.id });

      if (phone) await page.getByTestId('sidebar-tab-more').click();
      await page.getByTestId('sidebar-tab-commissions').click();
      await expect(page.getByRole('heading', { name: 'Comisiones', exact: true })).toBeVisible();
      await page.locator(phone ? '.commission-person' : '.commission-name').filter({ hasText: seller.name }).click();
      const commission = page.locator('.commission-detail');
      await expect(commission.locator('.commission-line').filter({ hasText: 'Equipo vendedor' })).toContainText('150,03');
      await page.keyboard.press('Escape');

      // Clearing the seller persists and leaves no active accrual in the API view.
      await salesTab(page); await row().click();
      await page.getByRole('dialog', { name: /V-/ }).getByRole('button', { name: 'Editar', exact: true }).click();
      await editor.getByRole('combobox', { name: 'Vendedor', exact: true }).click();
      await page.getByRole('option', { name: 'Sin vendedor', exact: true }).click();
      await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      await expect(editor).toBeHidden();
      if (phone) await expect(row().locator('.av-c')).toHaveText('');
      else await expect(row()).toContainText('Sin vendedor');
      expect((await fetchSales(request, email)).sales.find(item => item.id === sale.id)).toMatchObject({ sellerMemberId: null });
      const cleared = await request.get(`${api}/api/commissions/members/${seller.id}`, { headers: authHeaders(email) });
      expect(cleared.ok(), await cleared.text()).toBeTruthy();
      expect((await cleared.json()).person.earned).toEqual({ ARS: 0, USD: 0 });
      await post(request, email, `/operations/sales/sales/${sale.id}/cancel`, {});
      await page.reload({ waitUntil: 'domcontentloaded' }); await salesTab(page); await row().click();
      await expect(page.getByRole('dialog', { name: /V-/ }).getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await row().click({ button: 'right' });
      await expect(page.locator('.ctx').getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
      await expect(page.locator('.ctx').getByRole('button', { name: 'Anular', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
}
