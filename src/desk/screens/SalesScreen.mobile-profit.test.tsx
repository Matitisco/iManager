import { render, screen, within } from '@testing-library/react';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Sale } from '../../types';
import type { ReturnCaseView } from '../../services/returns-api';
import { partialReturn } from '../../test/return-fixtures';
import { ExchangeProvider } from '../exchange';
import { DeskProvider } from '../ui';
import { SalesScreen } from './SalesScreen';

const context = vi.hoisted(() => ({
  sales: [] as Sale[],
  inventory: [] as Product[],
  returns: [] as ReturnCaseView[] | null,
  clients: [],
  appSession: { membership: { role: 'OWNER', sections: null as string[] | null } },
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

function renderSales(currency: 'USD' | 'ARS' = 'USD') {
  return render(
    <ExchangeProvider settings={{ currency, exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 990, manualSell: 1000 }}>
      <DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
        <SalesScreen />
      </DeskProvider>
    </ExchangeProvider>,
  );
}

function profitRow() {
  return screen.getByText('Ganancia', { exact: true }).parentElement!;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ media: query, matches: query.includes('max-width'), onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  context.sales = [{
    id: 's', saleNumber: 1, date: '2026-10-01', clientId: 'c1', clientName: 'Cliente ficticio',
    productId: 'p', deviceLabel: 'Equipo ficticio', cantidad: 10, amount: 6500,
    amountCurrency: 'USD', paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA',
  }];
  context.inventory = [{
    id: 'p', model: 'Equipo ficticio', imei: '', capacity: '', color: '', condition: '', grade: '',
    batteryHealth: '', cost: 450, price: 650, currency: 'USD', status: 'VENDIDO',
  }];
  context.returns = [];
  context.appSession = { membership: { role: 'OWNER', sections: null } };
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('ganancia en cards mobile de Ventas', () => {
  it('muestra la ganancia por cantidad en una fila propia al pie, con privacidad de replay', () => {
    renderSales();
    const row = profitRow();
    expect(row).toHaveClass('sale-profit');
    expect(row.closest('.sale-card')!.lastElementChild).toBe(row);
    const net = within(row).getByLabelText('Ganancia neta');
    expect(net).toHaveTextContent('US$ 2.000');
    expect(net).toHaveClass('positive');
    expect(net).toHaveAttribute('data-ph-mask');
    expect(row.querySelector('del')).toBeNull();
  });

  it.each([undefined, 0, -1, Number.NaN])('muestra — cuando el costo no es conocido (%s)', cost => {
    context.inventory[0].cost = cost;
    renderSales();
    expect(within(profitRow()).getByLabelText('Ganancia neta')).toHaveTextContent('—');
    expect(profitRow().querySelector('del')).toBeNull();
  });

  it('muestra — cuando el equipo no está en inventario', () => {
    context.inventory = [];
    renderSales();
    expect(within(profitRow()).getByLabelText('Ganancia neta')).toHaveTextContent('—');
  });

  it('tacha el bruto y muestra el neto ámbar sólo por las devoluciones compensadas de esa venta', () => {
    context.returns = [
      partialReturn({ moneyAmount: 1300, saleAmount: 6500, itemCost: 450, compensatedOn: '2025-01-01' }),
      partialReturn({ id: 'other', saleId: 'other', moneyAmount: 6500 }),
      partialReturn({ id: 'pending', compensatedOn: null, resolvedOn: null }),
      partialReturn({ id: 'repair', resolution: 'REPARACION' }),
      partialReturn({ id: 'void', deletedAt: '2026-10-03' }),
    ];
    renderSales();
    const row = profitRow();
    const gross = within(row).getByLabelText('Ganancia antes de devoluciones');
    expect(gross.tagName).toBe('DEL');
    expect(gross).toHaveTextContent('US$ 2.000');
    expect(gross).toHaveAttribute('data-ph-mask');
    const net = within(row).getByLabelText('Ganancia neta');
    expect(net).toHaveTextContent('US$ 1.600');
    expect(net).toHaveClass('adjusted');
    expect(net.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([false, true])('muestra el signo menos y el tono rojo con devolución=%s', returned => {
    context.sales[0].amount = 4000;
    if (returned) context.returns = [partialReturn({ moneyAmount: 500, saleAmount: 6500, itemCost: 450 })];
    renderSales();
    const net = within(profitRow()).getByLabelText('Ganancia neta');
    expect(net).toHaveClass('negative');
    expect(net).toHaveTextContent(returned ? 'US$ -653,85' : 'US$ -500');
    expect(Boolean(profitRow().querySelector('del'))).toBe(returned);
  });

  it('cuenta la ganancia completa en una venta pendiente sin pagos', () => {
    Object.assign(context.sales[0], { status: 'PENDIENTE', paymentMethod: 'SIN_PAGO', openBalance: 6500 });
    renderSales();
    expect(within(profitRow()).getByLabelText('Ganancia neta')).toHaveTextContent('US$ 2.000');
  });

  it.each([
    ['MANAGER', ['sales'], false],
    ['MANAGER', ['sales', 'reports'], true],
    ['STAFF', ['sales'], true], // Conservar #691: STAFF ve finanzas temporalmente.
    ['OWNER', [], true],
  ] as const)('respeta canSeeFinancials para %s con secciones %j', (role, sections, allowed) => {
    context.appSession.membership = { role, sections: [...sections] };
    renderSales();
    expect(Boolean(screen.queryByText('Ganancia', { exact: true }))).toBe(allowed);
    expect(Boolean(screen.queryByLabelText('Ganancia neta'))).toBe(allowed);
    if (!allowed) expect(document.querySelector('.sale-card')).not.toHaveTextContent('2.000');
  });

  it('convierte costo y precio a la moneda activa como desktop', () => {
    renderSales('ARS');
    expect(within(profitRow()).getByLabelText('Ganancia neta')).toHaveTextContent('$ 2.000.000');
  });

  it('conserva el caso desktop de devolución con costo y equipo actual sin costo', () => {
    context.inventory = [];
    context.returns = [partialReturn({ moneyAmount: 1300, saleAmount: 6500, itemCost: 450 })];
    renderSales();
    expect(within(profitRow()).getByLabelText('Ganancia neta')).toHaveTextContent('US$ -400');
    expect(profitRow().querySelector('del')).toBeNull();
  });

  it('no inventa una ganancia mientras las devoluciones no están disponibles', () => {
    context.returns = null;
    renderSales();
    expect(within(profitRow()).getByLabelText('Ganancia neta')).toHaveTextContent('—');
  });

  it('conserva desktop con una sola ganancia neta sin pie ni tachado', () => {
    vi.mocked(window.matchMedia).mockImplementation(query => ({ media: query, matches: false, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    context.returns = [partialReturn({ moneyAmount: 1300, saleAmount: 6500, itemCost: 450 })];
    renderSales();
    expect(screen.getByRole('columnheader', { name: 'Ganancia' })).toBeInTheDocument();
    const cells = within(screen.getByText('Cliente ficticio').closest('tr')!).getAllByRole('cell');
    expect(cells[9]).toHaveTextContent('US$ 1.600');
    expect(document.querySelector('.sale-profit')).toBeNull();
    expect(document.querySelector('del')).toBeNull();
  });
});

describe.each(['light', 'dark'])('Variante B a 390 px (%s)', theme => {
  it('mantiene divisor, colores semánticos y montos dentro de cada card', async () => {
    const base = context.sales[0];
    context.sales = [
      base,
      { ...base, id: 'pending', saleNumber: 2, status: 'PENDIENTE', paymentMethod: 'SIN_PAGO' },
      { ...base, id: 'partial', saleNumber: 3 },
      { ...base, id: 'no-cost', saleNumber: 4, productId: '' },
      { ...base, id: 'negative', saleNumber: 5, amount: 4000 },
    ];
    context.returns = [partialReturn({ saleId: 'partial', moneyAmount: 1300, saleAmount: 6500, itemCost: 450 })];
    renderSales();
    const css = readFileSync(path.resolve('src/desk/desk.css'), 'utf8').replace(/^@import[^\n]*\n/, '');
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 2 });
      await page.setContent(`<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><style>body{margin:0}${css}</style><div class="desk-app"><main class="stage"><div class="dscreen sales-screen">${screen.getByTestId('sales-timeline').outerHTML}</div></main></div></html>`);
      expect(await page.locator('.sale-profit').count()).toBe(5);
      expect(await page.locator('.sale-equipment > span:first-child').allTextContents()).toEqual(Array(5).fill('Equipo ficticio'));
      expect(await page.locator('.sale-profit-net').allTextContents()).toEqual(['US$ -500', '—', 'US$ 1.600', 'US$ 2.000', 'US$ 2.000']);
      for (const row of await page.locator('.sale-profit').all()) {
        const dimensions = await row.evaluate(element => {
          const style = getComputedStyle(element);
          return { overflow: element.scrollWidth > element.clientWidth + 1, border: style.borderTopWidth, width: element.getBoundingClientRect().width, cardWidth: element.closest('.sale-card')!.getBoundingClientRect().width };
        });
        expect(dimensions.overflow).toBe(false);
        expect(dimensions.border).toBe('1px');
        expect(dimensions.width).toBeLessThanOrEqual(dimensions.cardWidth);
      }
      const colors = await page.locator('.sale-profit-net').evaluateAll(elements => elements.map(element => getComputedStyle(element).color));
      expect(colors[4]).toBe(theme === 'dark' ? 'rgb(143, 207, 168)' : 'rgb(28, 127, 81)');
      expect(colors[2]).toBe(theme === 'dark' ? 'rgb(224, 196, 110)' : 'rgb(184, 120, 18)');
      expect(colors[0]).toBe(theme === 'dark' ? 'rgb(232, 155, 148)' : 'rgb(220, 76, 76)');
      expect(await page.locator('.sale-profit del').evaluate(element => getComputedStyle(element).textDecorationLine)).toBe('line-through');
      expect(await page.locator('body').evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(390);
      if (process.env.SALE_PROFIT_SHOTS) {
        mkdirSync(process.env.SALE_PROFIT_SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(process.env.SALE_PROFIT_SHOTS, `mobile-profit-390-${theme}.png`) });
      }
    } finally {
      await browser.close();
    }
  });
});
