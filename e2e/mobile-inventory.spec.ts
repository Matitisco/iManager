import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi } from './utils';

const SHOTS = process.env.MOBILE_INVENTORY_SHOTS?.trim();

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

async function settleMotion(page: Page, selector: string) {
  await page.locator(selector).first().evaluate(async (node) => {
    const animations = node.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function expectFits(page: Page) {
  const report = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - width;
    const outside: string[] = [];
    const roots = ['.mhead', '.mtab', '.stage', '.mdock', '.ov', '.sheet', '.ctx', '.dialog'].flatMap((selector) => [...document.querySelectorAll(selector)]);
    for (const root of roots) {
      const nodes = [root, ...root.querySelectorAll('*')];
      for (const node of nodes) {
        if (!(node instanceof Element) || node.closest('.toast')) continue;
        if (node.closest('.wchips, .gfilters, .dkanban') && !node.matches('.wchips, .gfilters, .dkanban')) continue;
        const box = node.getBoundingClientRect();
        if (box.width < 1 && box.height < 1) continue;
        if (box.left < -1 || box.right > width + 1) {
          const label = node.getAttribute('data-testid') || (typeof node.className === 'string' ? node.className : node.tagName);
          outside.push(`${String(label).slice(0, 70)} [${Math.round(box.left)}…${Math.round(box.right)}]`);
          if (outside.length >= 8) return { extra, outside };
        }
      }
    }
    return { extra, outside };
  });
  expect(report.outside).toEqual([]);
  expect(report.extra).toBeLessThanOrEqual(1);
}

test.describe('desktop inventory stays put', () => {
  test('keeps the table, the price list button and the old empty copy', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'inv-desk');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Inventario desk ${testInfo.parallelIndex}`);
    await page.getByTestId('sidebar-tab-inventory').click();
    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Lista de precios' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filtros' })).toHaveCount(0);
    await expect(page.getByTestId('inventory-empty')).toHaveCount(0);
    await expect(page.getByText('No hay equipos con ese filtro.')).toBeVisible();
    await expect(page.getByPlaceholder('Buscar modelo o color')).toBeVisible();
  });
});

test.describe('inventory on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows cards, filters, empty state and sheets inside the screen', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'inv-phone');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Inventario ${testInfo.parallelIndex}`);
    await page.getByTestId('sidebar-tab-inventory').click();
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByTestId('inventory-empty')).toContainText('Todavía no cargaste equipos');
    await expect(page.getByText('0 resultados')).toBeVisible();
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar equipo' })).toBeVisible();
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar modelo o color')).toHaveCount(0);
    const chips = page.locator('.wchips');
    const chipStyle = await chips.evaluate((node) => {
      const style = getComputedStyle(node);
      return { wrap: style.flexWrap, overflow: style.overflowX };
    });
    expect(chipStyle.wrap).toBe('nowrap');
    expect(chipStyle.overflow).toBe('auto');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/inventory-390-empty.png`, fullPage: true });

    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByPlaceholder('Buscar por IMEI, modelo o color')).toBeVisible();
    await page.getByRole('button', { name: 'Buscar' }).click();

    await page.getByRole('button', { name: 'Filtros' }).click();
    const filters = page.getByRole('dialog', { name: 'Filtros' });
    await expect(filters.locator('.sheet-grab')).toBeVisible();
    await expect(filters.locator('.sheet-foot').getByRole('button', { name: 'Aplicar filtros' })).toBeVisible();
    await expect(filters.locator('.sheet-foot').getByRole('button', { name: 'Limpiar filtros' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/inventory-390-filters.png` });
    await filters.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar equipo' }).click();
    const form = page.getByRole('dialog', { name: 'Registrar equipo' });
    await expect(form.locator('.sheet-foot').getByRole('button', { name: 'Guardar equipo' })).toBeVisible();
    await expect(form.getByText(/ARS/)).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/inventory-390-new.png` });
    await form.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' }).click();
    const importer = page.getByRole('dialog', { name: 'Importar equipos' });
    await expect(importer.locator('.sheet-grab')).toBeVisible();
    await expect(importer.getByText(/Arrastrá un archivo/)).toBeVisible();
    await expect(importer.locator('.sheet-foot').getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/inventory-390-import.png` });
    await importer.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByRole('button', { name: 'Más opciones' }).click();
    await expect(page.getByRole('button', { name: 'Lista de precios' })).toBeDisabled();
    await page.getByRole('button', { name: 'Más opciones' }).click();

    await createInventoryItemViaApi(request, email, {
      imei: '350000000000010',
      model: 'iPhone 13',
      capacity: '128GB',
      color: 'Medianoche',
      condition: 'USADO',
      grade: 'A',
      batteryHealth: '89%',
      price: 650000,
      status: 'DISPONIBLE',
    });
    await createInventoryItemViaApi(request, email, {
      imei: '350000000000020',
      model: 'iPhone 14 Pro',
      capacity: '256GB',
      color: 'Morado',
      condition: 'USADO',
      grade: 'A+',
      batteryHealth: '95%',
      price: 1100000,
      status: 'EN_REVISION',
    });
    await createInventoryItemViaApi(request, email, {
      imei: '350000000000030',
      model: 'iPhone 15',
      capacity: '128GB',
      color: 'Azul',
      condition: 'NUEVO',
      grade: 'N/A',
      batteryHealth: '100%',
      price: 1300000,
      status: 'DISPONIBLE',
    });
    await page.reload();
    await expect(page.getByTestId('blue-widget')).toHaveAttribute('data-state', 'ready');
    await page.getByTestId('sidebar-tab-inventory').click();
    await expect(page.getByText('3 equipos · 2 disponibles')).toBeVisible();
    const card = page.getByText('iPhone 13 · 128GB').locator('xpath=ancestor::button[1]');
    await expect(card.getByText('IMEI 35 000000 000001 0')).toBeVisible();
    await expect(card.getByText('Usado · Medianoche')).toBeVisible();
    await expect(card.getByText('Grado A · Bat. 89%')).toBeVisible();
    await expect(card.getByText('$ 650.000')).toBeVisible();
    await expect(card.getByText('Disponible')).toBeVisible();
    await expect(card.getByText('≈ US$ 500')).toBeVisible();
    await expect(page.getByTestId('row-menu').first()).toBeVisible();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/inventory-390-list.png`, fullPage: true });

    await page.getByRole('button', { name: 'Filtros' }).click();
    const filled = page.getByRole('dialog', { name: 'Filtros' });
    await filled.getByRole('checkbox', { name: 'Usado · Grado A', exact: true }).check();
    await filled.locator('.sheet-foot').getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByText('iPhone 13 · 128GB')).toBeVisible();
    await expect(page.getByText('iPhone 15 · 128GB')).toHaveCount(0);
    await expectFits(page);

    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('dialog', { name: 'Filtros' }).locator('.sheet-foot').getByRole('button', { name: 'Limpiar filtros' }).click();
    await page.getByRole('dialog', { name: 'Filtros' }).locator('.sheet-foot').getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByText('iPhone 15 · 128GB')).toBeVisible();

    await page.getByText('iPhone 13 · 128GB').click();
    const detail = page.getByRole('dialog', { name: /iPhone 13/ });
    await expect(detail.locator('.sheet-foot').getByRole('button', { name: 'Guardar estado' })).toBeVisible();
    await expect(detail.getByText('IMEI')).toBeVisible();
    await expect(detail.getByText('$ 650.000')).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/inventory-390-detail.png` });
    await detail.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByRole('button', { name: 'Lista de precios' }).click();
    await expect(page.getByRole('dialog', { name: 'Lista de precios' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Lista de precios' }).locator('.sheet-foot').getByRole('button', { name: 'Cerrar' }).click();

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByTestId('mobile-dock')).toBeVisible();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/inventory-360-list.png`, fullPage: true });
  });
});
