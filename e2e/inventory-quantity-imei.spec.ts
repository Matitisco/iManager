import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { authHeaders, buildTestEmail } from './utils';
import { openDeskSection } from './navigation';

const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3100';

for (const width of [1440, 390]) test.describe(`Cantidad con IMEI ${width}`, () => {
  test.use({ viewport: { width, height: width === 1440 ? 900 : 844 }, deviceScaleFactor: width === 1440 ? 1 : 2 });

  test('cantidad fija con IMEI y validación local sin IMEI', async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'cantidad-imei');
    const headers = authHeaders(email);
    await request.get(`${api}/api/me`, { headers });
    expect((await request.post(`${api}/api/stores`, { headers, data: { name: 'Mayorista ficticio' } })).ok()).toBe(true);
    await request.patch(`${api}/api/stores/current`, { headers, data: { instagram: 'tienda.ficticia' } });
    expect((await request.post(`${api}/api/inventory/import`, { headers, data: { rows: [
      { model: '15 Pro', capacity: '128GB', imei: '490154203237518', quantity: 1, cost: 450, price: 650, currency: 'USD' },
      { model: '14 Pro', capacity: '256GB', quantity: 73, cost: 350, price: 500, currency: 'USD' },
    ] } })).ok()).toBe(true);
    await page.addInitScript(email => localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email })), email);
    await page.goto('/');
    await expect(page.locator('.desk-app')).toBeVisible();
    await openDeskSection(page, 'inventory');
    await expect(page.getByTestId('inventory-total')).toHaveText('74 de 74');
    const shot = async (state: string) => {
      if (!process.env.IMEI_QUANTITY_SHOTS) return;
      await mkdir(process.env.IMEI_QUANTITY_SHOTS, { recursive: true });
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `${process.env.IMEI_QUANTITY_SHOTS}/${state}-${width}.png`, animations: 'disabled' });
    };

    if (width === 1440) {
      const fixed = page.getByTitle('Este equipo tiene IMEI, así que cuenta como 1 unidad.');
      await expect(fixed).toHaveText('1');
      await expect(page.getByRole('spinbutton', { name: 'Cantidad de 15 Pro' })).toHaveCount(0);
      await fixed.dblclick();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const quantity = page.getByRole('spinbutton', { name: 'Cantidad de 14 Pro' });
      const imeiHeader = page.getByRole('columnheader', { name: /^IMEI/ });
      await expect(imeiHeader).toBeInViewport();
      const headings = (await page.getByRole('columnheader').allTextContents()).map(text => text.trim());
      const imeiIndex = headings.indexOf('IMEI');
      expect(headings[imeiIndex - 1]).toBe('Equipo');
      expect(headings[imeiIndex + 1]).toBe('Cantidad');
      await expect(page.locator('tbody tr').filter({ has: fixed }).locator('td').nth(imeiIndex)).toHaveText('49 015420 323751 8');
      await expect(page.locator('tbody tr').filter({ has: quantity }).locator('td').nth(imeiIndex)).toHaveText('—');
      const quantityHeader = page.getByRole('columnheader', { name: /^Cantidad/ });
      const geometry = await Promise.all([fixed, quantity, quantityHeader].map(locator => locator.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { width: rect.width, center: rect.x + rect.width / 2, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight, textAlign: style.textAlign, appearance: style.appearance };
      })));
      expect(geometry.slice(0, 2).map(value => value.width)).toEqual([48, 48]);
      expect(geometry[0].center).toBeCloseTo(geometry[2].center, 1);
      expect(geometry[1].center).toBeCloseTo(geometry[2].center, 1);
      expect(geometry.map(value => value.textAlign)).toEqual(['center', 'center', 'center']);
      expect(geometry[1].paddingLeft).toBe('4px');
      expect(geometry[1].paddingRight).toBe('4px');
      const label = await quantityHeader.getByText('Cantidad', { exact: true }).boundingBox();
      expect(label!.x + label!.width / 2).toBeCloseTo(geometry[2].center, 1);
      expect(geometry[1].appearance).toBe('textfield');
      await shot('imei-despues');
      await quantity.fill('0'); await quantity.press('Enter');
      const cell = page.getByRole('cell').filter({ has: quantity });
      await expect(cell.getByRole('alert')).toHaveText('Ingresá una cantidad entera de 1 o más unidades.');
      await expect(quantity).toHaveAttribute('aria-invalid', 'true');
      await shot('cantidad-error-despues');
      await quantity.fill('1001'); await quantity.press('Enter');
      await expect(page.getByTestId('inventory-total')).toHaveText('1002 de 1002');
      await expect(page.getByRole('alert')).toHaveCount(0);
      await page.reload(); await openDeskSection(page, 'inventory');
      await expect(page.getByRole('spinbutton', { name: 'Cantidad de 14 Pro' })).toHaveValue('1001');
    } else {
      await expect(page.getByText('Cantidad: 1 · Costo:', { exact: false })).toBeVisible();
      await shot('imei-despues');
    }
  });
});
