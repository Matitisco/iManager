import { expect, test, type Page } from '@playwright/test';
import {
  bootstrapStoreViaApi,
  buildTestEmail,
  createClientViaApi,
  createInvitationViaApi,
  fetchClients,
  loginViaUi,
  updateStoreViaApi,
} from './utils';

const SHOTS = process.env.MOBILE_CLIENTS_SHOTS?.trim();

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

async function openClients(page: Page) {
  await page.getByTestId('sidebar-tab-more').click();
  await page.getByTestId('sidebar-tab-clients').click();
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
}

test.describe('desktop clients stays put', () => {
  test('keeps the table, the inline actions and the old empty copy', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'clients-desk');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Clientes desk ${testInfo.parallelIndex}`);
    await page.getByTestId('sidebar-tab-clients').click();
    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await expect(page.getByTestId('clients-empty')).toHaveCount(0);
    await expect(page.getByTestId('phone-rows')).toHaveCount(0);
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByText('No encontré clientes.')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Cliente/ })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar por nombre, DNI o teléfono')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo cliente' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Importar' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Filtros' })).toHaveCount(0);

    await createClientViaApi(request, email, { name: 'Cliente escritorio', dni: '30111000', phone: '1100001111' });
    await page.reload();
    await page.getByTestId('sidebar-tab-clients').click();
    await expect(page.getByRole('cell', { name: /Cliente escritorio/ })).toBeVisible();
    await expect(page.getByTestId('phone-rows')).toHaveCount(0);
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nuevo cliente' })).toHaveCount(1);
  });
});

test.describe('clients on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('lists, creates, filters, edits and collects a client inside the screen', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    const email = buildTestEmail(testInfo, 'clients-phone');
    const createdName = `Ana ${String(Date.now()).slice(-6)}`;
    const debtorName = `Zoe Díaz ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Clientes ${testInfo.parallelIndex}`);
    await updateStoreViaApi(request, email, { currency: 'USD' });
    await page.reload();
    await openClients(page);

    await expect(page.getByTestId('page-back')).toBeVisible();
    await expect(page.getByText('0 clientes · 0 con saldo')).toBeVisible();
    await expect(page.getByTestId('clients-empty')).toContainText('No hay clientes');
    await expect(page.getByText('0 resultados')).toBeVisible();
    await expect(page.getByPlaceholder('Buscar por nombre, DNI o teléfono')).toBeVisible();
    await expect(page.locator('.wchips').getByRole('button', { name: 'Todos', exact: true })).toBeVisible();
    await expect(page.locator('.wchips').getByRole('button', { name: 'Con saldo pendiente', exact: true })).toBeVisible();
    await expect(page.getByTestId('clients-sort')).toContainText('Ordenar');
    await settleMotion(page, '.enter-f');
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo cliente' })).toBeVisible();
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' })).toBeVisible();
    await expect(page.getByTestId('clients-empty').getByRole('button', { name: 'Nuevo cliente' })).toBeVisible();
    const dockBox = await page.getByTestId('mobile-dock').boundingBox();
    const tabBox = await page.getByTestId('mobile-tab-bar').boundingBox();
    expect(dockBox && tabBox && dockBox.y + dockBox.height <= tabBox.y + 1).toBeTruthy();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/clients-390-empty.png` });

    await page.getByPlaceholder('Buscar por nombre, DNI o teléfono').fill('nadie');
    await expect(page.getByText('No hay clientes con ese filtro.')).toBeVisible();
    await page.getByPlaceholder('Buscar por nombre, DNI o teléfono').fill('');
    await expect(page.getByTestId('clients-empty')).toBeVisible();

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' }).click();
    const importer = page.getByRole('dialog', { name: 'Importar clientes' });
    await expect(importer.locator('.sheet-grab')).toBeVisible();
    await expect(importer.locator('.sheet-foot').getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/clients-390-import.png` });
    await importer.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByRole('button', { name: 'Filtros' }).click();
    const filters = page.getByRole('dialog', { name: 'Filtros' });
    await expect(filters.locator('.sheet-grab')).toBeVisible();
    await expect(filters.getByText('Saldo · USD')).toBeVisible();
    await expect(filters.locator('.sheet-foot').getByRole('button', { name: 'Aplicar filtros' })).toBeVisible();
    await expect(filters.locator('.sheet-foot').getByRole('button', { name: 'Limpiar filtros' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    await filters.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo cliente' }).click();
    const form = page.getByRole('dialog', { name: 'Nuevo cliente' });
    await expect(form.locator('.sheet-grab')).toBeVisible();
    await expect(form.getByText('Última compra, total y saldo se calculan desde Ventas.')).toBeVisible();
    await expect(form.getByLabel('Nombre y apellido')).toBeVisible();
    await expect(form.getByLabel('DNI')).toBeVisible();
    await expect(form.getByLabel('Teléfono')).toBeVisible();
    await expect(form.getByLabel('Email')).toBeVisible();
    await form.getByLabel('Nombre y apellido').fill(createdName);
    await form.getByLabel('DNI').fill('30111222');
    await form.getByLabel('Teléfono').fill('1100002222');
    await form.getByLabel('Email').fill('ana@ejemplo.com');
    await form.getByLabel('Teléfono').scrollIntoViewIfNeeded();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/clients-390-new.png` });
    await form.locator('.sheet-foot').getByRole('button', { name: 'Guardar cliente' }).click();
    await expect(form).toBeHidden();
    await expect(page.locator('.toast.show')).toBeHidden();

    const saved = await fetchClients(request, email);
    expect(saved.clients.some((client) => client.name === createdName && client.dni === '30111222')).toBeTruthy();

    await createClientViaApi(request, email, {
      name: debtorName,
      dni: '30999888',
      phone: '1100003333',
      email: 'zoe@ejemplo.com',
      pendingBalance: 50000,
      totalSpent: 650000,
      lastPurchaseDate: '03/10/2026',
      balanceCurrency: 'USD',
    });
    await page.reload();
    await openClients(page);

    const debtor = page.getByTestId('phone-rows').locator('[data-testid^="client-row-"]').filter({ hasText: debtorName });
    const created = page.getByTestId('phone-rows').locator('[data-testid^="client-row-"]').filter({ hasText: createdName });
    await expect(debtor).toBeVisible();
    await expect(created).toBeVisible();
    await expect(debtor.locator('.av-c')).toHaveText('ZD');
    await expect(debtor).toContainText('DNI 30999888');
    await expect(debtor).toContainText('1100003333');
    await expect(debtor).toContainText('Saldo US$ 50.000');
    await expect(debtor).toContainText('03/10/2026');
    await expect(debtor).toContainText('US$ 650.000');
    await expect(created).toContainText('Sin saldo');
    await expect(page.getByText('2 clientes · 1 con saldo')).toBeVisible();
    const order = await page.getByTestId('phone-rows').locator('[data-testid^="client-row-"]').allTextContents();
    expect(order[0]).toContain(debtorName);
    expect(order[1]).toContain(createdName);
    await expect(page.getByTestId('row-menu')).toHaveCount(2);
    await expect(page.locator('.toast.show')).toBeHidden();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/clients-390-list.png`, fullPage: true });

    await page.locator('.wchips').getByRole('button', { name: 'Con saldo pendiente', exact: true }).click();
    await expect(debtor).toBeVisible();
    await expect(created).toHaveCount(0);
    await page.locator('.wchips').getByRole('button', { name: 'Todos', exact: true }).click();
    await expect(created).toBeVisible();

    await page.getByPlaceholder('Buscar por nombre, DNI o teléfono').fill('30999888');
    await expect(debtor).toBeVisible();
    await expect(created).toHaveCount(0);
    await page.getByPlaceholder('Buscar por nombre, DNI o teléfono').fill('');

    await page.getByTestId('clients-sort').getByRole('button', { name: 'Ordenar' }).click();
    await page.getByRole('button', { name: 'Nombre', exact: true }).click();
    const byName = await page.getByTestId('phone-rows').locator('[data-testid^="client-row-"]').allTextContents();
    expect(byName[0]).toContain(createdName);
    await page.getByTestId('clients-sort').getByRole('button', { name: 'Nombre' }).click();
    await page.getByRole('button', { name: 'Deudores', exact: true }).click();

    await debtor.click();
    const detail = page.getByRole('dialog', { name: debtorName });
    await expect(detail.getByText('Saldo pendiente')).toBeVisible();
    await expect(detail.getByText('US$ 50.000').first()).toBeVisible();
    await expect(detail.getByText('Total gastado')).toBeVisible();
    await expect(detail.getByText('US$ 650.000')).toBeVisible();
    await expect(detail.locator('.fl-mark', { hasText: 'USD' })).toBeVisible();
    await expect(detail.locator('.sheet-foot').getByRole('button', { name: 'Registrar pago' })).toBeVisible();
    await expect(detail.locator('.sheet-foot').getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
    await expect(detail.locator('.sheet-foot').getByRole('button', { name: 'Nueva venta' })).toBeVisible();
    await detail.getByRole('button', { name: 'Efectivo' }).click();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/clients-390-detail.png` });
    await detail.locator('.sheet-foot').getByRole('button', { name: 'Registrar pago' }).click();
    await expect(detail.getByText('Efectivo')).toBeVisible();
    await expect(page.locator('.toast.show')).toBeHidden();

    await detail.locator('.sheet-foot').getByRole('button', { name: 'Editar', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Editar cliente' });
    await expect(editor.getByLabel('Nombre y apellido')).toHaveValue(debtorName);
    await expect(editor.locator('.fl-mark', { hasText: 'USD' })).toBeVisible();
    await expect(editor.locator('.sheet-foot').getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
    await editor.getByLabel('Teléfono').fill('1100004444');
    await editor.getByLabel('Saldo pendiente').scrollIntoViewIfNeeded();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/clients-390-edit.png` });
    await editor.locator('.sheet-foot').getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(editor).toBeHidden();
    await expect(page.locator('.toast.show')).toBeHidden();
    const edited = await fetchClients(request, email);
    const debtorRecord = edited.clients.find((client) => client.name === debtorName);
    expect(debtorRecord?.phone).toBe('1100004444');
    expect(debtorRecord?.pendingBalance).toBe(0);

    const debtorRow = page.getByTestId('phone-rows').locator('[data-testid^="client-row-"]').filter({ hasText: debtorName });
    await debtorRow.locator('xpath=..').getByTestId('row-menu').click();
    await expect(page.locator('.ctx').getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
    await expect(page.locator('.ctx').getByRole('button', { name: 'Eliminar' })).toBeVisible();
    await settleMotion(page, '.ctx');
    await expectFits(page);
    await page.locator('.ctxov').click({ position: { x: 12, y: 12 } });

    await debtorRow.click();
    const again = page.getByRole('dialog', { name: debtorName });
    await again.locator('.sheet-foot').getByRole('button', { name: 'Nueva venta' }).click();
    const sale = page.getByRole('dialog', { name: 'Registrar venta' });
    await expect(sale.getByLabel('Cliente')).toHaveValue(debtorName);
    await settleMotion(page, '.sheet');
    await expectFits(page);
    await sale.locator('.sheet-foot').getByRole('button', { name: 'Cerrar' }).click();

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByTestId('mobile-dock')).toBeVisible();
    await expect(page.getByText(debtorName)).toBeVisible();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/clients-360-list.png`, fullPage: true });
    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo cliente' }).click();
    await expect(page.getByRole('dialog', { name: 'Nuevo cliente' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/clients-360-new.png` });
  });

  test('hides delete when the member cannot manage sensitive actions', async ({ page, request, browser }, testInfo) => {
    test.setTimeout(120_000);
    const ownerEmail = buildTestEmail(testInfo, 'clients-owner');
    const staffEmail = buildTestEmail(testInfo, 'clients-staff');
    const store = `Clientes staff ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, ownerEmail, store);
    await createClientViaApi(request, ownerEmail, { name: 'Cliente staff', dni: '30444555', phone: '1100005555' });

    const staffContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const staff = await staffContext.newPage();
    try {
      await mockDollar(staff);
      const invitation = await createInvitationViaApi(request, ownerEmail, 'STAFF', staffEmail);
      await staff.goto(`/invite/${invitation.token}`);
      await loginViaUi(staff, staffEmail);
      await staff.getByRole('button', { name: `Unirme a ${store}` }).click();
      await expect(staff.getByTestId('mobile-tab-bar')).toBeVisible();
      await openClients(staff);
      await expect(staff.getByTestId('page-back')).toBeVisible();
      const row = staff.getByTestId('phone-rows').locator('[data-testid^="client-row-"]').filter({ hasText: 'Cliente staff' });
      await expect(row).toBeVisible();
      await row.locator('xpath=..').getByTestId('row-menu').click();
      await expect(staff.locator('.ctx').getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
      await expect(staff.locator('.ctx').getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
      await settleMotion(staff, '.ctx');
      await expectFits(staff);
      if (SHOTS) await staff.screenshot({ path: `${SHOTS}/clients-390-staff.png` });
      await staff.setViewportSize({ width: 360, height: 800 });
      await expectFits(staff);
    } finally {
      await staffContext.close();
    }
  });
});
