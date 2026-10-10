import { expect, test, type Page } from '@playwright/test';
import { buildTestEmail, loginViaUi } from './utils';

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

test('resets the password from a firebase search url and returns to login', async ({ page }) => {
  await page.goto('/?mode=resetPassword&oobCode=valid-code&apiKey=test-key&lang=es');

  await expect(page.getByTestId('auth-action-screen')).toBeVisible();
  await expect(page).toHaveURL(/\/#\/restablecer\?mode=resetPassword&oobCode=valid-code&apiKey=test-key&lang=es$/);
  await expect(page.getByTestId('auth-action-email')).toHaveText('owner@imanager.test');

  const password = page.getByTestId('reset-password');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByTestId('reset-password-toggle').click();
  await expect(password).toHaveAttribute('type', 'text');

  await password.fill('nueva-clave-1');
  await page.getByTestId('reset-password-confirm').fill('otra-clave');
  await page.getByTestId('reset-password-submit').click();
  await expect(page.getByText(/no coinciden/i)).toBeVisible();

  await page.getByTestId('reset-password-confirm').fill('nueva-clave-1');
  await page.getByTestId('reset-password-submit').click();

  await expect(page.getByTestId('login-password-reset-notice')).toHaveText(
    'Tu contraseña se actualizó. Ya podés iniciar sesión.',
  );
  await expect(page.getByTestId('login-email')).toBeVisible();
  await expect(page).not.toHaveURL(/oobCode|mode=resetPassword/);
});

test('reads the code when firebase appends the query inside the hash', async ({ page }) => {
  await page.goto('/#/restablecer?mode=resetPassword&oobCode=valid-code&apiKey=test-key');
  await expect(page.getByTestId('auth-action-email')).toHaveText('owner@imanager.test');
  await expect(page).toHaveURL(/#\/restablecer\?mode=resetPassword&oobCode=valid-code/);
});

test('reads a firebase query even if the hash still points at another route', async ({ page }) => {
  await page.goto('/?mode=resetPassword&oobCode=valid-code&apiKey=test-key#/dash');
  await expect(page.getByTestId('auth-action-email')).toHaveText('owner@imanager.test');
  await expect(page).toHaveURL(/#\/restablecer\?/);
  await expect(page).not.toHaveURL(/#\/dash/);
});

test('explains an expired or used link in spanish', async ({ page }) => {
  await page.goto('/?mode=resetPassword&oobCode=expired&apiKey=test-key');
  await expect(page.getByTestId('auth-action-error')).toContainText(/venció/i);

  await page.getByTestId('auth-action-back').click();
  await expect(page.getByTestId('login-email')).toBeVisible();
  await expect(page.getByTestId('login-password-reset-notice')).toHaveCount(0);

  await page.goto('/#/restablecer?mode=resetPassword&oobCode=used&apiKey=test-key');
  await expect(page.getByTestId('auth-action-error')).toContainText(/ya fue usado/i);
});

test('explains a weak password and a lost connection in spanish', async ({ page }) => {
  await page.goto('/?mode=resetPassword&oobCode=weak&apiKey=test-key');
  await page.getByTestId('reset-password').fill('nueva-clave-1');
  await page.getByTestId('reset-password-confirm').fill('nueva-clave-1');
  await page.getByTestId('reset-password-submit').click();
  await expect(page.getByTestId('auth-action-error')).toContainText(/demasiado débil/i);
  await expect(page.getByTestId('reset-password-submit')).toBeEnabled();

  await page.goto('/?mode=resetPassword&oobCode=offline&apiKey=test-key');
  await expect(page.getByTestId('auth-action-error')).toContainText(/revisá tu conexión/i);
  await expect(page.getByTestId('reset-password')).toHaveCount(0);
});

test('verifies an email and restores a recovered email', async ({ page }) => {
  await page.goto('/?mode=verifyEmail&oobCode=valid-code&apiKey=test-key');
  await expect(page.getByTestId('auth-action-done')).toContainText(/quedó verificado/i);
  await page.getByTestId('auth-action-back').click();
  await expect(page.getByTestId('login-email')).toBeVisible();
  await expect(page.getByTestId('login-password-reset-notice')).toHaveCount(0);

  await page.goto('/#/restablecer?mode=recoverEmail&oobCode=valid-code&apiKey=test-key');
  await expect(page.getByTestId('auth-action-done')).toContainText('restored@imanager.test');
});

test('explains a sign-in link that this screen does not complete', async ({ page }) => {
  await page.goto('/?mode=signIn&oobCode=valid-code&apiKey=test-key');
  await expect(page.getByTestId('auth-action-error')).toContainText(/no se puede abrir en iManager/i);
});

test('signs out an open session and returns to login after the reset', async ({ page }, testInfo) => {
  const email = buildTestEmail(testInfo, 'reset-session');
  await loginViaUi(page, email);
  await expect(page.getByTestId('onboarding-store-name')).toBeVisible();

  await page.goto('/?mode=resetPassword&oobCode=valid-code&apiKey=test-key');
  await expect(page.getByTestId('auth-action-email')).toBeVisible();
  await expect(page.getByTestId('onboarding-store-name')).toHaveCount(0);

  await page.getByTestId('reset-password').fill('nueva-clave-1');
  await page.getByTestId('reset-password-confirm').fill('nueva-clave-1');
  await page.getByTestId('reset-password-submit').click();

  await expect(page.getByTestId('login-password-reset-notice')).toBeVisible();
  await expect(page.getByTestId('onboarding-store-name')).toHaveCount(0);
});

test.describe('phone password reset', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the yellow action on screen', async ({ page }) => {
    await page.goto('/?mode=resetPassword&oobCode=valid-code&apiKey=test-key');
    await expect(page.getByTestId('auth-action-email')).toBeVisible();
    const submit = page.getByTestId('reset-password-submit');
    await expect(submit).toBeVisible();
    const color = await submit.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(color).toBe('rgb(255, 208, 0)');
    await expectFits(page);
  });
});

test.describe('desktop password reset', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('uses the yellow action on a wide screen', async ({ page }) => {
    await page.goto('/#/restablecer?mode=resetPassword&oobCode=valid-code&apiKey=test-key');
    await expect(page.getByTestId('reset-password-submit')).toBeVisible();
    const color = await page.getByTestId('reset-password-submit').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(color).toBe('rgb(255, 208, 0)');
    await expectFits(page);
  });
});
