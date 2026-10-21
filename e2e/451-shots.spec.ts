import { expect, test } from '@playwright/test';
import { reportsFixture } from './451-fixtures';
const phase = process.env.REPORT_SHOT_PHASE ?? 'after';
for (const width of [390, 1440]) {
  test(`reports evidence ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const unexpected = await reportsFixture(page);
    const shot = async (name: string) => {
      await page.screenshot({ path: `docs/issue-451/${phase}-${name}-${width}.png`, animations: 'disabled' });
    };
    await expect(page.locator('.gamount')).not.toHaveText('—');
    await shot('ventas');
    if (width === 390 && phase === 'after') {
      for (const [selector, name] of [['.gcomp', 'ventas-breakdown'], ['.report-business', 'ventas-business'], ['.glh', 'ventas-details']]) {
        await page.locator(selector).first().scrollIntoViewIfNeeded();
        await shot(name);
      }
      await page.locator('.stage').evaluate(node => { node.scrollTop = 0; });
    }
    for (const [tab, name] of [['Stock', 'stock'], ['Servicio', 'servicio'], ['Clientes', 'clientes'], ['Comisiones', 'comisiones']]) {
      await page.getByRole('group', { name: 'Tipo de reporte' }).getByRole('button', { name: tab, exact: true }).click();
      if (tab === 'Comisiones') await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeEnabled();
      await shot(name);
      if (width === 390 && phase === 'after') {
        if (tab === 'Stock' || tab === 'Servicio') {
          await page.locator('.gcard').first().scrollIntoViewIfNeeded();
          await shot(`${name}-evolution`);
        }
        await page.locator('.gcomp').scrollIntoViewIfNeeded();
        await shot(`${name}-breakdown`);
        await page.locator('.stage').evaluate(node => { node.scrollTop = 0; });
      }
    }
    await page.getByRole('group', { name: 'Tipo de reporte' }).getByRole('button', { name: 'Ventas', exact: true }).click();
    await page.getByRole('button', { name: 'Personalizado', exact: true }).click();
    await page.getByLabel('Fecha de inicio', { exact: true }).fill('01/10/2026');
    await page.getByLabel('Fecha de fin', { exact: true }).fill('21/10/2026');
    await shot('custom-editor');
    await page.getByRole('button', { name: 'Aplicar período', exact: true }).click();
    await shot('custom-applied');
    if (width === 390 && phase === 'after') {
      await page.locator('.gcard').first().scrollIntoViewIfNeeded(); await shot('custom-evolution');
      await page.locator('.gcomp').scrollIntoViewIfNeeded(); await shot('custom-breakdown');
      await page.locator('.stage').evaluate(node => { node.scrollTop = 0; });
    }
    await page.getByRole('group', { name: 'Tipo de reporte' }).getByRole('button', { name: 'Canjes', exact: true }).click();
    await page.getByRole('button', { name: phase === 'before' ? 'Semana' : '7 días', exact: true }).click();
    await shot('canjes-empty');
    expect(unexpected).toEqual([]);
  });
}

for (const width of [390, 1440]) {
  for (const scenario of ['loading', 'error', 'unavailable'] as const) {
    test(`${scenario} evidence ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const unexpected = await reportsFixture(page, scenario);
      if (phase === 'before' && scenario !== 'unavailable') await expect(page.locator('.gamount')).toHaveText('$ 0');
      if (phase !== 'before' && scenario === 'loading') await expect(page.locator('.reports-screen')).toContainText('Cargando reporte');
      if (phase !== 'before' && scenario === 'error') await expect(page.getByRole('heading', { name: 'No se pudo cargar el reporte' })).toBeVisible();
      if (scenario === 'unavailable') await expect(page.locator('.gamount')).toHaveText('—');
      await page.screenshot({ path: `docs/issue-451/${phase}-${scenario}-${width}.png`, animations: 'disabled' });
      expect(unexpected).toEqual([]);
    });
  }
  test(`delta states evidence ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/e2e/451-deltas.html');
    await expect(page.getByRole('heading', { name: 'Variación vs período anterior' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/issue-451/after-deltas-${width}.png`, animations: 'disabled' });
    if (width === 390) {
      await page.getByText('Variación pequeña', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `docs/issue-451/after-deltas-lower-${width}.png`, animations: 'disabled' });
    }
  });
}

for (const width of [390, 1440]) {
  test(`signed commission evidence ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const unexpected = await reportsFixture(page, 'negative');
    await page.getByRole('group', { name: 'Tipo de reporte' }).getByRole('button', { name: 'Comisiones', exact: true }).click();
    await expect(page.locator('.report-signed')).toContainText('-15.550');
    await expect(page.locator('.gdonut')).toHaveCount(0);
    if (width === 390) await page.locator('.report-signed').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `docs/issue-451/after-comisiones-signed-${width}.png`, animations: 'disabled' });
    expect(unexpected).toEqual([]);
  });
}
