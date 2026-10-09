import { expect, test, type Page } from '@playwright/test';
import {
  bootstrapStoreViaApi,
  buildTestEmail,
  createInventoryItemViaApi,
  createInvitationViaApi,
  createTradeInViaApi,
  fetchTradeIns,
  loginViaUi,
  updateStoreViaApi,
} from './utils';

const SHOTS = process.env.MOBILE_TRADEINS_SHOTS?.trim();

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

async function openTradeIns(page: Page) {
  await page.getByTestId('sidebar-tab-more').click();
  await page.getByTestId('sidebar-tab-tradeins').click();
  await expect(page.getByRole('heading', { name: 'Canjes' })).toBeVisible();
}

test.describe('desktop trade-ins stays put', () => {
  test('keeps the table, the inline actions and the old empty copy', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'tradeins-desk');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Canjes desk ${testInfo.parallelIndex}`);
    await page.getByTestId('sidebar-tab-tradeins').click();
    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await expect(page.getByTestId('tradeins-timeline')).toHaveCount(0);
    await expect(page.getByTestId('tradeins-empty')).toHaveCount(0);
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByText('No encontré canjes.')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Canje' })).toHaveCount(0);
    await expect(page.getByPlaceholder('Buscar cliente, equipo, IMEI o número')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo canje' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Importar' })).toHaveCount(1);

    await createTradeInViaApi(request, email, {
      date: '09/10/2026',
      clientName: 'Cliente escritorio',
      deviceReceived: 'Recibido escritorio',
      deviceGiven: 'Entregado escritorio',
      takeValue: 1000,
    });
    await page.reload();
    await page.getByTestId('sidebar-tab-tradeins').click();
    await expect(page.getByRole('columnheader', { name: 'Canje' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Recibido escritorio/ })).toBeVisible();
    await expect(page.getByTestId('tradeins-timeline')).toHaveCount(0);
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await expect(page.getByTestId('page-back')).toHaveCount(0);
  });
});

test.describe('trade-ins on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('lists, creates, resumes, edits and cancels a trade-in inside the screen', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    const email = buildTestEmail(testInfo, 'tradeins-phone');
    const clientName = `Ana ${String(Date.now()).slice(-6)}`;
    const received = `iPhone 11 ${testInfo.parallelIndex}`;
    const model = `iPhone 13 ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => undefined },
      });
    });
    await bootstrapStoreViaApi(page, request, email, `Canjes ${testInfo.parallelIndex}`);
    await updateStoreViaApi(request, email, { currency: 'USD' });
    await page.reload();
    await openTradeIns(page);

    await expect(page.getByTestId('page-back')).toBeVisible();
    await expect(page.getByText('0 canjes · 0 en curso')).toBeVisible();
    await expect(page.getByTestId('tradeins-empty')).toContainText('No hay canjes');
    await expect(page.getByText('0 resultados')).toBeVisible();
    await expect(page.locator('.wchips').getByRole('button', { name: 'Todos', exact: true })).toBeVisible();
    await expect(page.locator('.wchips').getByRole('button', { name: 'Pendiente', exact: true })).toBeVisible();
    await expect(page.locator('.wchips').getByRole('button', { name: 'Peritaje téc.', exact: true })).toBeVisible();
    await settleMotion(page, '.enter-f');
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo canje' })).toBeVisible();
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' })).toBeVisible();
    await expect(page.getByTestId('tradeins-empty').getByRole('button', { name: 'Nuevo canje' })).toBeVisible();
    const dockBox = await page.getByTestId('mobile-dock').boundingBox();
    const tabBox = await page.getByTestId('mobile-tab-bar').boundingBox();
    expect(dockBox && tabBox && dockBox.y + dockBox.height <= tabBox.y + 1).toBeTruthy();
    await expect(page.getByPlaceholder('Buscar cliente, equipo, IMEI o número')).toHaveCount(0);
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tradeins-390-empty.png` });

    await page.getByTestId('page-back').click();
    await expect(page.getByRole('heading', { name: 'Más' })).toBeVisible();
    await page.getByTestId('sidebar-tab-tradeins').click();

    await page.getByRole('button', { name: 'Buscar' }).click();
    const search = page.getByPlaceholder('Buscar cliente, equipo, IMEI o número');
    await expect(search).toBeVisible();
    await search.fill('nadie');
    await expect(page.getByText('No encontré canjes.')).toBeVisible();
    await search.fill('');
    await expect(page.getByTestId('tradeins-empty')).toBeVisible();
    await page.getByRole('button', { name: 'Buscar' }).click();

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' }).click();
    const importer = page.getByRole('dialog', { name: 'Importar canjes' });
    await expect(importer.locator('.sheet-grab')).toBeVisible();
    await expect(importer.locator('.sheet-foot').getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    await importer.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo canje' }).click();
    const form = page.getByRole('dialog', { name: 'Nuevo canje' });
    await expect(form.locator('.sheet-grab')).toBeVisible();
    await expect(form.locator('.fl-mark', { hasText: 'USD' })).toHaveCount(2);
    await expect(form.getByTestId('trade-no-stock')).toBeVisible();
    await expect(form.getByRole('button', { name: 'Peritaje téc.' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Cobrado' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Efectivo' })).toBeVisible();
    await form.getByLabel('Cliente').fill(clientName);
    await expect(form.getByText(/Se crea un cliente nuevo al guardar/)).toBeVisible();
    await form.getByLabel('Equipo recibido').scrollIntoViewIfNeeded();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tradeins-390-new.png` });
    await form.getByRole('button', { name: 'Ir a inventario' }).click();
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
    await openTradeIns(page);

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo canje' }).click();
    const draft = page.getByRole('dialog', { name: 'Nuevo canje' });
    await draft.getByLabel('Equipo recibido').fill(received);
    await draft.getByLabel('Valor tomado').fill('300000');
    await draft.locator('.sheet-foot').getByRole('button', { name: 'Guardar pendiente' }).click();
    await expect(draft).toBeHidden();
    await expect(page.getByText('Canjes pendientes de confirmar')).toBeVisible();
    await expect(page.locator('.toast.show')).toBeHidden();

    await createInventoryItemViaApi(request, email, {
      imei: String(Date.now()).padStart(15, '7').slice(-15),
      model,
      price: 650000,
      capacity: '128GB',
    });
    await page.reload();
    await openTradeIns(page);
    await page.getByRole('button', { name: 'Retomar' }).click();
    const resume = page.getByRole('dialog', { name: 'Retomar canje' });
    await expect(resume.getByTestId('trade-no-stock')).toHaveCount(0);
    await expect(resume.locator('.fl-mark', { hasText: 'USD' })).toHaveCount(2);
    await resume.getByLabel('Cliente').fill(clientName);
    await expect(resume.getByText(/Se crea un cliente nuevo al guardar/)).toBeVisible();
    await resume.getByRole('combobox', { name: 'Equipo' }).fill(model);
    await expect(resume.getByRole('option', { name: new RegExp(model) })).toBeVisible();
    await resume.getByRole('option', { name: new RegExp(model) }).click();
    await resume.getByLabel('Precio completo de salida').fill('650000');
    await resume.getByLabel('Equipo recibido').scrollIntoViewIfNeeded();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tradeins-390-resume.png` });
    await resume.locator('.sheet-foot').getByRole('button', { name: 'Confirmar canje' }).click();
    await expect(resume).toBeHidden();

    const created = await fetchTradeIns(request, email);
    expect(created.tradeIns.some((item) => item.deviceReceived === received && item.confirmationStatus === 'CONFIRMED')).toBeTruthy();

    const card = page.getByText(clientName).locator('xpath=ancestor::button[1]');
    await expect(card.getByText(/#C-/)).toBeVisible();
    await expect(card.getByText(`Recibido: ${received}`)).toBeVisible();
    await expect(card.getByText(new RegExp(`Entrega: ${model}`))).toBeVisible();
    await expect(card.getByText('US$ 300.000')).toBeVisible();
    await expect(card.getByText('dif. US$ 350.000')).toBeVisible();
    await expect(card.getByText('Pendiente')).toBeVisible();
    await expect(page.getByTestId('row-menu')).toBeVisible();
    await expect(page.locator('.toast.show')).toBeHidden();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tradeins-390-list.png`, fullPage: true });

    await page.locator('.wchips').getByRole('button', { name: 'Rechazado', exact: true }).click();
    await expect(page.getByText('No encontré canjes.')).toBeVisible();
    await page.locator('.wchips').getByRole('button', { name: 'Todos', exact: true }).click();
    await expect(page.getByText(clientName)).toBeVisible();

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo canje' }).click();
    const another = page.getByRole('dialog', { name: 'Nuevo canje' });
    await another.getByLabel('Cliente').fill(clientName);
    await expect(another.getByRole('option', { name: new RegExp(clientName) })).toBeVisible();
    await another.getByRole('option', { name: new RegExp(clientName) }).click();
    await expect(another.getByText(/Se crea un cliente nuevo al guardar/)).toHaveCount(0);
    await another.locator('.sheet-foot').getByRole('button', { name: 'Cerrar' }).click();

    await card.click();
    const detail = page.getByRole('dialog', { name: new RegExp(clientName) });
    await expect(detail.getByText('US$ 300.000')).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Peritaje téc.' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'En revisión' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Aprobado' })).toBeVisible();
    await expect(detail.locator('.sheet-foot').getByRole('button', { name: 'Guardar estado' })).toBeVisible();
    await expect(detail.locator('.sheet-foot').getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
    await expect(detail.locator('.sheet-foot').getByRole('button', { name: 'Cancelar operación' })).toBeVisible();
    await detail.getByRole('button', { name: 'Peritaje téc.' }).click();
    await detail.locator('.sheet-foot').getByRole('button', { name: 'Guardar estado' }).click();
    await expect.poll(async () => (await fetchTradeIns(request, email)).tradeIns.find((item) => item.deviceReceived === received)?.status).toBe('PERITAJE TÉC.');
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tradeins-390-detail.png` });

    await detail.locator('.sheet-foot').getByRole('button', { name: 'Editar', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Editar operación' });
    await expect(editor.getByLabel('Cliente')).toHaveValue(clientName);
    await expect(editor.locator('.fl-mark', { hasText: 'USD' })).toHaveCount(2);
    await expect(editor.locator('.sheet-foot').getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tradeins-390-edit.png` });
    await editor.locator('.sheet-foot').getByRole('button', { name: 'Cerrar' }).click();

    await page.getByTestId('row-menu').click();
    await expect(page.locator('.ctx').getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
    await expect(page.locator('.ctx').getByRole('button', { name: 'Eliminar' })).toBeVisible();
    await settleMotion(page, '.ctx');
    await expectFits(page);
    await page.locator('.ctxov').click({ position: { x: 12, y: 12 } });

    await card.click();
    const again = page.getByRole('dialog', { name: new RegExp(clientName) });
    await again.locator('.sheet-foot').getByRole('button', { name: 'Cancelar operación' }).click();
    const confirm = page.getByRole('dialog', { name: 'Cancelar operación' });
    await expect(confirm).toBeVisible();
    await settleMotion(page, '.dialog');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tradeins-390-cancel.png` });
    await confirm.getByRole('button', { name: 'Volver', exact: true }).click();
    await expect(again.locator('.sheet-foot').getByRole('button', { name: 'Cancelar operación' })).toBeVisible();
    await again.locator('.sheet-foot').getByRole('button', { name: 'Cancelar operación' }).click();
    await confirm.getByRole('button', { name: 'Cancelar operación' }).click();
    await expect(page.locator('.toast.show')).toBeHidden();
    await expect(card.getByText('Operación cancelada')).toBeVisible();
    await expectFits(page);

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByTestId('mobile-dock')).toBeVisible();
    await expect(page.getByText(clientName)).toBeVisible();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tradeins-360-list.png`, fullPage: true });

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo canje' }).click();
    await expect(page.getByRole('dialog', { name: 'Nuevo canje' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tradeins-360-new.png` });
  });

  test('hides cancellation when the member cannot manage sensitive actions', async ({ page, request, browser }, testInfo) => {
    test.setTimeout(120_000);
    const ownerEmail = buildTestEmail(testInfo, 'tradeins-owner');
    const staffEmail = buildTestEmail(testInfo, 'tradeins-staff');
    const store = `Canjes staff ${testInfo.parallelIndex}`;
    const received = `Recibido staff ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, ownerEmail, store);
    await createTradeInViaApi(request, ownerEmail, {
      date: '09/10/2026',
      clientName: 'Cliente staff',
      deviceReceived: received,
      deviceGiven: 'Equipo entregado',
      takeValue: 1000,
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
      await staff.getByTestId('sidebar-tab-tradeins').click();
      await expect(staff.getByTestId('page-back')).toHaveCount(0);
      const card = staff.getByTestId('tradeins-timeline').getByText(received).locator('xpath=ancestor::button[1]');
      await expect(card).toBeVisible();
      await card.click();
      const detail = staff.getByRole('dialog', { name: /Cliente staff/ });
      await expect(detail.getByRole('button', { name: 'Guardar estado' })).toBeVisible();
      await expect(detail.getByRole('button', { name: 'Retomar' })).toBeVisible();
      await expect(detail.getByRole('button', { name: 'Cancelar operación' })).toHaveCount(0);
      await settleMotion(staff, '.sheet');
      await expectFits(staff);
      if (SHOTS) await staff.screenshot({ path: `${SHOTS}/tradeins-390-staff.png` });
      await staff.setViewportSize({ width: 360, height: 800 });
      await expectFits(staff);
    } finally {
      await staffContext.close();
    }
  });
});
