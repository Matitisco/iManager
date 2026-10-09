import { expect, test, type Page } from '@playwright/test';
import {
  bootstrapStoreViaApi,
  buildTestEmail,
  createInventoryItemViaApi,
  createInvitationViaApi,
  createSaleViaApi,
  createTradeInViaApi,
  loginViaUi,
  updateStoreViaApi,
} from './utils';

const SHOTS = process.env.MOBILE_REPORTS_SHOTS?.trim();

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
        if (node.closest('.wchips, .gfilters, .dkanban, .sale-pills') && !node.matches('.wchips, .gfilters, .dkanban, .sale-pills')) continue;
        const box = node.getBoundingClientRect();
        if (box.width < 1 && box.height < 1) continue;
        if (box.left < -1 || box.right > width + 1) {
          const label = node.getAttribute('data-testid') || node.getAttribute('aria-label') || (typeof node.className === 'string' ? node.className : node.tagName);
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

async function openReports(page: Page) {
  await page.getByTestId('sidebar-tab-reports').click();
  await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
}

function reportTabs(page: Page) {
  return page.getByRole('group', { name: 'Tipo de reporte' });
}

function reportPeriods(page: Page) {
  return page.getByRole('group', { name: 'Período' });
}

test.describe('desktop reports stays put', () => {
  test('keeps the two-column charts and the inline custom period', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'reports-desk');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Reportes desk ${testInfo.parallelIndex}`);
    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-bar')).toHaveCount(0);
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await openReports(page);
    await expect(page.getByRole('button', { name: 'Exportar' })).toBeVisible();
    await expect(reportTabs(page).getByRole('button', { name: 'Ventas' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.gnow')).toHaveCount(0);
    const columns = await page.locator('.repgrid').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length);
    expect(columns).toBe(2);
    const direction = await page.locator('.gcomp').evaluate((node) => getComputedStyle(node).flexDirection);
    expect(direction).toBe('row');
    await reportPeriods(page).getByRole('button', { name: 'Personalizado' }).click();
    await expect(page.locator('#report-custom-range')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Período personalizado' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Aplicar período' })).toBeVisible();
  });
});

test.describe('reports on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('stacks sales, stock and trade-ins without a side scroll', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    const email = buildTestEmail(testInfo, 'reports-phone');
    const cashClient = `Ana Efectivo ${testInfo.parallelIndex}`;
    const wireClient = `Luis Transferencia ${testInfo.parallelIndex}`;
    const model = `Pixel 8 Pro ${testInfo.parallelIndex}`;
    const received = `Galaxy S23 recibido ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Reportes ${testInfo.parallelIndex}`);
    await openReports(page);

    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exportar' })).toBeVisible();
    await expect(reportTabs(page).getByRole('button', { name: 'Ventas' })).toBeVisible();
    await expect(reportTabs(page).getByRole('button', { name: 'Stock' })).toBeVisible();
    await expect(reportTabs(page).getByRole('button', { name: 'Canjes' })).toBeVisible();
    await expect(reportPeriods(page).getByRole('button', { name: 'Personalizado' })).toBeVisible();
    const filters = page.locator('.gfilters');
    await expect(filters).toBeVisible();
    const filterDirection = await filters.evaluate((node) => getComputedStyle(node).flexDirection);
    expect(filterDirection).toBe('column');
    await expect(page.getByText('No hay ventas para este período y filtro.')).toBeVisible();
    await settleMotion(page, '.dscreen');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-390-empty.png` });

    const date = todayLabel();
    await createSaleViaApi(request, email, {
      date,
      clientName: cashClient,
      deviceLabel: 'Pixel 8',
      amount: 150000,
      paymentMethod: 'EFECTIVO',
    });
    await createSaleViaApi(request, email, {
      date,
      clientName: wireClient,
      deviceLabel: 'iPhone 13',
      amount: 300000,
      paymentMethod: 'TRANSFERENCIA',
    });
    await createInventoryItemViaApi(request, email, { imei: `35${String(Date.now()).slice(-13)}`, model, price: 900000 });
    await createTradeInViaApi(request, email, {
      date,
      clientName: cashClient,
      deviceReceived: received,
      deviceGiven: 'Pixel 8',
      takeValue: 200000,
    });
    await page.reload();
    await openReports(page);

    await expect(page.locator('.gamount')).toContainText('450.000');
    await expect(page.locator('.gdelta')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Evolución' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Por medio de pago' })).toBeVisible();
    await expect(page.locator('.gnow')).toBeVisible();
    const columns = await page.locator('.repgrid').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length);
    expect(columns).toBe(1);
    const donutDirection = await page.locator('.gcomp').evaluate((node) => getComputedStyle(node).flexDirection);
    expect(donutDirection).toBe('column');
    await expect(page.getByRole('button', { name: 'Efectivo: 33%' })).toContainText('150.000');
    await expect(page.getByRole('button', { name: 'Transferencia: 67%' })).toContainText('300.000');
    await expect(page.locator('.gtk')).toHaveCount(2);
    await expect(page.getByRole('button', { name: new RegExp(cashClient) })).toBeVisible();
    await settleMotion(page, '.dscreen');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-390-ventas.png` });

    await page.getByRole('heading', { name: 'Por medio de pago' }).scrollIntoViewIfNeeded();
    await page.locator('.gcomp').evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-390-desglose.png` });

    await page.getByRole('button', { name: 'Transferencia: 67%' }).click();
    await expect(page.locator('.gtk')).toHaveCount(1);
    await expect(page.getByRole('button', { name: new RegExp(wireClient) })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(cashClient) })).toHaveCount(0);
    await page.getByRole('button', { name: 'Transferencia: 67%' }).click();
    await expect(page.locator('.gtk')).toHaveCount(2);

    await reportPeriods(page).getByRole('button', { name: 'Personalizado' }).scrollIntoViewIfNeeded();
    await reportPeriods(page).getByRole('button', { name: 'Personalizado' }).click();
    const sheet = page.getByRole('dialog', { name: 'Período personalizado' });
    await expect(sheet.locator('.sheet-grab')).toBeVisible();
    await expect(sheet.locator('.sheet-foot').getByRole('button', { name: 'Aplicar período' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-390-personalizado.png` });
    await sheet.getByRole('button', { name: 'Abrir calendario: fecha de inicio' }).click();
    await settleMotion(page, '.dp-calendar');
    await expect(sheet.getByRole('dialog', { name: 'Elegir fecha de inicio' })).toBeVisible();
    await expectFits(page);
    await sheet.getByRole('button', { name: 'Hoy' }).click();
    await sheet.getByRole('button', { name: 'Abrir calendario: fecha de fin' }).click();
    await sheet.getByRole('button', { name: 'Hoy' }).click();
    await sheet.locator('.sheet-foot').getByRole('button', { name: 'Aplicar período' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('.gamount')).toContainText('450.000');
    await expect(reportPeriods(page).getByRole('button', { name: 'Personalizado' })).toHaveAttribute('aria-pressed', 'true');

    await reportPeriods(page).getByRole('button', { name: 'Personalizado' }).click();
    const again = page.getByRole('dialog', { name: 'Período personalizado' });
    await again.getByRole('textbox', { name: 'Fecha de inicio' }).fill('01/01/2020');
    await again.getByRole('textbox', { name: 'Fecha de fin' }).fill('01/01/2020');
    await again.locator('.sheet-foot').getByRole('button', { name: 'Aplicar período' }).click();
    await expect(again).toBeHidden();
    await expect(page.getByText('No hay ventas para este período y filtro.')).toBeVisible();
    await reportPeriods(page).getByRole('button', { name: 'Mes', exact: true }).click();
    await expect(page.locator('.gamount')).toContainText('450.000');

    await reportTabs(page).getByRole('button', { name: 'Stock' }).click();
    await expect(page.getByRole('heading', { name: 'Estado actual' })).toBeVisible();
    await expect(page.locator('.gamount')).toHaveText('1');
    await expect(page.getByRole('button', { name: 'Disponible: 1' })).toBeVisible();
    await expect(page.getByText(model)).toBeVisible();
    await page.locator('.gcomp').evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-390-stock.png` });

    await reportTabs(page).getByRole('button', { name: 'Canjes' }).click();
    await expect(page.getByRole('heading', { name: 'Por estado' })).toBeVisible();
    await expect(page.locator('.gamount')).toHaveText('1');
    await expect(page.getByText('1 en curso')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Peritaje téc.: 1' })).toBeVisible();
    await expect(page.getByText(received)).toBeVisible();
    await page.locator('.gcomp').evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-390-canjes.png` });

    await reportTabs(page).getByRole('button', { name: 'Ventas' }).click();
    await page.getByRole('button', { name: 'Exportar' }).click();
    await expect(page.getByRole('status')).toContainText('Reporte de ventas exportado');
    await expect(page.locator('.toast.show')).toBeHidden();
    await expectFits(page);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByRole('heading', { name: 'Por medio de pago' }).scrollIntoViewIfNeeded();
    await page.locator('.gcomp').evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await expect(page.getByRole('button', { name: 'Efectivo: 33%' })).toBeVisible();
    await expect(page.locator('.gamount')).toContainText('450.000');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-360-desglose.png` });
  });

  test('keeps the store currency and hides reports from staff', async ({ page, request, browser }, testInfo) => {
    const ownerEmail = buildTestEmail(testInfo, 'reports-owner');
    const staffEmail = buildTestEmail(testInfo, 'reports-staff');
    const store = `Reportes staff ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, ownerEmail, store);
    await updateStoreViaApi(request, ownerEmail, { currency: 'USD' });
    await createSaleViaApi(request, ownerEmail, {
      date: todayLabel(),
      clientName: 'Cliente Dolar',
      deviceLabel: 'iPhone 13',
      amount: 800,
      amountCurrency: 'USD',
    });
    await page.reload();
    await openReports(page);
    await expect(page.locator('.gamount')).toContainText('US$');
    await expect(page.locator('.gamount')).toContainText('800');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-390-usd.png` });

    const staffContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const staff = await staffContext.newPage();
    try {
      await mockDollar(staff);
      const invitation = await createInvitationViaApi(request, ownerEmail, 'STAFF', staffEmail);
      await staff.goto(`/invite/${invitation.token}`);
      await loginViaUi(staff, staffEmail);
      await staff.getByRole('button', { name: `Unirme a ${store}` }).click();
      await expect(staff.getByTestId('mobile-tab-bar')).toBeVisible();
      await expect(staff.getByTestId('sidebar-tab-reports')).toHaveCount(0);
      await expect(staff.getByRole('heading', { name: 'Reportes' })).toHaveCount(0);
      await expectFits(staff);
    } finally {
      await staffContext.close();
    }
  });
});
