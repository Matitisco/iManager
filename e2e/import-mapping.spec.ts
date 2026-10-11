import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { buildTestEmail, loginViaUi } from './utils';

const OUT = '/opt/cursor/artifacts/import-mapping';

const CSV = [
  'Equipo,GB,Pintura,Serial,Valor venta,Obs',
  'iPhone 14,128,Negro,350000000000001,450000,caja',
  'iPhone 13,256,Azul,350000000000002,390000,sellado',
  'Galaxy A54,128,Blanco,350000000000003,280000,',
].join('\n');

const SUGGESTION = {
  source: 'decisions',
  notice: null,
  suggestions: [
    { header: 'Equipo', field: 'model', confidence: 0.94, review: false, suggestedField: 'model' },
    { header: 'GB', field: 'capacity', confidence: 0.88, review: false, suggestedField: 'capacity' },
    { header: 'Pintura', field: 'color', confidence: 0.46, review: true, suggestedField: 'color' },
    { header: 'Serial', field: 'imei', confidence: 0.91, review: false, suggestedField: 'imei' },
    { header: 'Valor venta', field: 'price', confidence: 0.83, review: false, suggestedField: 'price' },
    { header: 'Obs', field: null, confidence: 0.62, review: true, suggestedField: 'cost' },
  ],
};

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

    test('muestra el mapeo sugerido y deja corregirlo', async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      const phone = viewport.width < 700;
      const email = buildTestEmail(testInfo, viewport.name);
      let suggested = false;
      page.on('request', (request) => {
        if (request.url().includes('api.openai.com')) {
          throw new Error('El navegador no debe llamar a OpenAI');
        }
      });
      await mockDollar(page);
      await page.route('**/api/import/suggest-mapping', async (route) => {
        suggested = true;
        const body = route.request().postDataJSON() as { section: string; columns: { header: string; samples: string[] }[] };
        expect(body.section).toBe('inventory');
        expect(body.columns.map((column) => column.header)).toEqual(['Equipo', 'GB', 'Pintura', 'Serial', 'Valor venta', 'Obs']);
        expect(body.columns.every((column) => column.samples.length <= 8)).toBe(true);
        expect(body.columns[0]?.samples).toContain('iPhone 14');
        await route.fulfill({ json: SUGGESTION });
      });

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
      await dialog.locator('input[type="file"]').setInputFiles({
        name: 'stock.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(CSV),
      });
      await dialog.getByRole('button', { name: phone ? 'Continuar' : 'Confirmar encabezado' }).click();

      await expect(dialog.getByTestId('import-confidence-model')).toHaveText('94%');
      await expect(dialog.getByTestId('import-confidence-color')).toHaveText('Revisar 46%');
      await expect(dialog.getByTestId('import-field-model')).toHaveValue('Equipo');
      await expect(dialog.getByTestId('import-field-color')).toHaveValue('Pintura');
      await expect(dialog.getByTestId('import-field-capacity')).toHaveValue('GB');
      await expect(dialog.getByTestId('import-mapping-notice')).toContainText('Revisá las columnas marcadas');
      await expect(dialog.getByTestId('import-column-review')).toContainText('Obs');
      await expect(dialog.getByTestId('import-column-review')).toContainText('Costo');
      await expect(dialog.getByTestId('import-field-model').locator('option[value="Serial"]')).toBeDisabled();
      expect(suggested).toBe(true);

      await page.screenshot({ path: path.join(OUT, `${viewport.name}-mapeo.png`) });

      await dialog.getByTestId('import-field-color').selectOption('');
      await expect(dialog.getByTestId('import-confidence-color')).toHaveCount(0);
      await expect(dialog.getByTestId('import-field-color')).toHaveValue('');
      await expect(dialog.getByTestId('import-field-model')).toHaveValue('Equipo');
    });
  });
}
