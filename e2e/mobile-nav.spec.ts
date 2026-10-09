import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInvitationViaApi, loginViaUi } from './utils';

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

  test('keeps dashboard, inventory, sales and reports in the bar and the rest in Más', async ({ page, request }, testInfo) => {
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
    await expect(bar.getByTestId('sidebar-tab-inventory')).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-sales')).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-reports')).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-more')).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-tradeins')).toHaveCount(0);
    await expect(page.getByTestId('sidebar-tab-dashboard').locator('.mtab-label')).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-inventory').locator('.mtab-label')).toBeHidden();

    const scrolling = await page.evaluate(() => ({
      stage: getComputedStyle(document.querySelector('.stage')!).overflowY,
      desk: getComputedStyle(document.querySelector('.desk-app')!).overflowY,
    }));
    expect(scrolling.stage).toBe('visible');
    expect(scrolling.desk).toBe('visible');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nav-390-dashboard.png` });

    await page.getByTestId('sidebar-tab-more').click();
    await expect(page).toHaveURL(/#\/mas/);
    await expect(page.getByRole('heading', { name: 'Más' })).toBeVisible();
    await expect(page.getByText('Todo lo que no entra en la barra')).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-tradeins')).toContainText('en curso');
    await expect(page.getByTestId('sidebar-tab-clients')).toContainText('Agenda y saldos');
    await expect(page.getByTestId('sidebar-tab-service')).toContainText('abierta');
    await expect(page.getByTestId('sidebar-tab-notifications')).toContainText('sin leer');
    await expect(page.getByTestId('sidebar-tab-settings')).toContainText('Configuración');
    await expect(page.getByTestId('more-profile')).toContainText('Propietario');
    await expect(page.getByTestId('sidebar-tab-more')).toHaveClass(/on/);
    await expect(page.getByText('Comisiones')).toHaveCount(0);
    await expect(page.getByText(/Tentativo/)).toHaveCount(0);
    await expect(page.getByText(/Propuesta tentativa/)).toHaveCount(0);
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nav-390-mas.png` });

    await page.setViewportSize({ width: 360, height: 800 });
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nav-360-mas.png` });

    await page.getByTestId('sidebar-tab-clients').click();
    await expect(page).toHaveURL(/#\/clientes/);
    await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-more')).toHaveClass(/on/);
    await expectFits(page);

    await page.getByTestId('sidebar-tab-inventory').click();
    await expect(page).toHaveURL(/#\/inv/);
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
      await staff.goto(`/invite/${invitation.token}`);
      await loginViaUi(staff, staffEmail);
      await staff.getByRole('button', { name: `Unirme a ${store}` }).click();
      await expect(staff.getByTestId('mobile-tab-bar')).toBeVisible();
      const bar = staff.getByTestId('mobile-tab-bar');
      await expect(bar.getByTestId('sidebar-tab-dashboard')).toBeVisible();
      await expect(bar.getByTestId('sidebar-tab-inventory')).toBeVisible();
      await expect(bar.getByTestId('sidebar-tab-sales')).toBeVisible();
      await expect(bar.getByTestId('sidebar-tab-tradeins')).toBeVisible();
      await expect(bar.getByTestId('sidebar-tab-reports')).toHaveCount(0);
      await bar.getByTestId('sidebar-tab-more').click();
      await expect(staff.getByTestId('sidebar-tab-service')).toContainText('Servicio técnico');
      await expect(staff.getByTestId('sidebar-tab-clients')).toBeVisible();
      await expect(staff.getByText('Comisiones')).toHaveCount(0);
      await expect(staff.getByText(/Tentativo/)).toHaveCount(0);
      await staff.setViewportSize({ width: 360, height: 800 });
      await expectFits(staff);
      if (SHOTS) await staff.screenshot({ path: `${SHOTS}/nav-360-staff.png` });
    } finally {
      await staffContext.close();
    }
  });
});
