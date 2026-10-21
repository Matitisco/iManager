import { expandListOptions } from './navigation';
import path from 'node:path';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createInventoryItemViaApi } from './utils';

test.describe.configure({ mode: 'serial' });

const SHOTS = path.resolve('docs/pr-shots');
const API = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';

type Seller = { id: string; name: string; role: string };

async function mockDollar(page: Page) {
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({
    json: { compra: 1535, venta: 1555, fechaActualizacion: '2026-10-18T22:30:00-03:00' },
  }));
  await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({
    json: { blue: { value_buy: 1535, value_sell: 1555 }, last_update: '2026-10-18T22:30:00-03:00' },
  }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({
    json: { venta: '1555,00', valor_cierre_ant: '1540,00' },
  }));
}

async function api(request: APIRequestContext, email: string, method: 'get' | 'post' | 'patch', url: string, data?: unknown) {
  let last = '';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await request[method](`${API}${url}`, {
      headers: { ...authHeaders(email), ...(data ? { 'Content-Type': 'application/json' } : {}) },
      data,
    });
    const body = await response.text();
    if (response.ok()) return body ? JSON.parse(body) as Record<string, unknown> : {};
    last = `${method.toUpperCase()} ${url} failed ${response.status()}: ${body}`;
    if (response.status() < 500 || attempt === 3) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  expect(false, last).toBeTruthy();
  return {};
}

async function rename(request: APIRequestContext, email: string, displayName: string) {
  await api(request, email, 'patch', '/api/users/me', { displayName });
}

async function invite(request: APIRequestContext, ownerEmail: string, email: string, name: string) {
  const created = await api(request, ownerEmail, 'post', '/api/invitations', { role: 'STAFF', email });
  await api(request, email, 'post', '/api/invitations/accept', { token: created.token });
  await rename(request, email, name);
}

