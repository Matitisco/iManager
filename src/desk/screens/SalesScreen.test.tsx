import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Sale } from '../../types';
import { DeskProvider } from '../ui';
import { SalesScreen } from './SalesScreen';

const context = vi.hoisted(() => ({
  sales: [] as Sale[],
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
    expect(screen.getByText('Cliente 1')).toBeVisible();
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

    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
    expect(screen.getByText('1–8 de 12')).toBeInTheDocument();
    expect(screen.getByText('12 ventas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();

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

    await user.click(screen.getByRole('button', { name: 'Filtrar pago' }));
    await user.click(screen.getByRole('checkbox', { name: 'Efectivo' }));
    expect(screen.getByText('No hay ventas con ese filtro.')).toHaveClass('table-empty');
    expect(screen.getByRole('button', { name: 'Filtrar cliente' })).toBeInTheDocument();
    expect(screen.getByText('12 ventas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sales-hero')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-dock')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Venta/ })).toBeInTheDocument();
  });

  it('shows billing and margin only to members who can open reports', () => {
    context.sales = [sale(1, { amount: 1000, productId: 'eq', status: 'COMPLETADA' })];
    context.inventory = [{
      id: 'eq', imei: '123456789012345', model: 'Pixel', capacity: '128 GB', color: 'Negro',
      condition: 'NUEVO', grade: '', batteryHealth: '100', cost: 400, price: 1000, status: 'VENDIDO',
    }];

    context.appSession = { membership: { role: 'OWNER', sections: null } };
    const owner = renderScreen();
    expect(screen.getByText('Facturación total')).toBeInTheDocument();
    expect(screen.getByText('Margen bruto est.')).toBeInTheDocument();
    expect(screen.getByText('precio menos costo')).toBeInTheDocument();
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument();
    owner.unmount();

    context.appSession = { membership: { role: 'STAFF', sections: ['sales', 'reports'] } };
    const granted = renderScreen();
    expect(screen.getByText('Facturación total')).toBeInTheDocument();
    expect(screen.getByText('Margen bruto est.')).toBeInTheDocument();
    expect(screen.getByText('precio menos costo')).toBeInTheDocument();
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument();
    granted.unmount();

    context.appSession = { membership: { role: 'STAFF', sections: ['sales'] } };
    const staff = renderScreen();
    expect(screen.queryByText('Facturación total')).not.toBeInTheDocument();
    expect(screen.queryByText('Margen bruto est.')).not.toBeInTheDocument();
    expect(screen.queryByText('precio menos costo')).not.toBeInTheDocument();
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument();
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();
    staff.unmount();

    context.appSession = { membership: { role: 'MANAGER', sections: ['sales'] } };
    renderScreen();
    expect(screen.queryByText('Facturación total')).not.toBeInTheDocument();
    expect(screen.queryByText('Margen bruto est.')).not.toBeInTheDocument();
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
    expect(screen.getByTestId('sales-hero')).toHaveTextContent('Margen bruto est.');
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
    expect(screen.getByTestId('sales-hero')).toHaveTextContent('Margen bruto est.');
  });

  it('hides billing and margin when the member cannot open reports', () => {
    context.appSession = { membership: { role: 'STAFF', sections: ['sales'] } };
    renderScreen();
    expect(screen.queryByText('Facturación total')).not.toBeInTheDocument();
    expect(screen.queryByText('Margen bruto est.')).not.toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Filtrar vendedor' }));
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
    expect(records().map(row => row.textContent?.match(/V-\d{4}/)?.[0])).toEqual(['V-0040', 'V-0031', 'V-0041']);
    view.unmount(); window.matchMedia = media;
  });

  it('partitions before pagination while preserving active and voided relative order', async () => {
    const media = window.matchMedia;
    window.matchMedia = vi.fn(query => ({ media: query, matches: phone && query.includes('max-width'), onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    context.sales = [sale(21, { status: 'CANCELADA' }), sale(22), sale(23, { voidedAt: '2026-10-02' }), sale(24), sale(25, { status: 'ANULADA' }), sale(26, { status: 'PENDIENTE' })];
    const view = renderScreen();
    const records = [...document.querySelectorAll(phone ? '.sale-node' : 'tbody tr')];
    expect(records.map(row => row.textContent?.match(/V-\d{4}/)?.[0])).toEqual(['V-0022', 'V-0024', 'V-0026', 'V-0021', 'V-0023', 'V-0025']);
    view.unmount(); window.matchMedia = media;
  });
});
