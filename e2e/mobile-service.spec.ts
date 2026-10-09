import { expect, test, type Page } from '@playwright/test';
import {
  bootstrapStoreViaApi,
  buildTestEmail,
  createClientViaApi,
  createInvitationViaApi,
  createRepairViaApi,
  loginViaUi,
  updateStoreViaApi,
} from './utils';

const SHOTS = process.env.MOBILE_SERVICE_SHOTS?.trim();

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

async function openService(page: Page) {
  await page.getByTestId('sidebar-tab-more').click();
  await page.getByTestId('sidebar-tab-service').click();
  await expect(page.getByRole('heading', { name: 'Servicio técnico' })).toBeVisible();
}

test.describe('desktop service stays on the board', () => {
  test('keeps the kanban, the list toggle and a single new-order button', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'service-desk');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Servicio desk ${testInfo.parallelIndex}`);
    await page.getByTestId('sidebar-tab-service').click();
    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await expect(page.getByTestId('service-groups')).toHaveCount(0);
    await expect(page.getByTestId('service-chips')).toHaveCount(0);
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nueva orden' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Tablero' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('repair-column-RECIBIDO')).toBeVisible();
    await expect(page.getByText(/Propuesta tentativa/)).toHaveCount(0);
    await expect(page.locator('.dstar')).toHaveCount(0);

    await createRepairViaApi(request, email, {
      clientName: 'Cliente escritorio',
      device: 'iPhone escritorio',
      fault: 'Pantalla',
      estimate: 45000,
      status: 'RECIBIDO',
    });
    await page.reload();
    await page.getByTestId('sidebar-tab-service').click();
    await expect(page.getByTestId('repair-column-RECIBIDO')).toContainText('#OT-0001');
    await expect(page.getByTestId('repair-column-RECIBIDO')).toContainText('iPhone escritorio');
    await expect(page.locator('[data-testid^="repair-card-"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Lista' }).click();
    await expect(page.locator('[data-testid^="repair-row-"]')).toContainText('Cliente escritorio');
    await expect(page.getByTestId('service-groups')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nueva orden' })).toHaveCount(1);
  });
});

test.describe('service on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('lists orders by status and keeps create, detail, whatsapp and sensitive actions inside the screen', async ({ page, browser, request }, testInfo) => {
    test.setTimeout(180_000);
    const email = buildTestEmail(testInfo, 'service-phone');
    const storeName = `Taller cel ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await page.addInitScript(() => {
      window.open = () => null;
    });
    await bootstrapStoreViaApi(page, request, email, storeName);
    await updateStoreViaApi(request, email, { currency: 'USD' });
    const client = await createClientViaApi(request, email, { name: 'Cliente Celular', phone: '2614000000' });
    await createRepairViaApi(request, email, {
      clientId: client.client.id,
      clientName: 'Cliente Celular',
      device: 'iPhone 14',
      fault: 'Cámara trasera borrosa',
      estimate: 120,
      deposit: 40,
      currency: 'USD',
      status: 'EN_REPARACION',
      estimatedDelivery: '01/01/2020',
      notifyWhatsapp: true,
      technician: 'Técnico Ejemplo',
      imei: '350000000000095',
    });
    await createRepairViaApi(request, email, {
      clientName: 'Ejemplo A',
      device: 'iPhone 12',
      faultTags: ['Pantalla'],
      fault: 'Pantalla rota',
      estimate: 145,
      currency: 'USD',
      status: 'RECIBIDO',
      estimatedDelivery: '01/01/2099',
    });
    await page.reload();
    await openService(page);

    await expect(page.getByTestId('page-back')).toBeVisible();
    await page.getByTestId('page-back').click();
    await expect(page.getByRole('heading', { name: 'Más' })).toBeVisible();
    await page.getByTestId('sidebar-tab-service').click();
    await expect(page.getByRole('heading', { name: 'Servicio técnico' })).toBeVisible();
    await expect(page.getByTestId('service-chips').getByRole('button', { name: 'Abiertas 2' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('service-chips').getByRole('button', { name: 'Recibido 1' })).toBeVisible();
    await expect(page.getByTestId('service-chips').getByRole('button', { name: 'En reparación 1' })).toBeVisible();
    await expect(page.getByTestId('repair-group-RECIBIDO')).toContainText('#OT-0002');
    await expect(page.getByTestId('repair-group-RECIBIDO')).toContainText('Entrega 01/01');
    await expect(page.getByTestId('repair-group-RECIBIDO')).toContainText('US$ 145');
    await expect(page.getByTestId('repair-group-EN_REPARACION')).toContainText('Atrasada · 01/01');
    await expect(page.getByTestId('repair-column-RECIBIDO')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tablero' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Lista' })).toHaveCount(0);
    await expect(page.getByText(/Propuesta tentativa/)).toHaveCount(0);
    await expect(page.getByText(/Tentativo/)).toHaveCount(0);
    await expect(page.locator('.dstar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nueva orden' })).toHaveCount(1);
    const dockBox = await page.getByTestId('mobile-dock').boundingBox();
    const tabBox = await page.getByTestId('mobile-tab-bar').boundingBox();
    expect(dockBox && tabBox && dockBox.y + dockBox.height <= tabBox.y + 1).toBeTruthy();
    await settleMotion(page, '.enter-f');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/servicio-390-lista.png`, fullPage: true });

    await page.setViewportSize({ width: 360, height: 800 });
    await expectFits(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByTestId('service-chips').getByRole('button', { name: 'Recibido 1' }).click();
    await expect(page.locator('[data-testid^="repair-card-"]')).toHaveCount(1);
    await expect(page.getByText('iPhone 12')).toBeVisible();
    await expect(page.getByText('iPhone 14')).toHaveCount(0);
    await page.getByTestId('service-chips').getByRole('button', { name: 'Abiertas 2' }).click();

    await page.getByRole('button', { name: 'Buscar' }).click();
    const search = page.getByPlaceholder('Buscar orden o cliente');
    await search.fill('nadie');
    await expect(page.getByText('No encontré órdenes.')).toBeVisible();
    await search.fill('iPhone 12');
    await expect(page.getByText('Pantalla rota')).toBeVisible();
    await expect(page.getByText('Cámara trasera borrosa')).toHaveCount(0);
    await search.fill('');
    await page.getByRole('button', { name: 'Buscar' }).click();

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Nueva orden' }).click();
    const form = page.getByRole('dialog', { name: 'Nueva orden de reparación' });
    await expect(form.locator('.sheet-grab')).toBeVisible();
    await expect(form.getByText('Arranca en «Recibido».')).toBeVisible();
    await expect(form.locator('.fl-mark', { hasText: 'USD' })).toHaveCount(2);
    await expect(form.getByRole('button', { name: 'Recibido' })).toHaveClass(/on/);
    await expect(form.getByRole('checkbox', { name: /WhatsApp/ })).toBeChecked();
    await expect(form.getByText(/Tentativo/)).toHaveCount(0);
    await form.getByRole('button', { name: 'Editar opciones' }).click();
    const catalog = page.getByRole('dialog', { name: 'Estados de servicio' });
    await expect(catalog.getByRole('heading', { name: 'Estados de servicio' })).toBeVisible();
    await expect(catalog.locator('input').first()).toHaveValue('Recibido');
    await settleMotion(page, '.dialog');
    await expectFits(page);
    await catalog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(catalog).toBeHidden();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    await form.locator('.sheet-scroll').evaluate((node) => { node.scrollTop = 0; });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/servicio-390-alta.png` });
    await form.getByRole('button', { name: 'Cerrar' }).click();

    const readyCard = page.locator('[data-testid^="repair-card-"]').filter({ hasText: 'iPhone 14' });
    await readyCard.click();
    const detail = page.getByRole('dialog', { name: /#OT-0001/ });
    await expect(detail.locator('.sheet-grab')).toBeVisible();
    await expect(detail.getByText('iPhone 14 · Cliente Celular')).toBeVisible();
    await expect(detail.getByTestId('repair-step')).toContainText('Paso 4 de 6');
    await expect(detail.getByTestId('repair-step')).toContainText('Listo para retirar');
    await expect(detail.getByText('Cámara trasera borrosa')).toBeVisible();
    await expect(detail.getByText('01/01 · atrasada')).toBeVisible();
    await expect(detail.getByText('US$ 120')).toBeVisible();
    await expect(detail.getByText('US$ 40')).toBeVisible();
    await expect(detail.getByText('Historial')).toBeVisible();
    await expect(detail.locator('.svc-log li')).toHaveCount(1);
    await expect(detail.getByText(/Tentativo/)).toHaveCount(0);
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/servicio-390-detalle.png` });

    await detail.getByRole('button', { name: 'Pasar a Listo para retirar' }).click();
    await expect(detail.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveAttribute('href', /wa\.me/);
    await expect(detail.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveCount(1);
    await expect(detail.locator('.svc-log li')).toHaveCount(2);

    await detail.getByTestId('repair-edit-budget').click();
    await detail.getByLabel('Presupuesto').fill('200');
    await detail.getByLabel('Seña').fill('50');
    await expectFits(page);
    await detail.getByTestId('repair-save-budget').click();
    await expect(detail.getByText('US$ 200')).toBeVisible();
    await expect(detail.getByText('US$ 50')).toBeVisible();

    await detail.getByTestId('repair-delete').click();
    const confirm = page.getByRole('dialog', { name: 'Eliminar orden' });
    await expect(confirm).toContainText('no se puede deshacer');
    await page.setViewportSize({ width: 360, height: 800 });
    await expectFits(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await confirm.getByRole('button', { name: 'Cancelar' }).click();
    await detail.locator('.sheet-foot').getByRole('button', { name: 'Cerrar' }).click();
    await expect(detail).toBeHidden();

    const staffEmail = buildTestEmail(testInfo, 'service-staff');
    const invitation = await createInvitationViaApi(request, email, 'STAFF', staffEmail);
    const staffContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const staff = await staffContext.newPage();
    try {
      await mockDollar(staff);
      await staff.goto(`/invite/${invitation.token}`);
      await loginViaUi(staff, staffEmail);
      await staff.getByRole('button', { name: `Unirme a ${storeName}` }).click();
      await openService(staff);
      await staff.locator('[data-testid^="repair-card-"]').filter({ hasText: 'iPhone 14' }).click();
      const staffDetail = staff.getByRole('dialog', { name: /#OT-0001/ });
      await expect(staffDetail.getByText('US$ 200')).toBeVisible();
      await expect(staffDetail.getByTestId('repair-edit-budget')).toBeDisabled();
      await expect(staffDetail.getByTestId('repair-delete')).toBeDisabled();
      await expect(staffDetail.getByText(/Acciones sensibles/)).toBeVisible();
    } finally {
      await staffContext.close();
    }
  });
});