async function seed(page: Page, request: APIRequestContext, testInfo: TestInfo) {
  const ownerEmail = buildTestEmail(testInfo, 'owner');
  const luciaEmail = buildTestEmail(testInfo, 'lucia');
  const martinEmail = buildTestEmail(testInfo, 'martin');
  await mockDollar(page);
  await bootstrapStoreViaApi(page, request, ownerEmail, 'Mi Tienda Ejemplo');
  await rename(request, ownerEmail, 'Matías');
  await invite(request, ownerEmail, luciaEmail, 'Lucía');
  await invite(request, ownerEmail, martinEmail, 'Martín');
  await api(request, ownerEmail, 'patch', '/api/stores/current', {
    currency: 'USD',
    usedWarrantyDays: 30,
    sealedWarrantyDays: 90,
  });

  const sellers = ((await api(request, ownerEmail, 'get', '/api/commissions/sellers')).sellers ?? []) as Seller[];
  const sellerId = (name: string) => {
    const person = sellers.find((item) => item.name === name);
    expect(person, `seller ${name}`).toBeTruthy();
    return person!.id;
  };
  const lucia = sellerId('Lucía');
  const martin = sellerId('Martín');
  const matias = sellerId('Matías');

  const juan = await createClientViaApi(request, ownerEmail, { name: 'Juan Domínguez', dni: '30111222', phone: '1123456789' });
  const other = async (name: string) => (await createClientViaApi(request, ownerEmail, { name })).client;
  const roberto = await other('Roberto Carlos');
  const ana = await other('Ana Pérez');
  const sofia = await other('Sofía Ruiz');
  const carla = await other('Carla Méndez');
  const imeiFor = (last4: string) => `${testInfo.parallelIndex + 1}${last4.padStart(14, '0')}`.slice(-15);
  const product = async (model: string, capacity: string, last4: string, price: number) => {
    const created = await createInventoryItemViaApi(request, ownerEmail, {
      model, capacity, imei: imeiFor(last4), price, condition: 'USADO', grade: 'A', batteryHealth: '90%',
    });
    return created.inventoryItem.id;
  };
  const sale = async (input: { date: string; clientId: string; clientName: string; deviceLabel: string; amount: number; sellerMemberId?: string | null; productId?: string; warrantyDays?: number; status?: 'COMPLETADA' | 'PENDIENTE' }) => {
    await api(request, ownerEmail, 'post', '/api/sales', {
      date: input.date,
      clientId: input.clientId,
      clientName: input.clientName,
      deviceLabel: input.deviceLabel,
      productId: input.productId,
      amount: input.amount,
      amountCurrency: 'USD',
      paymentMethod: 'EFECTIVO',
      status: input.status ?? 'COMPLETADA',
      sellerMemberId: input.sellerMemberId ?? null,
      warrantyDays: input.warrantyDays ?? 60,
    });
  };

  await sale({
    date: '16/10/2026',
    clientId: juan.client.id,
    clientName: 'Juan Domínguez',
    deviceLabel: 'iPhone 15 Pro · 256GB',
    amount: 980,
    sellerMemberId: lucia,
    warrantyDays: 60,
    productId: await product('iPhone 15 Pro', '256GB', '4821', 980),
  });
  await sale({
    date: '15/10/2026',
    clientId: roberto.id,
    clientName: 'Roberto Carlos',
    deviceLabel: 'iPhone 13 · 128GB',
    amount: 430,
    sellerMemberId: lucia,
    warrantyDays: 60,
    productId: await product('iPhone 13', '128GB', '4322', 430),
  });
  await sale({
    date: '13/10/2026',
    clientId: ana.id,
    clientName: 'Ana Pérez',
    deviceLabel: 'iPhone 14 · 128GB',
    amount: 590,
    sellerMemberId: martin,
    status: 'PENDIENTE',
    warrantyDays: 30,
    productId: await product('iPhone 14', '128GB', '5901', 590),
  });
  await sale({
    date: '11/10/2026',
    clientId: sofia.id,
    clientName: 'Sofía Ruiz',
    deviceLabel: 'iPhone 12 · 64GB',
    amount: 300,
    sellerMemberId: matias,
    warrantyDays: 90,
    productId: await product('iPhone 12', '64GB', '3001', 300),
  });
  await sale({
    date: '06/10/2026',
    clientId: carla.id,
    clientName: 'Carla Méndez',
    deviceLabel: 'iPhone 11 · 64GB',
    amount: 220,
    sellerMemberId: null,
    warrantyDays: 30,
    productId: await product('iPhone 11', '64GB', '2201', 220),
  });
  await sale({
    date: '04/10/2026',
    clientId: juan.client.id,
    clientName: 'Juan Domínguez',
    deviceLabel: 'Funda + vidrio',
    amount: 25,
    sellerMemberId: matias,
    warrantyDays: 0,
  });
  await sale({
    date: '02/07/2026',
    clientId: juan.client.id,
    clientName: 'Juan Domínguez',
    deviceLabel: 'iPhone 13 · 128GB',
    amount: 450,
    sellerMemberId: martin,
    warrantyDays: 30,
    productId: await product('iPhone 13', '128GB', '4501', 450),
  });

  await api(request, ownerEmail, 'post', '/api/trade-ins', {
    date: '16/10/2026',
    clientId: juan.client.id,
    clientName: 'Juan Domínguez',
    deviceReceived: 'iPhone 12 · 128GB',
    deviceReceivedImei: imeiFor('0937'),
    takeValue: 260,
    currency: 'USD',
    deviceGiven: 'iPhone 15 Pro · 256GB',
    differencePaid: 0,
    status: 'PERITAJE TÉC.',
    draft: true,
  });
  await api(request, ownerEmail, 'post', '/api/repairs', {
    clientId: juan.client.id,
    clientName: 'Juan Domínguez',
    device: 'iPhone 13',
    fault: 'cambio de batería',
    imei: imeiFor('5512'),
    estimate: 60,
    currency: 'USD',
    technician: 'Martín',
    status: 'ENTREGADO',
    warrantyDays: 90,
  });
  await api(request, ownerEmail, 'post', '/api/repairs', {
    clientId: juan.client.id,
    clientName: 'Juan Domínguez',
    device: 'iPhone 15 Pro',
    fault: 'módulo de pantalla',
    imei: imeiFor('1801'),
    estimate: 180,
    currency: 'USD',
    technician: 'Pablo',
    status: 'RECIBIDO',
    warrantyDays: 60,
  });
  await product('iPhone 14', '128GB', '9901', 590);

  await page.reload();
  await expect(page.getByTestId('sidebar-tab-inventory')).toBeVisible();
  return { clientId: juan.client.id };
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, name), animations: 'disabled' });
}

async function expectNoOverflow(page: Page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra).toBeLessThanOrEqual(1);
}

async function openSales(page: Page) {
  await page.getByTestId('sidebar-tab-sales').click();
  await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
  await expect(page.getByText('Juan Domínguez').first()).toBeVisible();
}

