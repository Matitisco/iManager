import { expect, test, type Page } from '@playwright/test';

const ownerId = 'owner-user';
const progress = {
  stage: 'done', eligible: false, active: false, dismissed: true, stock: 3, sales: true, team: true,
  catalog: true, installed: true, visible: false, samples: 0, storeNamed: true,
  steps: { store: true, stock: true, sale: true, team: true, install: true },
};
const members = [
  { id: 'm1', userId: ownerId, role: 'OWNER', isDefault: true, createdAt: '2026-10-01T12:00:00Z', sections: null, user: { id: ownerId, displayName: 'Matias Tiscornia', email: 'matiscorniaok@gmail.com', avatarUrl: null } },
  { id: 'm2', userId: 'u2', role: 'STAFF', isDefault: false, createdAt: '2026-10-02T12:00:00Z', sections: ['dashboard', 'sales', 'inventory', 'clients'], user: { id: 'u2', displayName: 'Mat Tisco', email: 'matitiscor.com@gmail.com', avatarUrl: null } },
  { id: 'm3', userId: 'u3', role: 'MANAGER', isDefault: false, createdAt: '2026-10-03T12:00:00Z', sections: null, user: { id: 'u3', displayName: 'NnehueE', email: 'nnehuee@gmail.com', avatarUrl: null } },
];
const invites = [{
  id: 'inv-1', email: 'empleado.nombre.muy.largo.pendiente@tienda-ejemplo.com', role: 'STAFF',
  expiresAt: '2026-11-01T00:00:00.000Z', inviteUrl: 'https://example.test/invite/abc',
}];
const inventory = [
  { id: 'p1', imei: '359876543210001', model: 'iPhone 13', capacity: '256GB', color: 'Negro', condition: 'USADO', batteryHealth: '90', price: 280, cost: 200, currency: 'USD', grade: 'A', status: 'DISPONIBLE', createdAt: '2026-10-10T12:00:00Z', catalogIncluded: true },
  { id: 'p2', imei: '359876543210002', model: 'iPhone 13', capacity: '128GB', color: 'Azul', condition: 'USADO', batteryHealth: '88', price: 240, cost: 180, currency: 'USD', grade: 'A', status: 'VENDIDO', createdAt: '2026-10-09T12:00:00Z', catalogIncluded: false },
];
const sales = [
  { id: 's12', saleNumber: 12, date: '2026-10-10T15:00:00.000Z', clientName: 'Matias', productId: 'p1', amount: 300, amountCurrency: 'USD', paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA', sellerMemberId: ownerId },
  { id: 's19', saleNumber: 192, date: '2026-10-12T15:00:00.000Z', clientName: 'PRUEBA', deviceLabel: 'PRUEBA equipo 64GB', amount: 2, amountCurrency: 'USD', paymentMethod: 'EFECTIVO', status: 'CANCELADA' },
  { id: 's20', saleNumber: 190, date: '2026-10-10T15:00:00.000Z', clientName: 'juan dominguez', productId: 'p1', amount: 280, amountCurrency: 'USD', paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA', sellerMemberId: ownerId },
];
const clients = [
  { id: 'c1', dni: '30111222', name: 'juan dominguez', email: 'juan@example.test', phone: '1144445555', totalSpent: 280, pendingBalance: 0, lastPurchaseDate: '2026-10-10' },
];
const notifications = [
  ...Array.from({ length: 3 }, (_, i) => note(`n-inv-${i}`, 'inventory')),
  ...Array.from({ length: 22 }, (_, i) => note(`n-sale-${i}`, 'sales')),
  note('n-cli', 'clients'),
];
function note(id: string, section: string) {
  return { id, storeId: 'store-1', section, title: section, message: section, kind: 'updated', createdAt: '2026-10-18T22:16:00.000Z', readAt: null };
}

let persona: 'owner' | 'staff' = 'owner';

async function installApi(page: Page) {
  await page.addInitScript(() => localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email: 'matiscorniaok@gmail.com' })));
  await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-18T22:16:00.000Z' } }));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const staff = persona === 'staff';
    if (path === '/api/me') {
      return route.fulfill({ json: {
        user: { id: staff ? 'u2' : ownerId, firebaseUid: 'test-owner', displayName: staff ? 'Mat Tisco' : 'Matias Tiscornia', email: staff ? 'matitiscor.com@gmail.com' : 'matiscorniaok@gmail.com', avatarUrl: null },
        store: { id: 'store-1', name: 'Tienda Ejemplo', currency: 'USD', timezone: 'America/Argentina/Buenos_Aires', instagram: 'tienda', phone: '1144445555', exchangeMode: 'auto', exchangeSource: 'blue' },
        membership: { role: staff ? 'STAFF' : 'OWNER', isDefault: true, sections: staff ? ['dashboard', 'inventory', 'sales', 'clients', 'cash', 'reports'] : null },
        stores: [], onboardingRequired: false,
      } });
    }
    if (path === '/api/inventory') return route.fulfill({ json: { inventory } });
    if (path === '/api/sales') return route.fulfill({ json: { sales } });
    if (path === '/api/clients') return route.fulfill({ json: { clients } });
    if (path === '/api/clients/categories') return route.fulfill({ json: { categories: [] } });
    if (path === '/api/trade-ins') return route.fulfill({ json: { tradeIns: [] } });
    if (path === '/api/repairs') return route.fulfill({ json: { orders: [] } });
    if (path === '/api/notifications') return route.fulfill({ json: { notifications } });
    if (path === '/api/onboarding/progress') return route.fulfill({ json: progress });
    if (path === '/api/catalogs') return route.fulfill({ json: { meta: {}, options: [] } });
    if (path.endsWith('/members')) return route.fulfill({ json: { members } });
    if (path === '/api/invitations') return route.fulfill({ json: { invitations: invites } });
    if (path === '/api/commissions/sellers') return route.fulfill({ json: { sellers: [{ id: ownerId, name: 'Matias Tiscornia', role: 'OWNER' }] } });
    if (path === '/api/commissions/exchange-rate') return route.fulfill({ json: { exchangeRate: 1300 } });
    if (path === '/api/cash') return route.fulfill({ json: { registers: [{ id: 'cash', name: 'Caja principal', currency: 'USD', method: 'EFECTIVO', isDefault: true, archivedAt: null, balance: 350, session: { id: 'session', day: '2026-10-18', status: 'OPEN' } }], canViewBalances: true } });
    if (path.includes('/movements')) return route.fulfill({ json: { movements: [{ id: 'mv', kind: 'INGRESO', createdAt: '2026-10-18T22:16:00.000Z', category: 'Caja', amount: 100 }], total: 1, categories: [] } });
    if (path.includes('/sessions')) return route.fulfill({ json: { sessions: [] } });
    if (path.includes('/drafts')) return route.fulfill({ json: { tradeIns: [] } });
    if (path.includes('/options')) return route.fulfill({ json: { products: [], clients: [] } });
    return route.fulfill({ json: {} });
  });
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/pr-shots/post395-despues-${name}.png`, animations: 'disabled' });
}

test.describe('post 395', () => {
  test.beforeEach(async ({ page }) => {
    persona = 'owner';
    await installApi(page);
  });

  for (const width of [1440, 390]) {
    test(`pantallas corregidas a ${width}`, async ({ page }) => {
      const mobile = width === 390;
      await page.setViewportSize({ width, height: mobile ? 844 : 1000 });
      await page.goto('/#/dash');
      await expect(page.getByRole('heading', { name: /hoy/ })).toBeVisible();
      const hero = page.locator('.hero');
      await expect(hero).toBeVisible();
      const heroPad = await hero.evaluate(el => getComputedStyle(el).padding);
      const ring = await page.locator('.turn-ring').evaluate(el => el.getBoundingClientRect().width);
      const itemPad = await page.locator('.hlist .item').first().evaluate(el => getComputedStyle(el).paddingTop);
      const miniPad = await page.locator('button.mini').first().evaluate(el => getComputedStyle(el).paddingTop);
      expect(ring).toBe(48);
      expect(parseFloat(itemPad)).toBeLessThanOrEqual(10);
      expect(parseFloat(miniPad)).toBeLessThanOrEqual(16);
      if (!mobile) expect(heroPad.startsWith('16px')).toBe(true);
      if (!mobile) {
        const code = page.getByText('#V-0012');
        await expect(code).toBeVisible();
        expect(await code.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false);
        const amount = page.locator('.dashboard-screen .dtable.compact td.r b').filter({ hasText: '300' });
        await expect(amount).toBeVisible();
        expect(await amount.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false);
        await expect(page.getByLabel('1 en Clientes')).toBeVisible();
      }
      await expect(page.getByLabel('3 en Inventario')).toBeVisible();
      await expect(page.getByLabel('22 en Ventas')).toBeVisible();
      await shot(page, `dashboard-${mobile ? 'mobile' : 'desktop'}`);

      await page.goto('/#/ven');
      await expect(page.getByTestId('sales-screen')).toBeVisible();
      if (mobile) {
        const saleCard = page.locator('.sales-screen .sale-node .phone-row').first();
        await expect(saleCard).toBeVisible();
        const saleBox = await saleCard.boundingBox();
        const saleText = await saleCard.evaluate(el => el.getBoundingClientRect().x + parseFloat(getComputedStyle(el).paddingLeft));
        const bg = await saleCard.evaluate(el => getComputedStyle(el).backgroundColor);
        const border = await saleCard.evaluate(el => getComputedStyle(el).borderTopWidth);
        expect(border).not.toBe('0px');
        expect(bg).not.toBe('rgba(0, 0, 0, 0)');
        await page.goto('/#/inv');
        await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
        const sub = page.locator('.dsub');
        await expect(sub).toHaveText(/\d+ equipos? · \d+ disponibles?/);
        expect(await sub.evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(24);
        const invCard = page.locator('.phone-row').first();
        const invBox = await invCard.boundingBox();
        expect(Math.abs((saleBox?.x ?? 0) - (invBox?.x ?? 0))).toBeLessThanOrEqual(2);
        const invText = await invCard.evaluate(el => el.getBoundingClientRect().x + parseFloat(getComputedStyle(el).paddingLeft));
        expect(Math.abs(saleText - invText)).toBeLessThanOrEqual(2);
        await shot(page, 'inventario-mobile');
        await page.goto('/#/ven');
      } else {
        const row = page.locator('tr.is-void').first();
        await expect(row).toBeVisible();
        const before = await page.locator('.dtable tbody tr').first().boundingBox();
        await page.locator('.dtable tbody tr').first().locator('input[type="checkbox"]').click();
        await expect(page.getByTestId('bulk-action-bar')).toBeVisible();
        const after = await page.locator('.dtable tbody tr').first().boundingBox();
        expect(Math.abs((before?.y ?? 0) - (after?.y ?? 0))).toBeLessThanOrEqual(2);
        const bar = await page.getByTestId('bulk-action-bar').boundingBox();
        expect((bar?.y ?? 0) > (after?.y ?? 0)).toBe(true);
        await shot(page, 'ventas-desktop');
      }
      if (mobile) {
        const voidCard = page.locator('.phone-row.is-void').first();
        await expect(voidCard).toBeVisible();
        await shot(page, 'ventas-mobile');
      }

      await page.goto('/#/rep');
      await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
      const periods = page.locator('.gperiods .gchip, .gperiods button');
      await expect(periods.first()).toBeVisible();
      const title = await page.locator('.dscreen h1').first().boundingBox();
      const chips = await periods.evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, text: node.textContent ?? '' };
      }));
      const firstRowY = Math.min(...chips.map(chip => chip.y));
      const second = chips.filter(chip => chip.y > firstRowY + 8);
      if (mobile && second.length) {
        expect(Math.min(...second.map(chip => chip.x))).toBeLessThanOrEqual((title?.x ?? 14) + 2);
      }
      const amount = page.locator('.gtk .gamt').first();
      await expect(amount).toBeVisible();
      expect(await amount.evaluate(el => getComputedStyle(el).textAlign)).toBe('right');
      expect(await amount.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('nowrap');
      await expect(page.locator('.gtk.is-void').first()).toBeVisible();
      await shot(page, `reportes-${mobile ? 'mobile' : 'desktop'}`);

      await page.goto('/#/config');
      await expect(page.getByTestId('settings-screen')).toBeVisible();
      await expect(page.getByTestId('settings-member-count')).toHaveText('3 miembros');
      await expect(page.getByText('MIEMBROS', { exact: true })).toHaveCount(0);
      await expect(page.getByTestId('settings-invite')).toHaveCount(1);
      await expect(page.getByTestId('settings-member-m1')).toContainText('vos');
      await expect(page.getByTestId('settings-member-m1')).toContainText('matiscorniaok@gmail.com');
      const inviteEmail = page.locator('.team-invitation b');
      expect(await inviteEmail.evaluate(el => getComputedStyle(el).textOverflow)).toBe('ellipsis');
      expect(await inviteEmail.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('nowrap');
      if (mobile) expect(await inviteEmail.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
      await page.getByRole('button', { name: 'Cancelar invitación' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: '¿Cancelás esta invitación?' })).toBeVisible();
      await shot(page, `equipo-${mobile ? 'mobile' : 'desktop'}`);
      await page.getByRole('alertdialog').getByRole('button', { name: 'Volver' }).click();

      await page.getByRole('button', { name: /Mat Tisco/ }).click();
      await expect(page).toHaveURL(/#\/config\/equipo\//);
      if (mobile) {
        await expect(page.getByRole('heading', { name: 'Mat Tisco' })).toBeVisible();
        const header = await page.getByTestId('mobile-header').boundingBox();
        const back = await page.getByTestId('page-back').boundingBox();
        expect(header?.height ?? 0).toBeGreaterThan(40);
        expect((back?.y ?? 0) >= (header?.y ?? 0) + (header?.height ?? 0) - 1).toBe(true);
      } else {
        await expect(page.getByRole('button', { name: '‹ Equipo' })).toBeVisible();
      }
      await shot(page, `permisos-${mobile ? 'mobile' : 'desktop'}`);
      await page.goBack();
      await expect(page.getByTestId('settings-screen')).toBeVisible();
      await expect(page).toHaveURL(/#\/config$/);

      await page.evaluate(() => { window.location.hash = '#/config/equipo'; });
      await expect(page.getByTestId('team-screen')).toBeVisible();
      await expect(page.getByTestId('page-back')).toBeVisible();
      await page.goBack();
      await expect(page.getByTestId('settings-screen')).toBeVisible();

      await page.goto('/#/cajas');
      const cashSub = page.locator('.wsub');
      if (mobile) {
        await expect(cashSub).toHaveText('Ingresos, egresos y cierre');
        expect(await cashSub.evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(24);
      }
      await page.getByRole('button', { name: /Caja principal/ }).click();
      await expect(page.getByText(/18\/10\/2026 19:16/)).toBeVisible();
      await expect(page.getByText(/07:16/)).toHaveCount(0);
      await shot(page, `cajas-${mobile ? 'mobile' : 'desktop'}`);

      await page.goto('/#/ven');
      await page.getByRole('button', { name: 'Registrar venta' }).click();
      const client = page.getByPlaceholder('Escribí el nombre o elegí un cliente');
      await expect(client).toBeVisible();
      expect(await client.getAttribute('autocomplete')).toBe('off');
    });
  }

  test('el empleado no ve canjes ni invitar', async ({ page }) => {
    persona = 'staff';
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/dash');
    await expect(page.getByRole('heading', { name: /hoy/ })).toBeVisible();
    await expect(page.getByText('Canjes en curso')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nuevo canje' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Invitar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Registrar venta' })).toBeVisible();
    await shot(page, 'dashboard-empleado');
  });
});
