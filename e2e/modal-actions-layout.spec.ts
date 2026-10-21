import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { data, me } from './pwa/fixtures.mjs';
import { mockCommissions } from './fixtures/commissions';
import { openDeskSection } from './navigation';

const shots = process.env.ISSUE_447_SHOTS?.trim();
const sale = {
  id: 'synthetic-sale-447', saleNumber: 447, date: '2026-10-15', clientId: 'synthetic-client-447',
  clientName: 'Cliente sintético', productId: 'synthetic-product-447', deviceLabel: 'iPhone 14 · 128GB',
  amount: 650000, amountCurrency: 'ARS', paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA',
  integratedOperation: false,
};
const client = {
  id: 'synthetic-client-447', dni: '12345678', name: 'Cliente sintético', email: 'cliente@example.test',
  phone: '1100000000', totalSpent: 650000, pendingBalance: 0,
};
const product = {
  ...data.inventory[0], id: 'synthetic-product-447', model: 'iPhone 14', capacity: '128GB',
  color: 'Negro', condition: 'USADO', grade: 'A', price: 650000, currency: 'ARS',
};
const trade = {
  id: 'synthetic-trade-447', tradeNumber: 447, date: '2026-10-15', clientId: client.id,
  clientName: client.name, deviceReceived: 'iPhone recibido sintético', deviceReceivedImei: '',
  deviceGiven: 'Equipo entregado sintético', takeValue: 200000, differencePaid: 450000,
  currency: 'ARS', status: 'PENDIENTE', confirmationStatus: 'CONFIRMED', operationSource: 'tradeins',
};
const repair = {
  id: 'synthetic-repair-447', orderNumber: 447, code: 'OT-0447', clientId: client.id,
  clientName: client.name, clientPhone: client.phone, device: 'iPhone sintético', imei: '',
  fault: 'Pantalla sintética para verificar la ficha y su pie de acciones.', faultTags: ['Pantalla'],
  estimate: 45000, deposit: 10000, currency: 'ARS', technician: 'Técnico sintético',
  status: 'RECIBIDO', estimatedDelivery: null, notifyWhatsapp: false, receivedAt: '2026-10-15',
  whatsappUrl: null, events: [{ id: 'synthetic-event-447', status: 'RECIBIDO', createdAt: '2026-10-15' }],
};

async function syntheticSalesSession(page: Page, includeOtherDetails = false) {
  const appClient = { ...client, pendingBalance: includeOtherDetails ? 125000 : 0 };
  const tradeIns = includeOtherDetails ? [trade] : [];
  await page.addInitScript(() => {
    localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email: 'modal447@example.test' }));
    localStorage.setItem('imanager:install-dismissed:ios', 'yes');
    localStorage.setItem('imanager:install-dismissed:android', 'yes');
  });
  await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-21T12:00:00Z' } }));
  await page.route('https://api.bluelytics.com.ar/**', route => route.fulfill({ json: {} }));
  await page.route('https://mercados.ambito.com/**', route => route.fulfill({ json: {} }));
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
  await page.context().route('**/api/**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: { ...me, membership: { role: 'OWNER', sections: null, isDefault: true } }, headers: cors });
    if (path === '/api/sales') return route.fulfill({ json: { sales: [sale] }, headers: cors });
    if (path === '/api/clients') return route.fulfill({ json: { clients: [appClient] }, headers: cors });
    if (path === '/api/clients/categories') return route.fulfill({ json: { categories: [] }, headers: cors });
    if (path === '/api/clients/synthetic-client-447/payments') return route.fulfill({ json: { payments: [] }, headers: cors });
    if (path === '/api/clients/synthetic-client-447/deposits') return route.fulfill({ json: { deposits: [] }, headers: cors });
    if (path === '/api/inventory') return route.fulfill({ json: { inventory: [product] }, headers: cors });
    if (path === '/api/trade-ins') return route.fulfill({ json: { tradeIns }, headers: cors });
    if (path === '/api/repairs') return route.fulfill({ json: { orders: includeOtherDetails ? [repair] : [] }, headers: cors });
    if (path === '/api/operations/tradeins/trades/synthetic-trade-447') return route.fulfill({ json: { tradeIn: trade, inventory: [], clients: [], notifications: [], summary: '' }, headers: cors });
    if (path === '/api/commissions/sellers') return route.fulfill({ json: { sellers: [] }, headers: cors });
    if (path === '/api/accounts/sales/synthetic-sale-447') return route.fulfill({ json: { saleId: sale.id, status: sale.status, openBalance: null, due: 0, paymentMethod: sale.paymentMethod, plan: null, installments: [], tenders: [] }, headers: cors });
    if (path === '/api/history' || path === '/api/history/actors') return route.fulfill({ json: path.endsWith('/actors') ? { actors: [] } : { events: [], nextCursor: null }, headers: cors });
    return route.fulfill({ json: { ...data, expenses: [], sales: [sale], clients: [appClient], inventory: [product], tradeIns }, headers: cors });
  });
  await page.goto('/#/ventas');
  await expect(page.locator('.desk-app')).toBeVisible();
  // Reopen from the cached synthetic session so screen hooks start in the
  // backend-ready state instead of rendering a transient session-check error.
  await page.reload();
  await expect(page.locator('.desk-app')).toBeVisible();
}

