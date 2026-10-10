import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInvitationViaApi, loginViaUi } from './utils';

const SHOTS = process.env.MOBILE_AUTH_SHOTS?.trim();

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function expectFits(page: Page) {
  const report = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - width;
    const outside: string[] = [];
    for (const node of document.body.querySelectorAll('*')) {
      if (!(node instanceof Element)) continue;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const box = node.getBoundingClientRect();
      if (box.width < 1 && box.height < 1) continue;
      if (box.left < -1 || box.right > width + 1) {
        const label = node.getAttribute('data-testid') || (typeof node.className === 'string' ? node.className : node.tagName);
        outside.push(`${String(label).slice(0, 80)} [${Math.round(box.left)}…${Math.round(box.right)}]`);
        if (outside.length >= 8) break;
      }
    }
    return { extra, outside };
  });
  expect(report.outside).toEqual([]);
  expect(report.extra).toBeLessThanOrEqual(1);
}

async function expectInViewport(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  const viewport = page.viewportSize();
  expect(box, testId).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
}

async function clearSession(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

test.describe('desktop auth stays put', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('keeps the split screen and the black actions', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /El control total de tu negocio/ })).toBeVisible();
    await expect(page.getByTestId('forgot-password')).toBeVisible();
    const submitColor = await page.getByTestId('login-submit').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(submitColor).toBe('rgb(0, 0, 0)');
    const footer = await page.getByTestId('auth-footer').evaluate((el) => getComputedStyle(el).position);
    expect(footer).toBe('static');

    const email = buildTestEmail(testInfo, 'auth-desk');
    await loginViaUi(page, email);
    await expect(page.getByTestId('onboarding-currency')).toBeVisible();
    await expect(page.getByTestId('onboarding-exchange-mode')).toBeVisible();
    await expect(page.getByTestId('onboarding-exchange-source')).toBeVisible();
    await expect(page.getByTestId('onboarding-store-name')).toHaveValue('');
    const cardDisplay = await page.locator('.onb-card').evaluate((el) => getComputedStyle(el).display);
    expect(cardDisplay).toBe('block');
    const onboardingColor = await page.getByTestId('onboarding-submit').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(onboardingColor).toBe('rgb(0, 0, 0)');
  });
});

