import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { authHeaders, buildTestEmail } from './utils';
import { openDeskSection } from './navigation';

const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3100';

for (const width of [1440, 390]) test.describe(`Filtros de todas las columnas ${width}`, () => {
  test.use({ viewport: { width, height: width === 1440 ? 900 : 844 }, deviceScaleFactor: width === 1440 ? 1 : 2 });

  test('combina rangos, texto, presencia, catálogo y búsqueda; limpia los filtros', async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'column-filters');
    const headers = authHeaders(email);
    await request.get(`${api}/api/me`, { headers });
    expect((await request.post(`${api}/api/stores`, { headers, data: { name: 'Stock de prueba' } })).ok()).toBe(true);
    await request.patch(`${api}/api/stores/current`, { headers, data: { instagram: 'stock.ficticio' } });
    for (const data of [
      { model: 'Pixel Pro', imei: '490154203237518', cantidad: 1, entryDate: '2026-10-30', cost: 450, batteryNote: 'Batería original' },
      { model: 'Pixel Lote', imei: '', cantidad: 3, entryDate: '2026-10-28', cost: 800, batteryNote: '' },
      { model: 'Galaxy', imei: '', cantidad: 2, entryDate: '2026-10-30', cost: 450, batteryNote: 'Batería reemplazada' },
    ]) {
      const response = await request.post(`${api}/api/inventory`, { headers, data: { capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '85%', price: 650, status: 'DISPONIBLE', currency: 'ARS', ...data } });
      expect(response.ok(), await response.text()).toBe(true);
    }
    await page.addInitScript(email => localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email })), email);
    await page.goto('/');
    await expect(page.locator('.desk-app')).toBeVisible();
    await openDeskSection(page, 'inventory');
    await expect(page.getByTestId('inventory-total')).toHaveText('6 de 6');
    const shot = async (state: string) => {
      if (!process.env.INVENTORY_FILTER_SHOTS) return;
      await mkdir(process.env.INVENTORY_FILTER_SHOTS, { recursive: true });
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `${process.env.INVENTORY_FILTER_SHOTS}/${state}-${width}.png` });
    };
    if (width === 1440) {
      for (const header of await page.getByRole('columnheader').all()) {
        if (await header.locator('.bulk-check').count() || await header.getByRole('button', { name: /^Seleccionar/ }).count()) continue;
        if (!(await header.textContent())?.trim()) continue;
        await expect(header.getByRole('button', { name: /^Filtrar / })).toHaveCount(1);
      }
      await page.getByRole('button', { name: 'Filtrar ingreso', exact: true }).click();
      let filter = page.getByRole('dialog', { name: 'Filtrar ingreso', exact: true });
      await filter.getByRole('textbox', { name: 'Desde' }).fill('30/10/2026');
      await filter.getByRole('textbox', { name: 'Hasta' }).fill('30/10/2026');
      await expect(page.getByTestId('inventory-total')).toHaveText('3 de 6');
      await shot('ingreso');
      await page.getByRole('button', { name: 'Filtrar IMEI', exact: true }).click();
      filter = page.getByRole('dialog', { name: 'Filtrar IMEI', exact: true });
      await filter.getByRole('textbox', { name: 'Contiene' }).fill('7518');
      await filter.getByRole('button', { name: 'Con IMEI', exact: true }).click();
      await expect(page.getByTestId('inventory-total')).toHaveText('1 de 6');
      await shot('imei');
      await page.getByRole('button', { name: 'Filtrar cantidad', exact: true }).click();
      await page.getByRole('textbox', { name: 'Cantidad mínimo' }).fill('1');
      await page.getByRole('textbox', { name: 'Cantidad máximo' }).fill('1');
      await page.getByRole('button', { name: 'Filtrar costo', exact: true }).click();
      await page.getByRole('textbox', { name: 'Costo mínimo' }).fill('450');
      await page.getByRole('textbox', { name: 'Costo máximo' }).fill('450');
      await shot('rangos');
      await page.getByRole('button', { name: 'Filtrar detalle batería', exact: true }).click();
      await page.getByRole('textbox', { name: 'Contiene' }).fill('original');
      await page.getByRole('button', { name: 'Con valor', exact: true }).click();
      await expect(page.getByTestId('inventory-total')).toHaveText('1 de 6');
      await page.getByRole('button', { name: 'Vacío', exact: true }).click();
      await expect(page.getByTestId('inventory-total')).toHaveText('0 de 6');
      await page.getByRole('button', { name: 'Con valor', exact: true }).click();
      await page.getByRole('button', { name: 'Filtrar catálogo', exact: true }).click();
      await page.getByRole('checkbox', { name: 'En catálogo', exact: true }).check();
      await expect(page.getByTestId('inventory-total')).toHaveText('0 de 6');
      await page.getByRole('checkbox', { name: 'Fuera de catálogo', exact: true }).check();
      await expect(page.getByTestId('inventory-total')).toHaveText('1 de 6');
      await page.locator('.dtable-scroll').evaluate(element => { element.scrollLeft = element.scrollWidth; });
      await shot('catalogo');
      await page.keyboard.press('Escape');
      for (const name of ['ingreso', 'IMEI', 'cantidad', 'costo', 'detalle batería', 'catálogo']) await expect(page.getByRole('button', { name: `Filtrar ${name}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
      const search = page.getByPlaceholder('Buscar modelo o color');
      await search.fill('Galaxy');
      await expect(page.getByTestId('inventory-total')).toHaveText('0 de 6');
      await search.fill('Pixel');
      await expect(page.getByTestId('inventory-total')).toHaveText('1 de 6');
      await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
      await expect(page.getByTestId('inventory-total')).toHaveText('4 de 6');
      await search.fill('');
    } else {
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      let sheet = page.getByRole('dialog', { name: 'Filtros', exact: true });
      await sheet.getByRole('textbox', { name: 'Ingreso desde' }).fill('30/10/2026');
      await sheet.getByRole('textbox', { name: 'Ingreso hasta' }).fill('30/10/2026');
      await sheet.getByRole('button', { name: 'Con IMEI', exact: true }).click();
      await sheet.getByRole('textbox', { name: 'Cantidad mínimo' }).fill('1');
      await sheet.getByRole('textbox', { name: 'Cantidad máximo' }).fill('1');
      await sheet.getByRole('textbox', { name: 'Costo mínimo' }).fill('450');
      await sheet.getByRole('textbox', { name: 'Costo máximo' }).fill('450');
      await sheet.getByRole('textbox', { name: 'Buscar detalle batería' }).fill('original');
      await sheet.getByRole('checkbox', { name: 'Fuera de catálogo', exact: true }).check();
      await expect(page.getByTestId('inventory-total')).toHaveText('6 de 6');
      await sheet.locator('.sheet-scroll').evaluate(element => { element.scrollTop = 0; });
      await shot('filtros-texto');
      await sheet.getByRole('textbox', { name: 'Costo mínimo' }).evaluate(element => element.scrollIntoView({ block: 'center' }));
      await shot('filtros-rangos');
      await sheet.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      await expect(page.getByTestId('inventory-total')).toHaveText('1 de 6');
      await expect(page.getByRole('button', { name: 'Filtros', exact: true }).locator('..')).toContainText('6');
      await shot('resultado');
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      sheet = page.getByRole('dialog', { name: 'Filtros', exact: true });
      await sheet.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
      await sheet.locator('.modal-x').click();
      await expect(page.getByTestId('inventory-total')).toHaveText('1 de 6');
      await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    }
    await expect(page.getByTestId('inventory-total')).toHaveText('6 de 6');
  });
});