test.describe('issue 375 ventas, garantía y ficha en escritorio', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('filtra por vendedor, ofrece garantía rápida y lista las compras del cliente', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    const seeded = await seed(page, request, testInfo);
    await openSales(page);
    await expect(page.getByRole('columnheader', { name: /Vendedor/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Lucía' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sin vendedor' })).toBeVisible();

    await page.getByRole('button', { name: 'Filtrar vendedor' }).click();
    const filter = page.getByRole('dialog', { name: 'Filtrar vendedor' });
    await expect(filter.getByRole('checkbox', { name: 'Lucía' })).toBeVisible();
    await expect(filter.getByRole('checkbox', { name: 'Sin vendedor' })).toBeVisible();
    await filter.getByRole('checkbox', { name: 'Lucía' }).check();
    await expect(page.getByTestId('sales-seller-chip')).toHaveText('Vendedor: Lucía ×');
    await expect(page.getByTestId('sales-filter-summary')).toContainText('2 de 6 ventas');
    await expect(page.getByTestId('sales-filter-summary')).toContainText('1.410');
    await expect(page.getByRole('cell', { name: /Ana Pérez/ })).toHaveCount(0);
    await shot(page, 'issue-375-vendedor-filter-desktop.png');

    await filter.getByRole('checkbox', { name: 'Sin vendedor' }).check();
    await expect(page.getByTestId('sales-seller-chip')).toHaveText('Vendedor: 2 ×');
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(page.getByTestId('sales-seller-chip')).toHaveCount(0);
    await expect(page.getByRole('cell', { name: 'Sin vendedor' })).toBeVisible();

    await page.getByRole('button', { name: 'Filtrar vendedor' }).click();
    await page.getByRole('dialog', { name: 'Filtrar vendedor' }).getByRole('checkbox', { name: 'Lucía' }).check();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Filtrar vendedor' })).toHaveCount(0);
    await shot(page, 'issue-375-ventas-desktop.png');

    await page.getByRole('button', { name: 'Registrar venta' }).click();
    const form = page.getByRole('dialog', { name: 'Registrar venta' });
    const warranty = form.getByRole('group', { name: 'Garantía' });
    await warranty.scrollIntoViewIfNeeded();
    await expect(warranty.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true');
    await expect(form.getByTestId('sale-warranty-until')).toContainText(/^Vence el /);
    await warranty.getByRole('button', { name: '60 días' }).click();
    await expect(warranty.getByRole('button', { name: '60 días' })).toHaveAttribute('aria-pressed', 'true');
    await expect(form.getByTestId('sale-warranty-until')).toHaveText(/^Vence el \d{2}\/\d{2}\/\d{4}$/);
    await shot(page, 'issue-375-garantia-desktop.png');
    await warranty.getByRole('button', { name: 'Otro' }).click();
    await form.getByTestId('sale-warranty-days').fill('45');
    await expect(warranty.getByRole('button', { name: 'Otro' })).toHaveAttribute('aria-pressed', 'true');
    await expect(form.getByTestId('sale-warranty-until')).toHaveText(/^Vence el \d{2}\/\d{2}\/\d{4}$/);
    await form.getByRole('button', { name: 'Cerrar' }).first().click();

    await page.getByTestId('sidebar-tab-clients').click();
    await page.getByTestId(`client-row-${seeded.clientId}`).click();
    const detail = page.getByRole('dialog', { name: 'Juan Domínguez' });
    await expect(detail.getByTestId('client-purchases')).toBeVisible();
    await detail.getByTestId('client-purchases').scrollIntoViewIfNeeded();
    await expect(detail.getByText('Total gastado')).toBeVisible();
    await expect(detail.getByTestId('client-purchase-stats')).toContainText('1.695');
    await expect(detail.getByTestId('client-purchase-stats')).toContainText('5');
    await expect(detail.getByTestId('client-purchase-stats')).toContainText('2 vigentes');
    await expect(detail.getByText('Cubierto')).toHaveCount(0);
    await expect(detail.getByText(/IMEI ···4821/)).toBeVisible();
    await expect(detail.getByText('- US$ 260')).toBeVisible();
    await detail.getByRole('button', { name: /4821/ }).click();
    await expect(detail.getByText(/IMEI \d*4821/)).toBeVisible();
    await expect(detail.getByText(/Vigente hasta el/)).toBeVisible();
    await detail.getByRole('button', { name: 'Canjes' }).click();
    await expect(detail.getByTestId('client-purchase-count')).toHaveText('1');
    await expect(detail.getByText('recibido')).toBeVisible();
    await detail.getByRole('button', { name: 'Reparaciones' }).click();
    await expect(detail.getByText('Martín (técnico)')).toBeVisible();
    await expect(detail.getByText('Al entregar')).toBeVisible();
    await detail.getByRole('button', { name: /cambio de batería/ }).click();
    await expect(detail.getByText(/empieza al entregar|Vigente hasta el/)).toBeVisible();
    await detail.getByRole('button', { name: 'Todas' }).click();
    await detail.getByTestId('purchases-more').click();
    await expect(detail.getByText(/Vencida · 01\/08/)).toBeVisible();
    await shot(page, 'issue-375-ficha-desktop.png');
  });
});

