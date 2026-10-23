import { openDeskSection } from './navigation';
import { expect, test, type Page } from '@playwright/test';

const progress = {
  stage: 'done', eligible: false, active: false, dismissed: true, stock: 14, sales: true, team: true,
  catalog: true, installed: true, visible: false, samples: 0, storeNamed: true,
  steps: { store: true, stock: true, sale: true, team: true, install: true },
};

const sales = [
  { id: 's14', saleNumber: 14, date: '2026-10-18', clientId: 'c1', clientName: 'Juan Pérez', productId: 'p1', deviceLabel: 'iPhone 15 Pro 256GB', amount: 1380000, amountCurrency: 'ARS', paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA', sellerMemberId: 'm-lg' },
  { id: 's13', saleNumber: 13, date: '2026-10-18', clientId: 'c2', clientName: 'Sofía Díaz', productId: 'p2', deviceLabel: 'iPhone 13 128GB', amount: 850000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', sellerMemberId: 'm-mt' },
  { id: 's12', saleNumber: 12, date: '2026-10-17', clientId: 'c3', clientName: 'Martín Acosta', productId: 'p3', deviceLabel: 'iPhone 14 128GB', amount: 760000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', sellerMemberId: 'm-tr' },
  { id: 's11', saleNumber: 11, date: '2026-10-16', clientId: 'c4', clientName: 'Carla Ruiz', productId: 'p4', deviceLabel: 'iPhone 12 64GB', amount: 420000, amountCurrency: 'ARS', paymentMethod: 'TARJETA', status: 'PENDIENTE', sellerMemberId: 'm-lg' },
  { id: 's10', saleNumber: 10, date: '2026-10-15', clientId: 'c5', clientName: 'Diego Sosa', productId: 'p5', deviceLabel: 'iPhone 11 64GB', amount: 330000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', sellerMemberId: 'm-tr' },
];

const inventory = sales.map((sale, index) => ({
  id: sale.productId,
  imei: `35987654321000${index}`,
  model: sale.deviceLabel,
  capacity: '',
  color: '',
  condition: 'USADO',
  batteryHealth: '90%',
  price: sale.amount,
  cost: Math.round(sale.amount * 0.7),
  currency: 'ARS',
  grade: 'A',
  status: 'VENDIDO',
  createdAt: '2026-10-01T12:00:00Z',
  catalogIncluded: index < 8,
}));

const notifications = Array.from({ length: 2 }, (_, index) => ({
  id: `n-${index}`,
  storeId: 'store-1',
  section: 'inventory',
  title: 'Equipo',
  message: 'Stock',
  kind: 'updated',
  createdAt: '2026-10-18T15:20:00.000Z',
  readAt: null,
}));

const tradeIns = Array.from({ length: 2 }, (_, index) => ({
  id: `t-${index}`,
  tradeNumber: index + 1,
  date: '2026-10-18',
  clientName: 'Cliente',
  deviceReceived: 'iPhone',
  takeValue: 200000,
  currency: 'ARS',
  status: 'PENDIENTE',
}));

const repairs = Array.from({ length: 4 }, (_, index) => ({
  id: `r-${index}`,
  device: 'iPhone',
  status: 'RECIBIDO',
  clientName: 'Cliente',
}));

const followUps = {
  today: '2026-10-19',
  settings: {},
  cards: Array.from({ length: 3 }, (_, index) => ({ id: `f-${index}` })),
  groups: [],
};

let persona: 'owner' | 'staff' = 'owner';

async function installApi(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email: 'matias@example.test' }));
    localStorage.setItem('imanager:install-dismissed:ios', 'yes');
    localStorage.setItem('imanager:install-dismissed:android', 'yes');
  });
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({
    json: { compra: 1535, venta: 1555, fechaActualizacion: '2026-10-19T15:20:00-03:00' },
  }));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const staff = persona === 'staff';
    const json = (value: unknown) => route.fulfill({ json: value });
    if (path === '/api/me') {
      return json({
        user: {
          id: staff ? 'u-staff' : 'u-owner',
          firebaseUid: 'test-owner',
          displayName: staff ? 'Tomás Rey' : 'Matias Tiscornia',
          email: 'matias@example.test',
          avatarUrl: null,
        },
        store: {
          id: 'store-1',
          name: 'Tienda Ejemplo',
          currency: 'ARS',
          timezone: 'America/Argentina/Buenos_Aires',
          exchangeMode: 'auto',
          exchangeSource: 'blue',
        },
        membership: { role: staff ? 'STAFF' : 'OWNER', isDefault: true, sections: null },
        stores: [],
        onboardingRequired: false,
        billing: { plan: 'INTERNAL' },
      });
    }
    if (path === '/api/inventory') return json({ inventory });
    if (path === '/api/sales') return json({ sales });
    if (path === '/api/clients') return json({ clients: [] });
    if (path === '/api/clients/categories') return json({ categories: [] });
    if (path === '/api/trade-ins') return json({ tradeIns });
    if (path === '/api/repairs') return json({ orders: repairs });
    if (path === '/api/notifications') return json({ notifications });
    if (path === '/api/accounts/follow-ups') return json(followUps);
    if (path === '/api/onboarding/progress') return json(progress);
    if (path === '/api/commissions/sellers') return json({ sellers: [] });
    if (path === '/api/commissions/rules') return json({ rules: [] });
    if (path === '/api/commissions/mine') return json({ period: { key: '2026-10', label: 'octubre 2026', timezone: 'America/Argentina/Buenos_Aires' }, person: { pending: { ARS: 0, USD: 0 } } });
    if (path.startsWith('/api/commissions')) return json({ period: { key: '2026-10', label: 'octubre 2026', timezone: 'America/Argentina/Buenos_Aires' }, people: [], summary: { earned: { ARS: 0, USD: 0 }, paid: { ARS: 0, USD: 0 }, pending: { ARS: 0, USD: 0 }, salesCount: 0 } });
    if (path.includes('/drafts')) return json({ tradeIns: [] });
    if (path.endsWith('/members')) return json({ members: [] });
    if (path === '/api/invitations') return json({ invitations: [] });
    return json({});
  });
}

