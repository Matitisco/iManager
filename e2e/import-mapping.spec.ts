import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { buildTestEmail, loginViaUi } from './utils';

const OUT = '/opt/cursor/artifacts/import-auto';
const WORKBOOK = path.resolve('e2e/fixtures/ejemplo-stock.xlsx');

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

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'phone-390', width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('importa el excel de ejemplo sin configurar columnas', async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const phone = viewport.width < 700;
      const email = buildTestEmail(testInfo, viewport.name);
      page.on('request', (request) => {
        if (request.url().includes('api.openai.com')) {
          throw new Error('El navegador no debe llamar a OpenAI');
        }
      });
      await mockDollar(page);

      await page.goto('/');
      await loginViaUi(page, email);
      await expect(page.getByTestId('onboarding-store-name')).toBeVisible();
      await page.getByTestId('onboarding-store-name').fill(`Tienda ${viewport.name}`);
      await page.getByTestId('onboarding-instagram').fill('@e2etienda');
      const onboardingRequest = page.waitForResponse(
        (response) => response.url().includes('/api/onboarding') && response.request().method() === 'POST' && response.ok(),
      );
      await page.getByTestId('onboarding-submit').click({ noWaitAfter: true });
      await onboardingRequest;
      const skipContact = page.getByRole('button', { name: 'Ahora no' });
      if (await skipContact.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)) {
        await skipContact.click();
      }
      await expect(page.getByTestId('sidebar-tab-dashboard')).toBeVisible();

      const inventoryTab = page.getByTestId('sidebar-tab-inventory');
      if (!(await inventoryTab.isVisible())) await page.getByTestId('sidebar-tab-more').click();
      await inventoryTab.click();
      await expect(page.getByRole('heading', { level: 1, name: 'Inventario' })).toBeVisible();
      if (phone) {
        await page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' }).click();
      } else {
        await page.getByRole('button', { name: 'Importar' }).click();
      }

      const dialog = page.getByRole('dialog', { name: 'Importar equipos' });
      await expect(dialog).toBeVisible();
      await dialog.locator('input[type="file"]').setInputFiles(WORKBOOK);

      await expect(dialog.getByTestId('import-summary-count')).toHaveText('Detectamos 3 hojas, 37 equipos');
      await expect(dialog.getByTestId('import-sheet-summary')).toHaveCount(3);
      await expect(dialog.getByText('iPhones Usados')).toBeVisible();
      await expect(dialog.getByText('iPhones Nuevos')).toBeVisible();
      await expect(dialog.getByText('OUTLET')).toBeVisible();
      await expect(dialog.getByText('20 equipos usados')).toBeVisible();
      await expect(dialog.getByText('10 equipos nuevos')).toBeVisible();
      await expect(dialog.getByText('Revisá las columnas')).toHaveCount(0);
      await expect(dialog.locator('[data-testid^="import-confidence-"]')).toHaveCount(0);
      await page.screenshot({ path: path.join(OUT, `${viewport.name}-resumen.png`) });

      await dialog.getByTestId('import-adjust-open').click();
      await expect(dialog.getByTestId('import-adjust')).toBeVisible();
      await expect(dialog.getByTestId('import-field-model')).toHaveValue('Modelo');
      await expect(dialog.getByTestId('import-field-price')).toHaveValue('PRECIO ARS');
      await expect(dialog.getByTestId('import-field-batteryHealth')).toHaveValue('Batería');
      await expect(dialog.locator('[data-testid^="import-confidence-"]')).toHaveCount(0);
      await expect(dialog.getByText('%', { exact: true })).toHaveCount(0);
      await page.screenshot({ path: path.join(OUT, `${viewport.name}-ajustar.png`) });

      await dialog.getByRole('button', { name: 'Listo' }).click();
      const importResponse = page.waitForResponse(
        (response) => response.url().includes('/api/inventory/import') && response.request().method() === 'POST',
      );
      await dialog.getByTestId('import-confirm').click();
      const response = await importResponse;
      expect(response.ok()).toBe(true);
      const body = await response.json() as { imported: number; errors: unknown[] };
      expect(body.imported).toBe(37);
      expect(body.errors).toEqual([]);
      await expect(dialog.getByText('37 creados')).toBeVisible();
    });
  });
}
