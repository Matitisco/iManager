import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import type { Client, Product, TradeIn } from '../types';
import { DeskProvider } from './ui';
import { SaleForm } from './overlays/operation';
import { TradeForm } from './overlays/trade';

const context = vi.hoisted(() => ({
  sales: [], tradeIns: [] as TradeIn[], inventory: [] as Product[], clients: [] as Client[],
  operationDrafts: [], operationOptions: {}, commissionSellers: [],
  loadOperationOptions: vi.fn(), fetchTradeOperation: vi.fn(), createOperation: vi.fn(), updateTradeIn: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('./scan/use-camera', () => ({ useCameraAvailable: () => true }));
const css = readFileSync('src/desk/desk.css', 'utf8').replace(/^@import[^\n]*\n/, '');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });
const run = vi.fn();
const trade: TradeIn = {
  id: 'trade', date: '22/10/2026', clientId: '', clientName: 'Ana Pérez',
  deviceReceived: 'iPhone 12', deviceReceivedImei: '', takeValue: 300,
  deviceGiven: 'iPhone 14', differencePaid: 500, status: 'PENDIENTE',
};
const modes = ['sale', 'new-trade', 'edit-trade', 'legacy-trade'] as const;
type Mode = typeof modes[number];

beforeEach(() => {
  vi.clearAllMocks();
  context.tradeIns = [];
  context.clients = [{ id: 'client', name: 'Ana Pérez', dni: '12345678', email: '', phone: '', lastPurchaseDate: '', totalSpent: 0, pendingBalance: 0 }];
  context.inventory = [{ id: 'product', model: 'iPhone 14', capacity: '128GB', color: 'Azul', imei: '123456789012345', condition: 'USADO', grade: 'A', batteryHealth: '90%', price: 800, status: 'DISPONIBLE' }];
  context.operationOptions = { sales: { products: context.inventory, clients: context.clients }, tradeins: { products: context.inventory, clients: context.clients } };
  context.loadOperationOptions.mockResolvedValue(undefined);
  context.fetchTradeOperation.mockResolvedValue({});
});

function mount(width: number, mode: Mode) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query.includes('max-width') && width <= 760, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  if (mode === 'edit-trade') context.tradeIns = [{ ...trade, confirmationStatus: 'PENDING', draftDeviceLabel: 'iPhone 14', draftAmount: 800 }];
  if (mode === 'legacy-trade') context.tradeIns = [trade];
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
    {mode === 'sale' ? <SaleForm run={run} busy={false} error={null} /> : <TradeForm id={mode.includes('edit') || mode === 'legacy-trade' ? 'trade' : undefined} run={run} busy={false} error={null} />}
  </DeskProvider></div>);
}
async function copyToBrowser(page: Page) {
  await page.setContent(`<!doctype html><style>${css}</style><body style="margin:0">${document.querySelector('.desk-app')!.outerHTML}</body>`);
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); });
}
async function assertLayout(page: Page) {
  const metrics = await page.locator('.sheet').evaluate(sheet => {
    const body = sheet.querySelector<HTMLElement>(':scope > .sheet-scroll')!;
    const rect = (node: Element) => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, height: b.height }; };
    const controls = [...body.querySelectorAll('input:not([type="checkbox"]):not(.ds-select-native), button.scan-cam, button.sg, button.ds-select-trigger')].filter(node => node.getBoundingClientRect().height > 0);
    const collisions = controls.flatMap((a, index) => controls.slice(index + 1).filter(b => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 1 && Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 1;
    }).map(b => `${a.outerHTML} intersects ${b.outerHTML}`));
    return {
      overflow: getComputedStyle(body).overflowY, scrollable: body.scrollHeight > body.clientHeight,
      horizontalOverflow: body.scrollWidth - body.clientWidth,
      positioned: [...body.querySelectorAll('.fl, .frow, .eqs, .scan-imei, .err, .eqs-list')].filter(node => ['absolute', 'fixed'].includes(getComputedStyle(node).position)).map(node => node.className),
      collisions,
      header: rect(sheet.querySelector(':scope > .sheet-h')!), footer: rect(sheet.querySelector(':scope > .sheet-foot')!),
      cameraAligned: [...body.querySelectorAll('.scan-imei')].every(row => Math.abs(row.querySelector('input')!.getBoundingClientRect().top - row.querySelector('.scan-cam')!.getBoundingClientRect().top) < 1),
    };
  });
  expect(metrics.overflow).toBe('auto');
  expect(metrics.scrollable).toBe(true);
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(metrics.positioned).toEqual([]);
  expect(metrics.collisions).toEqual([]);
  expect(metrics.cameraAligned).toBe(true);
  const equipment = page.locator('.sheet .eqs:has(.scan-imei)').first();
  const spacing = await equipment.count() ? await equipment.evaluate(node => {
    const next = node.nextElementSibling;
    return next ? next.getBoundingClientRect().top - node.querySelector('input')!.getBoundingClientRect().bottom : 16;
  }) : 16;
  expect(spacing).toBeGreaterThanOrEqual(12);
  await page.locator('.sheet-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
  const end = await page.locator('.sheet').evaluate(sheet => {
    const header = sheet.querySelector('.sheet-h')!.getBoundingClientRect();
    const footer = sheet.querySelector('.sheet-foot')!.getBoundingClientRect();
    const last = sheet.querySelector('.sheet-scroll')!.lastElementChild!.getBoundingClientRect();
    return { headerY: header.y, footerY: footer.y, lastBottom: last.bottom, footerBottom: footer.bottom };
  });
  expect(end.headerY).toBe(metrics.header.y);
  expect(end.footerY).toBe(metrics.footer.y);
  expect(end.lastBottom).toBeLessThanOrEqual(end.footerY);
  expect(end.footerBottom).toBeLessThanOrEqual(page.viewportSize()!.height);
}

