import { expect, test, type Page } from '@playwright/test';
import { me } from './pwa/fixtures.mjs';

const BOX = 'MLPF3LE/A F2LXK9POQ1 352098117744522';
const ONLY = '351204883022116';

function product(id: string, model: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    imei: `${id}`.padEnd(15, '0'),
    model,
    capacity: '128GB',
    color: 'Medianoche',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '90%',
    cost: 100,
    price: 850000,
    currency: 'ARS',
    status: 'DISPONIBLE',
    ...extra,
  };
}

async function boot(page: Page, width: number) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.addInitScript(() => {
    localStorage.setItem('imanager:install-dismissed:ios', 'yes');
    localStorage.setItem('imanager:install-dismissed:android', 'yes');
    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (original) {
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await original(constraints);
        for (const track of stream.getVideoTracks()) {
          const caps = track.getCapabilities?.bind(track);
          track.getCapabilities = () => ({ ...(caps ? caps() : {}), torch: true });
        }
        return stream;
      };
    }
    class Detector {
      static async getSupportedFormats() { return ['code_128', 'qr_code']; }
      async detect() {
        const raw = (window as Window & { __scan?: string }).__scan;
        return raw ? [{ rawValue: raw }] : [];
      }
    }
    (window as Window & { BarcodeDetector?: unknown }).BarcodeDetector = Detector;
  });
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
        user: { ...me.user, displayName: 'Matías Tiscornia', email: 'matias@example.test' },
        store: { ...me.store, name: 'Tienda Ejemplo' },
        membership: { role: 'OWNER', isDefault: true, sections: ['inventory', 'sales', 'tradeins', 'reports'] },
        onboardingRequired: false,
      });
    }
    if (path === '/api/inventory' && request.method() === 'GET') {
      return json({
        inventory: [
          product('a', 'iPhone 13'),
          product('b', 'iPhone 13', { id: 'b', capacity: '256GB' }),
          product('c', 'iPhone 11'),
          product('d', 'iPhone 14'),
          product('e', 'iPhone 12'),
        ],
      });
    }
    if (path === '/api/onboarding/progress') {
      return json({ stage: 'done', eligible: false, active: false, dismissed: true, stock: 1, sales: true, team: true, catalog: false, installed: false, visible: false, samples: 0, storeNamed: true, steps: { store: true, stock: true, sale: true, team: true, install: true } });
    }
    if (path.endsWith('/members')) return json({ members: [] });
    if (path === '/api/invitations') return json({ invitations: [] });
    if (path === '/api/notifications') return json({ notifications: [] });
    return json({ inventory: [], sales: [], clients: [], tradeIns: [], repairs: [], categories: [], catalogs: {}, drafts: [], notifications: [], suppliers: [] });
  });
  await page.goto('/');
  const email = page.getByTestId('login-email');
  if (await email.isVisible().catch(() => false)) {
    await email.fill('matias@example.test');
    await page.getByTestId('login-password').fill('test123456');
    await page.getByTestId('login-submit').click();
  }
  await expect(page.locator('.desk-app')).toBeVisible();
}

async function shoot(page: Page, name: string) {
  await page.screenshot({ path: `docs/pr-shots/${name}.png`, animations: 'disabled' });
}

