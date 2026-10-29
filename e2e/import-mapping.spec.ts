import { openDeskSection } from './navigation';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { buildTestEmail, loginViaUi } from './utils';
import type { ImportAnalysis } from '../src/services/import-api';

const OUT = 'test-results/import-auto';
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
  { name: 'tablet-1024', width: 1024, height: 900 },
  { name: 'phone-390', width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.width === 390 ? 2 : 1 });

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
      await page.getByText('Moneda y dólar').click();
      await page.getByTestId('onboarding-currency').selectOption('ARS');
      const onboardingRequest = page.waitForResponse(
        (response) => response.url().includes('/api/onboarding') && response.request().method() === 'POST' && response.ok(),
      );
      await page.getByTestId('onboarding-submit').click({ noWaitAfter: true });
      await onboardingRequest;
      await page.getByRole('button', { name: 'Saltar por ahora' }).click();
      await expect(page.getByTestId('sidebar-tab-dashboard')).toBeVisible();

      await openDeskSection(page, 'inventory');
      await expect(page.getByRole('heading', { level: 1, name: 'Inventario' })).toBeVisible();
      if (phone) {
        await page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' }).click();
      } else {
        await page.getByRole('button', { name: 'Importar' }).click();
      }

      const dialog = page.getByRole('dialog', { name: 'Importar equipos' });
      await expect(dialog).toBeVisible();
      await page.route('**/api/import/analyze', async route => {
        const response = await route.fetch();
        const analysis: ImportAnalysis = await response.json();
        analysis.source = 'model';
        for (const sheet of analysis.plan) {
          const model = sheet.mapping.find(column => column.field === 'model');
          if (model) model.review = ['Verificar modelo sugerido'];
        }
        await route.fulfill({ response, json: analysis });
      });
      await dialog.locator('input[type="file"]').setInputFiles(WORKBOOK);

      await expect(dialog.getByTestId('import-sheet-summary')).toHaveCount(3);
      await expect(dialog.getByTestId('import-sheet-summary').getByText('iPhones Usados')).toBeVisible();
      await expect(dialog.getByTestId('import-sheet-summary').getByText('iPhones Nuevos')).toBeVisible();
      await expect(dialog.getByTestId('import-sheet-summary').getByText('OUTLET')).toBeVisible();
      await expect(dialog.getByText('20 equipos usados')).toBeVisible();
      await expect(dialog.getByText('10 equipos nuevos')).toBeVisible();
      await expect(dialog.getByText('Revisá las columnas')).toHaveCount(0);
      await expect(dialog.locator('[data-testid^="import-confidence-"]')).toHaveCount(0);
      await expect(dialog.getByTestId('import-preview-count')).toHaveText('37 equipos');
      const preview = dialog.getByTestId('import-preview');
      await preview.scrollIntoViewIfNeeded();
      await expect(preview.getByTestId('import-preview-row').first()).toBeVisible();
      await expect(dialog.getByRole('complementary')).toHaveCount(0);
      await page.screenshot({ path: path.join(OUT, `${viewport.name}-resumen.png`) });
      await preview.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      const previewTable = preview.getByRole('table');
      const visibleCount = Number(await previewTable.getAttribute('aria-rowcount')) - 1;
      await expect(preview.locator('[data-testid="import-preview-row"]').last()).toHaveAttribute('data-index', String(visibleCount - 1));
      await page.screenshot({ path: path.join(OUT, `${viewport.name}-preview.png`) });

      const viewportWidth = page.viewportSize()!.width;
      const frame = await dialog.boundingBox();
      expect(frame!.x).toBeGreaterThanOrEqual(0);
      expect(frame!.x + frame!.width).toBeLessThanOrEqual(viewportWidth);
      await expect(dialog.getByTestId('import-confirm')).toBeInViewport();
      await expect(dialog.getByRole('button', { name: 'Importar Modelo como' })).toContainText('Modelo');
      await expect(dialog.getByRole('button', { name: 'Importar PRECIO ARS como' })).toContainText('Precio');
      await expect(dialog.getByRole('button', { name: 'Importar Batería como' })).toContainText('Batería');
      const modelHeader = dialog.locator('th[data-preview-key="model"]');
      await expect(modelHeader).toHaveClass(/imp-pending/);
      await expect(modelHeader).toHaveCSS('background-color', 'rgb(255, 244, 194)');
      await expect(modelHeader).toHaveCSS('border-top-color', 'rgb(255, 208, 0)');
      const review = dialog.getByRole('button', { name: /\d+ por revisar/ });
      await expect(review).toHaveText(`${await dialog.locator('th.imp-pending').count()} por revisar`);
      await review.click();
      await expect(modelHeader.locator('.imp-heading-label')).toBeFocused();
      const pending = dialog.getByRole('button', { name: /\d+ sin asignar/ });
      if (await pending.count()) {
        await expect(pending).toHaveCSS('color', 'rgb(220, 76, 76)');
        await expect(pending).toHaveText(`${await dialog.locator('th.imp-unassigned').count()} sin asignar`);
        const before = await preview.evaluate(element => element.scrollTop);
        await pending.click();
        await expect(dialog.locator('th.imp-unassigned .imp-heading-label').first()).toBeFocused();
        expect(await preview.evaluate(element => element.scrollTop)).toBe(before);
      }
      const batteryGrip = dialog.getByRole('button', { name: 'Arrastrar para reordenar · Batería' });
      await batteryGrip.focus();
      await page.keyboard.press('ArrowRight');
      await expect(preview.locator('th').nth(2)).toHaveAttribute('data-column-index', '1');
      await page.keyboard.press('ArrowLeft');
      await expect(preview.locator('th').nth(1)).toHaveAttribute('data-column-index', '1');
      await preview.evaluate(element => { element.scrollTop = 0; });
      await dialog.getByRole('button', { name: 'Importar Modelo como' }).click();
      const selector = page.getByRole('dialog', { name: /^Importar A · Modelo como/ });
      await expect(selector.getByRole('textbox', { name: 'Buscar campo' })).toBeFocused();
      await selector.getByRole('textbox', { name: 'Buscar campo' }).fill('pre');
      await expect(selector.getByRole('button', { name: /^Precio/ })).toContainText('Precio');
      await expect(selector.getByRole('button', { name: /^Modelo/ })).toHaveCount(0);
      await expect(selector.getByRole('button', { name: 'Nuevo campo…' })).toBeVisible();
      await expect(selector.getByRole('button', { name: 'Descartar' })).toBeVisible();
      const popup = await selector.boundingBox();
      expect(popup!.x).toBeGreaterThanOrEqual(0);
      expect(popup!.x + popup!.width).toBeLessThanOrEqual(viewportWidth);
      expect(popup!.y + popup!.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({ path: path.join(OUT, `${viewport.name}-selector.png`) });
      await page.keyboard.press('Escape');
      await expect(dialog.getByRole('button', { name: 'Importar Modelo como' })).toBeFocused();
      await dialog.getByRole('button', { name: 'Importar PRECIO ARS como' }).click();
      const priceSelector = page.getByRole('dialog', { name: / · PRECIO ARS como$/ });
      const applyResponse = page.waitForResponse(response => response.url().includes('/api/import/apply') && response.ok());
      await priceSelector.getByRole('button', { name: 'Precio', exact: true }).click();
      await applyResponse;
      await expect(dialog.getByTestId('import-confirm')).toBeEnabled();
      await expect(dialog.getByTestId('import-confirm')).toBeInViewport();

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
