import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { expect, type Page, type APIRequestContext, type TestInfo } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createSaleViaApi } from './utils';

const shots = process.env.ISSUE_287_SHOTS?.trim();

export async function reports(page: Page, request: APIRequestContext, testInfo: TestInfo) {
  const email = buildTestEmail(testInfo, 'dropdown');
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: new Date().toISOString() } }));
  await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({ json: { blue: { value_buy: 1280, value_sell: 1300 } } }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({ json: { venta: '1300,00', valor_cierre_ant: '1300,00' } }));
  await bootstrapStoreViaApi(page, request, email, 'iManager · Reportes');
  const date = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  await createSaleViaApi(request, email, { date, clientName: 'Ana Pérez', deviceLabel: 'iPhone 13 128 GB', amount: 300000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO' });
  await createSaleViaApi(request, email, { date, clientName: 'Luis Gómez', deviceLabel: 'iPhone 14 128 GB', amount: 450000, amountCurrency: 'ARS', paymentMethod: 'TRANSFERENCIA' });
  await page.reload();
  await page.getByTestId('sidebar-tab-reports').click();
  await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
  await expect(page.locator('.gtk')).toHaveCount(2);
  return page.getByRole('combobox', { name: 'Columna de desglose' });
}

export async function screenshot(page: Page, file: string) {
  if (!shots) return;
  await mkdir(shots, { recursive: true });
  await page.locator('.ds-select-popup').evaluate(async (node) => {
    await Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)));
  });
  await page.screenshot({ path: path.join(shots, file) });
}
