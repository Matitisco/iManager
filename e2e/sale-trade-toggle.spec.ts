import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, fetchInventory, fetchSales, fetchTradeIns } from './utils';
import { openDeskSection } from './navigation';

const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3100';
const shots = process.env.CANJE_QA_SHOTS;

async function openWholesaleSale(page: Page, request: APIRequestContext, info: TestInfo) {
  const email = buildTestEmail(info, 'trade-toggle');
  await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: new Date().toISOString() } }));
  await bootstrapStoreViaApi(page, request, email, 'Mayorista ficticio · canje');
  const seeded = await request.post(`${api}/api/inventory/import`, { headers: authHeaders(email), data: { rows: [
    { model: 'Equipo QA mayorista', capacity: '128GB', quantity: 20, cost: 400, price: 650, currency: 'ARS' },
  ] } });
  expect(seeded.ok()).toBe(true);
  await page.reload();
  await openDeskSection(page, 'sales');
  await (page.viewportSize()!.width < 500 ? page.getByTestId('mobile-dock') : page).getByRole('button', { name: 'Registrar venta', exact: true }).click();
  // The sheet title changes to Nuevo canje when the checkbox is checked.
  const form = page.locator('.operation-form');
  await expect(form).toBeVisible();
  await form.getByLabel('Cliente', { exact: true }).fill('Cliente QA mayorista');
  await form.getByRole('combobox', { name: 'Equipo', exact: true }).fill('Equipo QA mayorista');
  await form.getByRole('option', { name: /Equipo QA mayorista/ }).click();
  await form.getByLabel('Cantidad', { exact: true }).fill('3');
  return { email, form };
}

