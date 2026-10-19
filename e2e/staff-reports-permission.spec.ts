import { expect, test, type Page } from '@playwright/test';
import {
  acceptInvitationViaApi,
  bootstrapStoreViaApi,
  buildTestEmail,
  createInvitationViaApi,
  loginViaUi,
} from './utils';

const SHOTS = process.env.STAFF_REPORTS_SHOTS?.trim();

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

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test('an employee sees reportes on desktop and phone only after the switch is on', async ({ page, request, browser }, testInfo) => {
  test.setTimeout(180_000);
  const ownerEmail = buildTestEmail(testInfo, 'reports-grant-owner');
  const staffEmail = buildTestEmail(testInfo, 'reports-grant-staff');
  const store = `Reportes permiso ${testInfo.parallelIndex}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDollar(page);
  await bootstrapStoreViaApi(page, request, ownerEmail, store);
  const invitation = await createInvitationViaApi(request, ownerEmail, 'STAFF', staffEmail);
  await acceptInvitationViaApi(request, staffEmail, invitation.token);

  await page.getByTestId('sidebar-tab-settings').click();
  await page.getByTestId('settings-screen').getByRole('button', { name: /Empleado/ }).click();
  const reports = page.getByRole('switch', { name: 'Reportes' });
  await expect(page.locator('.team-permissions h1')).toBeVisible();
  await expect(reports).not.toBeChecked();
  await expect(reports).toBeEnabled();
  await expect(page.getByRole('switch', { name: 'Ventas' })).toBeChecked();
  await expect(page.locator('.side')).toBeVisible();
  await expect(page.getByTestId('mobile-tab-bar')).toHaveCount(0);
  await shot(page, 'permissions-1440-off');

  await reports.click();
  await expect(reports).toBeChecked();
  await expect(reports.locator('xpath=ancestor::div[contains(@class,"perm")][1]')).toContainText('Puede ver esta sección');
  await shot(page, 'permissions-1440-on');
  await page.getByRole('button', { name: 'Guardar permisos' }).click();
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
  await page.getByTestId('settings-screen').getByRole('button', { name: /Empleado/ }).click();
  await expect(page.getByRole('switch', { name: 'Reportes' })).toBeChecked();

  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const staffDesk = await desk.newPage();
  try {
    await mockDollar(staffDesk);
    await loginViaUi(staffDesk, staffEmail);
    await expect(staffDesk.getByTestId('sidebar-tab-reports')).toBeVisible();
    await expect(staffDesk.locator('.side')).toBeVisible();
    await staffDesk.getByTestId('sidebar-tab-reports').click();
    await expect(staffDesk.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(staffDesk).toHaveURL(/#\/rep/);
    await shot(staffDesk, 'reports-1440');
  } finally {
    await desk.close();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const permissions = page.locator('.team-permissions h1');
  const more = page.getByTestId('sidebar-tab-more');
  const onPermissions = await permissions.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
  if (!onPermissions) {
    await expect(more).toBeVisible();
    await more.click();
    await page.getByTestId('sidebar-tab-settings').click();
    await page.getByTestId('settings-screen').getByRole('button', { name: /Empleado/ }).click();
  }
  await expect(permissions).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Reportes' })).toBeChecked();
  await expect(page.getByTestId('permissions-save')).toBeVisible();
  await expect(page.getByTestId('mobile-tab-bar')).toBeHidden();
  await shot(page, 'permissions-390-on');

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staffPhone = await phone.newPage();
  try {
    await mockDollar(staffPhone);
    await loginViaUi(staffPhone, staffEmail);
    const bar = staffPhone.getByTestId('mobile-tab-bar');
    await expect(bar).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-reports')).toBeVisible();
    await expect(staffPhone.locator('.side')).toHaveCount(0);
    await bar.getByTestId('sidebar-tab-reports').click();
    await expect(staffPhone.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(staffPhone).toHaveURL(/#\/rep/);
    await shot(staffPhone, 'reports-390');
  } finally {
    await phone.close();
  }
});