test.describe('phone login, invite and onboarding', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('pins the login actions and keeps recovery on a short screen', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('forgot-password')).toBeVisible();
    const yellow = await page.getByTestId('login-submit').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(yellow).toBe('rgb(255, 208, 0)');
    const logo = await page.locator('div.lg\\:hidden > div').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(logo).toBe('rgb(255, 208, 0)');

    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectFits(page);
      await expectInViewport(page, 'login-submit');
      await expectInViewport(page, 'login-google');
      if (width === 390) await shot(page, 'm10-login-390');
    }

    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByPlaceholder('Confirmar contraseña')).toBeVisible();
    await expect(page.getByTestId('forgot-password')).toHaveCount(0);
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectFits(page);
      await expectInViewport(page, 'login-submit');
      if (width === 390) await shot(page, 'm10-registro-390');
    }

    await page.getByTestId('login-email').fill('nuevo@ejemplo.com');
    await page.getByTestId('login-password').fill('secret123');
    await page.getByPlaceholder('Confirmar contraseña').fill('otra-clave');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toHaveText(/no coinciden/i);
    await expectFits(page);
    await shot(page, 'm10-registro-error-390');

    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.getByTestId('login-email').fill('nadie@ejemplo.com');
    await page.getByTestId('login-password').fill('wrong-password');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toHaveText(/incorrectos/i);
    await expectInViewport(page, 'login-submit');
    await expectFits(page);
    await shot(page, 'm10-login-error-390');

    await page.setViewportSize({ width: 390, height: 520 });
    await expectInViewport(page, 'login-submit');
    await expectInViewport(page, 'login-google');
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeVisible();
    const before = await page.getByTestId('login-submit').boundingBox();
    await page.getByTestId('auth-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const after = await page.getByTestId('login-submit').boundingBox();
    expect(after?.y).toBe(before?.y);
    await expectFits(page);

    await page.setViewportSize({ width: 360, height: 844 });
    await page.getByTestId('forgot-password').click();
    await expect(page.getByRole('dialog', { name: /olvidaste tu contraseña/i })).toBeVisible();
    await page.getByTestId('password-reset-submit').scrollIntoViewIfNeeded();
    await expectInViewport(page, 'password-reset-submit');
    await expectFits(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectInViewport(page, 'password-reset-submit');
    await shot(page, 'm10-olvide-390');
    await page.setViewportSize({ width: 390, height: 480 });
    await page.getByTestId('password-reset-submit').scrollIntoViewIfNeeded();
    await expectInViewport(page, 'password-reset-email');
    await expectInViewport(page, 'password-reset-submit');
  });

  test('shows the invitation banners without sideways scroll', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    const owner = buildTestEmail(testInfo, 'auth-invite-owner');
    await bootstrapStoreViaApi(page, request, owner, 'Tienda Ejemplo');
    const invitation = await createInvitationViaApi(request, owner, 'MANAGER');
    await clearSession(page);

    let releasePreview: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releasePreview = resolve;
    });
    await page.route('**/api/invitations/preview/**', async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto(`/invite/${invitation.token}`);
    await expect(page.getByTestId('login-invite-banner')).toContainText('Verificando invitación');
    await expectFits(page);
    await shot(page, 'm10-login-invitacion-verificando-390');
    releasePreview?.();
    await expect(page.getByTestId('login-invite-banner')).toContainText('Tienda Ejemplo');
    await expect(page.getByTestId('login-invite-banner')).toContainText('Socio');
    await expect(page.getByTestId('login-submit')).toBeVisible();
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectFits(page);
      await expectInViewport(page, 'login-submit');
      if (width === 390) await shot(page, 'm10-login-invitacion-390');
    }

    await page.unroute('**/api/invitations/preview/**');
    await page.route('**/api/invitations/preview/**', (route) => route.fulfill({ status: 400, body: '{}' }));
    await clearSession(page);
    await page.goto('/invite/caido');
    await expect(page.getByTestId('login-invite-banner')).toContainText('No pudimos verificar la invitación todavía');
    await expectFits(page);
    await expectInViewport(page, 'login-submit');
    await shot(page, 'm10-login-invitacion-error-390');

    await page.unroute('**/api/invitations/preview/**');
    await page.goto(`/invite/vencida-${Date.now()}`);
    await expect(page.getByTestId('login-invite-banner')).toContainText('ya no está disponible');
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectFits(page);
      await expectInViewport(page, 'login-google');
      if (width === 390) await shot(page, 'm10-login-invitacion-no-disponible-390');
    }
  });

  test('keeps currency, dollar source and the onboarding action on screen', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    const email = buildTestEmail(testInfo, 'auth-onb');
    await loginViaUi(page, email);
    await expect(page.getByTestId('onboarding-currency')).toBeVisible();
    await expect(page.getByTestId('onboarding-exchange-mode')).toBeVisible();
    await expect(page.getByTestId('onboarding-exchange-source')).toBeVisible();
    await expect(page.getByTestId('onboarding-store-name')).toHaveValue('');
    const yellow = await page.getByTestId('onboarding-submit').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(yellow).toBe('rgb(255, 208, 0)');

    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectFits(page);
      await expectInViewport(page, 'onboarding-submit');
      if (width === 390) await shot(page, 'm10-onboarding-390');
    }

    await page.getByTestId('onboarding-exchange-mode').selectOption('manual');
    await expect(page.getByTestId('onboarding-manual-buy')).toBeVisible();
    await expect(page.getByTestId('onboarding-manual-sell')).toBeVisible();
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectFits(page);
      await expectInViewport(page, 'onboarding-submit');
      if (width === 390) await shot(page, 'm10-onboarding-manual-390');
    }

    await page.setViewportSize({ width: 390, height: 520 });
    await page.getByTestId('onboarding-store-name').focus();
    await expectInViewport(page, 'onboarding-submit');
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    await expectFits(page);
    await page.setViewportSize({ width: 360, height: 520 });
    await expectInViewport(page, 'onboarding-submit');
    await expectFits(page);

    await clearSession(page);
    const owner = buildTestEmail(testInfo, 'auth-onb-owner');
    await bootstrapStoreViaApi(page, request, owner, 'Tienda Norte');
    const invitation = await createInvitationViaApi(request, owner, 'STAFF');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/invite/${invitation.token}`);
    await expect(page.getByTestId('store-invite-modal')).toContainText('Tienda Norte');
    await expect(page.getByTestId('store-invite-modal')).toContainText('Empleado');
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectFits(page);
      await expect(page.getByRole('button', { name: 'Aceptar invitación' })).toBeVisible();
    }

    await clearSession(page);
    let releaseOnboarding: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseOnboarding = resolve;
    });
    await page.route('**/api/invitations/preview/**', async (route) => {
      await gate;
      await route.continue();
    });
    const guest = buildTestEmail(testInfo, 'auth-onb-guest');
    await loginViaUi(page, guest);
    await page.goto(`/invite/${invitation.token}`);
    await expect(page.getByText('Verificando invitación…')).toBeVisible();
    await expectFits(page);
    await shot(page, 'm10-onboarding-verificando-390');
    releaseOnboarding?.();
    await expect(page.getByRole('button', { name: /Unirme a Tienda Norte/ })).toBeVisible();
    await expect(page.getByText('Empleado')).toBeVisible();
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expectFits(page);
      await expectInViewport(page, 'onboarding-dock');
      if (width === 390) await shot(page, 'm10-onboarding-invitacion-390');
    }

    await page.unroute('**/api/invitations/preview/**');
    await page.route('**/api/invitations/preview/**', (route) => route.fulfill({ status: 400, body: '{}' }));
    await page.goto('/invite/onboarding-error');
    await expect(page.getByRole('heading', { name: 'No pudimos verificar la invitación todavía' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar verificación' })).toBeVisible();
    await expectFits(page);
    await expectInViewport(page, 'onboarding-dock');
    await shot(page, 'm10-onboarding-error-390');

    await page.unroute('**/api/invitations/preview/**');
    await page.goto(`/invite/onboarding-vencida-${Date.now()}`);
    await expect(page.getByRole('heading', { name: 'Invitación inválida' })).toBeVisible();
    await expect(page.getByTestId('onboarding-currency')).toBeVisible();
    await expect(page.getByTestId('onboarding-exchange-source')).toBeVisible();
    await expect(page.getByTestId('onboarding-submit')).toBeVisible();
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 640 });
      await expectFits(page);
      await expectInViewport(page, 'onboarding-submit');
      if (width === 390) await shot(page, 'm10-onboarding-invalida-390');
    }
  });
});
