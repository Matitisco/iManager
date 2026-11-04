import { expect, test } from '@playwright/test';
import { sheetAction } from './sheet-actions';
import { mockCommissions } from './fixtures/commissions';
import { openDeskSection } from './navigation';

for (const width of [390, 1440]) {
  test(`@smoke revendedor: alta rápida y atribución al editar (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await mockCommissions(page);
    // The rest of the fixture is shared with the existing commission flows.
    await page.route('**/api/commissions/resellers', route => route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' } }) : route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, json: { reseller: { id: 'externo', name: 'Diego Ejemplo', archivedAt: null } } }));
    await openDeskSection(page, 'sales');
    await page.getByText('Juan Ruiz', { exact: true }).first().click();
    const detail = page.getByRole('dialog');
    await (await sheetAction(detail, 'Editar')).click();
    await page.getByRole('combobox', { name: 'Vendedor' }).click();
    await expect(page.getByText('Revendedores', { exact: true })).toBeVisible();
    await page.getByRole('option', { name: '+ Agregar revendedor' }).click();
    await page.getByLabel('Nombre del revendedor').fill('Diego Ejemplo');
    await page.getByRole('button', { name: 'Guardar revendedor' }).click();
    await expect(page.getByRole('combobox', { name: 'Vendedor' })).toHaveText('Diego Ejemplo');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect.poll(() => state.editedSales.length).toBe(1);
    expect(state.editedSales[0]).toMatchObject({ sellerMemberId: null, resellerId: 'externo' });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
