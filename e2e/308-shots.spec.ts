import { expect, test } from '@playwright/test';
import { me } from './pwa/fixtures.mjs';

const supplier = {
  id: 'sup-1',
  name: 'Mayorista Centro',
  phone: '1144445555',
  email: 'ventas@mayorista.test',
  notes: 'Entrega los martes.',
  deviceCount: 2,
  problemCount: 1,
  deletedAt: null,
  purchases: [{
    id: 'buy-1',
    purchasedAt: '2026-10-10',
    notes: 'Lote de octubre.',
    problemCount: 1,
    items: [
      { id: 'eq-1', model: 'iPhone 13', capacity: '128 GB', imei: '359111111111119', status: 'DISPONIBLE', cost: 80000, currency: 'ARS', problem: false, problemLabel: null, createdAt: '2026-10-10T15:00:00.000Z' },
      { id: 'eq-2', model: 'iPhone 12', capacity: '64 GB', imei: '359222222222228', status: 'EN_REVISION', cost: 50000, currency: 'ARS', problem: true, problemLabel: 'En revisión', createdAt: '2026-10-10T15:00:00.000Z' },
    ],
  }],
};

const inventory = [
  { id: 'eq-1', imei: '359111111111119', model: 'iPhone 13', capacity: '128 GB', color: 'Azul', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 80000, price: 200000, currency: 'ARS', status: 'VENDIDO', supplierId: 'sup-1', supplierName: 'Mayorista Centro', createdAt: '2026-10-10T15:00:00.000Z' },
  { id: 'eq-2', imei: '359222222222228', model: 'iPhone 12', capacity: '64 GB', color: 'Negro', condition: 'USADO', grade: 'B', batteryHealth: '86%', cost: 50000, price: 140000, currency: 'ARS', status: 'EN_REVISION', supplierId: 'sup-1', supplierName: 'Mayorista Centro', createdAt: '2026-10-10T15:00:00.000Z' },
];

const sales = [
  { id: 'sale-1', saleNumber: 18, date: '2026-10-12', clientId: 'cl-1', clientName: 'Lucía Martínez', productId: 'eq-1', amount: 200000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA' },
];

const expenses = [
  { id: 'ex-1', date: '2026-10-12', category: 'Alquiler', amount: 10000, currency: 'ARS', exchangeRate: 1300, notes: 'Local de octubre', deletedAt: null },
  { id: 'ex-2', date: '2026-10-12', category: 'Publicidad', amount: 10, currency: 'USD', exchangeRate: 1300, notes: null, deletedAt: null },
];

for (const width of [390, 1440]) {
  test(`proveedores gastos y ganancia ${width}`, async ({ page }) => {
    const mobile = width === 390;
    await page.setViewportSize({ width, height: mobile ? 844 : 900 });
    await page.addInitScript(() => {
      localStorage.setItem('imanager:install-dismissed:ios', 'yes');
      localStorage.setItem('imanager:install-dismissed:android', 'yes');
    });
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
    await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-19T12:00:00Z' } }));
    await page.context().route('**/api/**', async route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const path = new URL(request.url()).pathname;
      const json = (value: unknown, status = 200) => route.fulfill({ json: value, status, headers: cors });
      if (path === '/api/me') {
        return json({
          ...me,
          user: { ...me.user, displayName: 'Natan', email: 'natan@iphoneveron.test' },
          store: {
            ...me.store,
            name: 'iPhone Veron',
            currency: 'ARS',
            exchangeMode: 'manual',
            exchangeSource: 'blue',
            manualBuy: 1280,
            manualSell: 1300,
            phone: '1144445555',
            email: 'natan@iphoneveron.test',
          },
          membership: { role: 'OWNER', isDefault: true },
          onboardingRequired: false,
        });
      }
      if (path === '/api/onboarding/progress') {
        return json({ stage: 'done', eligible: false, active: false, dismissed: true, stock: 2, sales: true, team: true, catalog: false, installed: false, visible: false, samples: 0, storeNamed: true, steps: { store: true, stock: true, sale: true, team: true, install: true } });
      }
      if (path === '/api/suppliers') return json({ suppliers: [{ ...supplier, purchases: undefined }] });
      if (path.startsWith('/api/suppliers/')) return json({ supplier });
      if (path === '/api/expenses') return json({ expenses });
      if (path === '/api/inventory') return json({ inventory });
      if (path === '/api/sales') return json({ sales });
      if (path.endsWith('/members')) return json({ members: [] });
      if (path === '/api/invitations') return json({ invitations: [] });
      if (path === '/api/notifications') return json({ notifications: [] });
      return json({ inventory: [], sales: [], clients: [], tradeIns: [], repairs: [], categories: [], catalogs: {}, drafts: [], suppliers: [], expenses: [], notifications: [] });
    });

    await page.goto('/');
    await page.getByTestId('login-email').fill('natan@iphoneveron.test');
    await page.getByTestId('login-password').fill('test123456');
    await page.getByTestId('login-submit').click();
    await expect(page.locator('.desk-app')).toBeVisible();

    await page.goto('/#/proveedores');
    await expect(page.getByRole('heading', { name: 'Proveedores' })).toBeVisible();
    await expect(page.getByTestId('suppliers-list')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/pr-shots/308-proveedores-${width}.png`, animations: 'disabled' });

    await page.getByTestId('supplier-sup-1').click();
    await expect(page.getByTestId('supplier-detail')).toBeVisible();
    await expect(page.getByTestId('supplier-problems')).toBeVisible();
    await page.screenshot({ path: `docs/pr-shots/308-proveedor-${width}.png`, animations: 'disabled' });

    await page.goto('/#/gastos');
    await expect(page.getByRole('heading', { name: 'Gastos' })).toBeVisible();
    await expect(page.getByTestId('expenses-list')).toBeVisible();
    await page.screenshot({ path: `docs/pr-shots/308-gastos-${width}.png`, animations: 'disabled' });

    await page.goto('/#/rep');
    await expect(page.getByTestId('net-profit')).toBeVisible();
    await expect(page.getByText('Ganancia neta')).toBeVisible();
    await page.screenshot({ path: `docs/pr-shots/308-ganancia-${width}.png`, animations: 'disabled' });

    await page.goto('/#/inv');
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
    await expect(page.getByText('Proveedor: Mayorista Centro').first()).toBeVisible();
    await page.screenshot({ path: `docs/pr-shots/308-inventario-${width}.png`, animations: 'disabled' });
  });
}
