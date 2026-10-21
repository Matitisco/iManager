import { expandListOptions } from './navigation';
import { expect, test, type Locator } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { mockCommissions } from './fixtures/commissions';
import { me } from './pwa/fixtures.mjs';
import { commissionFixturePeople, commissionFixtureSummary } from '../src/test/commission-fixtures';

const ownerEmail = 'propietario.nombre.muy.largo@tienda-ejemplo.test';
const staffEmail = 'empleado.nombre.muy.largo@tienda-ejemplo.test';
const members = [ownerEmail, staffEmail].map((email, i) => ({
  id: i ? 'staff' : 'owner', userId: i ? 'staff-user' : 'owner-user', role: i ? 'STAFF' : 'OWNER',
  isDefault: true, createdAt: '2026-10-01T12:00:00Z', sections: null,
  user: { id: i ? 'staff-user' : 'owner-user', displayName: null, email, avatarUrl: null },
}));
const progress = { stage: 'done', eligible: true, active: false, dismissed: false, stock: 3, sales: true, team: true, catalog: false, installed: false, visible: true, samples: 0, storeNamed: true, steps: { store: true, stock: true, sale: true, team: true, install: false } };

for (const width of [390, 1440]) {
  test(`quince ajustes y capturas ${width}`, async ({ page }) => {
    const mobile = width === 390;
    const device = mobile ? 'mobile' : 'desktop';
    await page.setViewportSize({ width, height: mobile ? 844 : 900 });
    const measurements: Record<string, unknown> = {};
    const box = async (locator: Locator) => { await expect(locator).toBeVisible(); return (await locator.boundingBox())!; };
    const shot = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      // Also inspect the scrollport: the shell clips horizontal overflow at document level.
      if (await page.locator('.stage').count()) {
        expect(await page.locator('.stage').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
      await page.screenshot({ path: `docs/pr-shots/395b-despues-${name}-${device}.png`, animations: 'disabled' });
    };
    const visit = async (hash: string, title: string) => {
      await page.goto(`/#/${hash}`);
      await expect(page.locator('.dscreen h1').first()).toHaveText(title);
      await page.evaluate(() => document.fonts.ready);
    };

    await page.goto('/');
    const submit = await box(page.getByTestId('login-submit'));
    const google = await box(page.getByTestId('login-google'));
    expect(submit.height).toBe(54); expect(google.height).toBe(submit.height);
    const forgot = await box(page.getByTestId('forgot-password'));
    expect(submit.y - (forgot.y + forgot.height)).toBeLessThan(45);
    if (mobile) { expect(submit.x).toBe(14); expect(submit.width).toBe(362); }
    measurements.login = { submit, google, forgot };
    await shot('login');

    await mockCommissions(page);
    let releaseMembers: (() => void) | undefined;
    let membersGate: Promise<void> | undefined;
    await page.context().route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/me') return route.fulfill({ json: { ...me, user: { ...me.user, id: 'owner-user', email: ownerEmail, displayName: null }, store: { ...me.store, id: 'commission-store', name: 'Tienda Ejemplo', instagram: 'tiendaejemplo', phone: '1144445555' } } });
      if (path.endsWith('/members')) { await membersGate; return route.fulfill({ json: { members } }); }
      if (path === '/api/onboarding/progress') return route.fulfill({ json: progress });
      if (path === '/api/cash') return route.fulfill({ json: { registers: [{ id: 'cash', name: 'Caja principal', currency: 'USD', method: 'EFECTIVO', isDefault: true, archivedAt: null, balance: 350, session: { id: 'session', day: '2026-10-13', status: 'OPEN' } }], canViewBalances: true } });
      if (path === '/api/catalog') return route.fulfill({ json: { catalog: null } });
      if (path === '/api/commissions') return route.fulfill({ json: { ...commissionFixtureSummary, people: commissionFixturePeople.map(person => ({ ...person, name: staffEmail })) } });
      return route.fallback();
    });
    await page.reload(); await visit('inv', 'Inventario'); await expect(page.getByText(/iPhone 15 · 128GB/).first()).toBeVisible();
    await shot('inventario');
    await visit('dash', '¿Qué hay para hoy?');
    await expect(page.locator('.steps-pill')).toHaveAttribute('aria-label', 'Primeros pasos, 4 de 5');
    const stage = await box(page.locator('.stage')); const pill = await box(page.locator('.steps-pill'));
    if (mobile) {
      expect(stage.y + stage.height).toBeLessThanOrEqual(pill.y);
      expect((await box(page.locator('.dashboard-screen h1'))).x).toBe(14);
    }
    measurements.dashboard = { stage, pill }; await shot('dashboard');

    const titleBoxes: Record<string, unknown> = {};
    for (const [hash, title, name] of [['ven', 'Ventas', 'ventas'], ['clientes', 'Clientes', 'clientes'], ['catalogo', 'Catálogo', 'catalogo'], ['rep', 'Reportes', 'reportes'], ['comisiones', 'Comisiones', 'comisiones'], ['cajas', 'Cajas', 'cajas'], ['ayuda', 'Ayuda', 'ayuda']] as const) {
      await visit(hash, title);
      const titleBox = await box(page.locator('.dscreen h1').first()); titleBoxes[name] = titleBox;
      if (!mobile) expect(titleBox.height).toBe(33);
      if (name === 'ventas' && mobile) {
        const card = await box(page.locator('.sale-node .phone-row').first()); expect(card.x).toBe(14); expect(card.x + card.width).toBe(376);
        const dot = await page.locator('.sale-node').first().evaluate(el => ({ left: getComputedStyle(el, '::before').left, width: getComputedStyle(el, '::before').width }));
        expect(dot.left).toBe('10px');
        const content = await box(page.locator('.sale-card').first());
        expect(content.x).toBeGreaterThanOrEqual(card.x + 24);
        measurements.ventas = { card, dot, content };
      }
      if (name === 'clientes' && !mobile) {
        const all = await box(page.locator('.clients-filters').getByRole('button', { name: 'Todos', exact: true }));
        const debt = await box(page.getByRole('button', { name: 'Con saldo pendiente', exact: true })); expect(all.y).toBe(debt.y);
        measurements.clientes = { all, debt };
      }
      if (name === 'catalogo' && mobile) await expect(page.getByTestId('page-back')).toBeVisible();
      if (name === 'reportes') {
        expect(titleBox.y).toBe(mobile ? 60 : 28);
        const periods = await box(page.locator('.gperiods')); expect(periods.x).toBeGreaterThanOrEqual(mobile ? 14 : 284); expect(periods.x + periods.width).toBeLessThanOrEqual(width - (mobile ? 14 : 36));
      }
      if (name === 'comisiones') {
        const cards = page.locator('.commission-person');
        if (mobile) { await expect(cards).not.toHaveCount(0); for (const card of await cards.all()) { const b = await box(card); expect(b.x).toBeGreaterThanOrEqual(14); expect(b.x + b.width).toBeLessThanOrEqual(376); } }
        else { const table = await box(page.locator('.commission-table')); expect(table.x).toBe(285); expect(table.x + table.width).toBe(1403); measurements.comisiones = table; }
      }
      if (name === 'cajas') { await expect(page.getByRole('button', { name: 'Nueva caja', exact: true })).toHaveCSS('border-top-style', 'solid'); await expect(page.getByRole('button', { name: 'Nueva caja', exact: true })).toHaveCSS('border-top-width', '1px'); }
      if (name === 'ayuda' && !mobile) expect(titleBox.x).toBe(284);
      await shot(name);
      if (name === 'ventas' && mobile) {
        await expandListOptions(page);
        await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
        const check = await box(page.locator('.sale-node input[type=checkbox]').first());
        expect(check.x).toBeGreaterThanOrEqual(14);
        measurements.seleccionVenta = check;
        await shot('ventas-seleccion');
      }
      if (name === 'catalogo' && mobile) { await page.getByTestId('page-back').click(); await expect(page.locator('.mmore h1')).toHaveText('Más'); }
    }
    membersGate = new Promise<void>(resolve => { releaseMembers = resolve; });
    await visit('config', 'Configuración');
    await expect(page.getByTestId('settings-member-count')).toHaveText('…');
    releaseMembers!();
    await expect(page.getByTestId('settings-member-count')).toHaveText('2');
    const teamLabel = page.getByRole('button', { name: 'Equipo ›' });
    await expect(teamLabel).toHaveCSS('text-transform', 'uppercase');
    await expect(teamLabel).toHaveCSS('color', 'rgb(154, 160, 170)');
    titleBoxes.configuracion = await box(page.locator('.dscreen h1'));
    if (!mobile) expect((titleBoxes.configuracion as { height: number }).height).toBe(33);
    if (!mobile) {
      const email = page.locator('.duser b'); const side = await box(page.locator('.side')); const emailBox = await box(email);
      await expect(email).toHaveCSS('text-overflow', 'ellipsis'); expect(emailBox.x + emailBox.width).toBeLessThan(side.x + side.width);
      measurements.sidebar = { side, emailBox };
    }
    await shot('configuracion');
    await teamLabel.click(); await expect(page.getByTestId('team-screen')).toBeVisible();
    await expect(page.getByTestId('settings-member-count')).toHaveText('2');
    if (mobile) await expect(page.getByTestId('page-back')).toBeVisible();
    for (const name of await page.locator('.team-grid .name').all()) { await expect(name).toHaveCSS('text-overflow', 'ellipsis'); expect((await box(name)).x + (await box(name)).width).toBeLessThanOrEqual(width - 14); }
    await shot('equipo');
    await page.getByTestId('settings-member-staff').click();
    await expect(page.locator('.team-member-head h1')).toHaveText(staffEmail);
    await expect(page.locator('.team-member-head h1')).toHaveCSS('text-overflow', 'ellipsis');
    if (mobile) await expect(page.getByTestId('page-back')).toBeVisible();
    await shot('permisos');
    if (mobile) { await page.getByTestId('page-back').click(); await expect(page.getByTestId('team-screen')).toBeVisible(); await page.getByTestId('page-back').click(); await expect(page.getByTestId('settings-screen')).toBeVisible(); }
    measurements.titulos = titleBoxes;
    writeFileSync(`docs/pr-shots/395b-geometria-${device}.json`, JSON.stringify(measurements, null, 2) + '\n');
  });
}
