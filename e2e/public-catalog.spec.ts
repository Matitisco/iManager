import { mkdirSync } from 'node:fs';
import { devices, expect, test } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi, fetchInventory } from './utils';
const shots = process.env.ISSUE_341_SHOTS?.trim();
if (shots) mkdirSync(shots, { recursive: true });
const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3100';
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType });
for (const device of [
  { name: 'desktop', mobile: false, use: { viewport: { width: 1440, height: 900 } } },
  { name: 'iphone', mobile: true, use: { ...iphone, viewport: { width: 390, height: 844 } } },
]) test.describe(`catalog ${device.name}`, () => {
  test.use(device.use);
  test('publishes selected devices, filters without auth, hides, revokes and preserves errors', async ({ page, request, browser }, testInfo) => {
    const email = buildTestEmail(testInfo, 'catalog');
    await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300 } }));
    await bootstrapStoreViaApi(page, request, email, 'Mi Tienda Ejemplo');
    expect((await request.patch(`${api}/api/stores/current`, { headers: authHeaders(email), data: { phone: '+54 9 11 55551234', address: 'Av. Corrientes 1234, CABA', currency: 'USD', exchangeMode: 'manual', manualBuy: 1280, manualSell: 1300 } })).ok()).toBeTruthy();
    await createInventoryItemViaApi(request, email, { imei: '359123456789012', model: 'iPhone 15 Pro', capacity: '128GB', color: 'Titanio negro', condition: 'USADO', grade: 'A+', batteryHealth: '95%', cost: 600, price: 920 });
    await createInventoryItemViaApi(request, email, { imei: '359123456789013', model: 'iPhone 14', capacity: '256GB', color: 'Azul', condition: 'USADO', grade: 'A', batteryHealth: '88%', cost: 400, price: 590 });
    await page.reload();
    const openCatalog = async () => {
      if (device.mobile) {
        await page.getByTestId('mobile-tab-bar').getByRole('button', { name: /Más/ }).click();
        await expect(page.getByTestId('sidebar-tab-publicCatalog')).toBeVisible();
      }
      await page.getByTestId('sidebar-tab-publicCatalog').click();
    };
    await openCatalog(); await page.getByRole('button', { name: 'Crear catálogo' }).click();
    const link = await page.getByRole('textbox', { name: 'Link público' }).inputValue();
    const slug = link.split('/c/')[1];
    if (device.mobile) await page.getByTestId('catalog-screen').getByRole('button', { name: 'Equipos', exact: true }).click();
    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Seleccionar iPhone 15 Pro 128GB' }).check();
    await page.getByRole('checkbox', { name: 'Seleccionar iPhone 14 256GB' }).check();
    await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
    await expect(page.getByText('0 seleccionados')).toBeVisible();
    await page.getByRole('button', { name: 'Listo', exact: true }).click();
    expect((await fetchInventory(request, email)).inventory.every(item => (item as { catalogVisible?: boolean }).catalogVisible)).toBe(true);
    // Separate browser context has no login/session/localStorage.
    const context = await browser.newContext(device.use);
    const lead = await context.newPage();
    const loadPublic = async (url: string, expectedStatus = 200) => {
      const path = `/api/public/catalog/${new URL(url).pathname.split('/c/')[1]}`;
      const [response] = await Promise.all([
        lead.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === 'GET'),
        lead.goto(url, { waitUntil: 'domcontentloaded' }),
      ]);
      expect(response.status(), `GET ${path}`).toBe(expectedStatus);
    };
    const publicPayload = async () => {
      const response = await request.get(`${api}/api/public/catalog/${slug}`);
      expect(response.status(), 'Read public catalog fixture').toBe(200);
      return response.json();
    };
    await loadPublic(link);
    await expect(lead.getByRole('heading', { name: 'Mi Tienda Ejemplo' })).toBeVisible();
    await expect(lead.getByText('US$ 920')).toBeVisible();
    await expect(lead.getByRole('link', { name: 'Escribinos por WhatsApp' })).toHaveCount(1);
    await expect(lead.getByRole('link', { name: 'Escribinos por WhatsApp' })).toBeInViewport({ ratio: 1 });
    await expect(lead.getByText(/precios en USD/)).toBeVisible();
    const href = await lead.getByRole('link', { name: 'Escribinos por WhatsApp' }).getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\/5491155551234\?text=/);
    expect(decodeURIComponent(new URL(href!).searchParams.get('text')!)).toContain('👋');
    expect(await lead.locator('.price-groups').evaluate(node => getComputedStyle(node).columnCount)).toBe(device.mobile ? '1' : '2');
    await expect(lead.getByRole('img')).toHaveCount(0);
    await expect(lead.getByTestId('login-email')).toHaveCount(0);
    expect(await lead.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const payload = await publicPayload();
    expect(JSON.stringify(payload)).not.toMatch(/"(?:cost|imei|serial|supplier|customFields|id|storeId)"/);
    await expect(lead.locator('select')).toHaveCount(0);
    if (device.mobile) await lead.getByRole('button', { name: /^Filtros/ }).click();
    const filters = device.mobile ? lead.getByRole('dialog', { name: 'Filtrar lista' }) : lead.locator('.price-desktop-filters');
    if (device.mobile) {
      await filters.getByRole('button', { name: '128GB', exact: true }).click();
      await filters.getByRole('button', { name: 'Ver 1 equipo' }).click();
    } else {
      await filters.getByRole('button', { name: 'Capacidad', exact: true }).click();
      await lead.getByRole('option', { name: '128GB' }).click();
    }
    await expect(lead.getByText('US$ 590')).toHaveCount(0);
    await lead.getByRole('textbox', { name: 'Buscar modelo o color' }).fill('no coincide');
    await expect(lead.getByText('No hay equipos con estos filtros')).toBeVisible();
    await lead.getByRole('button', { name: 'Limpiar filtros' }).click();
    await lead.screenshot({ path: shots ? `${shots}/issue-341-${device.name}-public.png` : testInfo.outputPath('public.png'), fullPage: true });
    await page.getByRole('switch', { name: 'Visible en catálogo: iPhone 15 Pro 128GB' }).click();
    await expect(page.getByText('Oculto a mano')).toBeVisible();
    const afterHide = await publicPayload();
    expect(afterHide.items.map((item: { model: string }) => item.model)).toEqual(['iPhone 14']);
    await loadPublic(link); await expect(lead.getByText('US$ 920')).toHaveCount(0);
    if (device.mobile) await page.getByRole('button', { name: 'Resumen', exact: true }).click();
    await page.screenshot({ path: shots ? `${shots}/issue-341-${device.name}-manage.png` : testInfo.outputPath('manage.png'), fullPage: true });
    if (device.mobile) await page.getByRole('button', { name: 'Editar ›' }).click();
    else await page.getByRole('button', { name: 'Reglas y precio', exact: true }).click();
    const rules = page.getByRole('dialog', { name: 'Reglas y precio' });
    await rules.getByRole('switch', { name: 'Mostrar precio', exact: true }).click();
    if (shots) await page.screenshot({ path: `${shots}/issue-341-${device.name}-rules.png` });
    // Failed persistence keeps the modal open and does not announce success.
    await page.route('**/api/catalog', async route => { if (route.request().method() === 'PATCH') await route.fulfill({ status: 503, json: { error: 'unavailable' } }); else await route.continue(); });
    await rules.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(rules.getByRole('alert')).toBeVisible(); await expect(rules).toBeVisible();
    await page.unroute('**/api/catalog');
    await rules.getByRole('button', { name: 'Guardar', exact: true }).click(); await expect(rules).toHaveCount(0);
    await loadPublic(link); await expect(lead.getByText('Consultá', { exact: true })).toBeVisible();
    expect((await publicPayload()).items[0]).not.toHaveProperty('price');
    const editRules = async () => { if (device.mobile) await page.getByRole('button', { name: 'Editar ›' }).click(); else await page.getByRole('button', { name: 'Reglas y precio', exact: true }).click(); };
    await editRules(); await page.getByRole('dialog', { name: 'Reglas y precio' }).getByRole('button', { name: 'Regenerar link' }).click();
    await page.getByRole('dialog', { name: '¿Regenerar el link?' }).getByRole('button', { name: 'Regenerar link' }).click();
    await expect(page.getByRole('dialog', { name: '¿Regenerar el link?' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Link público' })).not.toHaveValue(link);
    const newLink = await page.getByRole('textbox', { name: 'Link público' }).inputValue(); expect(newLink).not.toBe(link);
    await loadPublic(link, 404); await expect(lead.getByText('Esta lista de precios no está disponible')).toBeVisible();
    await editRules(); await page.getByRole('dialog', { name: 'Reglas y precio' }).getByRole('button', { name: 'Desactivar catálogo' }).click();
    await page.getByRole('dialog', { name: '¿Desactivar el catálogo?' }).getByRole('button', { name: 'Desactivar catálogo' }).click();
    await expect(page.getByRole('dialog', { name: '¿Desactivar el catálogo?' })).toHaveCount(0);
    await loadPublic(newLink); await expect(lead.getByText('Esta lista de precios no está disponible')).toBeVisible();
    await expect(lead.getByRole('link', { name: 'Escribinos por WhatsApp' })).toHaveCount(1);
    await context.close();
  });
});
