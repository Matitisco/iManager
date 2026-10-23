import { openDeskSection } from './navigation';
import { devices, expect, test } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi, createStoreViaApi, loginViaUi } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3100';
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType });

for (const device of [
  { name: 'desktop', mobile: false, use: { viewport: { width: 1440, height: 900 } } },
  { name: 'iphone', mobile: true, use: { ...iphone, viewport: { width: 390, height: 844 } } },
]) test.describe(`offline banner ${device.name}`, () => {
  test.use(device.use);

  test('recovers the public catalog without a connection banner', async ({ page, request, browser }, testInfo) => {
    const email = buildTestEmail(testInfo, 'offline-catalog');
    await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300 } }));
    // Seed before the single login navigation. Consecutive setup reloads can
    // overlap WebKit's unfinished navigation, before this offline test begins.
    await createStoreViaApi(request, email, 'Mi Tienda Ejemplo');
    expect((await request.patch(`${api}/api/stores/current`, { headers: authHeaders(email), data: { instagram: 'e2etienda', phone: '+54 9 11 55551234', address: 'Av. Corrientes 1234', currency: 'USD', exchangeMode: 'manual', manualBuy: 1280, manualSell: 1300 } })).ok()).toBeTruthy();
    await createInventoryItemViaApi(request, email, { imei: '359123456789012', model: 'iPhone 15 Pro', capacity: '128GB', color: 'Titanio negro', condition: 'USADO', grade: 'A+', batteryHealth: '95%', cost: 600, price: 920 });
    await loginViaUi(page, email);
    await expect(page.locator('.desk-app')).toBeVisible();
    if (device.mobile) await page.getByTestId('mobile-tab-bar').getByRole('button', { name: /Más/ }).click();
    await openDeskSection(page, 'publicCatalog');
    await page.getByRole('button', { name: 'Crear catálogo' }).click();
    const link = await page.getByRole('textbox', { name: 'Link público' }).inputValue();
    // Summary and equipment now share the same Catálogo destination.
    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Seleccionar iPhone 15 Pro 128GB' }).check();
    await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
    const context = await browser.newContext(device.use);
    const lead = await context.newPage();
    await lead.goto(link, { waitUntil: 'domcontentloaded' });
    await expect(lead.getByText('US$ 920')).toBeVisible();
    const url = lead.url();
    await context.setOffline(true);
    const failedRefresh = lead.waitForEvent('requestfailed', request => request.url().includes('/api/public/catalog/'));
    await lead.evaluate(() => window.dispatchEvent(new Event('focus')));
    await failedRefresh;
    await expect(lead.getByText('US$ 920')).toBeVisible();
    await expect(lead.getByTestId('offline-banner')).toHaveCount(0);
    const recovered = lead.waitForResponse(response => response.url().includes('/api/public/catalog/') && response.ok());
    await context.setOffline(false);
    await recovered;
    await expect(lead.getByTestId('offline-banner')).toHaveCount(0);
    await expect(lead.getByText('US$ 920')).toBeVisible();
    expect(lead.url()).toBe(url);
    await context.close();
  });

  test('keeps Más and Clientes free of connection notices while offline', async ({ page, request }, testInfo) => {
    test.skip(!device.mobile, 'Más sólo existe en el teléfono');
    await page.setViewportSize({ width: 393, height: 852 });
    const email = buildTestEmail(testInfo, 'offline-phone');
    await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300 } }));
    await bootstrapStoreViaApi(page, request, email, 'Mi Tienda Ejemplo');
    await page.getByTestId('mobile-tab-bar').getByRole('button', { name: /Más/ }).click();
    await expect(page.getByRole('heading', { name: 'Más' })).toBeVisible();
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);
    await page.context().setOffline(true);
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);
    await expect(page.getByText('No hay conexión. Revisá tu internet y probá de nuevo.')).toHaveCount(0);
    await openDeskSection(page, 'clients');
    await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);
    await page.context().setOffline(false);
    await expect(page.getByTestId('offline-banner')).toHaveCount(0, { timeout: 8_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
  });

  test('keeps Más free of banners during recovery', async ({ page, request }, testInfo) => {
    test.skip(!device.mobile, 'Más sólo existe en el teléfono');
    const email = buildTestEmail(testInfo, 'offline-more');
    await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300 } }));
    await bootstrapStoreViaApi(page, request, email, 'Mi Tienda Ejemplo');
    await page.context().setOffline(true);
    await page.getByTestId('mobile-tab-bar').getByRole('button', { name: /Más/ }).click();
    await expect(page.getByRole('heading', { name: 'Más' })).toBeVisible();
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);
    const hash = await page.evaluate(() => window.location.hash);
    await page.context().setOffline(false);
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Más' })).toBeVisible();
    expect(await page.evaluate(() => window.location.hash)).toBe(hash);
  });
});
