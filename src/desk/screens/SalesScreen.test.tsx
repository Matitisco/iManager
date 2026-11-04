import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Sale } from '../../types';
import { DeskProvider } from '../ui';
import { ExchangeProvider } from '../exchange';
import { SalesScreen } from './SalesScreen';
import { partialReturn } from '../../test/return-fixtures';
import type { ReturnCaseView } from '../../services/returns-api';

const context = vi.hoisted(() => ({
  sales: [] as Sale[],
  returns: [] as ReturnCaseView[],
  clients: [] as never[],
  inventory: [] as Product[],
  appSession: null as { membership?: { role?: string; sections?: string[] | null }; store?: { id: string } } | null,
  commissionSellers: [] as { id: string; name: string; role: 'OWNER' | 'MANAGER' | 'STAFF' }[],
  loadCommissionSellers: vi.fn(async () => undefined),
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
const flags = vi.hoisted(() => ({ IMPORT_SALES_ENABLED: false }));
vi.mock('../../config/featureFlags', () => flags);

function sale(number: number, overrides: Partial<Sale> = {}): Sale {
  return {
    id: String(number),
    saleNumber: number,
    date: '2026-10-01',
    clientId: '',
    clientName: `Cliente ${number}`,
    productId: '',
    deviceLabel: `Equipo ${number}`,
    amount: number * 1000,
    paymentMethod: number === 1 ? 'EFECTIVO' : 'TRANSFERENCIA',
    status: number === 1 ? 'PENDIENTE' : 'COMPLETADA',
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <SalesScreen />
    </DeskProvider>,
  );
}

// El período «Mes» son los últimos 30 días: sin fecha fija, estas pruebas dependen del día en que corren.
beforeEach(() => {
  context.returns = [];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
});
afterEach(() => { vi.useRealTimers(); });

describe.each([390, 1440])('sale quantities at %ipx', width => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18, 12));
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ media: query, matches: width === 390 && query.includes('max-width'), onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    context.sales = [
      sale(1, { cantidad: 5 }),
      sale(2),
      sale(3, { cantidad: 2 }),
      sale(4, { cantidad: 20, status: 'ANULADA' }),
      sale(5, { cantidad: 30, date: '2026-01-01' }),
    ];
    context.clients = [];
    context.inventory = [];
    context.appSession = { membership: { role: 'OWNER', sections: null } };
    context.commissionSellers = [];
  });

  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('etiqueta Seña en la lista conservando el filtro Pendiente', async () => {
    context.sales = [sale(1, { hasInitialDeposit: true }), sale(2)];
    renderScreen();
    const row = screen.getByText('Cliente 1').closest(width === 390 ? '.sale-card' : 'tr')!;
    expect(within(row as HTMLElement).getByText('Seña', { exact: true })).toBeVisible();
    if (width === 390) {
      await userEvent.click(within(screen.getByTestId('sales-status')).getByRole('button', { name: 'Estado' }));
      await userEvent.click(screen.getByRole('button', { name: 'Pendiente' }));
    } else {
      await userEvent.click(screen.getByRole('button', { name: 'Filtrar estado' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Pendiente' }));
    }
    expect(screen.getByText('Cliente 1')).toBeVisible();
    expect(screen.queryByText('Cliente 2')).not.toBeInTheDocument();
  });

  it('conserva los centavos USD en precio unitario y total de cada venta', () => {
    const amounts = [25.8, 1.5, 1.6, 100];
    context.sales = amounts.map((amount, index) => sale(index + 1, { amount, amountCurrency: 'USD', status: 'COMPLETADA' }));
    render(<ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1200, manualSell: 1250 }}>
      <DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><SalesScreen /></DeskProvider>
    </ExchangeProvider>);
    for (const [index, expected] of ['25,80', '1,50', '1,60', '100'].entries()) {
      const row = screen.getByText(`Cliente ${index + 1}`).closest(width === 390 ? '.sale-card' : 'tr')!;
      const shown = within(row as HTMLElement).getAllByText(`US$ ${expected}`, { exact: true });
      expect(shown).toHaveLength(width === 390 ? 1 : 2);
    }
    expect(context.sales.map(row => row.amount)).toEqual(amounts);
  });

  it('shows a desktop quantity column or mobile badges and preserves the period summary', async () => {
    renderScreen();
    const row = (buyer: string) => screen.getByText(buyer).closest(width === 390 ? '.sale-card' : 'tr')!;
    expect(row('Cliente 2')).toHaveTextContent('Equipo 2');
    if (width === 390) {
      expect(row('Cliente 1').querySelector('.sale-quantity')).toHaveTextContent('x5');
      expect(row('Cliente 2').querySelector('.sale-quantity')).toBeNull();
      expect(row('Cliente 3').querySelector('.sale-quantity')).toHaveTextContent('x2');
      expect(row('Cliente 4').querySelector('.sale-quantity')).toHaveTextContent('x20');
      expect(row('Cliente 1').querySelector('.sale-equipment > span:first-child')).toHaveTextContent(/^Equipo 1$/);
      expect(screen.queryByRole('columnheader', { name: 'Cant.' })).not.toBeInTheDocument();
    } else {
      const headers = screen.getAllByRole('columnheader');
      expect(headers.map(header => header.textContent)).toEqual(['', 'Venta', 'Fecha', 'Cliente', 'Equipo', 'Cant.', 'Vendedor', 'Precio unit.', 'Total', 'Ganancia', 'Estado']);
      for (const [buyer, equipment, quantity] of [['Cliente 1', 'Equipo 1', '5'], ['Cliente 2', 'Equipo 2', '1'], ['Cliente 3', 'Equipo 3', '2'], ['Cliente 4', 'Equipo 4', '20']]) {
        const cells = within(row(buyer) as HTMLElement).getAllByRole('cell');
        expect(cells).toHaveLength(headers.length);
        expect(cells[4]).toHaveTextContent(new RegExp(`^${equipment}$`));
        expect(cells[5]).toHaveTextContent(new RegExp(`^${quantity}$`));
      }
      expect(document.querySelector('.sale-quantity')).toBeNull();
    }
    expect(screen.queryByText('Cliente 5')).not.toBeInTheDocument();
    const units = screen.getByText('Unidades vendidas').parentElement!;
    expect(within(units).getByText('8')).toBeInTheDocument();
    expect(screen.getByText('3 ventas')).toBeInTheDocument();

    // List-only filters leave all summary cards scoped to the selected period.
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    if (width === 390) await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.type(screen.getByPlaceholderText('Buscar cliente, equipo o número'), 'Cliente 1');
    expect(screen.queryByText('Cliente 3')).not.toBeInTheDocument();
    expect(within(units).getByText('8')).toBeInTheDocument();
  });

  it('shows total profit for five units with the active currency and excludes unknown costs', () => {
    context.sales = [
      sale(1, { cantidad: 5, productId: 'usd', amount: 800, amountCurrency: 'USD', status: 'COMPLETADA' }),
      sale(2, { cantidad: 5, productId: 'ars', amount: 1000, amountCurrency: 'USD' }),
      sale(3, { amount: 9000, amountCurrency: 'USD' }),
      sale(4, { cantidad: 5, productId: 'usd', status: 'ANULADA' }),
      sale(5, { cantidad: 5, productId: 'usd', date: '2026-01-01' }),
    ];
    context.inventory = [
      { id: 'usd', cost: 100, currency: 'USD' },
      { id: 'ars', cost: 120000, currency: 'ARS' },
    ] as Product[];
    render(
      <ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 990, manualSell: 1000 }}>
        <DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
          <SalesScreen />
        </DeskProvider>
      </ExchangeProvider>,
    );
    const profit = screen.getByText('Ganancia total').parentElement!;
    expect(within(profit).getByText('US$ 700')).toBeInTheDocument();
    expect(within(profit).getByText('1 venta sin costo no incluida')).toBeInTheDocument();
    if (width === 1440) {
      const cell = (buyer: string) => within(screen.getByText(buyer).closest('tr')!).getAllByRole('cell')[9];
      expect(cell('Cliente 1')).toHaveTextContent(/^US\$ 300$/);
      expect(cell('Cliente 2')).toHaveTextContent(/^US\$ 400$/);
      expect(cell('Cliente 3')).toHaveTextContent(/^—$/);
      expect(cell('Cliente 4')).toHaveTextContent(/^—$/);
    }
  });

  it('asks for equipment costs when no sale has a known cost', () => {
    renderScreen();
    const profit = screen.getByText('Ganancia total').parentElement!;
    expect(within(profit).getByText('—')).toBeInTheDocument();
    expect(within(profit).getByText('Cargá el costo en el equipo')).toBeInTheDocument();
  });

  it('descuenta dos de diez unidades en facturación y ganancia', () => {
    context.sales = [sale(1, { cantidad: 10, amount: 1000, productId: 'p', status: 'COMPLETADA', amountCurrency: 'ARS' })];
    context.inventory = [{ id: 'p', cost: 60, currency: 'ARS' }] as Product[];
    context.returns = [partialReturn({ saleId: '1', moneyCurrency: 'ARS', itemCurrency: 'ARS' })];
    renderScreen();
    expect(screen.getByText('Facturación total').parentElement).toHaveTextContent('$ 800');
    expect(screen.getByText('Ganancia total').parentElement).toHaveTextContent('$ 320');
    if (width === 1440) expect(within(screen.getByText('Cliente 1').closest('tr')!).getAllByRole('cell')[9]).toHaveTextContent('$ 320');
  });

  it('counts absent or invalid quantities as one unit', () => {
    context.sales = [sale(1, { cantidad: 0 }), sale(2, { cantidad: NaN }), sale(3, { cantidad: 1 })];
    renderScreen();
    expect(within(screen.getByText('Unidades vendidas').parentElement!).getByText('3')).toBeInTheDocument();
    expect(screen.queryByText(/^x\d+$/)).not.toBeInTheDocument();
    if (width === 1440) {
      expect([...document.querySelectorAll('tbody .sale-quantity-cell')].map(cell => cell.textContent)).toEqual(['1', '1', '1']);
    }
  });
});

