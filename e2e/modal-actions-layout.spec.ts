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

async function syntheticSalesSession(page: Page) {
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
    if (path === '/api/clients') return route.fulfill({ json: { clients: [client] }, headers: cors });
    if (path === '/api/clients/categories') return route.fulfill({ json: { categories: [] }, headers: cors });
    if (path === '/api/clients/synthetic-client-447/payments') return route.fulfill({ json: { payments: [] }, headers: cors });
    if (path === '/api/inventory') return route.fulfill({ json: { inventory: [product] }, headers: cors });
    if (path === '/api/trade-ins') return route.fulfill({ json: { tradeIns: [] }, headers: cors });
    if (path === '/api/commissions/sellers') return route.fulfill({ json: { sellers: [] }, headers: cors });
    if (path === '/api/accounts/sales/synthetic-sale-447') return route.fulfill({ json: { saleId: sale.id, status: sale.status, openBalance: null, due: 0, paymentMethod: sale.paymentMethod, plan: null, installments: [], tenders: [] }, headers: cors });
    if (path === '/api/history' || path === '/api/history/actors') return route.fulfill({ json: path.endsWith('/actors') ? { actors: [] } : { events: [], nextCursor: null }, headers: cors });
    return route.fulfill({ json: { ...data, expenses: [], sales: [sale], clients: [client], inventory: [product], tradeIns: [] }, headers: cors });
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
      const { width, height } = page.viewportSize()!;
      await assertVisibleAction(menu, 'Editar', width, height);
      await assertVisibleAction(menu, 'Devolver', width, height);
      await shot(page, `${viewport.name}-sale-menu.png`);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveJSProperty('open', false);
      await expect(summary).toBeFocused();
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
  });
}
