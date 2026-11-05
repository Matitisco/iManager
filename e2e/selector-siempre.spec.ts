import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { groupSession } from '../src/test/store-group-fixtures';
import type { AppSession } from '../src/types/app-session';

const evidence = '/workspace/qa-selector-siempre';
type Scenario = 'owner-1tienda' | 'empleado-1tienda' | 'owner-2tiendas';

function sessionFor(scenario: Scenario): AppSession {
  const session = groupSession();
  session.user = {
    ...session.user,
    firebaseUid: 'test-demo-example-test',
    displayName: 'Usuario Demo',
    email: 'demo@example.test',
  };
  session.store = {
    ...session.store!,
    name: 'Tienda Demo',
    exchangeMode: 'manual',
    manualBuy: 1200,
    manualSell: 1250,
  };
  session.stores![0].name = 'Tienda Demo';
  session.stores![1].name = 'Sucursal Demo';
  if (scenario !== 'owner-2tiendas') {
    session.stores = [{ ...session.stores![0], kind: null, groupId: null }];
  }
  if (scenario === 'empleado-1tienda') {
    session.membership!.role = 'STAFF';
    session.stores![0] = {
      ...session.stores![0],
      role: 'STAFF',
      kind: 'RETAIL',
    };
  }
  return session;
}

async function mockApi(page: Page, initial: AppSession) {
  let session = initial;
  const unexpected: string[] = [];
  const mutations: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // All off-box requests are blocked, including analytics, auth and images.
    if (url.origin !== 'http://127.0.0.1:4819')
      return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const path = url.pathname;
    if (request.method() === 'POST' && path === '/api/stores/active') {
      mutations.push(path);
      const store = session.stores!.find(
        (item) => item.id === request.postDataJSON().storeId,
      )!;
      session = {
        ...session,
        store: { ...session.store!, id: store.id, name: store.name },
      };
      return route.fulfill({ json: { session } });
    }
    const fixtures: Record<string, unknown> = {
      '/api/health': { ok: true },
      '/api/me': session,
      '/api/inventory': { inventory: [] },
      '/api/inventory/categories': { categories: [] },
      '/api/clients/categories': { categories: [] },
      '/api/clients': { clients: [] },
      '/api/sales': { sales: [] },
      '/api/trade-ins': { tradeIns: [] },
      '/api/repairs': { orders: [] },
      '/api/custom-field-definitions': { definitions: [] },
      '/api/suppliers': { suppliers: [] },
      '/api/expenses': { expenses: [] },
      '/api/returns': { returns: [] },
      '/api/returns/credit-notes': { creditNotes: [] },
      '/api/consignments': {
        items: [],
        totals: {
          debt: { ARS: 0, USD: 0 },
          equipment: 0,
          people: 0,
          oldestDays: 0,
          oldestClient: null,
        },
      },
      '/api/notifications': { notifications: [] },
      '/api/section-views': { sections: {} },
      '/api/catalogs': { meta: {}, options: [] },
      '/api/catalog': { catalog: null },
      '/api/catalog/list': { catalogs: [] },
      '/api/onboarding/progress': {
        stage: 'done',
        active: false,
        eligible: false,
        dismissed: true,
        visible: false,
        stock: 0,
        sales: false,
        team: false,
        catalog: false,
        installed: true,
        samples: 0,
      },
      [`/api/stores/${session.store!.id}/members`]: { members: [] },
      '/api/invitations': { invitations: [] },
      '/api/accounts/follow-ups': { cards: [] },
      '/api/commissions': { people: [], summary: {} },
      '/api/commissions/rules': { rules: [] },
      '/api/commissions/mine': { person: { pending: { ARS: 0, USD: 0 } } },
      '/api/reports/overview': {
        overview: {
          currency: 'ARS',
          summary: { revenue: 0, grossProfit: 0, marginRate: 0, unitsSold: 0 },
          comparison: {
            available: false,
            revenueChange: null,
            grossProfitChange: null,
            unitsChange: null,
          },
          salesSeries: [],
          paymentMethods: [],
        },
      },
    };
    if (request.method() !== 'GET' || !(path in fixtures)) {
      unexpected.push(`${request.method()} ${path}`);
      return route.abort('blockedbyclient');
    }
    return route.fulfill({ json: fixtures[path] });
  });
  return { unexpected, mutations, errors };
}

