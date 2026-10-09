import { render, screen, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Sale } from '../../types';
import { DeskProvider } from '../ui';
import { SalesScreen } from './SalesScreen';

const context = vi.hoisted(() => ({
  sales: [] as Sale[],
  clients: [] as never[],
  inventory: [] as Product[],
  appSession: null as { membership?: { role?: string; sections?: string[] | null } } | null,
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

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
    expect(screen.getByText('1 de 12')).toBeInTheDocument();
    expect(screen.getByText('12 ventas')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Buscar cliente, equipo o número'), 'pixel');
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText('Buscar cliente, equipo o número'));

    await user.click(screen.getByRole('button', { name: 'Filtrar pago' }));
    await user.click(screen.getByRole('checkbox', { name: 'Efectivo' }));
    expect(screen.getByText('No hay ventas con ese filtro.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtrar cliente' })).toBeInTheDocument();
    expect(screen.getByText('12 ventas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
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
