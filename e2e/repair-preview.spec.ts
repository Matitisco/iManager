import { openSheetActions } from './sheet-actions';
import { openDeskSection } from './navigation';
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createRepairViaApi } from './utils';

const SHOTS = 'test-results/issue-267';

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

async function settle(page: Page) {
  const overlay = page.locator('.ov').last();
  if (await overlay.count()) {
    await overlay.evaluate(async (node) => {
      const animations = node.getAnimations({ subtree: true });
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
    });
  }
}

async function openService(page: Page) {
  const heading = page.getByRole('heading', { name: 'Servicio técnico' });
  if (await heading.isVisible()) return;
  await openDeskSection(page, 'service');
  await expect(heading).toBeVisible();
}

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

test('separates the read-only preview from edit on desktop and phone', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const email = buildTestEmail(testInfo, 'repair-preview');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDollar(page);
  await bootstrapStoreViaApi(page, request, email, `Taller preview ${testInfo.parallelIndex}`);
  await createRepairViaApi(request, email, {
    clientName: 'Ana Pérez',
    device: 'iPhone 13',
    fault: 'Pantalla rota',
    estimate: 45000,
    deposit: 10000,
    technician: 'Técnico Ejemplo',
    estimatedDelivery: '20/10/2026',
  });
  await page.reload();
  await openService(page);

  const card = page.locator('[data-testid^="repair-card-"]').first();
  await expect(card).toHaveAttribute('draggable', 'true');
  await expect(page.getByRole('button', { name: 'Más acciones' })).toHaveCount(0);
  await card.click();
  const preview = page.getByRole('dialog', { name: /#OT-0001/ });
  await expect(preview.getByText('Ana Pérez')).toBeVisible();
  await expect(preview.getByText('Pantalla rota')).toBeVisible();
  await expect(preview.getByText('$ 45.000')).toBeVisible();
  await expect(preview.getByText('$ 10.000')).toBeVisible();
  await expect(preview.getByText('Técnico Ejemplo')).toBeVisible();
  await expect(preview.getByText('Recibido').first()).toBeVisible();
  await expect(preview.getByLabel('Presupuesto')).toHaveCount(0);
  await expect(preview.getByRole('button', { name: 'Guardar' })).toHaveCount(0);
  await expect(preview.getByRole('button', { name: 'Eliminar orden' })).toHaveCount(0);
  await openSheetActions(preview);
  await expect(preview.getByRole('button', { name: 'Editar' })).toBeVisible();
  await expect(preview.locator('.sheet-h .modal-x')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/desktop-1440-preview.png` });

  await preview.getByTestId('repair-open-edit').click();
  const editor = page.getByRole('dialog', { name: 'Editar orden' });
  await expect(editor.getByLabel('Equipo')).toBeVisible();
  await expect(editor.getByLabel('Presupuesto')).toBeEnabled();
  await expect(editor.getByRole('button', { name: 'Guardar' })).toBeVisible();
  await expect(editor.getByTestId('repair-delete')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/desktop-1440-edit.png` });
  await editor.getByRole('button', { name: 'Cancelar' }).click();
  await expect(editor).toBeHidden();

  await card.click({ button: 'right' });
  const menu = page.locator('.ctx');
  await expect(menu.getByRole('button', { name: 'Editar' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Archivar' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/desktop-1440-menu.png` });
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await card.click({ button: 'right' });
  await expect(menu).toBeVisible();
  await page.locator('.ctxov').click({ position: { x: 8, y: 8 } });
  await expect(menu).toBeHidden();

  await page.getByRole('button', { name: 'Lista' }).click();
  await page.locator('[data-testid^="repair-row-"]').click({ button: 'right' });
  await expect(page.locator('.ctx').getByRole('button', { name: 'Editar' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('mobile-dock')).toBeVisible();
  await openService(page);
  const phoneCard = page.locator('[data-testid^="repair-card-"]').first();
  await expect(phoneCard).not.toHaveAttribute('draggable');
  await page.getByRole('button', { name: 'Más acciones' }).click();
  await expect(page.locator('.ctx').getByRole('button', { name: 'Editar' })).toBeVisible();
  await expect(page.locator('.ctx').getByRole('button', { name: 'Archivar' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/phone-390-menu.png` });
  await page.keyboard.press('Escape');

  await phoneCard.click();
  const phonePreview = page.getByRole('dialog', { name: /#OT-0001/ });
  await expect(phonePreview.getByText('iPhone 13', { exact: true })).toBeVisible();
  await expect(phonePreview.getByText('Ana Pérez')).toBeVisible();
  await expect(phonePreview.getByLabel('Equipo')).toHaveCount(0);
  await openSheetActions(phonePreview);
  await expect(phonePreview.getByRole('button', { name: 'Editar' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/phone-390-preview.png` });
  await phonePreview.getByTestId('repair-open-edit').click();
  const phoneEditor = page.getByRole('dialog', { name: 'Editar orden' });
  await expect(phoneEditor.getByRole('button', { name: 'Guardar' })).toBeVisible();
  await expect(phoneEditor.getByTestId('repair-delete')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/phone-390-edit.png` });
});
