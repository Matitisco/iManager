import { openDeskSection } from './navigation';
import { enableHiddenSections } from './hidden-sections';
import { devices, expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType });

async function openClients(page: Page) {
  await openDeskSection(page, 'clients');
}

async function post(request: APIRequestContext, email: string, url: string, data: unknown) {
  const response = await request.post(`${api}${url}`, { headers: authHeaders(email), data });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

for (const device of [
  { name: 'desktop', mobile: false, options: { viewport: { width: 1440, height: 900 } } },
  { name: 'iphone', mobile: true, options: iphone },
]) {
  test.describe(`account lines ${device.name}`, () => {
    test.use(device.options);

    test('keeps one credit, the manual balance, the sale debt and the installment', async ({ page, request }, info) => {
      test.setTimeout(120_000);
      await enableHiddenSections(page, ['cuenta-corriente']);
      const email = buildTestEmail(info, `lineas-${device.name}`);
      await bootstrapStoreViaApi(page, request, email, 'iManager · Líneas');
      const { client } = await createClientViaApi(request, email, { name: 'Ana Pérez', phone: '2615550199', dni: '30111999' });
      await post(request, email, `/api/accounts/clients/${client.id}/movements`, { kind: 'CARGO', amount: 35, currency: 'ARS', note: 'Saldo manual' });
      const covered = await post(request, email, '/api/operations/sales', {
        clientId: client.id, deviceLabel: 'Cuotas', amount: 100, currency: 'ARS', paymentMethod: 'EFECTIVO',
        installments: { count: 2, frequency: 'MENSUAL', firstDueDate: '2026-11-14' },
      });
      expect(covered.sale.paymentMethod).toBe('SIN_PAGO');
      const open = await post(request, email, '/api/operations/sales', {
        clientId: client.id, deviceLabel: 'Accesorio', amount: 30, currency: 'ARS', paymentMethod: 'EFECTIVO', status: 'PENDIENTE',
      });
      const paid = await post(request, email, '/api/operations/sales', {
        clientId: client.id, deviceLabel: 'Cobrado', amount: 40, currency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA',
      });

      await page.reload();
      await openDeskSection(page, 'sales');
      const saleRow = page.locator(device.mobile ? '.phone-row' : 'tbody tr').filter({ hasText: 'Cuotas' });
      await expect(saleRow).toContainText('Sin pago');
      await expect(saleRow).not.toContainText('Efectivo');
      await saleRow.click();
      const beforePay = page.getByRole('dialog', { name: /V-/ });
      await expect(beforePay.getByText('Deuda $ 100')).toBeVisible();
      await expect(beforePay.locator('.kv').filter({ hasText: 'Cuota 1' })).toContainText('$ 50');
      await page.keyboard.press('Escape');
      await expect(beforePay).toBeHidden();

      await post(request, email, `/api/clients/${client.id}/payments`, { amount: 30, method: 'EFECTIVO', currency: 'ARS' });
      await page.reload();
      await openDeskSection(page, 'sales');
      await saleRow.click();
      const afterPay = page.getByRole('dialog', { name: /V-/ });
      await expect(afterPay.getByText('Deuda $ 70')).toBeVisible();
      await expect(afterPay.locator('.kv').filter({ hasText: 'Cuota 1' })).toContainText('$ 20');
      await page.keyboard.press('Escape');

      await post(request, email, `/api/operations/sales/sales/${covered.sale.id}/cancel`, {});
      await post(request, email, `/api/operations/sales/sales/${open.sale.id}/cancel`, {});
      await post(request, email, `/api/operations/sales/sales/${paid.sale.id}/cancel`, {});
      await page.reload();
      await openClients(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Clientes', exact: true })).toBeVisible();
      const clientRow = page.getByTestId(`client-row-${client.id}`);
      await expect(clientRow).toContainText('Saldo $ 5');
      await clientRow.click();
      const record = page.getByRole('dialog', { name: 'Ana Pérez' });
      await expect(record.locator('.kv', { has: page.getByText('Deuda', { exact: true }) })).toContainText('$ 35');
      await expect(record.locator('.kv', { has: page.getByText('Saldo a favor', { exact: true }) })).toContainText('$ 30');
      await expect(record.getByText('Saldo a favor (sin cobro)')).toHaveCount(1);
      await expect(record.getByText('$ 60')).toHaveCount(0);
      await expect(record.getByText('$ 65')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Cuenta corriente' }).click();
      const panel = page.getByTestId('account-current');
      await expect(panel.getByTestId(`account-balance-${client.id}`)).toHaveText('$ 5');
      await expect(panel.getByText('Saldo a favor $ 30')).toHaveCount(1);
      await expect(panel.getByText('Saldo manual')).toBeVisible();
      await expect(panel.locator('.acct-line').filter({ hasText: 'Saldo manual' })).toContainText('$ 35');
    });

    test('asks for the amount before saving a payment', async ({ page, request }, info) => {
      test.setTimeout(120_000);
      const email = buildTestEmail(info, `pago-${device.name}`);
      await bootstrapStoreViaApi(page, request, email, 'iManager · Pago');
      const { client } = await createClientViaApi(request, email, { name: 'Luis Gómez', phone: '2615550188', dni: '30111888', pendingBalance: 165, balanceCurrency: 'ARS' });
      const payments = () => request.get(`${api}/api/clients/${client.id}/payments`, { headers: authHeaders(email) });
      expect((await payments()).ok()).toBeTruthy();
      await page.reload();
      await openClients(page);
      await page.getByTestId(`client-row-${client.id}`).click();
      const record = page.getByRole('dialog', { name: 'Luis Gómez' });
      await record.getByRole('button', { name: 'Registrar pago' }).click();
      const sheet = page.getByRole('dialog', { name: 'Registrar pago' });
      await expect(sheet.getByLabel('Monto')).toHaveValue('165');
      expect(await (await payments()).json()).toMatchObject({ payments: [] });
      await sheet.getByRole('button', { name: 'Volver' }).click();
      await expect(record).toBeVisible();
      expect(await (await payments()).json()).toMatchObject({ payments: [] });
      await record.getByRole('button', { name: 'Registrar pago' }).click();
      const again = page.getByRole('dialog', { name: 'Registrar pago' });
      await again.getByLabel('Monto').fill('40');
      await again.getByRole('button', { name: 'Confirmar pago' }).click();
      await expect(page.getByText('Pago registrado')).toBeVisible();
      const saved = await (await payments()).json();
      expect(saved.payments).toEqual([expect.objectContaining({ amount: 40, kind: 'PAGO' })]);
    });
  });
}
