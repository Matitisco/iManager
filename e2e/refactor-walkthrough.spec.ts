import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  acceptInvitationViaApi,
  buildTestEmail,
  createClientViaApi,
  createInvitationViaApi,
  createInventoryItemViaApi,
  createRepairViaApi,
  createSaleViaApi,
  loginViaUi,
} from './utils';

const OUT = process.env.REFACTOR_WALKTHROUGH_SHOTS?.trim();

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
  if (!OUT) return;
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

async function openSection(page: Page, id: string) {
  const tab = page.getByTestId(`sidebar-tab-${id}`);
  if (!(await tab.isVisible())) {
    await page.getByTestId('sidebar-tab-more').click();
  }
  await tab.click();
}

async function closeDialog(page: Page) {
  const dialog = page.getByRole('dialog').last();
  const close = dialog.getByRole('button', { name: /^(Cerrar|Cancelar|Listo)$/ });
  await close.first().click();
  await expect(dialog).toBeHidden();
}

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'phone-390', width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('recorre los flujos y deja capturas', async ({ page, request }, testInfo) => {
      test.setTimeout(180_000);
      const phone = viewport.width < 700;
      const email = buildTestEmail(testInfo, viewport.name);
      const staffEmail = buildTestEmail(testInfo, `${viewport.name}-staff`);
      const storeName = `Tienda ${viewport.name}`;
      const prefix = viewport.name;
      await mockDollar(page);

      await page.goto('/');
      await expect(page.getByTestId('login-email')).toBeVisible();
      await shot(page, `${prefix}-01-login.png`);

      await loginViaUi(page, email);
      await expect(page.getByTestId('onboarding-store-name')).toBeVisible();
      await shot(page, `${prefix}-02-onboarding.png`);
      await page.getByTestId('onboarding-store-name').fill(storeName);
      await page.getByText('Moneda y dólar').click();
      await page.getByTestId('onboarding-currency').selectOption('ARS');
      const onboardingRequest = page.waitForResponse(
        (response) => response.url().includes('/api/onboarding') && response.request().method() === 'POST' && response.ok(),
      );
      await page.getByTestId('onboarding-submit').click({ noWaitAfter: true });
      await onboardingRequest;
      for (let step = 0; step < 2; step++) await page.getByRole('button', { name: 'Saltar por ahora' }).click();
      await expect(page.getByTestId('sidebar-tab-dashboard')).toBeVisible();

      await createInventoryItemViaApi(request, email, {
        imei: '350000000000111',
        model: 'iPhone 13',
        color: 'Medianoche',
        price: 890000,
        cost: 620000,
      });
      const client = await createClientViaApi(request, email, { name: 'Lucía Fernández', phone: '2615550101' });
      await createSaleViaApi(request, email, {
        date: '2026-10-08',
        clientName: 'Lucía Fernández',
        clientId: client.client.id,
        deviceLabel: 'iPhone 13',
        amount: 890000,
      });
      await createRepairViaApi(request, email, {
        clientId: client.client.id,
        clientName: 'Lucía Fernández',
        device: 'iPhone 13',
        fault: 'Pantalla',
        estimate: 45000,
      });
      const staffInvite = await createInvitationViaApi(request, email, 'STAFF');
      await acceptInvitationViaApi(request, staffEmail, staffInvite.token);
      await createInvitationViaApi(request, email, 'MANAGER', 'socio@imanager.test');
      await page.reload();
      await expect(page.getByTestId('sidebar-tab-dashboard')).toBeVisible();
      await shot(page, `${prefix}-03-dashboard.png`);

      await openSection(page, 'inventory');
      await expect(page.getByRole('heading', { level: 1, name: 'Inventario' })).toBeVisible();
      await expect(page.getByText('iPhone 13').first()).toBeVisible();
      await shot(page, `${prefix}-04-inventario.png`);
      if (phone) {
        await page.getByRole('button', { name: 'Filtros' }).click();
        await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible();
        await shot(page, `${prefix}-05-inventario-filtros.png`);
        await closeDialog(page);
        await page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' }).click();
      } else {
        await page.getByRole('button', { name: 'Disponible' }).click();
        await expect(page.getByText('iPhone 13').first()).toBeVisible();
        await shot(page, `${prefix}-05-inventario-filtros.png`);
        await page.getByRole('button', { name: 'Todos' }).click();
        await page.getByRole('button', { name: 'Importar' }).click();
      }
      await expect(page.getByText('Importar equipos').first()).toBeVisible();
      await shot(page, `${prefix}-06-inventario-importar.png`);
      if (phone) {
        await closeDialog(page);
      } else {
        const overlay = page.locator('.fixed.inset-0').filter({ hasText: 'Importar equipos' });
        await overlay.click({ position: { x: 8, y: 8 } });
        await expect(overlay).toBeHidden();
      }

      await openSection(page, 'sales');
      await expect(page.getByRole('heading', { level: 1, name: 'Ventas' })).toBeVisible();
      await shot(page, `${prefix}-07-ventas.png`);
      const openSale = phone
        ? page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar venta' })
        : page.getByRole('button', { name: 'Registrar venta' });
      await openSale.click();
      const sale = page.getByRole('dialog', { name: 'Registrar venta' });
      await sale.getByRole('combobox', { name: 'Equipo' }).fill('Galaxy no listado');
      await expect(sale.getByTestId('unlisted-equipment')).toBeVisible();
      await shot(page, `${prefix}-08-venta-equipo-no-registrado.png`);
      if (phone) {
        const fold = sale.getByTestId('sale-trade-fold');
        await fold.locator('summary').click();
        await fold.getByRole('checkbox', { name: 'Tiene canje' }).check();
      } else {
        await sale.getByRole('checkbox', { name: 'Tiene canje' }).check();
      }
      const withTrade = page.getByRole('dialog', { name: 'Nuevo canje' });
      await expect(withTrade.getByLabel('Equipo recibido')).toBeVisible();
      await shot(page, `${prefix}-08b-venta-con-canje.png`);
      await closeDialog(page);

      await openSection(page, 'tradeins');
      await expect(page.getByRole('heading', { level: 1, name: 'Canjes' })).toBeVisible();
      await shot(page, `${prefix}-09-canjes.png`);
      const openTrade = phone
        ? page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo canje' })
        : page.getByRole('button', { name: 'Nuevo canje' });
      await openTrade.click();
      await expect(page.getByRole('dialog', { name: 'Nuevo canje' })).toBeVisible();
      await shot(page, `${prefix}-10-canje-nuevo.png`);
      await closeDialog(page);

      await openSection(page, 'clients');
      await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
      await expect(page.getByText('Lucía Fernández').first()).toBeVisible();
      await shot(page, `${prefix}-11-clientes.png`);

      await openSection(page, 'service');
      await expect(page.getByRole('heading', { level: 1, name: 'Servicio técnico' })).toBeVisible();
      await shot(page, `${prefix}-12-servicio.png`);
      if (phone) {
        await page.locator('[data-testid^="repair-card-"]').click();
        const detail = page.getByRole('dialog').last();
        await detail.getByRole('button', { name: 'Pasar a En reparación' }).click();
        await expect(page.getByTestId('repair-group-EN_REPARACION')).toContainText('#OT-0001');
        await shot(page, `${prefix}-13-servicio-estado.png`);
        await closeDialog(page);
      } else {
        const card = page.getByTestId('repair-column-RECIBIDO').locator('[data-testid^="repair-card-"]');
        await card.dragTo(page.getByTestId('repair-column-EN_REPARACION'), { targetPosition: { x: 40, y: 80 } });
        await expect(page.getByTestId('repair-column-EN_REPARACION')).toContainText('#OT-0001');
        await shot(page, `${prefix}-13-servicio-drag.png`);
      }

      await openSection(page, 'reports');
      await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible();
      await shot(page, `${prefix}-14-reportes.png`);

      await openSection(page, 'settings');
      await expect(page.getByTestId('settings-screen')).toBeVisible();
      await shot(page, `${prefix}-15-configuracion.png`);
      await page.getByRole('button', { name: storeName }).click();
      const store = page.getByRole('dialog', { name: 'Tienda' });
      await expect(store.getByTestId('store-currency')).toBeVisible();
      await expect(store.getByTestId('store-exchange-mode')).toBeVisible();
      await shot(page, `${prefix}-15b-moneda-dolar.png`);
      await closeDialog(page);

      await expect(page.getByTestId('blue-widget')).toHaveAttribute('data-state', 'ready');
      await page.getByTestId('blue-widget').getByRole('button').first().click();
      await expect(page.getByTestId('blue-overlay')).toBeVisible();
      await shot(page, `${prefix}-15c-cotizacion.png`);
      await page.getByTestId('blue-done').click();
      await expect(page.getByTestId('blue-overlay')).toBeHidden();

      await page.getByTestId('settings-invite').click();
      const invite = page.getByRole('dialog', { name: 'Invitá a tu equipo' });
      await invite.getByTestId('invite-copy').click();
      await expect(invite.getByTestId('invite-url')).not.toHaveText('');
      const inviteUrl = await invite.getByTestId('invite-url').innerText();
      await shot(page, `${prefix}-16-invitacion.png`);
      await page.keyboard.press('Escape');
      await expect(invite).toBeHidden();
      await expect(page.getByTestId('settings-invites')).toBeVisible();
      const share = page.getByTestId('settings-invites').getByRole('link', { name: 'Compartir por WhatsApp' })
        .and(page.locator(`a[href*="${encodeURIComponent(inviteUrl)}"]`));
      await expect(share).toBeVisible();
      await expect(share).toHaveAttribute('href', `https://wa.me/?text=${encodeURIComponent(`Sumate al equipo de ${storeName}: ${inviteUrl}`)}`);
      await shot(page, `${prefix}-17-invitaciones.png`);

      await page.locator('[data-testid^="settings-member-"]').filter({ hasText: 'Empleado' }).click();
      await expect(page.locator('.team-permissions h1')).toBeVisible();
      await expect(page.getByRole('switch', { name: 'Inventario' })).toBeVisible();
      await shot(page, `${prefix}-18-permisos.png`);
    });
  });
}
