import { test, expect } from '@playwright/test';
import { adminStores } from './fixtures/admin-panel';
const action = { id: 'a:one', at: '2026-10-18T02:20:00Z', type: 'create', text: 'Registró una venta', actor: { name: 'Lucía', role: 'Dueña' }, source: 'database' };
for (const width of [1440, 390]) {
  test(`action history and filters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email: 'admin@internal.test' })));
    const requests: URL[] = [];
    await page.route('http://127.0.0.1:3194/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/me') return route.fulfill({ json: { user: { id: 'admin', email: 'admin@internal.test' }, store: null, membership: null, onboardingRequired: true } });
      if (url.pathname === '/api/me/admin') return route.fulfill({ json: { isAdmin: true } });
      if (url.pathname === '/api/events') return route.fulfill({ status: 204 });
      if (url.pathname === '/admin/store-activity') return route.fulfill({ json: { range: '30d', generatedAt: action.at, stores: [{ ...adminStores[0], lastAction: { text: 'Editó un cliente · Campos: Teléfono', at: action.at } }] } });
      if (url.pathname.endsWith('/timeline')) return route.fulfill({ json: { store: adminStores[0], events: [] } });
      if (url.pathname.endsWith('/history')) {
        requests.push(url);
        const more = url.searchParams.has('cursor');
        const filtered = url.searchParams.has('type');
        return route.fulfill({ json: { actions: filtered ? [] : more ? [{ ...action, id: 'p:two', text: 'Cargó 12 equipos por Excel', type: 'create' }] : [action], nextCursor: more || filtered ? null : 'page-two', warning: 'Te mostramos las acciones guardadas en la app.' } });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    await page.goto('/admin/actividad');
    await expect(page.getByText('Editó un cliente · Campos: Teléfono')).toBeVisible();
    await page.getByTestId(width === 390 ? 'activity-card-palermo' : 'activity-row-palermo').click();
    await expect(page.getByRole('heading', { name: 'Historial de acciones' })).toBeVisible();
    await expect(page.getByText('Lucía · Dueña')).toBeVisible();
    await expect(page.getByText('17/10/2026 23:20')).toBeVisible();
    await page.getByRole('button', { name: 'Cargar más acciones' }).click();
    await expect(page.getByText('Cargó 12 equipos por Excel')).toBeVisible();
    await expect(page.getByText('Registró una venta')).toBeVisible();
    await page.screenshot({ path: `/tmp/admin-store-history-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(page.getByLabel('Tipo de acción').locator('option')).toHaveText(['Todas las acciones', 'Cargas', 'Bajas', 'Modificaciones', 'Conexiones']);
    for (const type of ['delete', 'update', 'connection']) {
      await page.getByLabel('Tipo de acción').selectOption(type);
      await expect.poll(() => requests.at(-1)?.searchParams.get('type')).toBe(type);
    }
    await page.getByLabel('Tipo de acción').selectOption('create');
    await expect(page.getByText('No hay acciones registradas para estos filtros.')).toBeVisible();
    await page.getByLabel('Desde').fill('2026-10-01');
    await page.getByLabel('Hasta').fill('2026-10-31');
    await expect.poll(() => requests.at(-1)?.searchParams.get('to')).toBe('2026-10-31');
    expect(requests.at(-1)?.searchParams.get('cursor')).toBeNull();
    expect(requests.at(-1)?.searchParams.get('type')).toBe('create');
    await page.getByRole('link', { name: 'Actividad', exact: true }).click();
    await expect(page.getByText('Editó un cliente · Campos: Teléfono')).toBeVisible();
  });
}