describe('Sales desktop unit price and profit', () => {
  beforeEach(() => {
    context.clients = [];
    context.commissionSellers = [];
    context.appSession = { membership: { role: 'OWNER', sections: null } };
    context.inventory = [{ id: 'eq', cost: 20, currency: 'ARS' }] as Product[];
    context.sales = [sale(1, { productId: 'eq', amount: 100, cantidad: 3 })];
  });

  const cells = () => within(screen.getByText('Cliente 1').closest('tr')!).getAllByRole('cell');

  it.each([
    [{}, '$ 33,33'],
    [{ cantidad: undefined }, '$ 100'],
    [{ cantidad: 0 }, '$ 100'],
    [{ unitPrice: null }, '$ 33,33'],
    [{ unitPrice: 12.345 }, '$ 12,35'],
    [{ unitPrice: 0 }, '$ 0'],
  ] as const)('shows the stored unit price or total divided by quantity (%j)', (overrides, expected) => {
    context.sales[0] = { ...context.sales[0], ...overrides };
    renderScreen();
    expect(cells()[6]).toHaveTextContent('Sin vendedor');
    expect(cells()[7].textContent).toBe(expected);
    expect(cells()[8]).toHaveTextContent(/^\$ 100$/);
    expect(cells()[9]).toHaveTextContent(context.sales[0].cantidad ? /^\$ 40$/ : /^\$ 80$/);
    expect(screen.getByRole('columnheader', { name: /Vendedor/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Pago/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filtrar pago' })).not.toBeInTheDocument();
  });

  it.each([undefined, 0, -1, NaN])('shows a dash for missing or unknown equipment cost (%s)', cost => {
    context.inventory = cost === undefined ? [] : [{ id: 'eq', cost }] as Product[];
    renderScreen();
    expect(cells()[9]).toHaveTextContent(/^—$/);
  });

  it('preserves negative profit', () => {
    context.sales[0].amount = 30;
    renderScreen();
    expect(cells()[9]).toHaveTextContent(/^\$ -30$/);
  });

  it.each([
    ['OWNER', null, true],
    ['STAFF', ['sales'], true],
    ['MANAGER', ['sales', 'reports'], true],
    ['MANAGER', ['sales'], false],
  ] as const)('uses the summary financial permission for %s with sections %j', (role, sections, permitted) => {
    context.appSession = { membership: { role, sections: sections ? [...sections] : null } };
    renderScreen();
    expect(Boolean(screen.queryByText('Ganancia total'))).toBe(permitted);
    expect(Boolean(screen.queryByRole('columnheader', { name: 'Ganancia' }))).toBe(permitted);
    expect(cells()).toHaveLength(permitted ? 11 : 10);
    if (!permitted) expect(cells()[9]).toHaveTextContent('Pendiente');
  });

  it.each(['ARS', 'USD'] as const)('formats the unit price in the same active currency as Total (%s)', currency => {
    context.sales[0] = { ...context.sales[0], amount: 100000, amountCurrency: 'ARS' };
    render(
      <ExchangeProvider settings={{ currency, exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 990, manualSell: 1000 }}>
        <DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
          <SalesScreen />
        </DeskProvider>
      </ExchangeProvider>,
    );
    expect(cells()[7]).toHaveTextContent(currency === 'ARS' ? /^\$ 33\.333,33$/ : /^US\$ 33,33$/);
    expect(cells()[8]).toHaveTextContent(currency === 'ARS' ? /^\$ 100\.000$/ : /^US\$ 100$/);
  });
});

describe('Sales column filters', () => {
  beforeEach(() => {
    context.sales = [
      ...Array.from({ length: 11 }, (_, index) => sale(index + 1)),
      sale(12, { clientName: 'Ana Pérez', deviceLabel: 'Pixel', amount: 900000, date: '2026-10-02' }),
    ];
    context.clients = [];
    context.inventory = [];
    context.appSession = null;
    context.commissionSellers = [];
    context.loadCommissionSellers.mockClear();
  });

  it('keeps sales visible and logs a failed secondary seller directory', async () => {
    const cause = new Error('No se pudieron cargar los vendedores');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    context.loadCommissionSellers.mockRejectedValueOnce(cause);
    renderScreen();
    await waitFor(() => expect(warn).toHaveBeenCalledWith('No se pudieron cargar los vendedores.', cause));
    expect(screen.getByText('Cliente 11')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
    expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
    expect(document.querySelector('.ferr')).not.toBeInTheDocument();
    warn.mockRestore();
  });

  it('opens unassigned sales from the selected commission month, including historical periods', () => {
    context.sales.push(sale(13, { date: '2026-09-01', clientName: 'Venta histórica sin vendedor' }));
    sessionStorage.setItem('commission-unassigned', '2026-09');
    renderScreen();
    expect(screen.getByText('Venta histórica sin vendedor')).toBeInTheDocument();
    expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument();
    expect(screen.getByText(/Ventas sin vendedor de septiembre/)).toBeInTheDocument();
    expect(sessionStorage.getItem('commission-unassigned')).toBeNull();
  });

  it('filters with the search, resets to page 1 and keeps the header when nothing matches', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();

    expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument();
    expect(screen.getByText('1–8 de 12')).toBeInTheDocument();
    expect(screen.getByText('12 ventas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtrar cliente' }));
    const client = screen.getByRole('dialog', { name: 'Filtrar cliente' });
    await user.type(within(client).getByRole('textbox', { name: 'Contiene' }), 'ana');
    expect(screen.getByRole('button', { name: 'Filtrar cliente' })).toHaveClass('on');
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument();
    expect(screen.getByTestId('sales-filter-summary')).toHaveTextContent('1 de 12 ventas');
    expect(screen.getByTestId('sales-filter-summary')).toHaveTextContent('900.000');
    expect(screen.getByText('12 ventas')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Buscar cliente, equipo o número'), 'pixel');
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText('Buscar cliente, equipo o número'));

    await user.click(screen.getByRole('button', { name: 'Filtrar estado' }));
    await user.click(screen.getByRole('checkbox', { name: 'Pendiente' }));
    expect(screen.getByText('No hay ventas con ese filtro.')).toHaveClass('table-empty');
    expect(screen.getByRole('button', { name: 'Filtrar cliente' })).toBeInTheDocument();
    expect(screen.getByText('12 ventas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sales-hero')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-dock')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Venta/ })).toBeInTheDocument();
  });

  it('temporarily shows staff billing and margin without reports access', () => {
    context.sales = [sale(1, { amount: 1000, productId: 'eq', status: 'COMPLETADA' })];
    context.inventory = [{
      id: 'eq', imei: '123456789012345', model: 'Pixel', capacity: '128 GB', color: 'Negro',
      condition: 'NUEVO', grade: '', batteryHealth: '100', cost: 400, price: 1000, status: 'VENDIDO',
    }];

    context.appSession = { membership: { role: 'OWNER', sections: null } };
    const owner = renderScreen();
    expect(screen.getByText('Facturación total')).toBeInTheDocument();
    expect(screen.getByText('Ganancia total')).toBeInTheDocument();
    expect(screen.getByText('≈ 60%')).toBeInTheDocument();
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument();
    owner.unmount();

    context.appSession = { membership: { role: 'STAFF', sections: ['sales', 'reports'] } };
    const granted = renderScreen();
    expect(screen.getByText('Facturación total')).toBeInTheDocument();
    expect(screen.getByText('Ganancia total')).toBeInTheDocument();
    expect(screen.getByText('≈ 60%')).toBeInTheDocument();
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument();
    granted.unmount();

    context.appSession = { membership: { role: 'STAFF', sections: ['sales'] } };
    const staff = renderScreen();
    expect(screen.getByText('Facturación total')).toBeInTheDocument();
    expect(screen.getByText('Ganancia total')).toBeInTheDocument();
    expect(screen.getByText('≈ 60%')).toBeInTheDocument();
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument();
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();
    staff.unmount();

    context.appSession = { membership: { role: 'MANAGER', sections: ['sales'] } };
    renderScreen();
    expect(screen.queryByText('Facturación total')).not.toBeInTheDocument();
    expect(screen.queryByText('Ganancia total')).not.toBeInTheDocument();
  });
});

describe('Sales on a phone', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('760'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    context.sales = [
      sale(1, { clientName: 'Cliente Ejemplo', deviceLabel: 'iPhone 13', amount: 650000, paymentMethod: 'EFECTIVO', status: 'PENDIENTE', date: '2026-10-05' }),
      sale(2, { clientName: 'Ana Pérez', deviceLabel: 'Pixel', amount: 480000, paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA', date: '2026-10-04' }),
    ];
    context.clients = [];
    context.inventory = [];
    context.appSession = { membership: { role: 'OWNER', sections: null } };
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('shows the hero, the timeline and the dock without the desktop table', () => {
    renderScreen();
    expect(screen.getByTestId('sales-hero')).toHaveTextContent('Facturación total');
    expect(screen.getByTestId('sales-hero')).toHaveTextContent('Ticket promedio');
    expect(screen.getByTestId('sales-hero')).toHaveTextContent('Ganancia total');
    const timeline = screen.getByTestId('sales-timeline');
    expect(timeline).toHaveTextContent('#V-0002');
    expect(timeline).toHaveTextContent('Ana Pérez');
    expect(timeline).toHaveTextContent('Pixel');
    expect(timeline).toHaveTextContent('Transferencia');
    expect(timeline).toHaveTextContent('Completada');
    expect(screen.getByTestId('mobile-dock')).toHaveTextContent('Registrar venta');
    expect(screen.getAllByTestId('row-menu').length).toBeGreaterThan(0);
    expect(screen.queryByRole('columnheader', { name: /Venta/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('sales-period')).toHaveTextContent('Mes');
    expect(screen.getByTestId('sales-status')).toHaveTextContent('Estado');
  });

  it('shows billing and margin on a phone when the employee can open reports', () => {
    context.appSession = { membership: { role: 'STAFF', sections: ['sales', 'reports'] } };
    renderScreen();
    expect(screen.getByTestId('sales-hero')).toHaveTextContent('Facturación total');
    expect(screen.getByTestId('sales-hero')).toHaveTextContent('Ganancia total');
  });

  it('temporarily shows staff billing and margin on a phone without reports access', () => {
    context.appSession = { membership: { role: 'STAFF', sections: ['sales'] } };
    renderScreen();
    expect(screen.getByText('Facturación total')).toBeInTheDocument();
    expect(screen.getByText('Ganancia total')).toBeInTheDocument();
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  });

  it('filters by status and shows the empty period', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const view = renderScreen();
    await user.click(within(screen.getByTestId('sales-status')).getByRole('button', { name: 'Estado' }));
    await user.click(screen.getByRole('button', { name: 'Pendiente' }));
    expect(screen.getByText('Cliente Ejemplo')).toBeInTheDocument();
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
    view.unmount();

    context.sales = [];
    renderScreen();
    expect(screen.getByTestId('sales-empty')).toHaveTextContent('No hay ventas');
    expect(screen.queryByText('0 resultados')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar venta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar primera venta' })).toBeInTheDocument();
    expect(within(screen.getByTestId('mobile-dock')).getByRole('button', { name: 'Registrar venta' })).toBeInTheDocument();
  });

  it('filters by seller from the sheet, including sales without a seller', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.commissionSellers = [
      { id: 'lucia', name: 'Lucía', role: 'STAFF' },
      { id: 'martin', name: 'Martín', role: 'STAFF' },
    ];
    context.sales = [
      sale(1, { sellerMemberId: 'lucia', clientName: 'Juan Domínguez', amount: 980, date: '2026-10-16' }),
      sale(2, { sellerMemberId: 'lucia', clientName: 'Ana Pérez', amount: 430, date: '2026-10-15' }),
      sale(3, { clientName: 'Mostrador', amount: 100, date: '2026-10-14' }),
    ];
    renderScreen();
    const timeline = screen.getByTestId('sales-timeline');
    expect(timeline.querySelectorAll('.av-c').length).toBe(3);
    expect(timeline).toHaveTextContent('Juan Domínguez');
    await user.click(screen.getByTestId('sales-seller-chip'));
    const sheet = screen.getByRole('dialog', { name: 'Vendedor' });
    expect(within(sheet).getByRole('checkbox', { name: /Lucía/ })).not.toBeChecked();
    expect(within(sheet).getByText('2')).toBeInTheDocument();
    expect(within(sheet).getByRole('checkbox', { name: /Sin vendedor/ })).toBeInTheDocument();
    expect(within(sheet).getByRole('checkbox', { name: /Martín/ })).toBeInTheDocument();
    await user.click(within(sheet).getByRole('checkbox', { name: /Lucía/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Ver 2 ventas' }));
    expect(screen.queryByRole('dialog', { name: 'Vendedor' })).not.toBeInTheDocument();
    expect(screen.getByTestId('sales-seller-chip')).toHaveTextContent('Lucía');
    expect(screen.getByTestId('sales-filter-summary')).toHaveTextContent('2 de 3 ventas');
    expect(screen.getByTestId('sales-filter-summary')).toHaveTextContent('1.410');
    expect(screen.getByText('Juan Domínguez')).toBeInTheDocument();
    expect(screen.queryByText('Mostrador')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar filtro de vendedor' }));
    expect(screen.getByText('Mostrador')).toBeInTheDocument();
    expect(screen.queryByTestId('sales-filter-summary')).not.toBeInTheDocument();
  });
});

describe('Seller column filter', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    context.sales = [
      sale(1, { sellerMemberId: 'lucia', clientName: 'Juan Domínguez', amount: 980, date: '2026-10-16' }),
      sale(2, { sellerMemberId: 'lucia', clientName: 'Ana Pérez', amount: 430, date: '2026-10-15' }),
      sale(3, { clientName: 'Mostrador', amount: 100, date: '2026-10-14' }),
    ];
    context.clients = [];
    context.inventory = [];
    context.appSession = null;
    context.commissionSellers = [
      { id: 'lucia', name: 'Lucía', role: 'STAFF' },
      { id: 'martin', name: 'Martín', role: 'STAFF' },
    ];
  });

  it('filters with the vendedor checkboxes and clears the total', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    const headers = screen.getAllByRole('columnheader');
    await user.click(within(headers[6]).getByRole('button', { name: 'Filtrar vendedor' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtrar vendedor' });
    expect(within(dialog).getByRole('checkbox', { name: 'Lucía' })).not.toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Sin vendedor' })).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Martín' })).toBeInTheDocument();
    expect(within(dialog).getByText('2')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Lucía' }));
    expect(screen.getByText('Juan Domínguez')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Mostrador')).not.toBeInTheDocument();
    expect(screen.getByTestId('sales-filter-summary')).toHaveTextContent('2 de 3 ventas');
    expect(screen.getByTestId('sales-seller-chip')).toHaveTextContent('Vendedor: Lucía');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Sin vendedor' }));
    expect(screen.getByText('Mostrador')).toBeInTheDocument();
    expect(screen.getByTestId('sales-seller-chip')).toHaveTextContent('Vendedor: 2');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByTestId('sales-seller-chip')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('keeps Total filtering the sale total beside the moved unit price', async () => {
    context.sales[0].cantidad = 10;
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    const headers = screen.getAllByRole('columnheader');
    const cells = within(screen.getByText('Juan Domínguez').closest('tr')!).getAllByRole('cell');
    expect(cells[6]).toHaveTextContent('Lucía');
    expect(headers[7]).toHaveTextContent(/^Precio unit\.$/);
    expect(headers[7]).toHaveClass('r');
    expect(cells[7]).toHaveTextContent(/^\$ 98$/);
    expect(cells[7]).toHaveClass('r');
    expect(cells[8]).toHaveTextContent(/^\$ 980$/);
    await user.click(within(headers[8]).getByRole('button', { name: 'Filtrar total' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtrar total' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Mínimo' }), '500');
    expect(screen.getByText('Juan Domínguez')).toBeInTheDocument();
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
    expect(screen.queryByText('Mostrador')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Mostrador')).toBeInTheDocument();
  });
});


describe.each([390, 1440])('unified void status at %ipx', width => {
  const originalMedia = window.matchMedia;
  afterEach(() => { window.matchMedia = originalMedia; });
  it('shows cancelled and voided sales in red in Todos and in the single Anulada filter', async () => {
    window.matchMedia = vi.fn(query => ({ media: query, matches: width === 390 && query.includes('max-width'), onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    context.sales = [sale(1, { status: 'COMPLETADA' }), sale(2, { status: 'CANCELADA' }), sale(3, { status: 'COMPLETADA', voidedAt: '2026-10-22' })];
    context.appSession = null;
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    for (const name of ['Cliente 2', 'Cliente 3']) {
      expect(screen.getByText(name).closest(width === 390 ? '.phone-row' : 'tr')).toHaveClass('is-void');
    }
    if (width === 390) {
      await user.click(within(screen.getByTestId('sales-status')).getByRole('button', { name: 'Estado' }));
      expect(screen.queryByRole('button', { name: 'Cancelada' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Anulada' }));
    } else {
      await user.click(screen.getByRole('button', { name: 'Filtrar estado' }));
      expect(screen.queryByRole('checkbox', { name: 'Cancelada' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('checkbox', { name: 'Anulada' }));
    }
    expect(screen.getByText('Cliente 2')).toBeInTheDocument();
    expect(screen.getByText('Cliente 3')).toBeInTheDocument();
    expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument();
  });
});

describe('sales import feature flag', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => { window.matchMedia = originalMatchMedia; flags.IMPORT_SALES_ENABLED = false; });

  it.each([false, true])('hides import and restores it when enabled (phone=%s)', phone => {
    window.matchMedia = vi.fn(query => ({ media: query, matches: phone && query.includes('max-width'), onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    context.sales = [];
    const view = renderScreen();
    expect(screen.queryByRole('button', { name: 'Importar' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Registrar venta' }).length).toBeGreaterThan(0);
    flags.IMPORT_SALES_ENABLED = true;
    view.rerender(<DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><SalesScreen /></DeskProvider>);
    expect(screen.getByRole('button', { name: 'Importar' })).toBeInTheDocument();
  });
});


describe.each([false, true])('annulled sales order (phone: %s)', phone => {
  it('keeps annulled rows on the last page when they would otherwise displace active rows', async () => {
    const media = window.matchMedia;
    window.matchMedia = vi.fn(query => ({ media: query, matches: phone && query.includes('max-width'), onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    context.sales = [sale(31, { status: 'CANCELADA' }), ...Array.from({ length: 9 }, (_, i) => sale(32 + i)), sale(41, { voidedAt: '2026-10-02' })];
    const view = renderScreen();
    const records = () => [...document.querySelectorAll(phone ? '.sale-node' : 'tbody tr')];
    expect(records()).toHaveLength(8);
    expect(records().every(row => !row.querySelector('.is-void') && !row.classList.contains('is-void'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(records().map(row => row.textContent?.match(/V-\d{4}/)?.[0])).toEqual(['V-0032', 'V-0041', 'V-0031']);
    view.unmount(); window.matchMedia = media;
  });

  it('partitions before pagination while preserving active and voided relative order', async () => {
    const media = window.matchMedia;
    window.matchMedia = vi.fn(query => ({ media: query, matches: phone && query.includes('max-width'), onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    context.sales = [sale(21, { status: 'CANCELADA' }), sale(22), sale(23, { voidedAt: '2026-10-02' }), sale(24), sale(25, { status: 'ANULADA' }), sale(26, { status: 'PENDIENTE' })];
    const view = renderScreen();
    const records = [...document.querySelectorAll(phone ? '.sale-node' : 'tbody tr')];
    expect(records.map(row => row.textContent?.match(/V-\d{4}/)?.[0])).toEqual(['V-0026', 'V-0024', 'V-0022', 'V-0025', 'V-0023', 'V-0021']);
    view.unmount(); window.matchMedia = media;
  });
});

it('Ventas descuenta dos de diez unidades en facturación y ganancia sin alterar Total de la fila', () => {
  window.matchMedia = vi.fn(query => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  context.sales = [sale(1, { cantidad: 10, productId: 'p', amount: 6500, amountCurrency: 'USD', status: 'COMPLETADA' })];
  context.inventory = [{ id: 'p', cost: 450, currency: 'USD' }] as Product[];
  context.appSession = { membership: { role: 'OWNER' } };
  context.returns = [{ id: 'r', saleId: '1', status: 'RESUELTO', resolution: 'REINTEGRO', settlement: 'REINTEGRO', compensatedOn: '2026-10-02', moneyAmount: 1300, moneyCurrency: 'USD', saleAmount: 6500, saleQuantity: 10, itemCost: 450, itemCurrency: 'USD' } as ReturnCaseView];
  render(<ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 990, manualSell: 1000 }}><DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><SalesScreen /></DeskProvider></ExchangeProvider>);
  expect(screen.getByText('Facturación total').parentElement).toHaveTextContent('US$ 5.200');
  expect(screen.getByText('Ganancia total').parentElement).toHaveTextContent('US$ 1.600');
  const cells = within(screen.getByText('Cliente 1').closest('tr')!).getAllByRole('cell');
  expect(cells[8]).toHaveTextContent('US$ 6.500');
  expect(cells[9]).toHaveTextContent('US$ 1.600');
});

it('Ventas muestra el ajuste cuando sólo hay una devolución de una venta anterior en el período', () => {
  window.matchMedia = vi.fn(query => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  context.sales = [];
  context.inventory = [];
  context.appSession = { membership: { role: 'OWNER' } };
  context.returns = [{ id: 'r', saleId: 'old', status: 'RESUELTO', resolution: 'REINTEGRO', settlement: 'REINTEGRO', compensatedOn: '2026-10-02', moneyAmount: 1300, moneyCurrency: 'USD', saleAmount: 6500, saleQuantity: 10, itemCost: 450, itemCurrency: 'USD' } as ReturnCaseView];
  render(<ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 990, manualSell: 1000 }}><DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><SalesScreen /></DeskProvider></ExchangeProvider>);
  expect(screen.getByText('Facturación total').parentElement).toHaveTextContent('US$ -1.300');
  expect(screen.getByText('Ganancia total').parentElement).toHaveTextContent('US$ -400');
});


describe('orden por carga y encabezados de Ventas (#748)', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn(query => ({ media: query, matches: false, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    context.appSession = null;
    context.inventory = [];
    context.clients = [];
    context.commissionSellers = [];
    context.sales = [
      sale(13, { createdAt: '2026-10-10T10:00:00Z', clientName: 'Zoe' }),
      sale(7, { createdAt: '2026-10-10T14:00:00Z', clientName: 'Ana', date: '2026-09-30' }),
      sale(16, { createdAt: '2026-10-10T10:00:00Z', clientName: 'Ana' }),
    ];
  });
  const codes = () => [...document.querySelectorAll('tbody tr')].map(row => row.textContent?.match(/V-\d{4}/)?.[0]);

  it('ordena por hora de carga y desempata por número descendente', () => {
    renderScreen();
    expect(codes()).toEqual(['V-0007', 'V-0016', 'V-0013']);
  });

  it('alterna el encabezado, conserva el desempate y permite volver al orden de carga', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    const header = screen.getByRole('button', { name: 'Ordenar por cliente' });
    expect(header).toHaveClass('thsort');
    await user.click(header);
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'ascending');
    expect(codes()).toEqual(['V-0007', 'V-0016', 'V-0013']);
    await user.click(header);
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'descending');
    expect(codes()).toEqual(['V-0013', 'V-0007', 'V-0016']);
    await user.click(screen.getByRole('button', { name: 'Filtrar cliente' }));
    expect(screen.getByRole('dialog', { name: 'Filtrar cliente' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(within(screen.getByTestId('sales-sort')).getByRole('button'));
    await user.click(screen.getByRole('button', { name: 'Orden de carga' }));
    expect(codes()).toEqual(['V-0007', 'V-0016', 'V-0013']);
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'none');
  });

  it.each([
    ['venta', ['V-0007', 'V-0013', 'V-0016']],
    ['fecha', ['V-0007', 'V-0016', 'V-0013']],
    ['equipo', ['V-0007', 'V-0013', 'V-0016']],
    ['cant.', ['V-0007', 'V-0016', 'V-0013']],
    ['vendedor', ['V-0013', 'V-0007', 'V-0016']],
    ['precio unit.', ['V-0013', 'V-0007', 'V-0016']],
    ['total', ['V-0007', 'V-0013', 'V-0016']],
    ['ganancia', ['V-0007', 'V-0013', 'V-0016']],
    ['estado', ['V-0007', 'V-0016', 'V-0013']],
  ])('ordena por %s sin modificar las ventas', async (label, expected) => {
    context.sales = context.sales.map(row => ({ ...row, productId: `p${row.saleNumber}`, cantidad: row.saleNumber === 13 ? 5 : 1, unitPrice: row.saleNumber === 13 ? 12.11 : 12.12, amountCurrency: 'ARS', sellerMemberId: row.saleNumber === 13 ? 'ana' : 'zoe' }));
    context.inventory = context.sales.map(row => ({ id: row.productId, model: row.deviceLabel, capacity: '', cost: 1, currency: 'ARS' })) as Product[];
    context.commissionSellers = [{ id: 'ana', name: 'Ana', role: 'STAFF' }, { id: 'zoe', name: 'Zoe', role: 'STAFF' }];
    const original = structuredClone(context.sales);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    const header = screen.getByRole('button', { name: `Ordenar por ${label}` });
    await user.click(header);
    expect(codes()).toEqual(expected);
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'ascending');
    expect(context.sales).toEqual(original);
  });

  it('permite ordenar las cards desde el mismo menú en mobile', async () => {
    window.matchMedia = vi.fn(query => ({ media: query, matches: query.includes('max-width'), onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    const records = () => [...document.querySelectorAll('.sale-node')].map(row => row.textContent?.match(/V-\d{4}/)?.[0]);
    expect(records()).toEqual(['V-0007', 'V-0016', 'V-0013']);
    await user.click(within(screen.getByTestId('sales-sort')).getByRole('button'));
    await user.click(screen.getByRole('button', { name: 'Venta ↑' }));
    expect(records()).toEqual(['V-0007', 'V-0013', 'V-0016']);
  });

  it('ordena el conjunto completo antes de paginar y vuelve a la primera página', async () => {
    context.sales = Array.from({ length: 12 }, (_, i) => sale(i + 1));
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Ordenar por venta' }));
    expect(codes()).toEqual(['V-0001', 'V-0002', 'V-0003', 'V-0004', 'V-0005', 'V-0006', 'V-0007', 'V-0008']);
    expect(screen.getByText('1–8 de 12')).toBeInTheDocument();
  });
});
