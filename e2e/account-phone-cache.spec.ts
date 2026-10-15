import { devices, expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi, updateStoreViaApi } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType });

async function openClients(page: Page) {
  const target = page.getByTestId('sidebar-tab-clients');
  const more = page.getByTestId('sidebar-tab-more');
  await expect(target.or(more).first()).toBeVisible();
  if (!(await target.isVisible())) await more.click();
  await target.click();
}

async function post(request: APIRequestContext, email: string, url: string, data: unknown) {
  const response = await request.post(`${api}${url}`, { headers: authHeaders(email), data });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

function clientsList(url: string, method: string) {
  if (method !== 'GET') return false;
  const path = new URL(url).pathname;
  return /\/api\/clients\/?$/.test(path);
}

for (const device of [
  { name: 'desktop', mobile: false, options: { viewport: { width: 1440, height: 900 } } },
  { name: 'iphone', mobile: true, options: iphone },
]) {
  test.describe(`sale debt and client badge ${device.name}`, () => {
    test.use(device.options);

    test('shows the updated sale debt when the loaded balance is still the old one', async ({ page, request }, info) => {
      test.setTimeout(120_000);
      const email = buildTestEmail(info, `cobro-${device.name}`);
      await bootstrapStoreViaApi(page, request, email, 'iManager · Cobro');
      const { client } = await createClientViaApi(request, email, { name: 'Ana Pérez', phone: '2615550191', dni: '30111991' });
      await post(request, email, '/api/operations/sales', {
        clientId: client.id, deviceLabel: 'Cuotas', amount: 100, currency: 'USD', paymentMethod: 'EFECTIVO',
        installments: { count: 2, frequency: 'MENSUAL', firstDueDate: '2026-11-14' },
      });

      const listed = page.waitForResponse((response) => clientsList(response.url(), response.request().method()) && response.ok());
      await page.reload();
      const staleClients = await (await listed).text();
      await page.getByTestId('sidebar-tab-sales').click();
      const saleRow = page.locator(device.mobile ? '.phone-row' : 'tbody tr').filter({ hasText: 'Cuotas' });
      await expect(saleRow).toBeVisible();

      await page.route('**/api/clients**', async (route) => {
        const method = route.request().method();
        const path = new URL(route.request().url()).pathname;
        if (method === 'GET' && /\/payments\/?$/.test(path)) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ payments: [] }) });
          return;
        }
        if (clientsList(route.request().url(), method)) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: staleClients, headers: { 'cache-control': 'no-store' } });
          return;
        }
        await route.continue();
      });
      await post(request, email, `/api/clients/${client.id}/payments`, { amount: 30, method: 'EFECTIVO', currency: 'USD' });

      const accountResponse = page.waitForResponse((response) => response.request().method() === 'GET' && response.url().includes('/api/accounts/sales/'));
      await saleRow.click();
      const account = await accountResponse;
      expect(account.headers()['cache-control']).toContain('no-store');
      const dialog = page.getByRole('dialog', { name: /V-/ });
      await expect(dialog.locator('.kv').filter({ hasText: 'Cuota 1' }).locator('b')).toContainText('20');
      await expect(dialog.locator('.kv').filter({ hasText: 'Cuota 2' }).locator('b')).toContainText('50');
      await expect(dialog.getByText('Deuda US$ 70')).toBeVisible();
      await expect(dialog.getByText('Deuda US$ 100')).toHaveCount(0);
    });

    test('shows the current debt on the client badge after cancellations', async ({ page, request }, info) => {
      test.setTimeout(120_000);
      const email = buildTestEmail(info, `aviso-${device.name}`);
      await bootstrapStoreViaApi(page, request, email, 'iManager · Aviso');
      await updateStoreViaApi(request, email, { currency: 'USD' });
      const { client } = await createClientViaApi(request, email, { name: 'Ana Pérez', phone: '2615550192', dni: '30111992' });
      await post(request, email, `/api/accounts/clients/${client.id}/movements`, { kind: 'CARGO', amount: 35, currency: 'USD', note: 'Saldo manual' });
      const covered = await post(request, email, '/api/operations/sales', {
        clientId: client.id, deviceLabel: 'Cuotas', amount: 100, currency: 'USD', paymentMethod: 'EFECTIVO',
        installments: { count: 2, frequency: 'MENSUAL', firstDueDate: '2026-11-14' },
      });
      const open = await post(request, email, '/api/operations/sales', {
        clientId: client.id, deviceLabel: 'Accesorio', amount: 30, currency: 'USD', paymentMethod: 'EFECTIVO', status: 'PENDIENTE',
      });
      const paid = await post(request, email, '/api/operations/sales', {
        clientId: client.id, deviceLabel: 'Cobrado', amount: 100, currency: 'USD', paymentMethod: 'EFECTIVO', status: 'COMPLETADA',
      });
      await post(request, email, `/api/clients/${client.id}/payments`, { amount: 30, method: 'EFECTIVO', currency: 'USD' });
      await post(request, email, `/api/operations/sales/sales/${paid.sale.id}/cancel`, {});
      await post(request, email, `/api/operations/sales/sales/${covered.sale.id}/cancel`, {});
      await post(request, email, `/api/operations/sales/sales/${open.sale.id}/cancel`, {});

      await page.reload();
      await openClients(page);
      const clientRow = page.getByTestId(`client-row-${client.id}`);
      await expect(clientRow).toContainText('Saldo US$ 5');
      const notice = clientRow.getByTestId('notice-reason');
      await expect(notice).toContainText('Debe US$ 35');
      await expect(notice).not.toContainText('65');
    });
  });
}