test.describe('issue 375 ventas, garantía y ficha en iPhone', () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test('usa el sheet de vendedor y no desborda a 393px', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    const seeded = await seed(page, request, testInfo);
    await openSales(page);
    await expect(page.getByTestId('sales-seller-chip')).toHaveText('Vendedor');
    await expectNoOverflow(page);

    await expandListOptions(page);
    await page.getByTestId('sales-seller-chip').click();
    const sheet = page.getByRole('dialog', { name: 'Vendedor' });
    await expect(sheet.getByRole('checkbox', { name: /Lucía/ })).toBeVisible();
    await expect(sheet.getByRole('checkbox', { name: /Sin vendedor/ })).toBeVisible();
    await expect(sheet.getByText('2').first()).toBeVisible();
    await sheet.getByRole('checkbox', { name: /Lucía/ }).check();
    await expect(sheet.getByRole('button', { name: 'Ver 2 ventas' })).toBeVisible();
    await shot(page, 'issue-375-vendedor-sheet-mobile.png');
    await expectNoOverflow(page);
    await sheet.getByRole('button', { name: 'Limpiar' }).click();
    await expect(sheet.getByRole('checkbox', { name: /Lucía/ })).not.toBeChecked();
    await sheet.getByRole('checkbox', { name: /Lucía/ }).check();
    await sheet.getByRole('button', { name: 'Ver 2 ventas' }).click();
    await expect(page.getByTestId('sales-seller-chip')).toHaveText('Lucía');
    await expect(page.getByTestId('sales-filter-summary')).toContainText('2 de 6 ventas');
    await expect(page.getByTestId('sales-filter-summary')).toContainText('1.410');
    await expect(page.getByText('iPhone 11 · 64GB')).toHaveCount(0);
    await expectNoOverflow(page);
    await shot(page, 'issue-375-ventas-mobile.png');
    await page.getByRole('button', { name: 'Quitar filtro de vendedor' }).click();
    await expect(page.getByTestId('sales-filter-summary')).toHaveCount(0);

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar venta' }).click();
    const form = page.getByRole('dialog', { name: 'Registrar venta' });
    const warranty = form.getByRole('group', { name: 'Garantía' });
    await warranty.scrollIntoViewIfNeeded();
    await expect(warranty.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true');
    await warranty.getByRole('button', { name: '60 días' }).click();
    await expect(form.getByTestId('sale-warranty-until')).toHaveText(/^Vence el \d{2}\/\d{2}\/\d{4}$/);
    await expectNoOverflow(page);
    await shot(page, 'issue-375-garantia-mobile.png');
    await warranty.getByRole('button', { name: 'Otro' }).click();
    await form.getByLabel('Días de garantía').fill('45');
    await expect(form.getByTestId('sale-warranty-until')).toHaveText(/^Vence el \d{2}\/\d{2}\/\d{4}$/);
    await form.getByRole('button', { name: 'Cerrar' }).first().click();

    await page.getByTestId('sidebar-tab-more').click();
    await page.getByTestId('sidebar-tab-clients').click();
    await page.getByTestId(`client-row-${seeded.clientId}`).click();
    const detail = page.getByRole('dialog', { name: 'Juan Domínguez' });
    await detail.getByTestId('client-purchases').scrollIntoViewIfNeeded();
    const chips = detail.getByRole('group', { name: 'Filtrar compras' });
    await expect(chips.getByRole('button')).toHaveText(['Todas', 'Ventas', 'Canjes', 'Reparaciones']);
    const chipFit = await chips.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
    expect(chipFit).toBe(true);
    await expect(detail.getByTestId('client-purchase-stats')).toContainText('2 vigentes');
    await expect(detail.getByText('- US$ 260')).toBeVisible();
    await detail.getByRole('button', { name: /cambio de batería|módulo de pantalla/ }).first().click();
    await expect(detail.getByText(/IMEI \d{15}/)).toBeVisible();
    await expectNoOverflow(page);
    await shot(page, 'issue-375-ficha-mobile.png');

    await page.setViewportSize({ width: 320, height: 700 });
    await expectNoOverflow(page);
    const narrowFit = await chips.evaluate((node) => node.scrollWidth <= node.clientWidth + 1 || getComputedStyle(node).overflowX === 'auto');
    expect(narrowFit).toBe(true);
  });
});
