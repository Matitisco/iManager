import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInvitationViaApi, loginViaUi } from './utils';

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

async function expectInside(page: Page, selector: string) {
  const report = await page.locator(selector).evaluate((root) => {
    const viewportWidth = window.innerWidth;
    const board = root.classList.contains('svc-screen');
    const nodes = [root, ...root.querySelectorAll('*')];
    const outside: string[] = [];
    for (const node of nodes) {
      if (!(node instanceof Element)) continue;
      if (board && node.closest('.dkanban') && !node.classList.contains('dkanban')) continue;
      const box = node.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (box.left < -1 || box.right > viewportWidth + 1) {
        const label = node.getAttribute('data-testid') || (typeof node.className === 'string' ? node.className : node.tagName);
        outside.push(`${label} [${Math.round(box.left)}…${Math.round(box.right)}] de ${viewportWidth}`);
      }
    }
    return {
      outside: outside.slice(0, 6),
      scrolls: root.scrollWidth > root.clientWidth + 1,
      viewportWidth,
    };
  });
  expect(report.outside).toEqual([]);
  expect(report.scrolls).toBe(false);
}

async function openService(page: Page) {
  await page.getByTestId('sidebar-tab-service').click();
  await expect(page.getByRole('heading', { name: 'Servicio técnico' })).toBeVisible();
  await expect(page.getByText(/Propuesta tentativa/)).toHaveCount(0);
  await expect(page.getByText(/propuesta exploratoria/)).toHaveCount(0);
  await expect(page.locator('.dstar')).toHaveCount(0);
}

async function createOrder(page: Page) {
  await page.getByRole('button', { name: 'Nueva orden' }).click();
  const form = page.getByRole('dialog', { name: 'Nueva orden de reparación' });
  await form.getByRole('combobox').fill('Cliente Taller');
  await form.getByPlaceholder('iPhone 13').fill('iPhone 13');
  await form.getByRole('button', { name: 'Pantalla' }).click();
  await form.getByPlaceholder('Opcional').fill('45000');
  await form.getByRole('button', { name: 'Crear orden' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByTestId('repair-column-RECIBIDO')).toContainText('#OT-0001');
  await expect(page.getByTestId('repair-column-RECIBIDO')).toContainText('$ 45.000');
}

test('the owner edits the budget and deletes the order, and an employee without sensitive actions cannot', async ({ page, browser, request }, testInfo) => {
  const ownerEmail = buildTestEmail(testInfo, 'repair-owner');
  const staffEmail = buildTestEmail(testInfo, 'repair-staff');
  const storeName = `Taller ${testInfo.parallelIndex}`;
  await mockDollar(page);
  await bootstrapStoreViaApi(page, request, ownerEmail, storeName);
  await openService(page);
  await createOrder(page);

  await page.locator('[data-testid^="repair-card-"]').first().click();
  const detail = page.getByRole('dialog', { name: /#OT-0001/ });
  await detail.getByTestId('repair-edit-budget').click();
  await detail.getByLabel('Presupuesto').fill('80000');
  await detail.getByLabel('Seña').fill('15000');
  await detail.getByTestId('repair-save-budget').click();
  await expect(detail.getByText('$ 80.000')).toBeVisible();
  await expect(detail.getByText('$ 15.000')).toBeVisible();
  await expect(page.getByText('Presupuesto actualizado')).toBeVisible();
  await detail.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('repair-column-RECIBIDO')).toContainText('$ 80.000');

  const invitation = await createInvitationViaApi(request, ownerEmail, 'STAFF', staffEmail);
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  try {
    await mockDollar(staff);
    await staff.goto(`/invite/${invitation.token}`);
    await loginViaUi(staff, staffEmail);
    await staff.getByRole('button', { name: `Unirme a ${storeName}` }).click();
    await expect(staff.getByTestId('sidebar-tab-service')).toBeVisible();
    await openService(staff);
    await staff.locator('[data-testid^="repair-card-"]').first().click();
    const staffDetail = staff.getByRole('dialog', { name: /#OT-0001/ });
    await expect(staffDetail.getByText('$ 80.000')).toBeVisible();
    await expect(staffDetail.getByText('$ 15.000')).toBeVisible();
    await expect(staffDetail.getByTestId('repair-edit-budget')).toBeDisabled();
    await expect(staffDetail.getByTestId('repair-delete')).toBeDisabled();
    await expect(staffDetail.getByText(/Acciones sensibles/)).toBeVisible();
    await expect(staffDetail.getByLabel('Presupuesto')).toHaveCount(0);
  } finally {
    await staffContext.close();
  }

  await page.locator('[data-testid^="repair-card-"]').first().click();
  await detail.getByTestId('repair-delete').click();
  const confirm = page.getByRole('dialog', { name: 'Eliminar orden' });
  await expect(confirm).toContainText('no se puede deshacer');
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  await expect(confirm).toBeHidden();
  await detail.getByTestId('repair-delete').click();
  await page.getByRole('dialog', { name: 'Eliminar orden' }).getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByText('Orden eliminada')).toBeVisible();
  await expect(page.locator('[data-testid^="repair-card-"]')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Servicio técnico' })).toBeVisible();
  await expect(page.locator('[data-testid^="repair-card-"]')).toHaveCount(0);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the service screen and the order sheet inside 390 and 360', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'repair-phone');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Taller cel ${testInfo.parallelIndex}`);
    await openService(page);
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectInside(page, '.svc-screen');
    }

    await page.getByRole('button', { name: 'Nueva orden' }).click();
    const form = page.getByRole('dialog', { name: 'Nueva orden de reparación' });
    await expect(form).toBeVisible();
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectInside(page, '.sheet.svc-sheet');
    }
    await form.getByRole('combobox').fill('Cliente Celular');
    await form.getByPlaceholder('iPhone 13').fill('iPhone 13');
    await form.getByRole('button', { name: 'Batería' }).click();
    await form.getByPlaceholder('Opcional').fill('12000');
    await form.getByRole('button', { name: 'Crear orden' }).click();
    await expect(form).toBeHidden();

    await page.locator('[data-testid^="repair-card-"]').first().click();
    const detail = page.getByRole('dialog', { name: /#OT-0001/ });
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectInside(page, '.sheet.svc-sheet');
    }
    await detail.getByTestId('repair-edit-budget').click();
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectInside(page, '.sheet.svc-sheet');
    }
    await detail.getByRole('button', { name: 'Cancelar' }).click();
    await detail.getByTestId('repair-delete').click();
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectInside(page, '.dialog');
    }
    await page.getByRole('dialog', { name: 'Eliminar orden' }).getByRole('button', { name: 'Cancelar' }).click();
  });
});
