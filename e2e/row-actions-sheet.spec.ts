import { openDeskSection } from './navigation';
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  bootstrapStoreViaApi,
  buildTestEmail,
  createClientViaApi,
  createInventoryItemViaApi,
  createRepairViaApi,
  createSaleViaApi,
  createTradeInViaApi,
} from './utils';

const SHOTS = process.env.ROW_ACTIONS_SHOTS?.trim();

function todayLabel() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${now.getFullYear()}`;
}

async function mockDollar(page: Page) {
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({
    json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-08T21:40:00-03:00' },
  }));
  await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({
    json: { blue: { value_buy: 1270, value_sell: 1290 }, last_update: '2026-10-08T21:10:00-03:00' },
  }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({
    json: { venta: '1300,00', valor_cierre_ant: '1290,00' },
  }));
}

async function settle(page: Page) {
  const overlay = page.locator('.ov.ctxov');
  await overlay.evaluate(async (node) => {
    const animations = node.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function openSection(page: Page, id: string, heading: string | RegExp) {
  await openDeskSection(page, id);
  const headingLocator = typeof heading === 'string'
    ? page.getByRole('heading', { name: heading, exact: true, level: 1 })
    : page.getByRole('heading', { name: heading, level: 1 });
  await expect(headingLocator).toBeVisible();
}

async function closeMenu(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('.ctx')).toBeHidden();
}

async function expectPhoneMenuCoversFooter(page: Page) {
  const menu = page.locator('.ctx');
  await expect(menu.getByRole('button', { name: 'Editar' })).toBeVisible();
  await expect(menu.getByRole('button', { name: /^(Archivar|Anular)$/ })).toBeVisible();
  await settle(page);
  const box = await page.evaluate(() => {
    const overlay = document.querySelector('.ov.ctxov');
    const ctx = document.querySelector('.ctx');
    const tab = document.querySelector('.mtab');
    if (!(overlay instanceof HTMLElement) || !(ctx instanceof HTMLElement) || !(tab instanceof HTMLElement)) {
      throw new Error('missing action sheet');
    }
    const overlayBox = overlay.getBoundingClientRect();
    const ctxBox = ctx.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const height = window.innerHeight;
    const width = document.documentElement.clientWidth;
    const x = tabBox.left + tabBox.width / 2;
    const y = Math.min(height - 2, tabBox.top + tabBox.height / 2);
    const hit = document.elementsFromPoint(x, y);
    return {
      overlayTop: overlayBox.top,
      overlayBottom: overlayBox.bottom,
      overlayLeft: overlayBox.left,
      overlayRight: overlayBox.right,
      ctxBottom: ctxBox.bottom,
      ctxWidth: ctxBox.width,
      height,
      width,
      scrim: getComputedStyle(overlay).backgroundColor,
      sheetIndex: hit.findIndex((node) => node === ctx || ctx.contains(node)),
      tabIndex: hit.findIndex((node) => node === tab || tab.contains(node)),
    };
  });
  expect(box.overlayTop).toBeLessThanOrEqual(1);
  expect(box.overlayLeft).toBeLessThanOrEqual(1);
  expect(box.overlayRight).toBeGreaterThanOrEqual(box.width - 1);
  expect(box.overlayBottom).toBeGreaterThanOrEqual(box.height - 1);
  expect(box.ctxBottom).toBeGreaterThanOrEqual(box.height - 1);
  expect(box.ctxWidth).toBeGreaterThan(box.width - 8);
  expect(box.scrim).toBe('rgba(17, 17, 17, 0.45)');
  expect(box.sheetIndex).toBeGreaterThanOrEqual(0);
  expect(box.tabIndex).toBeGreaterThan(box.sheetIndex);
}

async function expectDesktopMenuFloats(page: Page) {
  const menu = page.locator('.ctx');
  await expect(menu.getByRole('button', { name: 'Editar' })).toBeVisible();
  await expect(menu.getByRole('button', { name: /^(Archivar|Anular)$/ })).toBeVisible();
  await expect(page.getByTestId('mobile-tab-bar')).toHaveCount(0);
  await expect(page.locator('.side')).toBeVisible();
  await settle(page);
  const box = await page.evaluate(() => {
    const overlay = document.querySelector('.ov.ctxov');
    const ctx = document.querySelector('.ctx');
    if (!(overlay instanceof HTMLElement) || !(ctx instanceof HTMLElement)) throw new Error('missing menu');
    const ctxBox = ctx.getBoundingClientRect();
    const style = getComputedStyle(ctx);
    return {
      position: style.position,
      width: ctxBox.width,
      bottom: ctxBox.bottom,
      height: window.innerHeight,
      viewport: document.documentElement.clientWidth,
      scrim: getComputedStyle(overlay).backgroundColor,
      radius: `${style.borderTopLeftRadius} ${style.borderBottomLeftRadius}`,
    };
  });
  expect(box.position).toBe('fixed');
  expect(box.width).toBeGreaterThan(180);
  expect(box.width).toBeLessThan(280);
  expect(box.width).toBeLessThan(box.viewport - 40);
  expect(box.scrim).toBe('rgba(22, 24, 29, 0.08)');
  expect(box.radius).toBe('18px 18px');
}

test.beforeAll(() => {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
});

test('lays the row action sheet over the phone footer and keeps the desktop menu floating', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const email = buildTestEmail(testInfo, 'row-actions');
  const clientName = `Ana Fila ${testInfo.parallelIndex}`;
  const model = `iPhone fila ${testInfo.parallelIndex}`;
  const received = `Pixel recibido ${testInfo.parallelIndex}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDollar(page);
  await bootstrapStoreViaApi(page, request, email, `Acciones ${testInfo.parallelIndex}`);
  await createClientViaApi(request, email, { name: clientName, phone: '11 4444 5555' });
  await createInventoryItemViaApi(request, email, {
    imei: String(Date.now()).padStart(15, '5').slice(-15),
    model,
    price: 650000,
  });
  await createSaleViaApi(request, email, {
    date: todayLabel(),
    clientName,
    deviceLabel: `${model} 128GB`,
    amount: 650000,
  });
  await createTradeInViaApi(request, email, {
    date: todayLabel(),
    clientName,
    deviceReceived: received,
    deviceGiven: 'Funda',
    takeValue: 80000,
  });
  await createRepairViaApi(request, email, {
    clientName,
    device: 'iPhone 13',
    fault: 'Batería',
    estimate: 45000,
  });
  await page.reload();
  await expect(page.locator('.side')).toBeVisible();

  const desktopTargets: { id: string; heading: string | RegExp; row: string }[] = [
    { id: 'dashboard', heading: /Qué hay para/, row: '[data-testid="dashboard-sales"] tbody tr' },
    { id: 'dashboard', heading: /Qué hay para/, row: '[data-testid="dashboard-trades"] .dash-cj' },
    { id: 'inventory', heading: 'Inventario', row: '.dtable tbody tr' },
    { id: 'sales', heading: 'Ventas', row: '.dtable tbody tr' },
    { id: 'tradeins', heading: 'Canjes', row: '.dtable tbody tr' },
    { id: 'clients', heading: 'Clientes', row: '.dtable tbody tr' },
    { id: 'service', heading: 'Servicio técnico', row: '[data-testid^="repair-card-"]' },
  ];

  for (const target of desktopTargets) {
    await openSection(page, target.id, target.heading);
    await expect(page.getByRole('button', { name: 'Más acciones' })).toHaveCount(0);
    const row = page.locator(target.row).first();
    await expect(row).toBeVisible();
    await row.click({ button: 'right' });
    await expectDesktopMenuFloats(page);
    if (SHOTS && target.id === 'inventory') await page.screenshot({ path: `${SHOTS}/desktop-1440-menu.png` });
    await closeMenu(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();

  const phoneTargets: { id: string; heading: string | RegExp; shot: string }[] = [
    { id: 'dashboard', heading: /Qué hay para/, shot: 'phone-390-dashboard.png' },
    { id: 'inventory', heading: 'Inventario', shot: 'phone-390-menu.png' },
    { id: 'sales', heading: 'Ventas', shot: 'phone-390-sales.png' },
    { id: 'tradeins', heading: 'Canjes', shot: 'phone-390-tradeins.png' },
    { id: 'clients', heading: 'Clientes', shot: 'phone-390-clients.png' },
    { id: 'service', heading: 'Servicio técnico', shot: 'phone-390-service.png' },
  ];

  for (const target of phoneTargets) {
    await openSection(page, target.id, target.heading);
    const bulkList = ['inventory', 'sales', 'tradeins', 'clients'].includes(target.id);
    if (bulkList) {
      await expect(page.getByRole('checkbox', { name: /^Seleccionar/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Seleccionar', exact: true })).toBeVisible();
    }
    const menus = page.getByRole('button', { name: 'Más acciones' });
    await expect(menus.first()).toBeVisible();
    const count = await menus.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < Math.min(count, target.id === 'dashboard' ? 2 : 1); index += 1) {
      if (bulkList) {
        const row = page.locator('.phone-row').first();
        await row.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 300, button: 0 });
        await expect(page.locator('.ctx')).toBeVisible();
        await row.dispatchEvent('pointerup', { pointerType: 'touch' });
        await expect(page.getByRole('checkbox', { name: /^Seleccionar/ })).toHaveCount(0);
      } else await menus.nth(index).click();
      await expectPhoneMenuCoversFooter(page);
      if (SHOTS && index === 0) await page.screenshot({ path: `${SHOTS}/${target.shot}` });
      await closeMenu(page);
    }
    if (bulkList) {
      await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
      const bar = page.getByTestId('bulk-action-bar');
      await expect(bar).toContainText('0 seleccionados');
      await expect(page.getByRole('checkbox', { name: /^Seleccionar/ }).first()).toBeVisible();
      await page.getByRole('checkbox', { name: /^Seleccionar todos/ }).check();
      const selectedCount = await page.getByRole('checkbox', { name: /^Seleccionar/ }).count() - 1;
      await expect(bar).toContainText(`${selectedCount} ${selectedCount === 1 ? 'seleccionado' : 'seleccionados'}`);
      await bar.getByRole('button', { name: 'Listo', exact: true }).click();
      await expect(page.getByRole('checkbox', { name: /^Seleccionar/ })).toHaveCount(0);
      await expect(bar).toHaveCount(0);
    }
  }
});
