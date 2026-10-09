import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi } from './utils';

const SHOTS = process.env.MOBILE_NOTIFICATIONS_SHOTS?.trim();

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
        if (node.closest('.wchips, .gfilters, .dkanban, .sale-pills') && !node.matches('.wchips, .gfilters, .dkanban, .sale-pills')) continue;
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

async function openNotifications(page: Page) {
  await page.getByTestId('sidebar-tab-more').click();
  await page.getByTestId('sidebar-tab-notifications').click();
  await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible();
}

test.describe('desktop notifications stay put', () => {
  test('keeps the total, the section chips and the flat list', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'notif-desk');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Notif desk ${testInfo.parallelIndex}`);
    await page.getByTestId('sidebar-tab-notifications').click();
    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-bar')).toHaveCount(0);
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByTestId('notifications-screen')).toHaveCount(0);
    await expect(page.getByTestId('notifications-empty')).toHaveCount(0);
    await expect(page.getByPlaceholder('Buscar notificaciones')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible();
    await expect(page.getByText('Todo al día')).toBeVisible();
    await expect(page.getByText('Todavía no hay notificaciones.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leer todas' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Marcar todas como leídas' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Inventario 0' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ventas 0' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Canjes 0' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clientes 0' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sin leer', exact: true })).toBeVisible();
    await expect(page.getByText('Hoy', { exact: true })).toHaveCount(0);
  });
});

test.describe('notifications on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('lists section notices with Argentine amounts, counters, highlights and an empty history', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    const email = buildTestEmail(testInfo, 'notif-phone');
    const model = `iPhone aviso ${Date.now()}`;
    const clientName = `Cliente aviso ${Date.now()}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Notif ${testInfo.parallelIndex}`);

    await openNotifications(page);
    await expect(page.getByTestId('page-back')).toBeVisible();
    await expect(page.getByText('Estás al día')).toBeVisible();
    await expect(page.getByTestId('notifications-empty')).toContainText('No hay notificaciones');
    await expect(page.getByTestId('notifications-empty')).toContainText('Todavía no tenés notificaciones en tu historial.');
    await expect(page.getByPlaceholder('Buscar notificaciones')).toBeVisible();
    await expect(page.getByTestId('notifications-read-filter').getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('notifications-sections').getByRole('button', { name: 'Inventario 0' })).toBeVisible();
    await expect(page.getByTestId('notifications-sections').getByRole('button', { name: 'Ventas 0' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar todas como leídas' })).toHaveCount(0);
    await expect(page.locator('.side')).toHaveCount(0);
    await settleMotion(page, '.enter-f');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/notifications-390-empty.png` });

    await page.setViewportSize({ width: 360, height: 800 });
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/notifications-360-empty.png` });
    await page.setViewportSize({ width: 390, height: 844 });

    await createInventoryItemViaApi(request, email, {
      imei: String(Date.now()).padStart(15, '7').slice(-15),
      model,
      price: 50000,
    });
    await page.getByTestId('sidebar-tab-sales').click();
    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar venta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Registrar venta' });
    await dialog.getByLabel('Cliente').fill(clientName);
    await dialog.getByRole('combobox', { name: 'Equipo' }).fill(model);
    await dialog.getByRole('option', { name: new RegExp(model) }).click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByLabel('1 en Inventario')).toHaveText('1');
    await page.getByTestId('sidebar-tab-more').click();
    const moreNote = page.getByTestId('sidebar-tab-notifications');
    await expect(moreNote).toContainText(/[1-9]\d* sin leer/);
    await expectFits(page);

    await moreNote.click();
    await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible();
    const sale = page.getByTestId('notification-groups').getByRole('button', { name: /Venta registrada/ });
    await expect(sale).toContainText(model);
    await expect(sale).toContainText(clientName);
    await expect(sale).toContainText(/\$\s*50\.000/);
    await expect(sale).toContainText('Ventas');
    const inventory = page.getByTestId('notification-groups').getByRole('button', { name: /Equipo vendido/ });
    await expect(inventory).toContainText(new RegExp(`${model}.*vendido`));
    await expect(inventory).toContainText('Inventario');
    const client = page.getByTestId('notification-groups').locator('.notif-row').filter({ hasText: 'Clientes' });
    await expect(client).toContainText(clientName);
    await expect(page.getByTestId('notification-group-hoy')).toBeVisible();
    await expect(page.getByTestId('notifications-sections').getByRole('button', { name: 'Inventario 1' })).toBeVisible();
    await expect(page.getByTestId('notifications-sections').getByRole('button', { name: /Ventas \d+/ })).toBeVisible();
    await expect(page.getByTestId('notifications-sections').getByRole('button', { name: 'Canjes 0' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar todas como leídas' })).toBeVisible();
    await expect(page.getByText(/[1-9]\d* sin leer/)).toBeVisible();
    await expect(page.locator('.toast.show')).toBeHidden();
    await settleMotion(page, '.enter-f');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/notifications-390-list.png` });

    await page.getByTestId('notifications-sections').getByRole('button', { name: /Ventas \d+/ }).click();
    await expect(sale).toBeVisible();
    await expect(inventory).toHaveCount(0);
    await page.getByTestId('notifications-sections').getByRole('button', { name: 'Canjes 0' }).click();
    await expect(page.getByText('No hay notificaciones de Canjes.')).toBeVisible();
    await page.getByTestId('notifications-sections').getByRole('button', { name: 'Todas' }).click();
    await page.getByPlaceholder('Buscar notificaciones').fill('nadie');
    await expect(page.getByText('No hay notificaciones con esa búsqueda.')).toBeVisible();
    await page.getByPlaceholder('Buscar notificaciones').fill('');
    await expect(sale).toBeVisible();

    await page.getByTestId('sidebar-tab-inventory').click();
    const list = page.getByTestId('phone-rows');
    await expect(page.getByTestId('section-notices')).toContainText('1 novedad');
    await expect(list.getByText(model)).toBeVisible();
    await expect(list.getByTestId('notice-reason')).toHaveText('Vendido');
    await expect(page.getByLabel('1 en Inventario')).toHaveCount(0);
    await page.getByTestId('sidebar-tab-sales').click();
    await page.getByTestId('sidebar-tab-inventory').click();
    await expect(page.getByLabel('1 en Inventario')).toHaveCount(0);
    await expect(page.getByTestId('notice-reason')).toHaveCount(0);

    await openNotifications(page);
    await page.getByTestId('notifications-read-filter').getByRole('button', { name: 'Sin leer' }).click();
    await expect(page.getByTestId('notification-groups').getByRole('button', { name: /Equipo vendido/ })).toHaveCount(0);
    await expect(page.getByTestId('notifications-sections').getByRole('button', { name: 'Inventario 0' })).toBeVisible();
    await page.getByRole('button', { name: 'Marcar todas como leídas' }).click();
    await expect(page.getByText('Estás al día', { exact: true })).toBeVisible();
    await expect(page.getByText('Estás al día. No hay notificaciones sin leer.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar todas como leídas' })).toHaveCount(0);
    await expect(page.locator('.toast.show')).toBeHidden();
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/notifications-360-read.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('sidebar-tab-more').click();
    await expect(page.getByTestId('sidebar-tab-notifications')).toContainText('0 sin leer');
  });
});
