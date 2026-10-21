import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { reportsFixture } from './451-fixtures';

for (const width of [320, 390, 1440, 1536]) {
  test(`periods, custom editor and calendar fit ${width}`, async ({ page }) => {
    const height = width === 1536 ? 640 : width < 760 ? 844 : 900;
    await page.setViewportSize({ width, height });
    const unexpected = await reportsFixture(page);
    await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeEnabled();
    await expect(page.locator('.report-applied')).toContainText('22/09/2026 al 21/10/2026');
    await expect(page.locator('.report-applied')).toContainText('23/08/2026 al 21/09/2026');
    const tabs = page.getByRole('group', { name: 'Tipo de reporte' });
    const periods = page.getByRole('group', { name: 'Período', exact: true });
    if (width < 760) {
      for (const row of [tabs, periods]) await expect(row).toHaveCSS('overflow-x', 'auto');
      for (const name of ['Este mes', 'Personalizado', '7 días']) {
        await periods.getByRole('button', { name, exact: true }).scrollIntoViewIfNeeded();
        await expect(periods.getByRole('button', { name, exact: true })).toBeInViewport();
      }
    } else {
      const filters = (await page.locator('.gfilters').boundingBox())!;
      const range = (await periods.boundingBox())!;
      expect(Math.abs(range.x + range.width - filters.x - filters.width)).toBeLessThanOrEqual(2);
    }
    await periods.getByRole('button', { name: 'Este mes', exact: true }).click();
    await expect(page.locator('.report-applied')).toContainText('01/10/2026 al 21/10/2026');
    await expect(page.locator('.report-applied')).toContainText('10/09/2026 al 30/09/2026');
    await expect(page.locator('.gcol')).toHaveCount(7);
    await periods.getByRole('button', { name: 'Personalizado', exact: true }).click();
    await page.getByLabel('Fecha de inicio', { exact: true }).fill('01/10/2026');
    await page.getByLabel('Fecha de fin', { exact: true }).fill('21/10/2026');
    await expect(page.locator('.report-preview')).toContainText('21 días');
    await page.getByRole('button', { name: 'Abrir calendario: fecha de inicio', exact: true }).click();
    const calendar = page.getByRole('dialog', { name: 'Elegir fecha de inicio', exact: true });
    await calendar.scrollIntoViewIfNeeded();
    const box = (await calendar.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: `docs/issue-451/after-calendar-${width}x${height}.png`, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.locator('.report-applied')).toContainText('Este mes');
    await periods.getByRole('button', { name: 'Personalizado', exact: true }).click();
    await page.getByRole('button', { name: 'Aplicar período', exact: true }).click();
    await expect(page.locator('.report-applied')).toContainText('Personalizado');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `docs/issue-451/after-fit-${width}x${height}.png`, animations: 'disabled' });
    expect(unexpected).toEqual([]);
  });
}

test('module summaries, scoped export and monthly commissions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const unexpected = await reportsFixture(page);
  const tabs = page.getByRole('group', { name: 'Tipo de reporte' });
  const periods = page.getByRole('group', { name: 'Período', exact: true });
  await expect(page.locator('.gamount')).toHaveText('$ 19.320.000');
  await expect(page.locator('.gdelta')).toHaveClass(/report-delta-negative/);
  await expect(page.locator('.report-business')).toContainText('Ventas, gastos y devoluciones');
  await page.getByRole('button', { name: 'Efectivo: 50%', exact: true }).click();
  const listed = await page.locator('.gtk').count();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv.trim().split('\n')).toHaveLength(listed + 1);
  expect(csv).not.toContain('Juan Pérez');
  await tabs.getByRole('button', { name: 'Stock', exact: true }).click();
  await expect(page.locator('.report-kpis')).toContainText('Disponibles hoy');
  await expect(page.locator('.report-kpi').first()).toContainText('41');
  await expect(page.locator('.gdelta')).toHaveClass(/report-delta-neutral/);
  await expect(page.locator('.report-business')).toHaveCount(0);
  await tabs.getByRole('button', { name: 'Servicio', exact: true }).click();
  await expect(page.locator('.gamount')).toHaveText('$ 1.760.000');
  await expect(page.locator('.report-kpis')).toContainText('3,2 días');
  await expect(page.locator('.report-notes')).toContainText('3 órdenes «A cotizar» no suman');
  await periods.getByRole('button', { name: '90 días', exact: true }).click();
  await tabs.getByRole('button', { name: 'Comisiones', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Mes de comisiones', exact: true })).toBeVisible();
  await expect(periods).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeEnabled();
  await tabs.getByRole('button', { name: 'Canjes', exact: true }).click();
  await expect(page.getByRole('button', { name: '90 días', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'No hubo canjes en este período', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver últimos 30 días', exact: true }).click();
  await expect(page.getByRole('button', { name: '30 días', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(unexpected).toEqual([]);
});