async function assertVisibleAction(menu: Locator, name: string, width: number, height: number) {
  const action = menu.getByRole('button', { name, exact: true });
  await expect(action).toBeVisible();
  await expect(action).toBeInViewport({ ratio: 1 });
  const box = (await action.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(height);
}

async function shot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await expect(page.locator('.toast.show')).toBeHidden();
  await page.screenshot({ path: `${shots}/${name}`, animations: 'disabled' });
}

for (const viewport of [
  { name: 'desktop-1440x900', options: { viewport: { width: 1440, height: 900 } } },
  { name: 'desktop-1536x640', options: { viewport: { width: 1536, height: 640 } } },
  { name: 'mobile-390x844', options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: 'mobile-320x844', options: { viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true } },
]) {
  test.describe(`modal actions ${viewport.name}`, () => {
    test.use(viewport.options);

    test('keeps sale details and every secondary action reachable without horizontal overflow', async ({ page }) => {
      await syntheticSalesSession(page);
      const isMobile = (page.viewportSize()?.width ?? 1000) < 760;
      const entry = isMobile
        ? page.getByTestId('sales-timeline').getByRole('button').filter({ hasText: 'V-0447' })
        : page.getByRole('row').filter({ hasText: 'V-0447' });
      await entry.click();
      const detail = page.getByRole('dialog', { name: 'V-0447' });
      await expect(detail).toBeVisible();
      // Compare scrolling only after the opening transform has stopped moving the footer.
      await detail.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished)); });
      const body = detail.locator('.sheet-scroll');
      const footer = detail.locator('.sheet-foot');
      const menu = footer.locator('.sheet-action-menu');
      const summary = menu.locator('summary');
      await expect(detail).toHaveCSS('overflow', 'hidden');
      await expect(body).toHaveCSS('overflow-y', 'auto');
      await expect(footer).toHaveCSS('flex-shrink', '0');
      expect(await detail.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await expect(footer.getByRole('button', { name: 'Cerrar', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(footer.locator('.sheet-primary')).toHaveCount(1);
      const before = (await footer.boundingBox())!;
      await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
      await expect(detail.getByTestId('sale-warranty')).toBeInViewport();
      expect((await footer.boundingBox())!.y).toBeCloseTo(before.y, 0);
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(menu).toHaveJSProperty('open', true);
      await page.keyboard.press('Tab');
      await expect(menu.getByRole('button', { name: 'Editar', exact: true })).toBeFocused();
      await summary.focus();
      const { width, height } = page.viewportSize()!;
      await assertVisibleAction(menu, 'Editar', width, height);
      await assertVisibleAction(menu, 'Devolver', width, height);
      await shot(page, `${viewport.name}-sale-menu.png`);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveJSProperty('open', false);
      await expect(summary).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(footer.locator('.sheet-primary')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(detail.locator('.sheet-h .modal-x')).toBeFocused();
    });

    test('keeps commission-rule actions reachable in the shared sheet at the same viewport', async ({ page }) => {
      await mockCommissions(page);
      await openDeskSection(page, 'commissions');
      await expect(page.getByRole('heading', { name: 'Comisiones', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Reglas', exact: true }).first().click();
      const sheet = page.getByRole('dialog', { name: 'Regla del equipo' });
      await expect(sheet).toBeVisible();
      const body = sheet.locator('.sheet-scroll');
      const footer = sheet.locator('.sheet-foot');
      await expect(footer.getByRole('button', { name: 'Guardar regla', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(footer.getByRole('button', { name: 'Cancelar', exact: true })).toBeInViewport({ ratio: 1 });
      const savedRule = sheet.getByRole('region', { name: 'Reglas guardadas' });
      const ruleMenu = savedRule.locator('.sheet-action-menu').first();
      const summary = ruleMenu.locator('summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(ruleMenu).toHaveJSProperty('open', true);
      const { width, height } = page.viewportSize()!;
      await assertVisibleAction(ruleMenu, 'Desactivar regla de Todo el equipo', width, height);
      await assertVisibleAction(ruleMenu, 'Eliminar regla de Todo el equipo', width, height);
      expect(await sheet.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await shot(page, `${viewport.name}-commission-rule-menu.png`);
      await page.keyboard.press('Escape');
      await expect(ruleMenu).toHaveJSProperty('open', false);
      await expect(summary).toBeFocused();
      await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
      await expect(sheet.getByLabel('Vigente desde')).toBeInViewport();
      await expect(footer.getByRole('button', { name: 'Guardar regla', exact: true })).toBeInViewport({ ratio: 1 });
      await shot(page, `${viewport.name}-commission-rule-bottom.png`);
    });

    test('keeps other detail footers and permitted menu actions reachable', async ({ page }) => {
      await syntheticSalesSession(page, true);
      const mobile = page.viewportSize()!.width < 760;
      const entries = [
        { tab: 'clients', enter: () => page.getByTestId(`client-row-${client.id}`).click(), primary: 'Registrar pago', actions: ['Agregar seña', 'Nueva venta', ...(mobile ? ['Editar'] : [])] },
        { tab: 'inventory', enter: () => (mobile ? page.locator('.phone-row') : page.getByRole('row')).filter({ hasText: 'iPhone 14' }).first().click(), primary: 'Guardar estado', actions: ['Vender'] },
        { tab: 'tradeins', enter: () => (mobile ? page.getByTestId('tradeins-timeline').getByRole('button') : page.getByRole('row')).filter({ hasText: 'C-0447' }).first().click(), primary: 'Editar', actions: ['Cancelar operación'] },
        { tab: 'service', enter: () => page.getByTestId(`repair-card-${repair.id}`).click(), primary: /^Pasar a /, actions: ['Cerrar', 'Compartir comprobante', 'Aplicar seña', 'Editar'] },
      ];
      for (const entry of entries) {
        await openDeskSection(page, entry.tab);
        await entry.enter();
        const sheet = page.locator('.sheet-frame[role="dialog"]').last();
        await expect(sheet).toBeVisible();
        await sheet.evaluate(async node => { await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))); });
        const footer = sheet.locator('.sheet-foot');
        await expect(footer.locator('.sheet-primary')).toHaveCount(1);
        await expect(footer.getByRole('button', { name: entry.primary, exact: true })).toBeInViewport({ ratio: 1 });
        const before = (await footer.boundingBox())!;
        await sheet.locator('.sheet-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
        expect((await footer.boundingBox())!.y).toBeCloseTo(before.y, 0);
        const menu = footer.locator('.sheet-action-menu');
        await menu.locator('summary').click();
        await expect(menu).toHaveJSProperty('open', true);
        const { width, height } = page.viewportSize()!;
        for (const action of entry.actions) await assertVisibleAction(menu, action, width, height);
        const closeAction = footer.locator('.sheet-actions > .sheet-secondary');
        if (await closeAction.count()) await closeAction.click({ trial: true });
        expect(await sheet.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
        await shot(page, `${viewport.name}-${entry.tab}-menu.png`);
        await page.keyboard.press('Escape');
        await expect(sheet).toBeVisible();
        await sheet.locator('.sheet-h .modal-x').click();
        await expect(sheet).toBeHidden();
      }
    });
  });
}
