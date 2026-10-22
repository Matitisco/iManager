import { sheetAction } from './sheet-actions';
import { expandListOptions, openDeskSection } from './navigation';
import { expect, test } from '@playwright/test';
import { mockCommissions } from './fixtures/commissions';

export function commissionTests(device: 'iPhone 13' | 'Pixel 5' | 'desktop') {
  test.describe(`comisiones ${device}`, () => {
    test('navigation, seller, settlements, adjustments, permissions and reports', async ({ page }) => {
      test.setTimeout(120000);
      const state = await mockCommissions(page);
      const phone = device !== 'desktop';
      if (device === 'iPhone 13') await page.setViewportSize({ width: 393, height: 852 });
      const shot = async (number: string, name: string) => {
        if (device === 'Pixel 5') return;
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('.toast')).not.toHaveClass(/show/);
        await page.screenshot({ path: `docs/pr-shots/issue-330-${phone ? 'mobile' : 'desktop'}-${number}-${name}.png`, animations: 'disabled', scale: 'css' });
      };
      const noExport = async () => { await expect(page.getByRole('button', { name: /exportar|descargar|csv|copiar filas/i })).toHaveCount(0); };
      const navigate = async (hash: string) => { await page.evaluate(hash => { window.location.hash = hash; }, hash); };
      await navigate(phone ? '#/mas' : '#/ven');
      const entry = phone ? page.getByTestId('sidebar-tab-commissions') : page.getByTestId('nav-group-analisis');
      await expect(entry).toBeVisible();
      if (phone) { await expect(entry).toContainText('Vendedores y pagos'); await expect(entry).toContainText('2 personas con comisiones pendientes'); }
      await noExport(); await shot('01', phone ? 'entrada-mas' : 'entrada-sidebar');
      await openDeskSection(page, 'commissions');
      await expect(page.getByRole('heading', { level: 1, name: 'Comisiones', exact: true })).toBeVisible();
      await expect(page.getByText('Cargando comisiones…')).toHaveCount(0);
      await noExport(); await shot('02', 'dueno');
      await page.getByRole('button', { name: 'Asignar', exact: true }).click();
      await expect(page.getByText(/Ventas sin vendedor de octubre/)).toBeVisible();
      await expect(page.getByText('Diego Sosa', { exact: true })).toBeVisible();
      await expect(page.getByText('Carla Méndez', { exact: true })).toHaveCount(0);
      await navigate('#/comisiones');
      await expect(page.getByText('Cargando comisiones…')).toHaveCount(0);
      await page.getByRole('button', { name: phone ? /Sofía Pérez/ : /Sofía Pérez/ }).click();
      const detail = page.getByRole('dialog', { name: /^Sofía Pérez/ });
      await expect(detail).toBeVisible(); await expect(detail.locator('s')).toHaveText('$ 30.000');
      await shot('03', 'detalle-vendedor');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /Lucía Díaz/ }).click();
      await expect(page.getByText('Ajuste por venta anulada')).toBeVisible();
      await expect(page.getByText(/Se le pagó de más/)).toContainText('$ 46.000');
      await shot('03b', 'ajuste-anulada');
      await page.getByRole('button', { name: 'Listo', exact: true }).click();
      await page.getByRole('button', { name: 'Reglas', exact: true }).first().click();
      const rule = page.getByRole('dialog', { name: 'Regla del equipo' });
      await expect(rule).toBeVisible();
      if (phone) {
        await rule.getByRole('button', { name: 'Una persona' }).click();
        await page.getByRole('combobox', { name: 'Persona' }).click(); await page.getByRole('option', { name: 'Martín Gómez' }).click();
        await page.getByRole('button', { name: 'Monto fijo por equipo' }).click();
        await page.getByRole('button', { name: 'USD', exact: true }).click(); await page.getByLabel('Monto por equipo').fill('20');
      }
      await shot('04', 'regla');
      await page.getByRole('button', { name: 'Guardar regla' }).click();
      await expect.poll(() => state.rules.length).toBe(1);
      await expect(page.locator('.commission-form')).toHaveCount(0);
      await page.getByRole('button', { name: /Sofía Pérez/ }).click();
      await page.getByRole('dialog', { name: /^Sofía Pérez/ }).getByRole('button', { name: 'Registrar pago' }).click();
      const payment = page.getByRole('dialog', { name: 'Registrar pago', exact: true });
      await expect(payment.getByLabel('Cotización del pago')).toHaveValue('1300');
      await payment.getByRole('button', { name: 'USD', exact: true }).click();
      await payment.getByLabel('Monto del pago').fill('50');
      await expect(payment.getByText(/Queda pendiente:/)).toContainText('$ 47.000 + US$ 40');
      if (device === 'desktop') {
        await payment.getByRole('combobox', { name: 'Para' }).click(); await page.getByRole('option', { name: /Martín Gómez/ }).click();
        await payment.getByRole('button', { name: 'ARS', exact: true }).click(); await payment.getByLabel('Monto del pago').fill('52000');
        await shot('05', 'registrar-pago');
        await payment.getByRole('combobox', { name: 'Para' }).click(); await page.getByRole('option', { name: /Sofía Pérez/ }).click();
        await payment.getByRole('button', { name: 'USD', exact: true }).click(); await payment.getByLabel('Monto del pago').fill('50');
      } else await shot('05', 'registrar-pago');
      await payment.getByRole('button', { name: 'Registrar pago', exact: true }).click();
      await expect.poll(() => state.payments.length).toBe(1);
      expect(state.payments[0]).toMatchObject({ amount: 50, currency: 'USD', settlesCurrency: 'ARS', exchangeRate: 1300 });
      await expect(payment).toHaveCount(0);
      // The saved payment returns to the member detail; register the next part there.
      await page.getByRole('dialog', { name: /^Sofía Pérez/ }).getByRole('button', { name: 'Registrar pago' }).click();
      await payment.getByLabel('Monto del pago').fill('10000');
      await payment.getByLabel('Cotización del pago').fill('1400');
      await payment.getByRole('button', { name: 'Registrar pago', exact: true }).click();
      await expect.poll(() => state.payments.length).toBe(2);
      await expect(payment).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: /^Sofía Pérez/ }).getByText('$ 37.000', { exact: true })).toBeVisible();
      expect(state.payments[1]).toMatchObject({ amount: 10000, currency: 'ARS', exchangeRate: 1400 });
      await page.locator('.ov').click({ position: { x: 4, y: 4 } });
      await expect(page.getByRole('dialog', { name: /^Sofía Pérez/ })).toHaveCount(0);
      await navigate('#/ven');
      await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
      const sale = page.getByRole('dialog', { name: 'Registrar venta', exact: true });
      await expect(sale.getByRole('combobox', { name: 'Vendedor' })).toContainText('Sin vendedor');
      await sale.getByRole('combobox', { name: 'Cliente' }).fill('Juan Ruiz');
      await sale.getByRole('combobox', { name: 'Equipo' }).fill('iPhone');
      // Select the inventory device rather than creating an unlisted one.
      await page.getByRole('option', { name: /iPhone 15/ }).click();
      await shot('06', 'venta-vendedor');
      await sale.getByRole('button', { name: 'Confirmar venta' }).click();
      await expect.poll(() => state.createdSales.length).toBe(1);
      expect(state.createdSales[0]).toMatchObject({ sellerMemberId: null, exchangeRate: 1300 });
      if (phone) {
        await expandListOptions(page);
        await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
      }
      for (const code of ['V-0156', 'V-0155', 'V-0154']) await page.getByRole('checkbox', { name: `Seleccionar ${code}`, exact: true }).check();
      await expect(page.getByRole('button', { name: 'Asignar vendedor', exact: true })).toBeVisible();
      await page.locator('.stage').evaluate(node => { node.scrollTop = 0; });
      await noExport(); await shot('07', 'asignar-vendedor-barra');
      await page.getByRole('button', { name: 'Asignar vendedor', exact: true }).click();
      const assign = page.getByRole('dialog', { name: 'Asignar vendedor', exact: true });
      await assign.getByRole('radio', { name: /Martín Gómez/ }).click();
      await expect(assign.getByRole('radio', { name: /Sin vendedor/ })).toBeVisible();
      await shot('08', 'asignar-vendedor-hoja');
      await assign.getByRole('button', { name: 'Asignar a Martín' }).click();
      await expect.poll(() => state.assignments.length).toBe(1);
      expect(state.assignments[0]).toEqual({ saleIds: ['sale-156', 'sale-155', 'sale-154'], sellerMemberId: 'martin' });
      const sellerRecord = phone ? page.locator('.sale-node').filter({ hasText: 'V-0158' }).locator('.phone-row') : page.getByRole('row').filter({ hasText: 'V-0158' });
      await sellerRecord.click();
      const soldDetail = page.getByRole('dialog', { name: 'V-0158', exact: true });
      await expect(soldDetail.getByText('Sofía Pérez', { exact: true })).toBeVisible();
      await (await sheetAction(soldDetail, 'Editar')).click();
      const editSale = page.getByRole('dialog', { name: 'Editar operación', exact: true });
      await expect(editSale.getByRole('combobox', { name: 'Vendedor' })).toContainText('Sofía Pérez');
      await editSale.getByRole('combobox', { name: 'Vendedor' }).click(); await page.getByRole('option', { name: /Martín Gómez/ }).click();
      await editSale.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      await expect.poll(() => state.editedSales.length).toBe(1);
      expect(state.editedSales[0]).toMatchObject({ sellerMemberId: 'martin' });
      await expect(editSale).toHaveCount(0);
      await navigate('#/rep'); await page.getByRole('group', { name: 'Tipo de reporte' }).getByRole('button', { name: 'Comisiones', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeEnabled();
      await expect(page.getByText('Comisiones generadas · últimos 30 días')).toBeVisible();
      await shot('10', 'reportes');
      const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar', exact: true }).click();
      expect((await download).suggestedFilename()).toBe('reporte-comisiones.csv');
      await navigate('#/config'); await page.getByTestId('settings-member-lucia').click();
      await expect(page.getByRole('switch', { name: 'Comisiones', exact: true })).toBeChecked();
      await shot('11', 'permisos');
      await page.getByRole('switch', { name: 'Comisiones', exact: true }).click();
      await page.getByRole('button', { name: phone ? 'Guardar' : 'Guardar permisos', exact: true }).click();
      for (const hash of ['#/dash', '#/inv', '#/ven', '#/canjes', '#/clientes', '#/servicio', '#/notif', '#/config']) { await navigate(hash); await noExport(); }
      state.resetPayments(); state.staff = true; state.calls = []; await page.reload(); await navigate('#/comisiones');
      await expect(page.getByRole('heading', { name: 'Mis comisiones', exact: true })).toBeVisible();
      await expect(page.locator('.commission-ledger').first()).toContainText('Venta $ 1.300.000');
      await expect(page.locator('.commission-ledger').first()).not.toContainText(/ganancia|costo/i);
      await expect(page.getByRole('button', { name: 'Registrar pago', exact: true })).toHaveCount(0);
      await noExport(); await shot('09', 'mis-comisiones');
      expect(state.calls.filter(path => path.startsWith('/api/commissions') && !['/api/commissions/mine', '/api/commissions/sellers'].includes(path))).toEqual([]);
      await navigate('#/ven');
      await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
      if (phone) {
        await expandListOptions(page);
        await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
      }
      await page.getByRole('checkbox', { name: 'Seleccionar V-0158', exact: true }).check();
      await expect(page.getByRole('button', { name: 'Asignar vendedor', exact: true })).toHaveCount(0);
      await noExport();
    });
  });
}
