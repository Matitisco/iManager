import ExcelJS from 'exceljs';
import { expect, test } from '@playwright/test';
import { authHeaders, buildTestEmail, loginViaUi } from './utils';
import { openDeskSection } from './navigation';
import type { ImportAnalysis } from '../src/services/import-api';

const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3100';
// Only synthetic devices. No customer workbook is read by this regression.
async function fakeWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Stock ficticio').addRows([
    ['Modelo', 'IMEI', 'Precio USD', 'Cantidad', 'Batería', 'Calidad', 'Origen QA'],
    ['iPhone QA 13', '990000000000038', 420, 4, 0.87, 'A/A-', 'Ficticio 1'],
    ['iPhone QA 14', '990000000000038', 590, 1, '89%', 'B/C', 'Ficticio 2'],
    ['', '', '', 1, '', '', 'Sin modelo, conservar fila'],
    ['iPhone QA 15', '', 'ilegible', 1, '8*%', 'ZZ', 'Ficticio 4'],
    [],
    ['iPhone QA 16', '990000000000046', 750, 1, '92%', 'A', 'Ficticio 5'],
  ]);
  return { name: 'stock-falso.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
}
for (const width of [1440, 390]) {
  test.describe(`onboarding Excel ${width}`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 2 : 1 });
    test('comparte análisis, reaplicación y persistencia con Inventario sin perder filas', async ({ page, request }, info) => {
      test.setTimeout(120_000);
      const email = buildTestEmail(info, `onb-import-${width}`);
      await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-29T12:00:00-03:00' } }));
      await loginViaUi(page, email);
      await page.getByTestId('onboarding-store-name').fill('Tienda ficticia QA');
      await page.getByTestId('onboarding-submit').click();
      await expect(page.getByRole('heading', { name: 'Cargá tu stock' })).toBeVisible();
      await expect(page.getByText('Paso 2 de 2')).toBeVisible();
      const file = await fakeWorkbook();
      const previews: ImportAnalysis[] = [];
      const requests: unknown[] = [];
      for (const entry of ['onboarding', 'inventory']) {
        await page.getByRole('button', { name: entry === 'onboarding' ? 'Subir Excel' : 'Importar', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Importar equipos', exact: true });
        const analyzing = page.waitForResponse(response => response.url().endsWith('/api/import/analyze') && response.request().method() === 'POST');
        await dialog.getByLabel('Archivo a importar').setInputFiles(file);
        const analyzed = await analyzing;
        expect(analyzed.ok()).toBe(true);
        requests.push(analyzed.request().postDataJSON());
        const preview = await analyzed.json() as ImportAnalysis;
        previews.push(preview);
        expect(preview.rows).toHaveLength(5);
        expect(preview.rows.map(row => row._sourceRow)).toEqual(['2', '3', '4', '5', '7']);
        expect(preview.rows[0]).toMatchObject({ batteryHealth: '87%' });
        expect(preview.rows[0].quantity ?? '1').toBe('1');
        expect(preview.rows[1]).toMatchObject({ imei: '', status: 'EN_REVISION', batteryNote: expect.stringContaining('IMEI duplicado en el archivo:') });
        expect(preview.rows[2].model).toBe('Equipo sin modelo');
        expect(preview.diagnostics?.discardedByReason).toEqual({ empty: 1 });
        await expect(dialog.getByTestId('import-preview-count')).toHaveText('5 equipos');
        await expect(dialog.getByTestId('import-adjust')).toHaveCount(0);
        if (entry === 'inventory') await expect(dialog.getByTestId('import-imei-warning')).toHaveText('2 actualizaciones por IMEI');
        await dialog.getByRole('button', { name: 'Importar Modelo como', exact: true }).click();
        const picker = page.getByRole('dialog', { name: /Importar A · Modelo como/ });
        await expect(picker.getByRole('textbox', { name: 'Buscar campo' })).toBeFocused();
        await expect(picker.getByRole('button', { name: 'Fecha de ingreso', exact: true })).toBeVisible();
        if (process.env.QA_ONB_OUT) await page.screenshot({ path: `${process.env.QA_ONB_OUT}/real-${entry}-selector-${width}.png` });
        const applying = page.waitForResponse(response => response.url().endsWith('/api/import/apply') && response.request().method() === 'POST');
        await picker.getByRole('button', { name: 'Modelo', exact: true }).click();
        expect((await applying).ok()).toBe(true);
        await expect(dialog.getByTestId('import-confirm')).toBeEnabled();
        await expect(dialog.getByTestId('import-confirm')).toBeInViewport();
        const box = await dialog.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        if (process.env.QA_ONB_OUT) await page.screenshot({ path: `${process.env.QA_ONB_OUT}/real-${entry}-preview-${width}.png` });
        const importing = page.waitForResponse(response => response.url().endsWith('/api/inventory/import') && response.request().method() === 'POST');
        await dialog.getByTestId('import-confirm').click();
        const saved = await importing;
        expect(saved.ok(), await saved.text()).toBe(true);
        expect(await saved.json()).toMatchObject({ imported: entry === 'onboarding' ? 5 : 3, updated: entry === 'onboarding' ? 0 : 2, errors: [] });
        const response = await request.get(`${api}/api/inventory`, { headers: authHeaders(email) });
        expect(response.ok()).toBe(true);
        const { inventory } = await response.json();
        expect(inventory).toHaveLength(entry === 'onboarding' ? 5 : 8);
        expect(inventory.filter((item: { batteryNote?: string }) => item.batteryNote?.includes('IMEI duplicado en el archivo:')).length).toBe(entry === 'onboarding' ? 1 : 2);
        if (entry === 'onboarding') {
          await openDeskSection(page, 'inventory');
        } else await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
      }
      expect(requests[1]).toEqual(requests[0]);
      expect(previews[1].rows).toEqual(previews[0].rows);
    });
  });
}
