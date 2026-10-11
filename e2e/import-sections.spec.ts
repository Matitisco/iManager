import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { buildTestEmail, loginViaUi } from './utils';

const OUT = '/opt/cursor/artifacts/import-sections';
const CLIENTS = path.resolve('e2e/fixtures/clientes-agenda.csv');
const SALES = path.resolve('e2e/fixtures/ventas-mostrador.csv');
const GASTOS = path.resolve('e2e/fixtures/gastos-local.csv');
const ALUMNOS = path.resolve('e2e/fixtures/alumnos.csv');

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

async function openTab(page: Page, id: string) {
  const tab = page.getByTestId(`sidebar-tab-${id}`);
  if (!(await tab.isVisible())) await page.getByTestId('sidebar-tab-more').click();
  await tab.click();
}

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'phone-390', width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('previsualiza ventas y clientes antes de confirmar', async ({ page }, testInfo) => {
      test.setTimeout(180_000);
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

      await openTab(page, 'clients');
      await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
      if (phone) await page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' }).click();
      else await page.getByRole('button', { name: 'Importar' }).click();

      const clientsDialog = page.getByRole('dialog', { name: 'Importar clientes' });
      await expect(clientsDialog).toBeVisible();
      await clientsDialog.locator('input[type="file"]').setInputFiles(ALUMNOS);
      await expect(clientsDialog.getByTestId('import-unrelated')).toHaveText('Este archivo no parece tener clientes para importar.');
      await page.screenshot({ path: path.join(OUT, `${viewport.name}-clientes-ajeno.png`) });
      await clientsDialog.getByRole('button', { name: 'Volver' }).click();
      await clientsDialog.locator('input[type="file"]').setInputFiles(CLIENTS);
      await expect(clientsDialog.getByTestId('import-summary-count')).toHaveText('Detectamos 1 hoja, 10 clientes');
      await expect(clientsDialog.getByTestId('import-preview-count')).toHaveText('10 clientes');
      await expect(clientsDialog.getByText('Clientes a importar')).toBeVisible();
      await expect(clientsDialog.getByText('Lucía Fernández').first()).toBeVisible();
      const clientPreview = clientsDialog.getByTestId('import-preview');
      await expect(clientPreview).toHaveAttribute('aria-rowcount', '10');
      await expect(clientsDialog.locator('[data-layout]')).toHaveAttribute('data-layout', phone ? 'cards' : 'table');
      await page.screenshot({ path: path.join(OUT, `${viewport.name}-clientes-preview.png`) });
      const clientImport = page.waitForResponse(
        (response) => response.url().includes('/api/clients/import') && response.request().method() === 'POST',
      );
      await clientsDialog.getByTestId('import-confirm').click();
      const clientResponse = await clientImport;
      expect(clientResponse.ok()).toBe(true);
      const clientBody = await clientResponse.json() as { imported: number; updated: number; errors: unknown[] };
      expect(clientBody.imported).toBe(10);
      expect(clientBody.updated).toBe(0);
      expect(clientBody.errors).toEqual([]);
      await expect(clientsDialog.getByText('10 creados')).toBeVisible();
      await clientsDialog.locator('button.btn2', { hasText: 'Cerrar' }).click();
      await expect(page.getByText('10 clientes ·')).toBeVisible();

      await openTab(page, 'sales');
      await expect(page.getByRole('heading', { level: 1, name: 'Ventas' })).toBeVisible();
      if (phone) await page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' }).click();
      else await page.getByRole('button', { name: 'Importar' }).click();

      const salesDialog = page.getByRole('dialog', { name: 'Importar ventas' });
      await expect(salesDialog).toBeVisible();
      await salesDialog.locator('input[type="file"]').setInputFiles(GASTOS);
      await expect(salesDialog.getByTestId('import-unrelated')).toHaveText('Este archivo no parece tener ventas para importar.');
      await page.screenshot({ path: path.join(OUT, `${viewport.name}-ventas-ajeno.png`) });
      await salesDialog.getByRole('button', { name: 'Volver' }).click();
      await salesDialog.locator('input[type="file"]').setInputFiles(SALES);
      await expect(salesDialog.getByTestId('import-summary-count')).toHaveText('Detectamos 1 hoja, 10 ventas');
      await expect(salesDialog.getByTestId('import-preview-count')).toHaveText('10 ventas');
      await expect(salesDialog.getByText('Ventas a importar')).toBeVisible();
      await expect(salesDialog.getByText('Lucía Fernández').first()).toBeVisible();
      await expect(salesDialog.getByText('Moneda')).toHaveCount(phone ? 0 : 1);
      const salesPreview = salesDialog.getByTestId('import-preview');
      await expect(salesPreview).toHaveAttribute('aria-rowcount', '10');
      await page.screenshot({ path: path.join(OUT, `${viewport.name}-ventas-preview.png`) });
      const salesImport = page.waitForResponse(
        (response) => response.url().includes('/api/sales/import') && response.request().method() === 'POST',
      );
      await salesDialog.getByTestId('import-confirm').click();
      const salesResponse = await salesImport;
      expect(salesResponse.ok()).toBe(true);
      const salesBody = await salesResponse.json() as { imported: number; errors: unknown[] };
      expect(salesBody.imported).toBe(10);
      expect(salesBody.errors).toEqual([]);
      await expect(salesDialog.getByText('10 creados')).toBeVisible();
      await salesDialog.locator('button.btn2', { hasText: 'Cerrar' }).click();

      await openTab(page, 'clients');
      await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
      await expect(page.getByText('10 clientes ·')).toBeVisible();
      await page.getByPlaceholder('Buscar por nombre, DNI o teléfono').fill('Lucía');
      await expect(page.getByText('Lucía Fernández').first()).toBeVisible();
      await expect(page.getByText('03/10/2026').first()).toBeVisible();
      await expect(page.getByText('$ 850.000').first()).toBeVisible();
    });
  });
}
