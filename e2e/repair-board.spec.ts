import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createRepairViaApi } from './utils';

const SHOTS = process.env.REPAIR_BOARD_SHOTS?.trim();

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

test('drags a repair across columns and still changes status from the keyboard button', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'repair-board');
  await page.addInitScript(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = (url?: string | URL | null) => {
      opened.push(String(url ?? ''));
      return null;
    };
  });
  await mockDollar(page);
  await bootstrapStoreViaApi(page, request, email, `Tablero ${testInfo.parallelIndex}`);
  const client = await createClientViaApi(request, email, { name: 'Cliente Tablero', phone: '2614000000' });
  await createRepairViaApi(request, email, {
    clientId: client.client.id,
    clientName: 'Cliente Tablero',
    device: 'iPhone 13',
    fault: 'Pantalla',
    estimate: 45000,
  });
  await page.reload();
  await page.getByTestId('sidebar-tab-service').click();
  await expect(page.getByRole('heading', { name: 'Servicio técnico' })).toBeVisible();
  await expect(page.getByTestId('repair-column-RECIBIDO')).toContainText('#OT-0001');
  await expect(page.getByTestId('repair-column-EN_DIAGNOSTICO')).toHaveCount(0);
  await expect(page.getByTestId('repair-column-ESPERANDO_REPUESTO')).toHaveCount(0);
  await expect(page.getByTestId('repair-column-ESPERANDO_RESPUESTA')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'En diagnóstico' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Esperando repuesto' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Esperando respuesta' })).toHaveCount(0);

  const card = page.getByTestId('repair-column-RECIBIDO').locator('[data-testid^="repair-card-"]');
  await expect(card).toHaveAttribute('draggable', 'true');
  await expect.poll(() => card.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgb(255, 255, 255)');
  await expect.poll(() => card.evaluate((node) => getComputedStyle(node).color)).toBe('rgb(22, 24, 29)');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tablero-cards.png` });

  await card.dragTo(page.getByTestId('repair-column-EN_REPARACION'), { targetPosition: { x: 40, y: 80 } });
  await expect(page.locator('.toast.show')).toContainText('Pasó a En reparación');
  await expect(page.getByTestId('repair-column-EN_REPARACION')).toContainText('#OT-0001');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tablero-arrastre.png` });

  await page.getByTestId('repair-column-EN_REPARACION').locator('[data-testid^="repair-card-"]').click();
  const detail = page.getByRole('dialog', { name: /#OT-0001/ });
  await expect(detail.locator('.svc-log')).toContainText('Recibido');
  await expect(detail.locator('.svc-log')).toContainText('En reparación');
  await expect(detail.locator('.svc-log li')).toHaveCount(2);
  await detail.getByRole('button', { name: 'Pasar a Listo para retirar' }).click();
  await expect(page.locator('.toast.show')).toContainText('Pasó a Listo para retirar');
  await expect(detail.locator('.svc-log li')).toHaveCount(3);
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  expect(opened.some((url) => url.includes('wa.me'))).toBeTruthy();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tablero-listo.png` });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the grouped list without drag or the retired statuses', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'repair-board-phone');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Tablero cel ${testInfo.parallelIndex}`);
    await createRepairViaApi(request, email, {
      clientName: 'Cliente Celular',
      device: 'iPhone 12',
      fault: 'Batería',
      estimate: 80000,
    });
    await page.reload();
    await page.getByTestId('sidebar-tab-more').click();
    await page.getByTestId('sidebar-tab-service').click();
    await expect(page.getByTestId('service-chips')).toContainText('Recibido');
    await expect(page.getByTestId('service-chips')).not.toContainText('En diagnóstico');
    await expect(page.getByTestId('service-chips')).not.toContainText('Esperando');
    await expect(page.getByTestId('repair-group-RECIBIDO')).toContainText('#OT-0001');
    await expect(page.locator('[data-testid^="repair-card-"]')).not.toHaveAttribute('draggable');
    await expect(page.getByTestId('repair-column-RECIBIDO')).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tablero-celular.png` });
  });
});
