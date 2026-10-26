import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`onboarding and logout stay unchanged and PostHog is silent at ${width}px`, async ({ page }, info) => {
    const frontendOrigin = new URL(info.project.use.baseURL as string).origin;
    await page.setViewportSize({ width, height: 900 });
    const posthogRequests: string[] = [];
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('request', request => { if (/https?:\/\/[^/]*posthog\.com/.test(request.url())) posthogRequests.push(request.url()); });
    const session = {
      user: { id: 'internal-user', firebaseUid: 'test-posthog-imanager-test', email: 'posthog@imanager.test', displayName: 'Test Owner', avatarUrl: null },
      store: null as null | Record<string, unknown>,
      membership: null as null | Record<string, unknown>,
      onboardingRequired: true,
      billing: { plan: 'INTERNAL', status: 'ACTIVE', readOnly: false },
    };
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === frontendOrigin) return route.continue();
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.fulfill({ status: 204 });
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
      let json: unknown = {};
      if (url.pathname === '/api/me') json = session;
      else if (url.pathname === '/api/onboarding') {
        session.store = { id: 'test-store', name: 'Tienda de prueba', currency: 'USD', timezone: 'America/Argentina/Buenos_Aires', onboardingStartedAt: '2026-10-26T00:00:00Z' };
        session.membership = { role: 'OWNER', isDefault: true };
        session.onboardingRequired = false;
        json = { session };
      } else if (url.pathname === '/api/onboarding/progress') json = { stage: 'stock', active: true, eligible: true, stock: 0, samples: 0, steps: { store: true, stock: false, sale: false, team: false, install: false } };
      else if (url.pathname === '/api/inventory') json = { inventory: [] };
      else if (url.pathname === '/api/sales') json = { sales: [] };
      else if (url.pathname === '/api/trade-ins') json = { tradeIns: [] };
      else if (url.pathname === '/api/clients') json = { clients: [] };
      else if (url.pathname === '/api/notifications') json = { notifications: [] };
      else if (url.pathname === '/api/repairs') json = { repairOrders: [] };
      return route.fulfill({ json, headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto('/');
    await page.getByTestId('login-email').fill('posthog@imanager.test');
    await page.getByTestId('login-password').fill('test123456');
    await page.getByTestId('login-submit').click();
    await page.getByTestId('onboarding-store-name').fill('Tienda de prueba');
    await page.getByTestId('onboarding-submit').click();
    await expect(page.getByRole('heading', { name: 'Cargá tu stock' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saltar por ahora' })).toBeVisible();
    await page.evaluate(async () => {
      // Exercise the same adapter used by the logout action, without leaving stock UI.
      const { getAuthAdapter } = await import('/src/services/auth-adapter.ts');
      await getAuthAdapter().logout();
    });
    await expect(page.getByTestId('login-email')).toBeVisible();
    expect(posthogRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await expect(page.locator('[class*="posthog"], [id*="posthog-survey"], [class*="cookie-banner"]')).toHaveCount(0);
  });
}
