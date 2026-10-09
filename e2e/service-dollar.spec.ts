import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail } from './utils';

const SHOTS = process.env.EXTRAS_SCREENSHOT_DIR?.trim();

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

test('the sidebar shows the blue dollar and a repair order moves from Recibido to Listo para retirar', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'service');
  await mockDollar(page);
  await bootstrapStoreViaApi(page, request, email, `Service ${testInfo.parallelIndex}`);

  const widget = page.getByTestId('blue-widget');
  await expect(widget).toHaveAttribute('data-state', 'ready');
  await expect(widget).toContainText('Act. 21:40 · DolarApi');
  await page.getByRole('button', { name: /Dólar blue/ }).click();
  await page.getByLabel('Dólares').fill('100');
  await expect(page.getByTestId('blue-result')).toContainText('130.000');
  await expect(page.getByText('Fuente: DolarApi (cotización blue).')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dolar-detalle.png` });
  await page.getByTestId('blue-done').click();

  await page.getByTestId('sidebar-tab-service').click();
  await expect(page).toHaveURL(/#\/?servicio/);
  await expect(page.getByRole('heading', { name: 'Servicio técnico' })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva orden' }).click();
  const form = page.getByRole('dialog', { name: 'Nueva orden de reparación' });
  await form.getByRole('button', { name: 'Crear orden' }).click();
  await expect(form.getByText('Completá este dato').first()).toBeVisible();
  await form.getByRole('combobox').fill('Cliente Servicio');
  await form.getByPlaceholder('iPhone 13').fill('iPhone 13');
  await form.getByRole('button', { name: 'Pantalla' }).click();
  await form.getByPlaceholder('Opcional').fill('45000');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/servicio-alta.png` });
  await form.getByRole('button', { name: 'Crear orden' }).click();
  await expect(form).toBeHidden();

  const card = page.locator('[data-testid^="repair-card-"]').first();
  await expect(page.getByTestId('repair-column-RECIBIDO')).toContainText('#OT-0001');
  await expect(card).toContainText('$ 45.000');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/servicio-tablero.png` });
  await card.click();
  const detail = page.getByRole('dialog', { name: /#OT-0001/ });
  for (const next of ['En diagnóstico', 'Esperando repuesto', 'En reparación', 'Listo para retirar']) {
    await detail.getByRole('button', { name: `Pasar a ${next}` }).click();
    await expect(detail.getByText(`Sigue: ${next}`)).toHaveCount(0);
  }
  await expect(detail.locator('.svc-log li')).toHaveCount(5);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/servicio-detalle.png` });
  await detail.getByRole('button', { name: 'Cerrar' }).first().click();

  await page.getByRole('button', { name: 'Lista' }).click();
  await expect(page.locator('[data-testid^="repair-row-"]')).toContainText('Listo para retirar');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Servicio técnico' })).toBeVisible();
  await expect(page.getByTestId('repair-column-LISTO_PARA_RETIRAR')).toContainText('#OT-0001');
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the dollar widget and the service tab reachable on a phone', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'service-phone');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Service phone ${testInfo.parallelIndex}`);
    await expect(page.getByTestId('blue-widget')).toHaveAttribute('data-state', 'ready');
    await page.getByTestId('blue-widget').scrollIntoViewIfNeeded();
    const bar = await page.locator('.side').boundingBox();
    expect(bar?.height ?? 0).toBeLessThan(90);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-dolar.png` });
    await page.getByTestId('sidebar-tab-service').click();
    await expect(page.getByRole('heading', { name: 'Servicio técnico' })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-servicio.png` });
  });
});
