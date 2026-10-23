import { expect, test } from '@playwright/test';
import { me } from './pwa/fixtures.mjs';

const inventory = [
  { id: 'eq-1', imei: '359111111111119', model: 'iPhone 13', capacity: '128 GB', color: 'Azul', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 80000, price: 200000, currency: 'ARS', status: 'VENDIDO', createdAt: '2026-10-10T15:00:00.000Z' },
];

const sales = [
  { id: 'sale-1', saleNumber: 18, date: '2026-10-12', clientId: 'cl-1', clientName: 'Lucía Martínez', productId: 'eq-1', deviceLabel: 'iPhone 13 128 GB', amount: 200000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', warrantyDays: 60 },
];

const returns = [
  {
    id: 'rma-1',
    code: 'RMA-0001',
    caseNumber: 1,
    saleId: 'sale-1',
    clientId: 'cl-1',
    clientName: 'Lucía Martínez',
    inventoryItemId: 'eq-1',
    imei: '359111111111119',
    deviceLabel: 'iPhone 13 128 GB',
    supplierId: null,
    supplierName: null,
    reason: 'La batería se apaga al 40%.',
    diagnosis: 'Batería fuera de rango.',
    openedOn: '2026-10-12',
    resolution: 'REINTEGRO',
    settlement: 'NOTA_CREDITO',
    moneyAmount: 50000,
    moneyCurrency: 'ARS',
    destination: 'STOCK',
    stockStatus: 'EN_REVISION',
    previousStatus: 'DISPONIBLE',
    rmaStatus: null,
    status: 'RESUELTO',
    resolvedOn: '2026-10-12',
    deletedAt: null,
    refundable: 200000,
    saleAmount: 200000,
    saleCurrency: 'ARS',
    saleDate: '2026-10-12',
    warrantyDays: 60,
    itemCost: 80000,
    itemCurrency: 'ARS',
    creditNote: { id: 'note-1', amount: 50000, remaining: 50000, currency: 'ARS', status: 'ABIERTA' },
    events: [{ status: 'ABIERTO', note: 'Ingresó el reclamo.', createdAt: '2026-10-12T15:00:00.000Z' }],
  },
];

for (const width of [390, 1440]) {
  test(`devoluciones nota y reportes ${width}`, async ({ page }) => {
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
        return json({ stage: 'done', eligible: false, active: false, dismissed: true, stock: 1, sales: true, team: true, catalog: false, installed: false, visible: false, samples: 0, storeNamed: true, steps: { store: true, stock: true, sale: true, team: true, install: true } });
      }
      if (path === '/api/returns/credit-notes') return json({ creditNotes: [] });
      if (path === '/api/returns') return json({ returns });
      if (path === '/api/inventory') return json({ inventory });
      if (path === '/api/sales') return json({ sales });
      if (path === '/api/expenses') return json({ expenses: [] });
      if (path.endsWith('/members')) return json({ members: [] });
      if (path === '/api/invitations') return json({ invitations: [] });
      if (path === '/api/notifications') return json({ notifications: [] });
      return json({ inventory: [], sales: [], clients: [], tradeIns: [], repairs: [], categories: [], catalogs: {}, drafts: [], suppliers: [], expenses: [], returns: [], creditNotes: [], notifications: [] });
    });

    await page.goto('/');
    await page.getByTestId('login-email').fill('natan@iphoneveron.test');
    await page.getByTestId('login-password').fill('test123456');
    await page.getByTestId('login-submit').click();
    await expect(page.locator('.desk-app')).toBeVisible();

    await page.goto('/#/devoluciones');
    await expect(page.getByRole('heading', { name: 'Devoluciones' })).toBeVisible();
    await expect(page.getByTestId('returns-list')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/pr-shots/316-lista-${width}.png`, animations: 'disabled' });

    await page.getByRole('button', { name: 'Nuevo reclamo' }).first().click();
    await page.getByRole('combobox', { name: 'Venta', exact: true }).click();
    await page.getByRole('option').filter({ hasText: 'Lucía Martínez' }).first().click();
    await expect(page.getByTestId('return-sale')).toBeVisible();
    await expect(page.getByTestId('return-sale')).toContainText('IMEI 359111111111119');
    await page.screenshot({ path: `docs/pr-shots/316-reclamo-${width}.png`, animations: 'disabled' });

    await page.goto('/#/rep');
    await expect(page.getByTestId('net-profit-returns')).toContainText('Devoluciones');
    await page.screenshot({ path: `docs/pr-shots/316-reportes-${width}.png`, animations: 'disabled' });
  });
}
