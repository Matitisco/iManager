import { openDeskSection } from './navigation';
import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { acceptInvitationViaApi, bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi, createInvitationViaApi, importSalesViaApi } from './utils';

const shots = 'docs/pr-shots';

test('captures archive, history and void screens', async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });
  const email = buildTestEmail(testInfo, 'natan1-shots');
  await bootstrapStoreViaApi(page, request, email, 'Tienda Ejemplo');
  await createInventoryItemViaApi(request, email, {
    imei: '359777777777771',
    model: 'iPhone 13',
    capacity: '128GB',
    color: 'Negro',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '84%',
    price: 560000,
  });
  const imported = await importSalesViaApi(request, email, [{
    date: '18/10/2026',
    clientName: 'Martín Acosta',
    device: 'iPhone 14 128GB',
    amount: '760000',
    status: 'COMPLETADA',
    exchangeRate: 1300,
  }]);
  expect(imported).toMatchObject({ imported: 1, errors: [] });
  const invitation = await createInvitationViaApi(request, email, 'MANAGER', 'lucia.gomez@example.com');
  await acceptInvitationViaApi(request, 'lucia.gomez@example.com', invitation.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByText('iPhone 13')).toBeVisible();
  await page.getByRole('row').filter({ hasText: 'iPhone 13' }).click({ button: 'right' });
  await page.locator('.ctx').getByRole('button', { name: 'Archivar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Archivar equipo' }).getByRole('button', { name: 'Archivar', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'iPhone 13' })).toHaveClass(/is-void/);
  await expect(page.locator('.toast.show')).toBeHidden();

  await openDeskSection(page, 'history');
  await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();
  await expect(page.getByText(/archivó/i).first()).toBeVisible();
  await page.screenshot({ path: `${shots}/natan1-historial-1440.png`, animations: 'disabled' });
  await page.locator('.history-row').first().click();
  await expect(page.getByRole('dialog').getByText('Campo')).toBeVisible();
  await page.screenshot({ path: `${shots}/natan1-detalle-1440.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');

  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('button', { name: 'Archivados', exact: true }).click();
  await expect(page.getByText('iPhone 13')).toBeVisible();
  await page.screenshot({ path: `${shots}/natan1-inventario-archivados-1440.png`, animations: 'disabled' });

  await page.getByTestId('sidebar-tab-settings').click();
  await page.getByTestId('settings-screen').getByRole('button', { name: /Lucia Gomez/ }).click();
  await expect(page.getByRole('switch', { name: 'Ver historial' })).toBeVisible();
  await page.screenshot({ path: `${shots}/natan1-permisos-1440.png`, animations: 'disabled' });
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('sidebar-tab-more').click();
  await page.getByTestId('sidebar-tab-history').click();
  await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();
  await page.screenshot({ path: `${shots}/natan1-m-historial.png`, animations: 'disabled' });

  await page.getByTestId('sidebar-tab-sales').click();
  const row = page.locator('.phone-row').filter({ hasText: 'Martín Acosta' });
  await expect(row).toBeVisible();
  await row.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 150, clientY: 300, button: 0 });
  await expect(page.locator('.ctx')).toBeVisible();
  await row.dispatchEvent('pointerup', { pointerType: 'touch' });
  await page.locator('.ctx').getByRole('button', { name: 'Anular', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Anular venta/ })).toBeVisible();
  await page.screenshot({ path: `${shots}/natan1-m-anular-venta.png`, animations: 'disabled' });
});