describe.each([1440, 390])('operation form layout at %ipx', width => {
  it.each(modes)('%s keeps fields in flow and only the body scrolls', async mode => {
    mount(width, mode);
    const dialog = screen.getByRole('dialog');
    const body = dialog.querySelector<HTMLElement>('.sheet-scroll')!;
    const footer = dialog.querySelector<HTMLElement>('.sheet-foot')!;
    expect(body).toContainElement(screen.getByLabelText('Cliente'));
    expect(body).not.toContainElement(footer);
    expect(footer).toContainElement(screen.getByRole('button', { name: mode === 'sale' ? 'Confirmar venta' : mode === 'legacy-trade' ? 'Guardar cambios' : 'Confirmar canje' }));
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    try { await copyToBrowser(page); await assertLayout(page); }
    finally { await page.close(); }
  });

  it.each(modes)('%s gives validation messages their own row', async mode => {
    mount(width, mode);
    if (mode !== 'sale') fireEvent.change(screen.getByLabelText('IMEI (opcional)'), { target: { value: '1234' } });
    if (mode === 'legacy-trade') fireEvent.change(screen.getByLabelText('Equipo que recibís'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: mode === 'sale' ? 'Confirmar venta' : mode === 'legacy-trade' ? 'Guardar cambios' : 'Confirmar canje' }));
    expect(run).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.fl.bad .err').length).toBeGreaterThan(0);
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    try {
      await copyToBrowser(page); await assertLayout(page);
      const errors = await page.locator('.fl.bad').evaluateAll(fields => fields.map(field => ({
        errorTop: field.querySelector('.err')!.getBoundingClientRect().top,
        inputBottom: field.querySelector('input')!.getBoundingClientRect().bottom,
      })));
      errors.forEach(error => expect(error.errorTop).toBeGreaterThanOrEqual(error.inputBottom));
    } finally { await page.close(); }
  });

  it('client and equipment suggestions push the next field down', async () => {
    mount(width, 'sale');
    const client = screen.getByRole('combobox', { name: 'Cliente' });
    fireEvent.change(client, { target: { value: 'Ana' } });
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    try {
      await copyToBrowser(page);
      const gap = await page.locator('.eqs-list').evaluate(list => list.closest('.eqs')!.nextElementSibling!.getBoundingClientRect().top - list.getBoundingClientRect().bottom);
      expect(gap).toBeGreaterThanOrEqual(12);
      expect(await page.locator('.eqs-list').evaluate(node => getComputedStyle(node).position)).toBe('static');
    } finally { await page.close(); }
    fireEvent.blur(client);
    const equipment = screen.getByRole('combobox', { name: 'Equipo' });
    fireEvent.change(equipment, { target: { value: 'iPhone' } });
    expect(screen.getByRole('listbox')).toHaveAttribute('id', 'sale-equipment-list');
    const equipmentPage = await browser.newPage({ viewport: { width, height: 844 } });
    try {
      await copyToBrowser(equipmentPage);
      const gap = await equipmentPage.locator('#sale-equipment-list').evaluate(list => list.closest('.eqs')!.nextElementSibling!.getBoundingClientRect().top - list.getBoundingClientRect().bottom);
      expect(gap).toBeGreaterThanOrEqual(12);
      expect(await equipmentPage.locator('#sale-equipment-list').evaluate(node => getComputedStyle(node).position)).toBe('static');
    } finally { await equipmentPage.close(); }
    fireEvent.change(screen.getByRole('combobox', { name: 'Equipo' }), { target: { value: 'iPhone manual' } });
    await waitFor(() => expect(screen.getByTestId('unlisted-equipment')).toBeInTheDocument());
    expect(within(screen.getByTestId('unlisted-equipment')).getByLabelText('Capacidad')).toBeInTheDocument();
  });

  it.each(['sale', 'new-trade'] as const)('%s keeps filled fields and the last control reachable', async mode => {
    mount(width, mode);
    fireEvent.change(screen.getByRole('combobox', { name: 'Cliente' }), { target: { value: 'Ana' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Ana Pérez/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Equipo' }), { target: { value: 'iPhone 14' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /iPhone 14/ }));
    if (mode === 'new-trade') {
      fireEvent.change(screen.getByLabelText('Equipo recibido'), { target: { value: 'iPhone 12' } });
      fireEvent.change(screen.getByLabelText('IMEI (opcional)'), { target: { value: '356789104523871' } });
      fireEvent.change(screen.getByLabelText('Valor tomado'), { target: { value: '300' } });
    }
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    try { await copyToBrowser(page); await assertLayout(page); }
    finally { await page.close(); }
  });

  it('keeps the bulk sale unit price and total readable without horizontal overflow', async () => {
    context.inventory = [{ ...context.inventory[0], imei: '', cantidad: 10 }];
    context.operationOptions = { sales: { products: context.inventory, clients: context.clients } };
    mount(width, 'sale');
    fireEvent.change(screen.getByRole('combobox', { name: 'Equipo' }), { target: { value: 'iPhone 14' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /iPhone 14/ }));
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '5' } });
    expect(screen.getByLabelText('Precio por unidad')).toHaveValue('800');
    expect(screen.getByLabelText('Total')).toHaveTextContent('$ 4.000');
    const page = await browser.newPage({ viewport: { width, height: width === 1440 ? 900 : 844 }, deviceScaleFactor: width === 390 ? 2 : 1 });
    try {
      await copyToBrowser(page);
      await assertLayout(page);
      await page.locator('.op-total').scrollIntoViewIfNeeded();
      const metrics = await page.locator('.op-total').evaluate(row => {
        const value = row.querySelector('strong')!;
        const bounds = value.getBoundingClientRect();
        return { weight: getComputedStyle(value).fontWeight, right: bounds.right, width: window.innerWidth };
      });
      expect(Number(metrics.weight)).toBeGreaterThanOrEqual(700);
      expect(metrics.right).toBeLessThanOrEqual(metrics.width);
      if (process.env.UNITPRICE_SHOTS) await page.screenshot({ path: `${process.env.UNITPRICE_SHOTS}/sale-${width}.png` });
    } finally { await page.close(); }
  });

  it('keeps expanded payments and installments in the scrolling body', async () => {
    mount(width, 'sale');
    fireEvent.change(screen.getByRole('combobox', { name: 'Cliente' }), { target: { value: 'Ana' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Ana Pérez/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Combinar pagos' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Financiar en cuotas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    expect(screen.getByLabelText('Importe del pago 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Primer vencimiento')).toBeInTheDocument();
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    try { await copyToBrowser(page); await assertLayout(page); }
    finally { await page.close(); }
  });
});
