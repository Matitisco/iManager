import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  acceptInvitationViaApi, authHeaders, bootstrapStoreViaApi, buildTestEmail,
  createInventoryItemViaApi, createInvitationViaApi, fetchSession, loginViaUi,
} from './utils';

const shots = process.env.ISSUE_376_SHOTS?.trim();
const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3100';
const sections = ['dashboard', 'inventory', 'publicCatalog', 'sales', 'tradeins', 'clients', 'cash', 'notifications'];

// ISSUE_376_SHOTS=docs/pr-shots npm run test:e2e -- e2e/catalog-permissions.spec.ts
// Uses only the local E2E server/database configured by Playwright.
for (const width of [1440, 390]) test(`catalog permission screenshots at ${width}px`, async ({ page, browser, request }, info) => {
  test.skip(!shots, 'Set ISSUE_376_SHOTS to reproduce the review screenshots');
  test.setTimeout(120_000);
  mkdirSync(shots!, { recursive: true });
  const owner = buildTestEmail(info, 'catalog-owner');
  const staff = buildTestEmail(info, 'catalog-staff');
  const quote = { compra: 1535, venta: 1555, fechaActualizacion: new Date().toISOString() };
  await page.route('https://dolarapi.com/**', route => route.fulfill({ json: quote }));
  await bootstrapStoreViaApi(page, request, owner, 'iPhone Club Palermo');
  const session = await fetchSession(request, owner);
  const patch = async (path: string, data: unknown) => {
    const response = await request.patch(`${api}${path}`, { headers: authHeaders(owner), data });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  await patch('/api/users/me', { displayName: 'Matías Tiscornia' });
  await patch('/api/stores/current', { phone: '1155551234', address: 'Av. Santa Fe 3200, Palermo', currency: 'USD', exchangeMode: 'manual', manualBuy: 1535, manualSell: 1555 });
  const invitation = await createInvitationViaApi(request, owner, 'STAFF');
  await acceptInvitationViaApi(request, staff, invitation.token);
  expect((await request.patch(`${api}/api/users/me`, { headers: authHeaders(staff), data: { displayName: 'Lucía Gómez' } })).ok()).toBeTruthy();
  const members = (await (await request.get(`${api}/api/stores/${session.store!.id}/members`, { headers: authHeaders(owner) })).json()).members;
  const employee = members.find((member: { role: string }) => member.role === 'STAFF');
  const memberPath = `/api/stores/${session.store!.id}/members/${employee.id}/sections`;
  await patch(memberPath, { sections: sections.filter(id => id !== 'publicCatalog'), sensitiveAccess: false });

  const models = ['iPhone 15 Pro', 'iPhone 14', 'iPhone 13', 'iPhone 15', 'iPhone 12', 'iPhone 13 Pro', 'iPhone 11', 'iPhone 14 Pro Max'];
  const prices = [920, 590, 430, 850, 280, 610, 220, 840];
  const ids: string[] = [];
  for (let index = 0; index < 31; index++) {
    const response = await createInventoryItemViaApi(request, owner, {
      imei: String(359376000000000 + index), model: models[index % models.length],
      capacity: index % 3 ? '128GB' : '256GB', color: ['Titanio negro', 'Medianoche', 'Azul', 'Negro'][index % 4],
      condition: 'USADO', grade: 'A+', batteryHealth: index >= 24 && index < 29 ? '74%' : '95%',
      cost: 150, price: prices[index % prices.length],
    });
    ids.push(response.inventoryItem.id);
  }
  await patch('/api/catalog', { active: true, minBattery: 80, priceCurrency: 'USD' });
  await patch('/api/catalog/items', { ids: ids.slice(0, 29), visible: true });

  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 2 : 1, isMobile: width === 390, hasTouch: width === 390 });
  await context.route('https://dolarapi.com/**', route => route.fulfill({ json: quote }));
  // Keep fixture email concise in the permissions screenshot while retaining real auth/membership.
  await context.route('**/api/stores/*/members', async route => {
    const response = await route.fetch();
    const data = await response.json();
    for (const member of data.members) if (member.id === employee.id) member.user.email = 'lucia.gomez@gmail.com';
    await route.fulfill({ response, json: data });
  });
  const review = await context.newPage();
  const capture = async (name: string, fullPage = false) => {
    await review.evaluate(() => document.fonts.ready);
    // Let the navigation spring settle; CSS entrance animations are finished by screenshot().
    await review.waitForTimeout(400);
    await review.screenshot({ path: `${shots}/${name}.png`, fullPage, animations: 'disabled' });
  };
  try {
    await loginViaUi(review, owner);
    await expect(review.getByTestId('sidebar-tab-inventory')).toBeVisible();
    await review.goto('/#/config');
    await review.getByTestId('settings-team').getByRole('button', { name: 'Equipo ›' }).click();
    await review.getByRole('button', { name: /Lucía Gómez/ }).click();
    await review.getByRole('switch', { name: 'Catálogo', exact: true }).click();
    await expect(review.getByRole('switch', { name: 'Catálogo', exact: true })).toBeChecked();
    await expect(review.locator('.team-perm-columns > .card').first().locator('.team-perm:not(.team-nested)')).toHaveCount(6);
    await expect(review.locator('.team-perm-columns > .card').last().locator('.team-perm:not(.team-nested)')).toHaveCount(5);
    await capture(width === 390 ? '376-m-permisos' : '376-permisos-1440', true);
    await review.getByRole('button', { name: width === 390 ? 'Guardar' : 'Guardar permisos', exact: true }).click();
    await expect(review.getByTestId('team-screen')).toBeVisible();

    // Separate storage for the employee; permissions are persisted through the real API.
    await context.clearCookies();
    await review.evaluate(() => localStorage.clear());
    await loginViaUi(review, staff);
    await expect(review.getByTestId('sidebar-tab-inventory')).toBeVisible();
    // Review an already installed session, without the unrelated installation invitation.
    await review.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    if (width === 390) {
      await review.getByTestId('sidebar-tab-more').click();
      await expect(review.getByTestId('sidebar-tab-publicCatalog')).toBeVisible();
      await expect(review.getByTestId('mobile-tab-bar').getByText('Catálogo')).toHaveCount(0);
      await capture('376-m-mas', true);
    }
    await review.getByTestId('sidebar-tab-publicCatalog').click();
    await expect(review.getByTestId('catalog-screen')).toBeVisible();
    await review.getByRole('button', { name: width === 390 ? 'Editar ›' : 'Reglas y precio', exact: true }).click();
    const sheet = review.getByRole('dialog', { name: 'Reglas y precio' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Regenerar link' })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Desactivar catálogo' })).toHaveCount(0);
    await expect(sheet.getByRole('switch', { name: 'Catálogo activo' })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Guardar', exact: true })).toBeInViewport();
    await capture(width === 390 ? '376-m-catalogo-empleado' : '376-catalogo-empleado-1440');
    const saved = review.waitForRequest(req => req.method() === 'PATCH' && new URL(req.url()).pathname === '/api/catalog');
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
    expect((await saved).postDataJSON()).not.toHaveProperty('active');
    await expect(sheet).toBeHidden();
    if (width === 1440) {
      await patch(memberPath, { sections: sections.filter(id => id !== 'publicCatalog') });
      await review.reload();
      await expect(review.getByTestId('no-section-access')).toContainText('No tenés acceso');
      await expect(review).toHaveURL(/#\/stock\/catalogo$/);
      await capture('376-sin-acceso-1440');
    }
    expect(await review.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
