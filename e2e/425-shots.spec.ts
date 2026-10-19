import { expect, test, type Page } from '@playwright/test';
import { me } from './pwa/fixtures.mjs';

const settings = {
  birthdayLeadDays: 7,
  warrantyMonths: 12,
  warrantyLeadDays: 15,
  inactiveDays: 180,
  includeDebts: true,
};

function card(partial: Record<string, unknown>) {
  return {
    phone: '11 6200-7525',
    title: 'no usar',
    detail: 'TEXTO VIEJO',
    amount: null,
    dueDate: null,
    lastPurchaseAt: null,
    warrantyEndsAt: null,
    deviceLabel: null,
    currency: 'ARS',
    installmentSequence: null,
    installmentCount: null,
    birthdayOn: null,
    turningAge: null,
    warrantyDays: null,
    ...partial,
  };
}

const cards = [
  card({ id: 'debt-lucia', kind: 'DEUDA', clientId: 'lucia', name: 'Lucía Fernández', phone: '11 6200-7525', amount: 640000, dueDate: '2026-10-02' }),
  card({ id: 'debt-nico', kind: 'DEUDA', clientId: 'nico', name: 'Nicolás Pereyra', phone: '11 4725-2919', amount: 420000, dueDate: '2026-10-20', installmentSequence: 2, installmentCount: 3 }),
  card({ id: 'debt-sofia', kind: 'DEUDA', clientId: 'sofia', name: 'Sofía Benítez', phone: '11 6053-4336', amount: 225000, dueDate: '2026-09-28' }),
  card({ id: 'birthday-martin', kind: 'CUMPLEANOS', clientId: 'martin', name: 'Martín Acosta', phone: '11 4539-9666', birthdayOn: '2026-10-19' }),
  card({ id: 'birthday-carla', kind: 'CUMPLEANOS', clientId: 'carla', name: 'Carla Ruiz', phone: '11 7426-5813', birthdayOn: '2026-10-22', turningAge: 30 }),
  card({ id: 'warranty-diego', kind: 'GARANTIA', clientId: 'diego', name: 'Diego Sosa', phone: '11 1200-5924', warrantyEndsAt: '2026-10-24', deviceLabel: 'iPhone 13 128GB', warrantyDays: 60 }),
  card({ id: 'warranty-julieta', kind: 'GARANTIA', clientId: 'julieta', name: 'Julieta Romero', phone: '11 8372-4161', warrantyEndsAt: '2026-10-30', deviceLabel: 'iPhone 14 Pro 256GB', warrantyDays: 30 }),
  card({ id: 'inactive-pablo', kind: 'INACTIVO', clientId: 'pablo', name: 'Pablo Ríos', phone: '', lastPurchaseAt: '2026-04-09', deviceLabel: 'iPhone 11' }),
  card({ id: 'inactive-laura', kind: 'INACTIVO', clientId: 'laura', name: 'Laura Méndez', phone: '11 2814-5387', lastPurchaseAt: '2026-03-22', deviceLabel: 'iPhone 12' }),
];

const groups = [
  { kind: 'DEUDA', count: 3, totalAmount: 1285000, currency: 'ARS' },
  { kind: 'CUMPLEANOS', count: 2, totalAmount: null, currency: null },
  { kind: 'GARANTIA', count: 2, totalAmount: null, currency: null },
  { kind: 'INACTIVO', count: 2, totalAmount: null, currency: null },
];

const clients = Array.from({ length: 48 }, (_, index) => ({
  id: `client-${index}`,
  dni: String(30000000 + index),
  name: index === 0 ? 'Lucía Fernández' : `Cliente ${index + 1}`,
  email: '',
  phone: '1144445555',
  lastPurchaseDate: '2026-10-01',
  totalSpent: 0,
  pendingBalance: index < 3 ? 1000 : 0,
}));

async function fit(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const height = await page.evaluate(() => {
    const app = document.querySelector('.desk-app') as HTMLElement | null;
    const stage = app?.querySelector('.stage') as HTMLElement | null;
    if (!app || !stage) return 900;
    const head = app.querySelector('.mhead') as HTMLElement | null;
    const tab = head ? Number.parseFloat(getComputedStyle(app).getPropertyValue('--tab-clearance')) || 78 : 0;
    return Math.ceil((head?.getBoundingClientRect().height ?? 0) + stage.scrollHeight + tab + 16);
  });
  const size = page.viewportSize();
  if (!size) return;
  const next = Math.max(size.height, Math.min(height, 2400));
  if (next !== size.height) await page.setViewportSize({ width: size.width, height: next });
}