test('carga rápida 1440', async ({ page }) => {
  await boot(page, 1440);
  await page.goto('/#/stock/equipos');
  await expect(page.getByRole('heading', { name: 'Inventario', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar equipo' }).click();
  const form = page.getByRole('dialog', { name: 'Registrar equipo' });
  await expect(form.getByRole('button', { name: 'Escanear con la cámara' })).toBeVisible();
  await expect(form.getByText('Listo para escanear · lector USB o Bluetooth')).toBeVisible();
  await shoot(page, '433-escaner-1440');

  await page.evaluate((value) => { (window as Window & { __scan?: string }).__scan = value; }, BOX);
  await form.getByRole('button', { name: 'Escanear con la cámara' }).click();
  await expect(page.getByTestId('scan-viewer')).toBeVisible();
  await expect(page.getByText('IMEI leído')).toBeVisible();
  await shoot(page, '433-visor-ok-1440');
  await page.getByRole('button', { name: 'Usar' }).click();
  const review = page.getByRole('dialog', { name: 'Revisá el equipo' });
  await expect(review.getByText('iPhone 13 · 128GB')).toBeVisible();
  await expect(review.getByText('Medianoche')).toBeVisible();
  await expect(review.getByText('Falta completar para guardar')).toBeVisible();
  const overflow = await review.evaluate((node) => node.scrollHeight - node.clientHeight);
  expect(overflow).toBeLessThanOrEqual(4);
  await shoot(page, '433-preview-1440');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Carga en serie' }).click();
  const batch = page.getByRole('dialog', { name: 'Carga en serie' });
  await batch.getByRole('button', { name: 'Editar' }).click();
  await batch.getByLabel('Modelo de la serie').fill('iPhone 13');
  await batch.getByLabel('Precio de la serie').fill('850000');
  await batch.getByRole('button', { name: 'Listo' }).click();
  await batch.getByLabel('IMEI').fill(ONLY);
  await batch.getByLabel('IMEI').press('Enter');
  await expect(batch.getByText('1 escaneado')).toBeVisible();
  await shoot(page, '433-serie-1440');
});

test('carga rápida 390 y serie', async ({ page }) => {
  await boot(page, 390);
  await page.goto('/#/stock/equipos');
  await expect(page.getByRole('heading', { name: 'Inventario', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar equipo' }).click();
  const form = page.getByRole('dialog', { name: 'Registrar equipo' });
  await expect(form.getByRole('button', { name: 'Escanear con la cámara' })).toBeVisible();
  await expect(form.getByText('Listo para escanear')).toBeVisible();
  await shoot(page, '433-boton-camara-390');

  await page.evaluate(() => { (window as Window & { __scan?: string }).__scan = ''; });
  await form.getByRole('button', { name: 'Escanear con la cámara' }).click();
  await expect(page.getByText('Apuntá al código de barras del IMEI')).toBeVisible();
  await shoot(page, '433-visor-390');
  await page.evaluate((value) => { (window as Window & { __scan?: string }).__scan = value; }, ONLY);
  await expect(page.getByText('IMEI leído')).toBeVisible();
  await page.getByRole('button', { name: 'Usar' }).click();
  const review = page.getByRole('dialog', { name: 'Revisá el equipo' });
  await expect(review.getByText('Este código trae solo el IMEI')).toBeVisible();
  await expect(review.getByRole('button', { name: 'iPhone 13' })).toBeVisible();
  await shoot(page, '433-preview-solo-390');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Carga en serie' }).first().click();
  const batch = page.getByRole('dialog', { name: 'Carga en serie' });
  await batch.getByRole('button', { name: 'Editar' }).click();
  await batch.getByLabel('Modelo de la serie').fill('iPhone 13');
  await batch.getByLabel('Precio de la serie').fill('850000');
  await batch.getByLabel('IMEI').fill(ONLY);
  await batch.getByLabel('IMEI').press('Enter');
  await batch.getByRole('button', { name: 'Listo' }).click();
  const counted = batch.getByText('1 escaneado');
  await counted.scrollIntoViewIfNeeded();
  await expect(counted).toBeVisible();
  await shoot(page, '433-serie-390');
  await page.keyboard.press('Escape');

  await page.goto('/#/comercial/ventas');
  await expect(page.getByRole('heading', { name: 'Ventas', level: 1 })).toBeVisible();
  await page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar venta' }).click();
  const sale = page.getByRole('dialog', { name: 'Registrar venta' });
  await sale.getByRole('combobox', { name: 'Equipo' }).fill(ONLY);
  await expect(sale.getByText('Este IMEI no está en tu stock')).toBeVisible();
  await shoot(page, '433-venta-sin-stock-390');
});

test('permiso de cámara 390', async ({ page }) => {
  await boot(page, 390);
  await page.goto('/#/stock/equipos');
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await page.getByRole('button', { name: 'Registrar equipo' }).click();
  await page.getByRole('button', { name: 'Escanear con la cámara' }).click();
  await expect(page.getByRole('dialog', { name: 'No tenemos acceso a la cámara' })).toBeVisible();
  await shoot(page, '433-permiso-390');
});