for (const width of [1440, 390, 360]) for (const input of ['click', 'tap'] as const) {
  test.describe(`${width}px ${input}`, () => {
    test.use({ viewport: { width, height: width === 1440 ? 900 : 844 }, hasTouch: width < 500 || input === 'tap', isMobile: width < 500 });
    test('@smoke trade controls respond once per gesture and keep sale state', async ({ page, request }, info) => {
      const { email, form } = await openWholesaleSale(page, request, info);
      const fold = form.getByTestId('sale-trade-fold');
      const checkbox = form.getByRole('checkbox', { name: 'Tiene canje', includeHidden: true });
      const summary = fold.locator('summary');
      const target = width < 500 ? summary : form.locator('label.op-check').filter({ hasText: 'Tiene canje' });
      if (width < 500) await expect(summary).toContainText('Sin canje');
      await target.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await target.evaluate(node => {
        const log: { type: string; time: number; target: string }[] = [];
        (window as unknown as { tradeEvents: typeof log }).tradeEvents = log;
        for (const type of ['click', 'touchend', 'change', 'toggle']) {
          (node.closest('details') ?? node).addEventListener(type, event => log.push({ type, time: performance.now(), target: (event.target as Element).tagName }), true);
        }
      });
      const rect = await target.boundingBox();
      expect(rect).not.toBeNull();
      if (width < 500) expect(rect!.height).toBeGreaterThanOrEqual(44);
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      const point = { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 };
      expect(await target.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), point)).toBe(true);
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: `${shots}/${width}-${input}-before.png` });
      }
      const timings: number[] = [];
      const start = Date.now();
      // Physical coordinates stay fixed: auto-scrolling locators must not conceal a moving target.
      for (let i = 0; i < 5; i++) {
        const due = start + i * 400;
        if (Date.now() < due) await page.waitForTimeout(due - Date.now());
        const at = Date.now();
        if (input === 'tap') await page.touchscreen.tap(point.x, point.y);
        else await page.mouse.click(point.x, point.y);
        if (width < 500) await expect(fold).toHaveJSProperty('open', i % 2 === 0);
        else await expect(checkbox).toBeChecked({ checked: i % 2 === 0 });
        timings.push(Date.now() - at);
        const next = await target.boundingBox();
        expect(Math.abs(next!.y - rect!.y)).toBeLessThan(1);
      }
      await expect.poll(() => page.evaluate(type => (window as unknown as { tradeEvents: { type: string }[] }).tradeEvents.filter(event => event.type === type).length, width < 500 ? 'toggle' : 'change')).toBe(5);
      const events = await page.evaluate(() => (window as unknown as { tradeEvents: { type: string; time: number; target: string }[] }).tradeEvents);
      // Native labels forward clicks to their input; that second DOM event is not a second state change.
      expect(events.filter(event => event.type === 'click' && (width < 500 || event.target === 'INPUT'))).toHaveLength(5);
      expect(events.filter(event => event.type === (width < 500 ? 'toggle' : 'change'))).toHaveLength(5);
      expect(events.filter(event => event.type === 'touchend')).toHaveLength(input === 'tap' ? 5 : 0);
      if (width < 500) {
        await expect(checkbox).not.toBeChecked();
        await checkbox[input]();
      }
      await expect(checkbox).toBeChecked();
      if (width < 500) await expect(summary).toContainText('Con canje');
      await form.getByLabel('Equipo recibido', { exact: true }).fill('Equipo recibido QA');
      await form.getByLabel('Valor tomado', { exact: true }).fill('500');
      // A normal field edit rerenders OperationForm; it must not reset the checkbox or the fold.
      await form.getByLabel('Cliente', { exact: true }).fill('Cliente QA mayorista editado');
      await expect(checkbox).toBeChecked();
      if (width < 500) {
        await expect(fold).toHaveJSProperty('open', true);
        await summary[input]();
        await expect(fold).toHaveJSProperty('open', false);
        await expect(checkbox).toBeChecked();
        await expect(summary).toContainText('Con canje');
        if (shots) await page.screenshot({ path: `${shots}/${width}-${input}-collapsed-on.png` });
        await summary[input]();
        await expect(form.getByLabel('Equipo recibido', { exact: true })).toHaveValue('Equipo recibido QA');
      }
      if (shots) await page.screenshot({ path: `${shots}/${width}-${input}-on.png` });
      await form.getByRole('button', { name: 'Confirmar canje', exact: true })[input]();
      await expect(form).toBeHidden();
      const sales = (await fetchSales(request, email)).sales;
      const trades = (await fetchTradeIns(request, email)).tradeIns;
      expect(sales).toHaveLength(1);
      expect(trades).toHaveLength(1);
      expect(sales[0]).toMatchObject({ cantidad: 3, amount: 1950, tradeInId: trades[0].id });
      expect(trades[0]).toMatchObject({ takeValue: 500, differencePaid: 1450 });
      expect((await fetchInventory(request, email)).inventory.find(item => item.model === 'Equipo QA mayorista')).toMatchObject({ cantidad: 17 });
      await info.attach('gesture-evidence', { body: JSON.stringify({ width, input, target: rect, timings, events }, null, 2), contentType: 'application/json' });
    });

    if (width < 500) test('@smoke five panel gestures followed by Confirmar venta keep the sale without trade', async ({ page, request }, info) => {
      const { email, form } = await openWholesaleSale(page, request, info);
      const summary = form.getByTestId('sale-trade-fold').locator('summary');
      for (let i = 0; i < 5; i++) {
        await summary[input]();
        await expect(form.getByTestId('sale-trade-fold')).toHaveJSProperty('open', i % 2 === 0);
        await expect(summary).toContainText('Sin canje');
        if (i < 4) await page.waitForTimeout(400);
      }
      await expect(form.getByRole('checkbox', { name: 'Tiene canje' })).not.toBeChecked();
      await form.getByRole('button', { name: 'Confirmar venta', exact: true })[input]();
      await expect(form).toBeHidden();
      const sales = (await fetchSales(request, email)).sales;
      expect(sales).toHaveLength(1);
      expect(sales[0]).toMatchObject({ cantidad: 3, amount: 1950, tradeInId: null });
      expect((await fetchTradeIns(request, email)).tradeIns).toHaveLength(0);
      expect((await fetchInventory(request, email)).inventory.find(item => item.model === 'Equipo QA mayorista')).toMatchObject({ cantidad: 17 });
    });
  });
}
