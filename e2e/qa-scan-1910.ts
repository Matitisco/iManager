import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import {
  acceptInvitationViaApi,
  authHeaders,
  bootstrapStoreViaApi,
  buildTestEmail,
  createInventoryItemViaApi,
  createStoreViaApi,
  fetchInventory,
  fetchSession,
} from './utils';

const API = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
const FIXTURES = path.resolve('e2e/fixtures/barcodes');

export const BOX = 'MLPF3LE/A F2LXK9POQ1 352098117744522';
export const IMEI = '352098117744522';
export const ONLY = '351204883022116';
export const UNKNOWN_IMEI = '353911220588306';
export const UNKNOWN_BOX = 'ZZZZ9LL/A F2LXK9POQ1 353911220588306';
export const BAD_LUHN = '352098117744521';
export const OTHER = '490154203237518';

const PNG: Record<string, string> = {
  box: 'code128-box.png',
  unknown: 'code128-unknown.png',
  imei: 'code128-imei.png',
  'qr-imei': 'qr-imei.png',
  'qr-box': 'qr-box.png',
  'qr-bad': 'qr-bad-luhn.png',
  'qr-short': 'qr-short.png',
};

function dataUrl(name: keyof typeof PNG) {
  const bytes = readFileSync(path.join(FIXTURES, PNG[name]));
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

const FAKE_CAMERA = `
(() => {
  const win = window;
  try {
  win.__barcodePng = '';
  win.__torch = false;
  win.__denyCamera = false;
  win.__lastTorch = null;
  try {
    localStorage.setItem('imanager:install-dismissed:ios', 'yes');
    localStorage.setItem('imanager:install-dismissed:android', 'yes');
  } catch (error) {}

  const paint = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('sin canvas');
    let current = '';
    let img = new Image();
    const draw = () => {
      const next = win.__barcodePng || '';
      if (next !== current) {
        current = next;
        img = new Image();
        img.src = next;
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!img.complete || !img.width) return;
      const scale = Math.min((canvas.width - 80) / img.width, (canvas.height - 80) / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    draw();
    const stream = canvas.captureStream(12);
    const timer = window.setInterval(draw, 70);
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.addEventListener('ended', () => window.clearInterval(timer));
      const enableTorch = Boolean(win.__torch);
      const previous = track.getCapabilities && track.getCapabilities.bind(track);
      track.getCapabilities = () => {
        const caps = Object.assign({}, previous ? previous() : {});
        if (enableTorch) caps.torch = true;
        else delete caps.torch;
        return caps;
      };
      const apply = track.applyConstraints && track.applyConstraints.bind(track);
      track.applyConstraints = async (constraints) => {
        const advanced = constraints && constraints.advanced;
        const torch = advanced && advanced.find((item) => typeof item.torch === 'boolean');
        if (torch) win.__lastTorch = torch.torch;
        if (apply) await apply(constraints);
      };
    }
    return stream;
  };

  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: async () => [],
        getUserMedia: async () => { throw new DOMException('no media', 'NotFoundError'); },
      },
    });
  }
  const listDevices = async () => [{
    kind: 'videoinput',
    deviceId: 'fake-cam',
    label: 'Cámara de prueba',
    groupId: 'fake',
    toJSON() { return this; },
  }];
  const openCamera = async () => {
    if (win.__denyCamera) throw new DOMException('denied', 'NotAllowedError');
    return paint();
  };
  const patch = () => {
    const fakeMedia = {
      enumerateDevices: listDevices,
      getUserMedia: openCamera,
      getSupportedConstraints: () => ({}),
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
      ondevicechange: null,
    };
    try {
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, get: () => fakeMedia });
    } catch (error) {
      const media = navigator.mediaDevices;
      if (!media) return;
      try { media.enumerateDevices = listDevices; } catch (ignored) {}
      try { media.getUserMedia = openCamera; } catch (ignored) {}
    }
  };
  patch();
  setTimeout(patch, 0);
  document.addEventListener('DOMContentLoaded', patch);
  window.addEventListener('load', patch);
  } catch (error) {}
})();
`;

export async function installFakeCamera(page: Page) {
  await page.addInitScript({ content: FAKE_CAMERA });
}

export async function useBarcode(page: Page, name: keyof typeof PNG, options?: { torch?: boolean; deny?: boolean }) {
  await page.evaluate(({ png, torch, deny }) => {
    const win = window as Window & { __barcodePng?: string; __torch?: boolean; __denyCamera?: boolean };
    win.__barcodePng = png;
    win.__torch = Boolean(torch);
    win.__denyCamera = Boolean(deny);
  }, { png: dataUrl(name), torch: options?.torch ?? false, deny: options?.deny ?? false });
}

export async function bootStore(page: Page, request: Parameters<typeof bootstrapStoreViaApi>[1], testInfo: TestInfo, slug: string) {
  const email = buildTestEmail(testInfo, slug);
  await installFakeCamera(page);
  await bootstrapStoreViaApi(page, request, email, `QA escaneo ${slug}`);
  return email;
}

export async function seedStore(request: Parameters<typeof bootstrapStoreViaApi>[1], email: string, storeName: string) {
  let session: Awaited<ReturnType<typeof fetchSession>> | null = null;
  let last = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      session = await fetchSession(request, email);
      break;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  if (!session) throw new Error(last || 'Sin sesión');
  if (session.onboardingRequired) await createStoreViaApi(request, email, storeName);
}

export async function closeSheets(page: Page) {
  for (let step = 0; step < 4; step += 1) {
    const dialog = page.getByRole('dialog').last();
    if (!(await dialog.isVisible().catch(() => false))) return;
    const cancel = dialog.getByRole('button', { name: 'Cancelar' });
    const close = dialog.getByRole('button', { name: 'Cerrar' });
    if (await cancel.isVisible().catch(() => false)) await cancel.click();
    else if (await close.isVisible().catch(() => false)) await close.click();
    else await page.keyboard.press('Escape');
  }
}

export async function openEquipos(page: Page) {
  await page.goto('/#/stock/equipos');
  await expect(page.getByRole('heading', { name: 'Inventario', level: 1 })).toBeVisible();
}

export async function wedge(page: Page, field: Locator, text: string) {
  await field.click();
  await page.keyboard.type(text, { delay: 8 });
  await page.keyboard.press('Enter');
}

export async function shoot(page: Page, name: string) {
  await page.screenshot({ path: `docs/pr-shots/qa-1910-${name}.png`, animations: 'disabled' });
}

export function registerScanQa(width: 390 | 1440) {
  const phone = width === 390;

  test(`cámara Code128 y QR, IMEI y part number (${width})`, async ({ page, request }, testInfo) => {
    test.setTimeout(150_000);
    const email = await bootStore(page, request, testInfo, `cam-${width}`);
    await openEquipos(page);
    await page.getByRole('button', { name: 'Registrar equipo' }).first().click();
    const form = page.getByRole('dialog', { name: 'Registrar equipo' });
    await expect(form.getByRole('button', { name: 'Escanear con la cámara' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Linterna' })).toHaveCount(0);

    const zxing: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('zxing')) zxing.push(req.url());
    });
    await useBarcode(page, 'qr-short', { torch: true });
    await form.getByRole('button', { name: 'Escanear con la cámara' }).click();
    const viewer = page.getByTestId('scan-viewer');
    await expect(viewer).toBeVisible();
    await expect(viewer.getByText('Apuntá al código de barras del IMEI')).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Linterna' })).toBeVisible();
    await viewer.getByRole('button', { name: 'Linterna' }).click();
    await expect.poll(() => page.evaluate(() => (window as Window & { __lastTorch?: boolean | null }).__lastTorch)).toBe(true);
    await useBarcode(page, 'box', { torch: true });
    await expect(viewer.getByText('IMEI leído')).toBeVisible({ timeout: 15_000 });
    await expect(viewer.getByText('iPhone 13 · 128GB · Medianoche')).toBeVisible();
    expect(zxing.length).toBeGreaterThan(0);
    if (!phone) await shoot(page, 'code128-1440');
    else await shoot(page, 'code128-390');
    await viewer.getByRole('button', { name: 'Usar' }).click();

    const review = page.getByRole('dialog', { name: 'Revisá el equipo' });
    await expect(review.getByText('iPhone 13 · 128GB')).toBeVisible();
    await expect(review.getByText('Medianoche')).toBeVisible();
    await expect(review.getByText('MLPF3LE/A')).toBeVisible();
    await expect(review.getByText('detectado', { exact: true })).toBeVisible();
    await review.getByRole('button', { name: 'Editar' }).click();
    await review.getByLabel('Color detectado').fill('Grafito');
    await expect(review.getByText('editado', { exact: true })).toBeVisible();
    if (!phone) {
      await review.evaluate((node) => Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
      const box = await review.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.y).toBeGreaterThanOrEqual(-1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(901);
      const overflow = await review.evaluate((node) => node.scrollHeight - node.clientHeight);
      expect(overflow).toBeLessThanOrEqual(4);
      await shoot(page, 'revision-1440');
    } else {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      expect(wide).toBe(false);
      await shoot(page, 'revision-390');
    }
    await review.getByLabel('Precio de venta').fill('850000');
    await review.getByRole('button', { name: 'Guardar equipo' }).click();
    await expect(review).toBeHidden({ timeout: 15_000 });
    const saved = await fetchInventory(request, email);
    expect(saved.inventory.some((item) => item.imei === IMEI && item.model === 'iPhone 13' && item.color === 'Grafito')).toBeTruthy();

    await page.getByRole('button', { name: 'Registrar equipo' }).first().click();
    await useBarcode(page, 'qr-imei');
    await page.getByRole('dialog', { name: 'Registrar equipo' }).getByRole('button', { name: 'Escanear con la cámara' }).click();
    await expect(page.getByText('IMEI leído')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Usar' }).click();
    const only = page.getByRole('dialog', { name: 'Revisá el equipo' });
    await expect(only.getByText('Este código trae solo el IMEI')).toBeVisible();
    await closeSheets(page);

    await page.getByRole('button', { name: 'Registrar equipo' }).first().click();
    await useBarcode(page, 'unknown');
    await page.getByRole('dialog', { name: 'Registrar equipo' }).getByRole('button', { name: 'Escanear con la cámara' }).click();
    await expect(page.getByText('IMEI leído')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Usar' }).click();
    const unknown = page.getByRole('dialog', { name: 'Revisá el equipo' });
    await expect(unknown.getByText('ZZZZ9LL/A')).toBeVisible();
    await expect(unknown.getByText('Completá el modelo')).toBeVisible();
    await expect(unknown.getByLabel('Buscar modelo')).toHaveValue('');
    await closeSheets(page);

    await page.getByRole('button', { name: 'Registrar equipo' }).first().click();
    await useBarcode(page, 'qr-bad');
    await page.getByRole('dialog', { name: 'Registrar equipo' }).getByRole('button', { name: 'Escanear con la cámara' }).click();
    await expect(page.getByText('No pudimos leer un IMEI válido')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Usar' })).toHaveCount(0);
    await closeSheets(page);
    await page.getByRole('button', { name: 'Registrar equipo' }).first().click();
    await useBarcode(page, 'qr-short');
    await page.getByRole('dialog', { name: 'Registrar equipo' }).getByRole('button', { name: 'Escanear con la cámara' }).click();
    await expect(page.getByText('No pudimos leer un IMEI válido')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('scan-viewer').getByRole('button', { name: 'Cerrar' }).click();
  });

  test(`BarcodeDetector tiene prioridad y sin linterna no hay botón (${width})`, async ({ page, request }, testInfo) => {
    await bootStore(page, request, testInfo, `detector-${width}`);
    await page.addInitScript(() => {
      class Detector {
        static async getSupportedFormats() { return ['code_128', 'qr_code']; }
        async detect() { return [{ rawValue: 'MLPF3LE/A F2LXK9POQ1 352098117744522' }]; }
      }
      (window as Window & { BarcodeDetector?: unknown }).BarcodeDetector = Detector;
    });
    await page.reload();
    await openEquipos(page);
    const zxing: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('zxing')) zxing.push(req.url());
    });
    await page.getByRole('button', { name: 'Registrar equipo' }).first().click();
    await useBarcode(page, 'box', { torch: false });
    await page.getByRole('button', { name: 'Escanear con la cámara' }).click();
    await expect(page.getByText('IMEI leído')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Linterna', exact: true })).toHaveCount(0);
    expect(zxing).toEqual([]);
  });

  test(`permiso de cámara denegado (${width})`, async ({ page, request }, testInfo) => {
    await bootStore(page, request, testInfo, `deny-${width}`);
    await openEquipos(page);
    await page.evaluate(() => {
      (window as Window & { __denyCamera?: boolean }).__denyCamera = true;
    });
    await page.getByRole('button', { name: 'Registrar equipo' }).first().click();
    await page.getByRole('button', { name: 'Escanear con la cámara' }).click();
    const denied = page.getByRole('dialog', { name: 'No tenemos acceso a la cámara' });
    await expect(denied).toBeVisible();
    await expect(denied.getByText('Ajustes › Apps › Safari › Cámara')).toBeVisible();
    await expect(denied.getByText('Ajustes › iManager › Cámara')).toBeVisible();
    if (phone) await shoot(page, 'permiso-390');
  });

  test(`lector, duplicados, vendido, archivado y otra tienda (${width})`, async ({ page, request }, testInfo) => {
    test.setTimeout(90_000);
    const email = await bootStore(page, request, testInfo, `batch-${width}`);
    const otherEmail = buildTestEmail(testInfo, `otra-${width}`);
    await seedStore(request, otherEmail, `Otra tienda ${width}`);
    await createInventoryItemViaApi(request, otherEmail, { imei: OTHER, model: 'iPhone ajeno', price: 1000 });
    await createInventoryItemViaApi(request, email, { imei: ONLY, model: 'iPhone en stock', price: 1000, status: 'DISPONIBLE' });
    const sold = await createInventoryItemViaApi(request, email, { imei: IMEI, model: 'iPhone vendido', price: 1000, status: 'VENDIDO' });
    const archived = await createInventoryItemViaApi(request, email, { imei: UNKNOWN_IMEI, model: 'iPhone archivado', price: 1000 });
    const removed = await request.delete(`${API}/api/inventory/${archived.inventoryItem.id}`, { headers: authHeaders(email) });
    expect(removed.ok()).toBeTruthy();
    await page.goto('/#/stock/equipos');
    await expect(page.getByRole('heading', { name: 'Inventario', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Registrar equipo' }).first().click();
    const single = page.getByRole('dialog', { name: 'Registrar equipo' });
    await wedge(page, single.getByLabel('IMEI (opcional)'), BAD_LUHN);
    await expect(single.getByText('El IMEI no pasa el control de dígito')).toBeVisible();
    await expect(single.getByLabel('IMEI (opcional)')).toHaveValue('');
    await expect(single.getByLabel('Proveedor')).toBeEnabled();
    await wedge(page, single.getByLabel('IMEI (opcional)'), ONLY);
    await expect(single.getByLabel('Proveedor')).toBeFocused();
    await expect(single.getByLabel('IMEI (opcional)')).toHaveValue(ONLY);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Carga en serie' }).first().click();
    const batch = page.getByRole('dialog', { name: 'Carga en serie' });
    await batch.getByRole('button', { name: 'Editar' }).click();
    await batch.getByLabel('Modelo de la serie').fill('iPhone 13');
    await batch.getByLabel('Precio de la serie').fill('850000');
    await batch.getByRole('button', { name: 'Listo' }).click();
    const imei = batch.getByLabel('IMEI');
    await wedge(page, imei, BAD_LUHN);
    await expect(batch.getByText('IMEI inválido · no se carga')).toBeVisible();
    await wedge(page, imei, '12345678901234');
    await expect(batch.getByText('El código no trae un IMEI de 15 dígitos.')).toBeVisible();
    await wedge(page, imei, ONLY);
    await expect(batch.getByText('Ya está en stock · no se carga')).toBeVisible();
    await wedge(page, imei, ONLY);
    await expect(batch.getByText('Repetido en esta carga · no se carga')).toBeVisible();
    await wedge(page, imei, IMEI);
    await expect(batch.getByText('Ya estuvo en stock (vendido) · se carga igual')).toBeVisible();
    await wedge(page, imei, UNKNOWN_IMEI);
    await expect(batch.getByText('Ya estuvo archivado · se carga igual')).toBeVisible();
    await wedge(page, imei, OTHER);
    const foreign = batch.getByText('49 015420 323751 8');
    await foreign.scrollIntoViewIfNeeded();
    await expect(foreign).toBeVisible();
    await expect(batch.getByText('Ya está en stock · no se carga')).toHaveCount(1);
    if (!phone) await shoot(page, 'serie-1440');
    else await shoot(page, 'serie-390');
    await batch.getByRole('button', { name: /Cargar \d+ equipos/ }).click();
    await expect(batch).toBeHidden({ timeout: 15_000 });
    const after = await fetchInventory(request, email);
    const restocked = after.inventory.filter((item) => item.imei === IMEI);
    expect(restocked.filter((item) => item.model === 'iPhone 13' && item.status === 'DISPONIBLE')).toHaveLength(1);
    expect(restocked.some((item) => item.status === 'VENDIDO' && item.model === 'iPhone vendido')).toBeTruthy();
    expect(after.inventory.filter((item) => item.imei === UNKNOWN_IMEI)).toHaveLength(1);
    expect(after.inventory.filter((item) => item.imei === OTHER)).toHaveLength(1);
    expect(after.inventory.filter((item) => item.imei === ONLY && item.status !== 'VENDIDO')).toHaveLength(1);
    expect(sold.inventoryItem.id).toBeTruthy();
  });

  test(`control de stock lee la etiqueta y el IMEI vendido (${width})`, async ({ page, request }, testInfo) => {
    test.setTimeout(90_000);
    const email = await bootStore(page, request, testInfo, `stock-${width}`);
    await createInventoryItemViaApi(request, email, { imei: ONLY, model: 'iPhone 13', capacity: '128GB', color: 'Azul', price: 900000 });
    await createInventoryItemViaApi(request, email, { imei: IMEI, model: 'iPhone vendido', price: 800000, status: 'VENDIDO' });
    await page.goto('/#/stock/control');
    await expect(page.getByRole('heading', { name: 'Control de stock', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar control' }).click();
    await page.getByRole('dialog', { name: 'Iniciar control de stock' }).getByRole('button', { name: 'Iniciar control' }).click();
    const input = page.getByTestId('stock-scan-input');
    await expect(input).toBeVisible();
    await wedge(page, input, `MLPF3LE/A F2LXK9POQ1 ${ONLY}`);
    await expect(page.getByRole('status').getByText(/Encontrado/)).toBeVisible();
    await expect(input).toHaveValue('');
    await wedge(page, input, `MLPF3LE/A F2LXK9POQ1 ${ONLY}`);
    await expect(page.getByRole('status').getByText('Repetido')).toBeVisible();
    await wedge(page, input, BOX);
    await expect(page.getByRole('status').getByText(/Figura vendido/)).toBeVisible();
    await useBarcode(page, 'qr-imei');
    await page.getByRole('button', { name: 'Escanear con la cámara' }).click();
    await expect(page.getByText('IMEI leído')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Usar' }).click();
    await expect(page.getByRole('status').getByText('Repetido')).toBeVisible();
    if (phone) await shoot(page, 'stock-390');
    else await shoot(page, 'stock-1440');
  });

  test(`venta sin stock vuelve cargada y el canje toma el equipo (${width})`, async ({ page, request }, testInfo) => {
    test.setTimeout(90_000);
    const email = await bootStore(page, request, testInfo, `venta-${width}`);
    await createInventoryItemViaApi(request, email, { imei: ONLY, model: 'iPhone 13', capacity: '128GB', price: 900000, color: 'Azul' });
    await page.goto('/#/comercial/ventas');
    await expect(page.getByRole('heading', { name: 'Ventas', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Registrar venta' }).first().click();
    const sale = page.getByRole('dialog', { name: 'Registrar venta' });
    await sale.getByLabel('Cliente').fill('Ana Pérez');
    await sale.getByLabel('Precio completo de salida').fill('250000');
    await wedge(page, sale.getByRole('combobox', { name: 'Equipo' }), UNKNOWN_IMEI);
    await expect(sale.getByText('Este IMEI no está en tu stock')).toBeVisible();
    if (phone) await shoot(page, 'venta-390');
    await sale.getByRole('button', { name: '+ Registrar equipo' }).click();
    const review = page.getByRole('dialog', { name: 'Revisá el equipo' });
    await review.getByRole('button', { name: 'iPhone 13' }).click();
    await review.getByLabel('Precio de venta').fill('250000');
    await review.getByRole('button', { name: 'Guardar equipo' }).click();
    const back = page.getByRole('dialog', { name: 'Registrar venta' });
    await expect(back).toBeVisible({ timeout: 15_000 });
    await expect(back.getByLabel('Cliente')).toHaveValue('Ana Pérez');
    await expect(back.getByRole('combobox', { name: 'Equipo' })).toHaveValue(/iPhone 13/);
    await expect(back.getByLabel('Precio completo de salida')).not.toHaveValue('');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Registrar venta' }).first().click();
    const again = page.getByRole('dialog', { name: 'Registrar venta' });
    await useBarcode(page, 'imei');
    await again.getByRole('button', { name: 'Escanear con la cámara' }).click();
    await expect(page.getByText('IMEI leído')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Usar' }).click();
    await expect(again.getByRole('combobox', { name: 'Equipo' })).toHaveValue(/iPhone 13/);
    await page.keyboard.press('Escape');

    await page.goto('/#/comercial/canjes');
    await expect(page.getByRole('heading', { name: 'Canjes', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Nuevo canje' }).first().click();
    const trade = page.getByRole('dialog', { name: 'Nuevo canje' });
    const received = trade.locator('.scan-imei').filter({ has: page.getByLabel('IMEI (opcional)') });
    await useBarcode(page, 'box', { torch: false });
    await received.getByRole('button', { name: 'Escanear con la cámara' }).click();
    await expect(page.getByText('IMEI leído')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Usar' }).click();
    await expect(trade.getByLabel('IMEI (opcional)')).toHaveValue(IMEI);
    await expect(trade.getByLabel('Equipo recibido')).toHaveValue(/iPhone 13/);
    await trade.getByLabel('Equipo recibido').fill('');
    await wedge(page, trade.getByLabel('IMEI (opcional)'), BOX);
    await expect(trade.getByLabel('Equipo recibido')).toHaveValue(/iPhone 13/);
    await expect(trade.getByLabel('Valor tomado')).toBeFocused();
  });
}

export async function inviteStaffWithoutInventory(request: Parameters<typeof bootstrapStoreViaApi>[1], ownerEmail: string, staffEmail: string) {
  const response = await request.post(`${API}/api/invitations`, {
    headers: { ...authHeaders(ownerEmail), 'Content-Type': 'application/json' },
    data: { role: 'STAFF', email: staffEmail, sections: ['dashboard', 'sales', 'clients'] },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json() as { token: string };
  await acceptInvitationViaApi(request, staffEmail, body.token);
}