for (const scenario of [
  'owner-1tienda',
  'empleado-1tienda',
  'owner-2tiendas',
] as const) {
  for (const phone of [false, true])
    for (const theme of ['light', 'dark'] as const) {
      test(`${scenario} ${phone ? 'mobile' : 'desktop'} ${theme}`, async ({
        page,
      }) => {
        await mkdir(evidence, { recursive: true });
        await page.setViewportSize({
          width: phone ? 390 : 1440,
          height: phone ? 844 : 900,
        });
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: 'reduce',
        });
        await page.addInitScript(
          ({ theme }) => {
            localStorage.clear();
            localStorage.setItem(
              'imanager:test-auth-user',
              JSON.stringify({ email: 'demo@example.test' }),
            );
            localStorage.setItem('imanager-theme', theme);
            localStorage.setItem('imanager:install-dismissed:ios', 'yes');
          },
          { theme },
        );
        const api = await mockApi(page, sessionFor(scenario));
        await page.goto('/#/dashboard');
        const selector = page.getByRole('combobox', {
          name: 'Cambiar tienda',
          exact: true,
        });
        await expect(selector).toBeVisible();
        await expect(selector).toContainText('Tienda Demo');
        await expect(page.locator('.desk-app')).toBeVisible();
        await expect(page.getByTestId('dashboard-initial-loading')).toHaveCount(
          0,
        );
        await expect(page.locator('#boot-splash')).not.toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(selector).toHaveAttribute(
          'data-testid',
          phone ? 'mobile-store-name' : 'store-selector',
        );
        if (scenario === 'owner-1tienda')
          await expect(selector.locator('.store-tile.generic')).toBeVisible();
        const prefix = `${evidence}/${scenario}-${phone ? 'mobile' : 'desktop'}-${theme}`;
        await page.screenshot({ path: `${prefix}-cerrado.png` });
        await selector.click();
        const current = page.getByRole('option', {
          name:
            scenario === 'owner-1tienda'
              ? 'Tienda Demo'
              : `Tienda Demo · ${scenario === 'empleado-1tienda' ? 'Minorista' : 'Mayorista'}`,
          exact: true,
        });
        await expect(current).toHaveAttribute('aria-selected', 'true');
        if (scenario === 'owner-1tienda')
          await expect(current.locator('.store-pill')).toHaveCount(0);
        const add = page.getByRole('option', {
          name: 'Agregar tienda',
          exact: true,
        });
        await expect(add).toHaveCount(scenario === 'owner-1tienda' ? 1 : 0);
        await expect(page.locator('.store-popup')).toHaveCSS('opacity', '1');
        await page.screenshot({ path: `${prefix}-abierto.png` });
        if (scenario === 'owner-1tienda') {
          await add.click();
          await expect(page).toHaveURL(/#\/cuenta\/configuracion$/);
          const card = page.getByTestId('enable-store-group');
          await expect(card).toBeFocused();
          await expect(card).toBeInViewport();
          await expect(
            page.getByRole('textbox', { name: 'Nombre de la otra tienda' }),
          ).toBeEditable();
          await page.screenshot({ path: `${prefix}-agregar.png` });
        } else if (scenario === 'owner-2tiendas') {
          await expect(
            page.getByRole('option', { name: 'Todas las tiendas' }),
          ).toBeVisible();
          await page
            .getByRole('option', { name: 'Sucursal Demo · Minorista' })
            .click();
          await expect(selector).toContainText('Sucursal Demo');
          await expect(selector).toContainText('Minorista');
          expect(api.mutations).toEqual(['/api/stores/active']);
        } else {
          await expect(page.getByRole('option')).toHaveCount(1);
          await current.click();
          await expect(selector).toHaveAttribute('aria-expanded', 'false');
        }
        expect(api.unexpected).toEqual([]);
        expect(api.errors).toEqual([]);
        if (scenario !== 'owner-2tiendas') expect(api.mutations).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      });
    }
}
