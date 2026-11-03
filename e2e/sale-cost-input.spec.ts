import { expect, test } from '@playwright/test';
import { openDeskSection } from './navigation';
import { sheetAction } from './sheet-actions';
import { bootstrapStoreViaApi, buildTestEmail, fetchInventory, fetchSales } from './utils';

test.use({ browserName: 'chromium' });

for (const width of [390, 1440]) {
  test.describe(`costo desde venta a ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('@smoke encargue, ganancia en vivo, edición y persistencia', async ({ page, request }, info) => {
      const email = buildTestEmail(info, 'sale-cost');
      await bootstrapStoreViaApi(page, request, email, 'Costo de venta ficticia');
      await openDeskSection(page, 'sales');
      await page.getByTestId('sales-empty').getByRole('button', { name: 'Registrar venta', exact: true }).click();
      let editor = page.getByRole('dialog', { name: 'Registrar venta' });
      await editor.getByRole('combobox', { name: 'Equipo', exact: true }).fill('Equipo por encargue ficticio');
      await editor.getByLabel('Precio completo de salida').fill('1500,31');
      await editor.getByRole('textbox', { name: 'Costo del equipo' }).fill('900,12');
      await expect(editor.getByLabel('Ganancia', { exact: true })).toContainText('600,19');
      const createResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/operations/sales'));
      await editor.getByRole('button', { name: 'Confirmar venta', exact: true }).click();
      const response = await createResponse;
      expect(response.status(), await response.text()).toBe(201);
      await expect(editor).toBeHidden();
      const sales = await fetchSales(request, email);
      const sale = sales.sales.find(row => row.deviceLabel === 'Equipo por encargue ficticio');
      expect(sale).toBeTruthy();
      const inventory = await fetchInventory(request, email);
      expect(inventory.inventory.find(row => row.id === sale!.productId)).toMatchObject({ cost: 900.12, needsCompletion: true });
      await page.reload();
      await openDeskSection(page, 'sales');
      const row = page.getByTestId('sales-screen').locator(width === 390 ? '.phone-row' : 'tbody tr').filter({ hasText: 'Equipo por encargue ficticio' });
      await row.click();
      await (await sheetAction(page.getByRole('dialog', { name: /V-/ }), 'Editar')).click();
      editor = page.getByRole('dialog', { name: 'Editar operación' });
      await expect(editor.getByRole('textbox', { name: 'Costo del equipo' })).toHaveValue('900,12');
      await editor.getByRole('textbox', { name: 'Costo del equipo' }).fill('1000,12');
      await expect(editor.getByLabel('Ganancia', { exact: true })).toContainText('500,19');
      const editResponse = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith(`/operations/sales/sales/${sale!.id}`));
      await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      const changed = await editResponse;
      expect(changed.status(), await changed.text()).toBe(200);
      await expect(editor).toBeHidden();
      expect((await fetchInventory(request, email)).inventory.find(item => item.id === sale!.productId)?.cost).toBe(1000.12);
    });
  });
}
