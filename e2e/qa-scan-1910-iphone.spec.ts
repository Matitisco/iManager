import { devices, expect, test } from '@playwright/test';
import { bootStore, registerScanQa } from './qa-scan-1910';

const { defaultBrowserType: _browser, ...iphone } = devices['iPhone 13'];

test.use({
  ...iphone,
  browserName: 'webkit',
  viewport: { width: 390, height: 844 },
});

registerScanQa(390);

test('barra, Más y redirecciones en el iPhone', async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  await bootStore(page, request, testInfo, 'nav-390');
  await expect(page.getByTestId('sidebar-tab-dashboard')).toBeVisible();
  await expect(page.getByTestId('sidebar-tab-sales')).toBeVisible();
  await expect(page.getByTestId('sidebar-tab-inventory')).toBeVisible();
  await expect(page.getByTestId('sidebar-tab-clients')).toBeVisible();
  await expect(page.getByTestId('sidebar-tab-more')).toBeVisible();
  await page.getByTestId('sidebar-tab-more').click();
  await expect(page.getByRole('heading', { name: 'Más', level: 1 })).toBeVisible();
  await expect(page.getByTestId('sidebar-tab-followups')).toBeVisible();
  await expect(page.getByTestId('sidebar-tab-returns')).toBeVisible();
  await expect(page.getByTestId('sidebar-tab-stockCount')).toBeVisible();
  await page.getByTestId('sidebar-tab-followups').click();
  await expect(page.getByRole('heading', { name: 'Seguimientos', level: 1 })).toBeVisible();
  await expect(page.getByTestId('group-tab-clients')).toBeVisible();
  await page.goto('/#/gastos');
  await expect(page).toHaveURL(/#\/finanzas\/gastos$/);
  await expect(page.getByRole('heading', { name: 'Gastos', level: 1 })).toBeVisible();
  await page.goto('/#/devoluciones');
  await expect(page).toHaveURL(/#\/comercial\/devoluciones$/);
  await expect(page.getByRole('heading', { name: 'Devoluciones', level: 1 })).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(wide).toBe(false);
  await page.screenshot({ path: 'docs/pr-shots/qa-1910-mas-390.png', animations: 'disabled' });
});
