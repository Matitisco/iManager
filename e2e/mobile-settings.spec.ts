import { expect, test, type Page } from '@playwright/test';
import {
  acceptInvitationViaApi,
  bootstrapStoreViaApi,
  buildTestEmail,
  createInvitationViaApi,
} from './utils';

const SHOTS = process.env.MOBILE_SETTINGS_SHOTS?.trim();

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

async function settleMotion(page: Page, selector: string) {
  const target = page.locator(selector).first();
  if (await target.count() === 0) return;
  await target.evaluate(async (node) => {
    const animations = node.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function expectFits(page: Page) {
  const report = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - width;
    const outside: string[] = [];
    const roots = ['.mhead', '.mtab', '.stage', '.phone-save', '.ov', '.sheet', '.dialog'].flatMap((selector) => [...document.querySelectorAll(selector)]);
    for (const root of roots) {
      const nodes = [root, ...root.querySelectorAll('*')];
      for (const node of nodes) {
        if (!(node instanceof Element) || node.closest('.toast')) continue;
        const box = node.getBoundingClientRect();
        if (box.width < 1 && box.height < 1) continue;
        if (box.left < -1 || box.right > width + 1) {
          const label = node.getAttribute('data-testid') || node.getAttribute('aria-label') || (typeof node.className === 'string' ? node.className : node.tagName);
          outside.push(`${String(label).slice(0, 70)} [${Math.round(box.left)}…${Math.round(box.right)}]`);
          if (outside.length >= 8) return { extra, outside };
        }
      }
    }
    return { extra, outside };
  });
  expect(report.outside).toEqual([]);
  expect(report.extra).toBeLessThanOrEqual(1);
}

async function openSettings(page: Page) {
  await page.getByTestId('sidebar-tab-more').click();
  await page.getByTestId('sidebar-tab-settings').click();
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
}

test.describe('desktop settings stays put', () => {
  test('keeps the store editor, profile and permissions on the page', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'settings-desk');
    const store = `Config desk ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, store);
    await page.getByTestId('sidebar-tab-settings').click();

    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-bar')).toHaveCount(0);
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByTestId('settings-store')).toContainText('Tienda');
    await expect(page.getByTestId('settings-team')).toContainText('Equipo');
    await expect(page.getByTestId('settings-account')).toContainText('Mi cuenta');
    await expect(page.getByTestId('settings-logout')).toContainText('Cerrar sesión');
    await expect(page.getByRole('button', { name: 'Perfil' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cambiar contraseña/ })).toBeVisible();

    await page.getByRole('button', { name: store }).click();
    const editor = page.getByRole('dialog', { name: 'Datos de la tienda' });
    await expect(editor).toBeVisible();
    await expect(editor.locator('.sheet-grab')).toHaveCount(0);
    await expect(editor.getByText('Moneda y dólar')).toHaveCount(0);
    await expect(editor.getByTestId('store-currency')).toBeVisible();
    await expect(editor.getByTestId('store-exchange-mode')).toBeVisible();
    await expect(editor.getByTestId('store-exchange-source')).toBeVisible();
    await editor.getByRole('button', { name: 'Cancelar' }).click();
    await expect(editor).toBeHidden();

    await page.getByRole('button', { name: 'Perfil' }).click();
    const profile = page.getByRole('dialog', { name: 'Perfil' });
    await expect(profile.locator('.cfg-who')).toHaveCount(0);
    await expect(profile.getByLabel('Rol')).toHaveCount(0);
    await expect(profile.getByLabel('Nombre')).toBeVisible();
    await profile.getByRole('button', { name: 'Cancelar' }).click();

    await page.getByTestId('settings-screen').getByRole('button', { name: /Propietario/ }).click();
    await expect(page.getByRole('heading', { name: 'Permisos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible();
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByTestId('permissions-save')).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Acciones sensibles' })).toBeDisabled();
  });
});

test.describe('settings on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('edits the store, profile, invite link and member permissions inside the screen', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    const email = buildTestEmail(testInfo, 'settings-phone');
    const staffEmail = buildTestEmail(testInfo, 'settings-staff');
    const store = `Config ${testInfo.parallelIndex}`;
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, store);
    const joined = await createInvitationViaApi(request, email, 'STAFF');
    await acceptInvitationViaApi(request, staffEmail, joined.token);
    await createInvitationViaApi(request, email, 'MANAGER');
    await openSettings(page);

    await expect(page.getByTestId('page-back')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();
    await expect(page.getByTestId('settings-store')).toContainText('Tienda');
    await expect(page.getByTestId('settings-team')).toContainText('2 miembros');
    await expect(page.getByTestId('settings-invites')).toContainText('1 link de invitación activo');
    await expect(page.getByTestId('settings-account')).toContainText('Mi cuenta');
    await expect(page.getByTestId('settings-logout')).toContainText('Cerrar sesión');
    await expect(page.getByRole('button', { name: /Cambiar contraseña/ })).toBeVisible();
    await settleMotion(page, '.enter-f');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-390.png` });

    await page.getByRole('button', { name: store }).click();
    const editor = page.getByRole('dialog', { name: 'Tienda' });
    await expect(editor.locator('.sheet-grab')).toBeVisible();
    await expect(editor.getByText('Configuración')).toBeVisible();
    await expect(editor.getByText('Información de la tienda')).toBeVisible();
    await expect(editor.getByText('Moneda y dólar')).toBeVisible();
    await expect(editor.getByLabel('Nombre')).toBeVisible();
    await expect(editor.getByLabel('CUIT')).toBeVisible();
    await expect(editor.getByLabel('Dirección')).toBeVisible();
    await expect(editor.getByLabel('Teléfono')).toBeVisible();
    await expect(editor.getByLabel('Correo electrónico')).toBeVisible();
    await expect(editor.getByLabel('Instagram')).toBeVisible();
    await expect(editor.getByTestId('store-currency')).toBeVisible();
    await expect(editor.getByTestId('store-exchange-mode')).toBeVisible();
    await expect(editor.getByTestId('store-exchange-source')).toBeVisible();
    const foot = editor.locator('.sheet-foot');
    await expect(foot.getByRole('button', { name: 'Guardar' })).toBeVisible();
    await expect(foot.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    const footBox = await foot.boundingBox();
    const tabBox = await page.getByTestId('mobile-tab-bar').boundingBox();
    expect(footBox && tabBox && footBox.y + footBox.height <= tabBox.y + 1).toBeTruthy();
    await editor.getByTestId('store-currency').selectOption('USD');
    await editor.getByTestId('store-exchange-mode').selectOption('manual');
    await editor.getByTestId('store-manual-buy').fill('1200');
    await editor.getByTestId('store-manual-sell').fill('1250');
    await editor.getByTestId('store-manual-sell').scrollIntoViewIfNeeded();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-390-tienda.png` });
    await foot.getByRole('button', { name: 'Guardar' }).click();
    await expect(editor).toBeHidden();
    await expect(page.locator('.toast.show')).toContainText('Tienda actualizada');

    await page.getByRole('button', { name: store }).click();
    const savedStore = page.getByRole('dialog', { name: 'Tienda' });
    await expect(savedStore.getByTestId('store-currency')).toHaveValue('USD');
    await expect(savedStore.getByTestId('store-exchange-mode')).toHaveValue('manual');
    await expect(savedStore.getByTestId('store-manual-buy')).not.toHaveValue('');
    await expect(savedStore.getByTestId('store-manual-sell')).not.toHaveValue('');
    await savedStore.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByRole('button', { name: 'Perfil' }).click();
    const profile = page.getByRole('dialog', { name: 'Perfil' });
    await expect(profile.locator('.cfg-who')).toBeVisible();
    await expect(profile.getByLabel('Rol')).toHaveValue('Propietario');
    await expect(profile.getByLabel('Email')).toBeDisabled();
    await profile.getByLabel('Nombre').fill('Ana Dueña');
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-390-perfil.png` });
    await profile.locator('.sheet-foot').getByRole('button', { name: 'Guardar' }).click();
    await expect(profile).toBeHidden();
    await expect(page.getByRole('button', { name: /Ana Dueña/ })).toBeVisible();

    await page.getByRole('button', { name: /Cambiar contraseña/ }).click();
    const password = page.getByRole('dialog', { name: 'Cambiar contraseña' });
    await expect(password.getByLabel('Contraseña actual')).toBeVisible();
    await expect(password.getByLabel('Nueva contraseña')).toBeVisible();
    await expect(password.getByLabel('Repetir nueva')).toBeVisible();
    await expect(password.locator('.sheet-foot').getByRole('button', { name: 'Actualizar' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-390-clave.png` });
    await password.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByTestId('settings-invites').click();
    const links = page.getByRole('dialog', { name: 'Links de invitación' });
    await expect(links.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await expect(links.locator('.sheet-foot').getByRole('button', { name: 'Listo' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-390-links.png` });
    await links.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.toast.show')).toContainText('Invitación cancelada');
    await links.locator('.sheet-foot').getByRole('button', { name: 'Listo' }).click();
    await expect(page.getByTestId('settings-invites')).toHaveCount(0);

    await page.getByTestId('settings-invite').click();
    const invite = page.getByRole('dialog', { name: 'Invitar al equipo' });
    await expect(invite.getByRole('button', { name: 'Empleado' })).toBeVisible();
    await invite.getByRole('button', { name: 'Socio' }).click();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-390-invitar.png` });
    await invite.locator('.sheet-foot').getByRole('button', { name: 'Generar link' }).click();
    const ready = page.getByRole('dialog', { name: 'Link listo' });
    await expect(ready.locator('.linkrow span')).not.toHaveText('');
    await ready.getByTestId('invite-copy').click();
    await expect(ready.getByTestId('invite-copy')).toHaveText('Copiado');
    await expect(page.locator('.toast.show')).toContainText('Link copiado');
    await expect(ready.locator('.sheet-foot').getByTestId('invite-share')).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-390-link.png` });
    await ready.locator('.sheet-foot').getByRole('button', { name: 'Listo' }).click();
    await expect(page.getByTestId('settings-invites')).toContainText('1 link de invitación activo');

    await page.getByTestId('settings-screen').getByRole('button', { name: /Empleado/ }).click();
    await expect(page.getByRole('heading', { name: 'Permisos' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Inventario' })).toBeChecked();
    await expect(page.getByRole('switch', { name: 'Acciones sensibles' })).not.toBeChecked();
    await page.getByRole('switch', { name: 'Inventario' }).click();
    await page.getByRole('switch', { name: 'Acciones sensibles' }).click();
    const permissions = page.getByTestId('permissions-save');
    await expect(permissions.getByRole('button', { name: 'Guardar permisos' })).toBeVisible();
    await expect(permissions.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    const saveBox = await permissions.boundingBox();
    const barBox = await page.getByTestId('mobile-tab-bar').boundingBox();
    expect(saveBox && barBox && saveBox.y + saveBox.height <= barBox.y + 1).toBeTruthy();
    await expect(page.locator('.toast.show')).toBeHidden();
    await settleMotion(page, '.enter-f');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-390-permisos.png` });
    await permissions.getByRole('button', { name: 'Guardar permisos' }).click();
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
    await page.getByTestId('settings-screen').getByRole('button', { name: /Empleado/ }).click();
    await expect(page.getByRole('switch', { name: 'Inventario' })).not.toBeChecked();
    await expect(page.getByRole('switch', { name: 'Acciones sensibles' })).toBeChecked();
    await page.getByTestId('page-back').click();
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

    await page.getByTestId('settings-logout').click();
    const logout = page.getByRole('dialog', { name: '¿Cerrar sesión?' });
    await expect(logout.getByText(/email y contraseña/)).toBeVisible();
    await expect(logout.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    await expect(page.locator('.toast.show')).toBeHidden();
    await settleMotion(page, '.dialog');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-390-logout.png` });
    await logout.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

    await page.setViewportSize({ width: 360, height: 800 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const logoutBox = await page.getByTestId('settings-logout').boundingBox();
    const logoutTab = await page.getByTestId('mobile-tab-bar').boundingBox();
    expect(logoutBox && logoutTab && logoutBox.y + logoutBox.height <= logoutTab.y + 1).toBeTruthy();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-360.png` });
    await page.getByRole('button', { name: store }).click();
    const narrow = page.getByRole('dialog', { name: 'Tienda' });
    await narrow.getByTestId('store-exchange-mode').selectOption('manual');
    await expect(narrow.getByTestId('store-manual-buy')).toBeVisible();
    await expect(narrow.getByTestId('store-manual-sell')).toBeVisible();
    await narrow.getByTestId('store-manual-sell').scrollIntoViewIfNeeded();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-360-tienda.png` });
    await narrow.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByTestId('page-back').click();
    await expect(page.getByRole('heading', { name: 'Más' })).toBeVisible();
    await expectFits(page);
  });
});
