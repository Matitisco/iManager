import { openDeskSection } from './navigation';
import { expect, test } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi, fetchInventory } from './utils';

test('archives a device, shows it in history and restores it', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'archive-history');
  await bootstrapStoreViaApi(page, request, email, 'iManager · Historial');
  await createInventoryItemViaApi(request, email, {
    imei: '359888888888888',
    model: 'iPhone Historial',
    price: 800000,
    color: 'Negro',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '90%',
  });
  await page.reload();
  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByText('iPhone Historial')).toBeVisible();
  await page.getByRole('row').filter({ hasText: 'iPhone Historial' }).click({ button: 'right' });
  await page.locator('.ctx').getByRole('button', { name: 'Archivar', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Archivar equipo' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Archivar', exact: true }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole('row').filter({ hasText: 'iPhone Historial' })).toHaveClass(/is-void/);
  expect((await fetchInventory(request, email)).inventory.map((item) => item.model)).not.toContain('iPhone Historial');

  await openDeskSection(page, 'history');
  await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();
  await expect(page.getByText(/archivó/i).first()).toBeVisible();

  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('button', { name: 'Archivados', exact: true }).click();
  const archived = page.getByRole('row').filter({ hasText: 'iPhone Historial' });
  await expect(archived).toBeVisible();
  await archived.click();
  const detail = page.getByRole('dialog').filter({ hasText: 'iPhone Historial' });
  await expect(detail.getByTestId('archived-banner')).toBeVisible();
  await detail.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(page.getByText('Equipo restaurado')).toBeVisible();
  await page.getByRole('button', { name: 'Archivados', exact: true }).click();
  await expect(page.getByText('iPhone Historial')).toBeVisible();
});
