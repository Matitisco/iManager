// Reproduce: ISSUE_394_SHOTS=1 npx playwright test --config e2e/admin-panel-shots.config.ts
// All API responses are intercepted; this capture suite does not start a backend or write a database.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { adminStores } from './fixtures/admin-panel';
import { PANEL_STEPS, type TimelineEvent } from '../src/lib/admin-panel';

test.skip(!process.env.ISSUE_394_SHOTS, 'Set ISSUE_394_SHOTS=1 to capture the approved panel views.');
const now = '2026-10-18T14:20:00Z';
const event = (name: string, at: string, props = {}): TimelineEvent => ({ name, at, props, source: 'server', label: '' });
const events = [
  event('app_installed', '2026-10-18T13:42:00Z'),
  event('invite_accepted', '2026-10-18T13:15:00Z', { role: 'STAFF' }),
  event('invite_shared', '2026-10-18T12:58:00Z', { channel: 'whatsapp' }),
  event('invite_created', '2026-10-18T12:57:00Z', { role: 'STAFF' }),
  event('first_step_completed', '2026-10-17T22:20:00Z', { step: 'sale', index: 3 }),
  event('active_day', '2026-10-17T15:04:00Z', { device: 'phone' }),
  event('active_day', '2026-10-17T15:03:00Z', { device: 'phone' }),
  event('onboarding_completed', '2026-10-16T18:31:00Z'),
  event('stock_import_finished', '2026-10-16T18:30:00Z', { method: 'excel', rows: '11-50', ok: true, errors: 0 }),
  event('real_stock', '2026-10-16T18:30:00Z'),
  event('stock_import_abandoned', '2026-10-16T18:22:00Z', { method: 'excel', at: 'review' }),
  event('stock_method_chosen', '2026-10-16T18:18:00Z', { method: 'excel' }),
  event('onboarding_stock_viewed', '2026-10-16T18:17:00Z'),
  event('onboarding_name_completed', '2026-10-16T17:05:00Z', { currency: 'USD' }),
  event('signup', '2026-10-16T17:02:00Z', { provider: 'google' }),
  event('active_day', '2026-10-16T17:02:00Z', { device: 'phone' }),
];
for (const width of [1440, 1024, 390]) {
  test(`admin panel screenshots ${width}`, async ({ browser }) => {
    await mkdir('docs/pr-shots', { recursive: true });
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 2 : 1 });
    const page = await context.newPage();
    // The approved static HTML places @import after its reset, so it renders with
    // the system fallback. Match that reference environment without changing app CSS.
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.clock.setFixedTime(new Date(now));
    await page.addInitScript(() => localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email: 'admin@internal.test' })));
    const stores = width === 390 ? adminStores.slice(0, 6) : adminStores;
    const tests = Array.from({ length: 3 }, (_, i) => ({ ...adminStores[0], id: `qa-${i}`, name: `QA-${i}` }));
    await page.route('http://127.0.0.1:3194/**', async route => {
      const url = new URL(route.request().url());
      expect(route.request().headers().authorization).toContain('Bearer test.');
      if (url.pathname === '/api/me') return route.fulfill({ json: { user: { id: 'admin', email: 'admin@internal.test' }, store: null, membership: null, onboardingRequired: true } });
      if (url.pathname === '/api/me/admin') return route.fulfill({ json: { isAdmin: true } });
      if (url.pathname === '/admin/store-activity') return route.fulfill({ json: { range: '30d', generatedAt: now, stores: [...stores, ...tests] } });
      if (url.pathname === '/admin/funnel') return route.fulfill({ json: { range: '30d', generatedAt: now, steps: PANEL_STEPS.map(([id, label], i) => ({ id, label, count: [25,21,20,17,9,15,8,3,2,4,1,8][i], pctOfStart: 0, dropFromPrev: 0 })), stockMethods: ['excel','paste','manual','sample','skip'].map((method, i) => ({ method, chosen: [9,4,3,3,4][i], finishedOk: [5,3,1,3,0][i], abandoned: [4,1,2,0,0][i] })), retention: { cohort: 22, nextDay: 8, week1Active: 9 }, medianHours: { signupToStore: 2/60, storeToRealStock: 24, storeToFirstSale: 72 } } });
      if (url.pathname === '/admin/stores/palermo/timeline') return route.fulfill({ json: { store: adminStores[0], events } });
      if (url.pathname === '/api/events') return route.fulfill({ status: 204 });
      throw new Error(`Unexpected API request: ${url.pathname}`);
    });
    for (const view of width === 1024 ? ['embudo'] : ['embudo', 'tiendas', 'timeline']) {
      await page.goto(view === 'embudo' ? '/admin/actividad/embudo' : view === 'timeline' ? '/admin/actividad/tienda/palermo' : '/admin/actividad');
      await expect(page.getByTestId('activity-screen')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (view === 'tiendas' && width !== 390) await page.getByTestId('activity-row-store-1').hover();
      await expect(page.locator('.store-activity')).toHaveCSS('font-family', /DM Sans/);
      const name = width === 390 ? `394-m-${view}` : `394-${view}-${width}`;
      if (view === 'embudo') await expect(page.locator('.fs').first()).toHaveCSS('cursor', 'default');
      await page.screenshot({ path: `docs/pr-shots/${name}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
    // Exercise the actual app matcher and history flow after preserving the captures.
    await page.goto('/admin/actividad');
    await expect(page.getByTestId('activity-screen')).toBeVisible();
    await page.getByRole('button', { name: 'Embudo', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/actividad\/embudo$/);
    await expect(page.getByTestId('funnel-kpi-0')).toBeVisible();
    await page.goBack();
    const row = page.getByTestId(width === 390 ? 'activity-card-palermo' : 'activity-row-palermo');
    await row.click();
    await expect(page).toHaveURL(/\/tienda\/palermo$/);
    await expect(page.getByRole('heading', { name: 'Recorrido' })).toBeVisible();
    await page.getByRole('link', { name: 'Actividad', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/actividad$/);

    await expect(page.getByTestId(width === 390 ? 'activity-card-palermo' : 'activity-table')).toBeVisible();
    await page.route('**/api/me/admin', route => route.fulfill({ status: 403, json: { error: 'Forbidden' } }));
    const deniedCalls: string[] = [];
    page.on('request', request => { if (request.url().startsWith('http://127.0.0.1:3194/admin/')) deniedCalls.push(request.url()); });
    for (const path of ['/admin/actividad', '/admin/actividad/embudo', '/admin/actividad/tienda/palermo']) {
      await page.goto(path);
      await expect(page.getByTestId('activity-not-found')).toHaveText(/No encontramos esta página/);
    }
    expect(deniedCalls).toEqual([]);
    await context.close();
  });
}
