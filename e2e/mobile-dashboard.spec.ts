import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInvitationViaApi, createSaleViaApi, createTradeInViaApi, loginViaUi, updateStoreViaApi } from './utils';

const SHOTS = process.env.MOBILE_DASHBOARD_SHOTS?.trim();

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

async function settleMotion(page: Page, selector: string) {
  const target = page.locator(selector).first();
  if (await target.count() === 0) return;
  await target.evaluate(async (node) => {
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

test.describe('desktop dashboard stays put', () => {
  test('keeps the table, the header action and the old empty copy', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'dash-desk');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Dash desk ${testInfo.parallelIndex}`);
    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await expect(page.getByTestId('mobile-tab-bar')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-bell')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-register-sale')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Qué hay para/ })).toBeVisible();
    await expect(page.locator('.hl')).toHaveText('hoy');
    await expect(page.getByRole('button', { name: 'Registrar venta' })).toHaveCount(1);
    await expect(page.getByTestId('dashboard-sales')).toContainText('No encontré ventas.');
    await expect(page.getByTestId('dashboard-trades')).toContainText('No hay canjes en curso.');
    await createSaleViaApi(request, email, {
      date: todayLabel(),
      clientName: 'Ana Escritorio',
      deviceLabel: 'Pixel 8',
      amount: 650000,
    });
    await page.reload();
    await expect(page.getByRole('columnheader', { name: 'Venta' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Cliente' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Equipo' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Total' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Ana Escritorio/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: /\$ 650\.000/ })).toBeVisible();
    await expect(page.getByTestId('phone-rows')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-register-sale')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Registrar venta' })).toHaveCount(1);
  });
});

test.describe('dashboard on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('uses cards for recent sales and open trades without a side scroll', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'dash-phone');
    const clientName = `Cliente dash ${testInfo.parallelIndex}`;
    const received = 'iPhone 14 Pro Max 256GB violeta profundo';
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Dash ${testInfo.parallelIndex}`);

    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();
    await expect(page.getByText(/Hola,/)).toBeVisible();
    await expect(page.locator('.hl')).toHaveText('hoy');
    await expect(page.getByTestId('dashboard-bell')).toBeVisible();
    await expect(page.getByLabel('Invitar')).toBeVisible();
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-register-sale').getByRole('button', { name: 'Registrar venta' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar venta' })).toHaveCount(1);
    await expect(page.getByTestId('dashboard-sales')).toContainText('No encontré ventas.');
    await expect(page.getByTestId('dashboard-trades')).toContainText('No hay canjes en curso.');
    await expect(page.getByRole('columnheader', { name: 'Venta' })).toHaveCount(0);
    const columns = await page.locator('.dkpis').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length);
    expect(columns).toBe(2);
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/dashboard-390-empty.png` });

    await page.getByTestId('dashboard-register-sale').getByRole('button', { name: 'Registrar venta' }).click();
    const form = page.getByRole('dialog', { name: 'Registrar venta' });
    await expect(form.locator('.sheet-grab')).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/dashboard-390-sale.png` });
    await form.locator('.sheet-foot').getByRole('button', { name: 'Cerrar' }).click();
    await expect(form).toBeHidden();

    const date = todayLabel();
    await createSaleViaApi(request, email, {
      date,
      clientName,
      deviceLabel: 'Pixel 8 128GB',
      amount: 650000,
    });
    await createTradeInViaApi(request, email, {
      date,
      clientName,
      deviceReceived: received,
      deviceGiven: 'Pixel 8',
      takeValue: 420000,
    });
    await page.reload();
    await expect(page.getByTestId('dashboard-sales')).toContainText(clientName);
    const sales = page.getByTestId('dashboard-sales');
    await expect(sales).toContainText('#V-');
    await expect(sales).toContainText('Pixel 8 128GB');
    await expect(sales).toContainText('$ 650.000');
    await expect(sales).toContainText('Completada');
    await expect(sales).not.toContainText('Margen');
    await expect(sales).not.toContainText(/costo/i);
    const trades = page.getByTestId('dashboard-trades');
    await expect(trades).toContainText(received);
    await expect(trades).toContainText(clientName);
    await expect(trades).toContainText('$ 420.000');
    await expect(trades).toContainText('Peritaje téc.');
    await expect(page.getByRole('button', { name: /Ventas del mes/ })).toContainText('$');
    await expect(page.getByTestId('row-menu').first()).toBeVisible();
    await expect(page.locator('.toast.show')).toBeHidden();
    await expectFits(page);
    if (SHOTS) {
      await page.getByTestId('dashboard-sales').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/dashboard-390-cards.png` });
    }

    await page.getByRole('button', { name: 'Ver todas' }).click();
    await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible();
    await page.getByTestId('sidebar-tab-dashboard').click();
    await expect(page.getByRole('heading', { name: /Qué hay para/ })).toBeVisible();
    await page.getByRole('button', { name: 'Ver todos' }).click();
    await expect(page.getByRole('heading', { name: 'Canjes' })).toBeVisible();
    await page.getByTestId('sidebar-tab-dashboard').click();
    await page.getByTestId('dashboard-bell').click();
    await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible();
    await page.getByTestId('sidebar-tab-dashboard').click();

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.locator('.toast.show')).toBeHidden();
    await expect(sales).toContainText(clientName);
    await expect(trades).toContainText(received);
    await expectFits(page);
    if (SHOTS) {
      await page.getByTestId('dashboard-trades').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/dashboard-360-cards.png` });
    }
  });

  test('hides billing for an employee and keeps the store currency', async ({ page, request, browser }, testInfo) => {
    const ownerEmail = buildTestEmail(testInfo, 'dash-owner');
    const staffEmail = buildTestEmail(testInfo, 'dash-staff');
    const store = `Dash staff ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, ownerEmail, store);
    await createSaleViaApi(request, ownerEmail, {
      date: todayLabel(),
      clientName: 'Ana Staff',
      deviceLabel: 'Pixel',
      amount: 250000,
    });

    const staffContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const staff = await staffContext.newPage();
    try {
      await mockDollar(staff);
      const invitation = await createInvitationViaApi(request, ownerEmail, 'STAFF', staffEmail);
      await staff.goto(`/invite/${invitation.token}`);
      await loginViaUi(staff, staffEmail);
      await staff.getByRole('button', { name: `Unirme a ${store}` }).click();
      await expect(staff.getByTestId('mobile-tab-bar')).toBeVisible();
      const month = staff.getByRole('button', { name: /Ventas del mes/ });
      await expect(month).toContainText('operaciones');
      await expect(month).not.toContainText('$');
      await expect(month).not.toContainText('Margen');
      await expect(staff.getByTestId('dashboard-sales')).toContainText('Ana Staff');
      await expect(staff.getByTestId('dashboard-sales')).toContainText('$ 250.000');
      await expect(staff.getByTestId('dashboard-sales')).not.toContainText('Margen');
      await expect(staff.getByTestId('dashboard-sales')).not.toContainText(/costo/i);
      await expect(staff.getByRole('button', { name: 'Registrar venta' })).toHaveCount(1);
      await expectFits(staff);
      if (SHOTS) {
        await staff.getByTestId('dashboard-sales').scrollIntoViewIfNeeded();
        await staff.screenshot({ path: `${SHOTS}/dashboard-390-staff.png` });
      }
    } finally {
      await staffContext.close();
    }

    await updateStoreViaApi(request, ownerEmail, { currency: 'USD' });
    await createSaleViaApi(request, ownerEmail, {
      date: todayLabel(),
      clientName: 'Cliente Dolar',
      deviceLabel: 'iPhone 13',
      amount: 800,
      amountCurrency: 'USD',
    });
    await page.reload();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('dashboard-sales')).toContainText('US$ 800');
    await expect(page.getByRole('button', { name: /Ventas del mes/ })).toContainText('US$');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/dashboard-390-usd.png`, fullPage: true });
  });
});
