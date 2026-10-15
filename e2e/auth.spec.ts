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
  const storeNameInput = page.getByTestId('onboarding-store-name');
  await expect(storeNameInput).toBeVisible();
  await expect(storeNameInput).toHaveValue('');
  await expect(storeNameInput).toHaveAttribute('placeholder', 'iManager Store');
  await page.getByTestId('onboarding-submit').click();
  await expect(page.getByText('Completá el nombre de la tienda')).toBeVisible();
  await storeNameInput.fill(storeName);
  await page.getByTestId('onboarding-submit').click();
  await expect(page.getByTestId('onboarding-invite')).toBeVisible();
  await page.getByRole('button', { name: 'Saltar por ahora' }).click();
  await expect(page.getByRole('heading', { name: 'Cargá tu stock' })).toBeVisible();
  await page.getByRole('button', { name: 'Saltar por ahora' }).click();

  await expect(page.getByTestId('sidebar-tab-dashboard')).toBeVisible();
  await expect(page.getByTestId('sidebar-tab-inventory')).toBeVisible();

  const session = await fetchSession(request, email);
  expect(session.onboardingRequired).toBeFalsy();
  expect(session.store?.name).toBe(storeName);
  expect(session.store?.phone).toBeNull();
  expect(session.store?.email).toBeNull();
  expect(session.store?.instagram).toBeNull();
  expect(session.membership?.role).toBe('OWNER');
});