async function openSales(page: Page) {
  await page.goto('/');
  await expect(page.locator('.desk-app')).toBeVisible();
  await expect(page.getByText(/Matias Tiscornia|Tomás Rey/).first()).toBeVisible();
  await page.goto('/#/comercial/ventas');
  await expect(page.getByRole('heading', { name: 'Ventas', level: 1 })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Secciones del grupo' })).toHaveCount(0);
  await expect(page.locator('.ferr')).toHaveCount(0);
  await expect(page.getByText('$ 1.535').first()).toBeVisible();
}

async function shoot(page: Page, name: string, fit = false) {
  await page.mouse.move(1000, 280);
  const nav = page.locator('.dnav');
  if (await nav.count()) await nav.evaluate((node) => { node.scrollTop = 0; });
  await page.evaluate(() => document.fonts.ready);
  if (fit) {
    const height = await page.evaluate(() => {
      const app = document.querySelector('.desk-app') as HTMLElement | null;
      const stage = app?.querySelector('.stage') as HTMLElement | null;
      if (!app || !stage) return 900;
      const head = app.querySelector('.mhead') as HTMLElement | null;
      const tab = head ? Number.parseFloat(getComputedStyle(app).getPropertyValue('--tab-clearance')) || 78 : 0;
      return Math.ceil((head?.getBoundingClientRect().height ?? 0) + stage.scrollHeight + tab + 8);
    });
    const size = page.viewportSize();
    if (size) await page.setViewportSize({ width: size.width, height: Math.max(size.height, Math.min(height, 2400)) });
  }
  await page.screenshot({ path: `docs/pr-shots/${name}.png`, animations: 'disabled' });
}

test.describe('navegación con acordeón exclusivo', () => {
  test.beforeEach(async ({ page }) => {
    persona = 'owner';
    await installApi(page);
  });

  test('escritorio del propietario y teclado', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSales(page);
    const nav = page.getByRole('navigation', { name: 'Navegación principal' });
    const stock = nav.getByRole('button', { name: 'Stock', exact: true });
    await expect(stock).toHaveAttribute('aria-expanded', 'false');
    await stock.focus(); await page.keyboard.press('Enter');
    await expect(stock).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.locator('button[aria-expanded="true"]')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Ventas', level: 1 })).toBeVisible();
    await shoot(page, 'sidenav-stock-1440');
    const analysis = nav.getByRole('button', { name: 'Análisis', exact: true });
    await analysis.focus(); await page.keyboard.press('Space');
    await expect(stock).toHaveAttribute('aria-expanded', 'false');
    await expect(nav.locator('button[aria-expanded="true"]')).toHaveCount(1);
    await expect(nav.getByRole('button', { name: 'Resumen periódico' })).toBeVisible();
    await shoot(page, 'sidenav-analisis-1440');
    await openDeskSection(page, 'tradeins');
    await expect(page.getByRole('heading', { name: 'Canjes', level: 1 })).toBeVisible();
    await page.goto('/#/inv');
    await expect(page).toHaveURL(/#\/stock\/equipos$/);
  });

  test('escritorio del empleado', async ({ page }) => {
    persona = 'staff';
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSales(page);
    await expect(page.getByTestId('sidebar-tab-commissions')).toHaveText('Mis comisiones');
    for (const id of ['analisis', 'finanzas']) await expect(page.getByTestId(`nav-group-${id}`)).toHaveCount(0);
    for (const id of ['publicCatalog', 'expenses', 'followups', 'reports', 'periodicSummary']) await expect(page.getByTestId(`sidebar-tab-${id}`)).toHaveCount(0);
    await shoot(page, 'sidenav-empleado-1440');
  });

  test('más recupera el grupo activo y conserva la barra inferior', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSales(page);
    await page.getByTestId('sidebar-tab-more').click();
    await expect(page.getByTestId('nav-group-comercial').locator('button[aria-expanded]').first()).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('more-item-sales')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();
    await shoot(page, 'sidenav-mas-390');
    await openDeskSection(page, 'stockCount');
    await expect(page.getByRole('heading', { name: 'Control de stock', level: 1 })).toBeVisible();
  });
});
