import { enableHiddenSections } from './hidden-sections';
import { expect, test, type Page } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';

async function openClients(page: Page) {
  const target = page.getByTestId('sidebar-tab-clients');
  const more = page.getByTestId('sidebar-tab-more');
  await expect(target.or(more).first()).toBeVisible();
  if (!(await target.isVisible())) await more.click();
  await target.click();
}

export function registerAccountTests(device: { name: string }) {
  test(`shows the debtor, collects, and follows up on ${device.name}`, async ({ page, request }, info) => {
    test.setTimeout(120_000);
    await enableHiddenSections(page, ['cuenta-corriente', 'seguimientos']);
    const email = buildTestEmail(info, `cuenta-${device.name}`);
    const headers = authHeaders(email);
    await bootstrapStoreViaApi(page, request, email, 'iManager · Cuenta');
    const { client } = await createClientViaApi(request, email, { name: 'Ana Pérez', phone: '2615550101', dni: '30111001' });
    const created = await request.post(`${api}/api/operations/sales`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { clientId: client.id, deviceLabel: 'iPhone 13', amount: 500, currency: 'ARS', paymentMethod: 'EFECTIVO', status: 'PENDIENTE' },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    await page.reload();
    await openClients(page);
    await page.getByRole('button', { name: 'Cuenta corriente' }).click();
    const panel = page.getByTestId('account-current');
    await expect(panel.getByText('Ana Pérez')).toBeVisible();
    await expect(panel.getByText('Menos de 7 días', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: /export/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    await panel.getByRole('button', { name: 'Registrar pago' }).click();
    const sheet = page.getByRole('dialog', { name: 'Registrar pago' });
    await sheet.getByLabel('Monto').fill('500');
    const pay = sheet.getByRole('button', { name: 'Registrar pago' });
    const box = await pay.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    await pay.click();
    await expect(panel.getByText('Nadie tiene saldo pendiente.')).toBeVisible();

    await page.locator('.clients-filters').getByRole('button', { name: 'Seguimientos' }).click();
    await expect(page.getByTestId('follow-ups')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}
