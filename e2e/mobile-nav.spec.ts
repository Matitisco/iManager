import { openDeskSection } from './navigation';
import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInvitationViaApi, acceptInvitationViaUi } from './utils';

const SHOTS = process.env.MOBILE_NAV_SHOTS?.trim();

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

async function expectFits(page: Page) {
  // The lime pill only exists while it slides. Wait until it lands so a
  // viewport change cannot measure the previous translate past the screen.
  await expect(page.getByTestId('mobile-tab-indicator')).toHaveCount(0);
  const report = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - width;
    const outside: string[] = [];
    const roots = ['.mhead', '.mtab', '.stage'].flatMap((selector) => [...document.querySelectorAll(selector)]);
    for (const root of roots) {
      const nodes = [root, ...root.querySelectorAll('*')];
      for (const node of nodes) {
        if (!(node instanceof Element) || node.closest('.toast')) continue;
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

test.describe('phone navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps two menu levels and migrates returns links on desktop and mobile', async ({ page, request }, testInfo) => {
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, buildTestEmail(testInfo, 'two-levels'), 'Menú de prueba');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/#/returns?view=patterns');
      await expect(page).toHaveURL(/#\/analisis\/patrones$/);
      await expect(page.getByRole('heading', { name: 'Patrones', exact: true })).toBeVisible();
      await expect(page.getByTestId('patterns-empty')).toBeVisible();
      await expect(page.getByRole('group', { name: 'Agrupar' })).toBeVisible();
      if (width === 390) await page.getByTestId('sidebar-tab-more').click();
      const menu = page.getByRole('navigation', { name: 'Navegación principal' });
      for (const group of ['comercial', 'stock', 'atencion', 'finanzas', 'analisis', 'cuenta']) {
        const block = menu.getByTestId(`nav-group-${group}`);
        const trigger = block.locator('button[aria-expanded]').first();
        if (await trigger.getAttribute('aria-expanded') === 'false') await trigger.click();
        await expect(menu.locator('.sn-children:not([hidden])')).toHaveCount(1);
        await expect(block.locator('.sn-children .sn-detail, .sn-children [aria-expanded], .sn-children .sn-children')).toHaveCount(0);
      }
      await openDeskSection(page, 'returns');
      await expect(page.getByRole('heading', { name: 'Devoluciones', exact: true })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Estado' })).toBeVisible();
      await page.goto('/#/returns?view=claims');
      await expect(page).toHaveURL(/#\/comercial\/devoluciones$/);
      await page.goto('/#/analisis/reportes/resumen-periodico');
      await expect(page).toHaveURL(/#\/analisis\/resumen-periodico$/);
      await expect(page.getByRole('heading', { name: 'Resumen periódico', exact: true })).toBeVisible();
    }
  });

  test('labels every bar button and keeps other sections in Más', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'mobile-nav');
    const store = `Nav ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, store);

    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();
    await expect(page.getByTestId('mobile-header')).toBeVisible();
    await expect(page.getByTestId('mobile-store-name')).toHaveText(store);
    await expect(page.locator('.side')).toHaveCount(0);
    await expect(page.getByTestId('blue-widget')).toHaveAttribute('data-variant', 'chip');
    await expect(page.getByTestId('blue-widget')).toHaveAttribute('data-state', 'ready');

    const bar = page.getByTestId('mobile-tab-bar');
    await expect(bar.getByTestId('sidebar-tab-dashboard')).toHaveClass(/on/);
    await expect(bar.getByTestId('sidebar-tab-sales')).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-inventory')).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-clients')).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-more')).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-tradeins')).toHaveCount(0);
    await expect(bar.getByTestId('sidebar-tab-reports')).toHaveCount(0);
    await expect(page.getByTestId('sidebar-tab-dashboard').locator('.mtab-label')).toBeVisible();
    for (const label of await bar.locator('.mtab-label').all()) await expect(label).toBeVisible();

    const scrolling = await page.evaluate(() => ({
      stage: getComputedStyle(document.querySelector('.stage')!).overflowY,
      desk: getComputedStyle(document.querySelector('.desk-app')!).overflowY,
    }));
    expect(scrolling.stage).toBe('auto');
    expect(scrolling.desk).toBe('hidden');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nav-390-dashboard.png` });

    await page.getByTestId('sidebar-tab-more').click();
    await expect(page).toHaveURL(/#\/mas/);
    await expect(page.getByRole('heading', { level: 1, name: 'Más', exact: true })).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-tradeins')).toContainText('Canjes');
    await expect(page.getByTestId('more-item-clients')).toContainText('Clientes');
    await expect(page.getByTestId('more-item-dashboard')).toBeVisible();
    await expect(page.getByTestId('more-item-sales')).toBeAttached();
    await expect(page.getByTestId('more-item-inventory')).toBeAttached();
    await expect(page.getByTestId('sidebar-tab-service')).toContainText('Servicio técnico');
    await expect(page.getByTestId('sidebar-tab-notifications')).toContainText('Notificaciones');
    await expect(page.getByTestId('sidebar-tab-settings')).toContainText('Configuración');
    await expect(page.getByTestId('more-profile')).toContainText('Propietario');
    await expect(page.getByTestId('sidebar-tab-more')).toHaveClass(/on/);
    await expect(page.getByTestId('sidebar-tab-commissions')).toBeAttached();
    await expect(page.getByText(/Tentativo/)).toHaveCount(0);
    await expect(page.getByText(/Propuesta tentativa/)).toHaveCount(0);
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nav-390-mas.png` });

    // With a short viewport a destination must not inherit the menu scroll.
    await page.setViewportSize({ width: 390, height: 440 });
    await page.getByTestId('nav-group-analisis').locator('button[aria-expanded]').first().click();
    const stage = page.locator('.stage');
    await page.getByTestId('sidebar-tab-reports').scrollIntoViewIfNeeded();
    await page.getByTestId('sidebar-tab-reports').focus();
    const moreTop = await stage.evaluate(node => node.scrollTop);
    expect(moreTop).toBeGreaterThan(0);
    await page.getByTestId('sidebar-tab-reports').press('Enter');
    await expect(page.getByRole('heading', { name: 'Reportes', level: 1 })).toBeVisible();
    await expect.poll(() => stage.evaluate(node => node.scrollTop)).toBe(0);
    await page.getByTestId('page-back').click();
    await expect(page).toHaveURL(/#\/mas$/);
    await expect.poll(() => stage.evaluate(node => node.scrollTop)).toBeCloseTo(moreTop, 0);

    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await expectFits(page);
      for (const button of await bar.getByRole('button').all()) {
        await expect(button.locator('.mtab-label')).toBeVisible();
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nav-360-mas.png` });

    await openDeskSection(page, 'clients');
    await expect(page).toHaveURL(/#\/atencion\/clientes/);
    await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-clients')).toHaveClass(/on/);
    await expect(page.getByTestId('sidebar-tab-more')).not.toHaveClass(/on/);
    await expectFits(page);

    await openDeskSection(page, 'inventory');
    await expect(page).toHaveURL(/#\/stock\/equipos/);
    await expect(page.getByTestId('sidebar-tab-inventory')).toHaveClass(/on/);
    await expect(page.getByTestId('sidebar-tab-more')).not.toHaveClass(/on/);
    await page.getByTestId('blue-widget').click();
    await expect(page.getByTestId('blue-overlay')).toBeVisible();
    await page.getByTestId('blue-done').click();
  });

  test('puts the next allowed section in the bar for an employee without reportes', async ({ page, request, browser }, testInfo) => {
    const ownerEmail = buildTestEmail(testInfo, 'mobile-nav-owner');
    const staffEmail = buildTestEmail(testInfo, 'mobile-nav-staff');
    const store = `Nav staff ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, ownerEmail, store);
    const invitation = await createInvitationViaApi(request, ownerEmail, 'STAFF', staffEmail);

    const staffContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const staff = await staffContext.newPage();
    try {
      await mockDollar(staff);
      await acceptInvitationViaUi(staff, staffEmail, invitation.token, store);
      await expect(staff.getByTestId('mobile-tab-bar')).toBeVisible();
      const bar = staff.getByTestId('mobile-tab-bar');
      await expect(bar.getByTestId('sidebar-tab-dashboard')).toBeVisible();
      await expect(bar.getByTestId('sidebar-tab-inventory')).toBeVisible();
      await expect(bar.getByTestId('sidebar-tab-sales')).toBeVisible();
      await expect(bar.getByTestId('sidebar-tab-clients')).toBeVisible();
      await expect(bar.getByTestId('sidebar-tab-tradeins')).toHaveCount(0);
      await expect(bar.getByTestId('sidebar-tab-reports')).toHaveCount(0);
      await bar.getByTestId('sidebar-tab-more').click();
      await expect(staff.getByTestId('sidebar-tab-service')).toContainText('Servicio técnico');
      await staff.getByTestId('nav-group-atencion').locator('button[aria-expanded]').first().click();
      await expect(staff.getByTestId('more-item-clients')).toBeVisible();
      await expect(staff.getByTestId('sidebar-tab-notifications')).toBeHidden();
      await expect(staff.getByTestId('sidebar-tab-cash')).toHaveCount(0);
      await expect(staff.getByTestId('sidebar-tab-reports')).toHaveCount(0);
      await staff.getByTestId('nav-group-analisis').getByRole('button', { name: 'Análisis' }).click();
      await expect(staff.getByTestId('sidebar-tab-commissions')).toContainText('Mis comisiones');
      await expect(staff.getByTestId('sidebar-tab-patterns')).toBeVisible();
      await expect(staff.getByText(/Tentativo/)).toHaveCount(0);
      await staff.setViewportSize({ width: 360, height: 800 });
      await expectFits(staff);
      if (SHOTS) await staff.screenshot({ path: `${SHOTS}/nav-360-staff.png` });
    } finally {
      await staffContext.close();
    }
  });
});
