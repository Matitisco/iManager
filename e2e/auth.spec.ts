import { expect, test } from '@playwright/test';

import { buildTestEmail, fetchSession, loginViaUi } from './utils';

test('shows an invalid credentials error on login', async ({ page }, testInfo) => {
  const email = buildTestEmail(testInfo, 'login-error');

  await page.goto('/');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('wrong-password');
  await page.getByTestId('login-submit').click();

  await expect(page.getByText(/incorrectos/i)).toBeVisible();
  await expect(page.getByTestId('login-submit')).toBeVisible();
});

test('completes onboarding and bootstraps the backend session', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'onboarding');
  const storeName = `Store ${testInfo.parallelIndex} ${Date.now()}`;

  await loginViaUi(page, email);
  await expect(page.getByTestId('onboarding-store-name')).toBeVisible();
  await page.getByTestId('onboarding-store-name').fill(storeName);

  const onboardingResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/onboarding') &&
      response.request().method() === 'POST' &&
      response.ok(),
  );
  await page.getByTestId('onboarding-submit').click({ noWaitAfter: true });

  const onboardingPayload = await (await onboardingResponse).json();
  expect(onboardingPayload.session.onboardingRequired).toBeFalsy();
  expect(onboardingPayload.session.store?.name).toBe(storeName);

  await expect(page.getByTestId('sidebar-tab-dashboard')).toBeVisible();
  await expect(page.getByTestId('sidebar-tab-inventory')).toBeVisible();

  const session = await fetchSession(request, email);
  expect(session.onboardingRequired).toBeFalsy();
  expect(session.store?.name).toBe(storeName);
  expect(session.membership?.role).toBe('OWNER');
});
