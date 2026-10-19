import { expect, test } from '@playwright/test';
import { acceptInvitationViaApi, authHeaders, bootstrapStoreViaApi, buildTestEmail, createInvitationViaApi, loginViaUi } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3100';
for (const width of [390, 1440]) {
  test(`team, permissions and invitation screens at ${width}px`, async ({ page, request, browser }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: width === 390 ? 852 : 900 });
    await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1535, venta: 1555, fechaActualizacion: new Date().toISOString() } }));
    const owner = buildTestEmail(info, 'owner');
    const staff = buildTestEmail(info, 'staff');
    await bootstrapStoreViaApi(page, request, owner, 'iPhone Club Palermo');
    await request.patch(`${api}/api/users/me`, { headers: authHeaders(owner), data: { displayName: 'Matías Tiscornia' } });
    const used = await createInvitationViaApi(request, owner, 'STAFF');
    await acceptInvitationViaApi(request, staff, used.token);
    await request.patch(`${api}/api/users/me`, { headers: authHeaders(staff), data: { displayName: 'Lucía Gómez' } });
    const pending = await createInvitationViaApi(request, owner, 'STAFF');
    await page.goto('/#/config');
    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await expect(page.getByTestId('settings-team')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Compartir por WhatsApp' })).toHaveAttribute('href', /wa\.me\/\?text=.*invite/);
    await page.screenshot({ path: `/tmp/issue71-team-${width}.png` });
    await page.getByRole('button', { name: /Lucía Gómez/ }).click();
    if (width === 390) await expect(page.getByTestId('mobile-header')).toBeVisible();
    await page.getByRole('button', { name: 'Técnico', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Servicio técnico' })).toBeChecked();
    await expect(page.getByRole('switch', { name: 'Ventas', exact: true })).not.toBeChecked();
    await expect(page.getByRole('switch', { name: 'Ver saldo de cajas' })).toBeDisabled();
    await page.screenshot({ path: `/tmp/issue71-permissions-${width}.png` });
    await page.getByRole('button', { name: width === 390 ? 'Guardar' : 'Guardar permisos', exact: true }).click();
    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await page.evaluate(() => { window.location.hash = '#/dash'; });
    await page.evaluate(() => { window.location.hash = '#/config'; });
    await page.evaluate(() => { window.location.hash = '#/config/equipo'; });
    await expect(page.getByTestId('team-screen')).toBeVisible();
    await expect(page.getByTestId('page-back')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await expect(page).toHaveURL(/#\/config$/);
    await page.getByRole('button', { name: /Lucía Gómez/ }).click();
    await expect(page).toHaveURL(/#\/config\/equipo\//);
    await page.goBack();
    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await expect(page).not.toHaveURL(/#\/dash/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 852 : 900 } });
    const guest = await context.newPage();
    try {
      await guest.goto(`/invite/${pending.token}`);
      await expect(guest.getByRole('heading', { name: 'Sumate a iPhone Club Palermo' })).toBeVisible();
      await expect(guest.getByText('Matías Tiscornia te invitó al equipo.')).toBeVisible();
      await guest.screenshot({ path: `/tmp/issue71-accept-${width}.png` });
      await request.delete(`${api}/api/invitations/${pending.id}`, { headers: authHeaders(owner) });
      await guest.reload();
      await expect(guest.getByRole('heading', { name: 'Esta invitación ya no sirve' })).toBeVisible();
      await guest.screenshot({ path: `/tmp/issue71-invalid-${width}.png` });
      await guest.getByRole('button', { name: 'Ir a iManager' }).click();
      await loginViaUi(guest, staff);
      await guest.goto('/#/rep');
      await expect(guest.getByTestId('no-section-access')).toBeVisible();
      await expect(guest.getByText('Pedile acceso a Matías Tiscornia')).toBeVisible();
      await expect(guest).toHaveURL(/#\/rep$/);
      await guest.screenshot({ path: `/tmp/issue71-denied-${width}.png` });
      expect(await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally { await context.close(); }
  });
}