async function shoot(page: Page, name: string) {
  await fit(page);
  await page.screenshot({ path: `docs/pr-shots/${name}.png`, animations: 'disabled' });
}

for (const width of [390, 1440]) {
  test(`seguimientos ${width}`, async ({ page }) => {
    const mobile = width === 390;
    await page.setViewportSize({ width, height: mobile ? 844 : 1100 });
    await page.addInitScript(() => {
      localStorage.setItem('imanager:install-dismissed:ios', 'yes');
      localStorage.setItem('imanager:install-dismissed:android', 'yes');
    });
    let mode: 'list' | 'empty' = 'list';
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
    await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1535, venta: 1555, fechaActualizacion: '2026-10-18T12:00:00Z' } }));
    await page.context().route('**/api/**', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const path = new URL(request.url()).pathname;
      const json = (value: unknown, status = 200) => route.fulfill({ json: value, status, headers: cors });
      if (path === '/api/me') {
        return json({
          ...me,
          user: { ...me.user, displayName: 'Matias Tiscornia', email: 'matias@example.test' },
          store: { ...me.store, name: 'iStore' },
          membership: { role: 'OWNER', isDefault: true },
          onboardingRequired: false,
        });
      }
      if (path === '/api/accounts/follow-ups') {
        return json(mode === 'empty'
          ? { today: '2026-10-18', settings, cards: [], groups: [] }
          : { today: '2026-10-18', settings, cards, groups });
      }
      if (path === '/api/clients') return json({ clients: mode === 'empty' ? clients : clients });
      if (path === '/api/onboarding/progress') {
        return json({ stage: 'done', eligible: false, active: false, dismissed: true, stock: 1, sales: true, team: true, catalog: false, installed: false, visible: false, samples: 0, storeNamed: true, steps: { store: true, stock: true, sale: true, team: true, install: true } });
      }
      if (path.endsWith('/members')) return json({ members: [] });
      if (path === '/api/invitations') return json({ invitations: [] });
      if (path === '/api/notifications') return json({ notifications: [] });
      return json({ inventory: [], sales: [], clients: [], tradeIns: [], repairs: [], categories: [], catalogs: {}, drafts: [], notifications: [] });
    });

    const openFollowUps = async () => {
      await page.goto('/');
      const email = page.getByTestId('login-email');
      if (await email.isVisible().catch(() => false)) {
        await email.fill('matias@example.test');
        await page.getByTestId('login-password').fill('test123456');
        await page.getByTestId('login-submit').click();
      }
      await expect(page.locator('.desk-app')).toBeVisible();
      await page.goto('/#/clientes');
      await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible();
      await page.getByRole('button', { name: 'Seguimientos' }).click();
      await expect(page.getByTestId('follow-ups')).toBeVisible();
    };

    await openFollowUps();
    await expect(page.getByText('Lucía Fernández')).toBeVisible();
    await expect(page.getByText('$ 1.285.000 en total')).toBeVisible();
    await expect(page.getByText('Debe desde el 02/10')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Escribirle a Lucía Fernández por WhatsApp' })).toBeVisible();
    await shoot(page, `425-seguimientos-${width}`);

    const missing = page.getByTestId('follow-INACTIVO').first();
    await expect(missing.getByRole('button', { name: mobile ? 'Agregar teléfono' : 'Agregar' })).toBeVisible();
    if (!mobile) {
      await missing.getByRole('button', { name: 'WhatsApp no disponible para Pablo Ríos' }).hover();
      await expect(page.getByRole('tooltip')).toHaveText('Cargá su teléfono para escribirle por WhatsApp');
    }
    await shoot(page, `425-sin-whatsapp-${width}`);

    mode = 'empty';
    await openFollowUps();
    await expect(page.getByTestId('follow-empty')).toBeVisible();
    await expect(page.getByText('Hoy no hay a quién escribir')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revisar reglas' })).toBeVisible();
    await shoot(page, `425-vacio-${width}`);
  });
}
