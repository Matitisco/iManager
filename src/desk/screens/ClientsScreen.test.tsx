import { render, screen, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../../types';
import { DeskProvider } from '../ui';
import { ClientsScreen } from './ClientsScreen';

const context = vi.hoisted(() => ({
  clients: [] as Client[],
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

function client(number: number, overrides: Partial<Client> = {}): Client {
  return {
    id: String(number),
    dni: String(30000000 + number),
    name: `Cliente ${number}`,
    email: `c${number}@tienda.com`,
    phone: `110000${String(number).padStart(4, '0')}`,
    lastPurchaseDate: '2026-10-01',
    totalSpent: number * 1000,
    pendingBalance: number === 1 ? 5000 : 0,
    tag: number === 12 ? 'Mayorista' : null,
    ...overrides,
  };
}

function renderScreen(open = vi.fn()) {
  return render(
    <DeskProvider value={{ tab: 'clients', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <ClientsScreen />
    </DeskProvider>,
  );
}

describe('New client action', () => {
  beforeEach(() => {
    context.clients = [client(1)];
  });

  it('opens the client form from a secondary button', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const open = vi.fn();
    renderScreen(open);

    const button = screen.getByRole('button', { name: 'Nuevo cliente' });
    expect(button).toHaveClass('dbtn', 's');
    expect(button).not.toHaveClass('p');

    await user.click(button);
    expect(open).toHaveBeenCalledWith({ type: 'new-cl' });
  });
});

describe('Client column filters', () => {
  beforeEach(() => {
    context.clients = [
      ...Array.from({ length: 11 }, (_, index) => client(index + 1)),
      client(12, { name: 'Ana Pérez', pendingBalance: 20000, totalSpent: 800000, dni: '40111222' }),
    ];
  });

  it('combines the balance chip with a column filter and clears one column without dropping the chip', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();

    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
    expect(screen.getByText('1–8 de 12')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Con saldo pendiente' }));
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtrar cliente' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtrar cliente' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Mayorista' }));
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Con saldo pendiente' })).toHaveClass('on');

    await user.click(within(dialog).getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Con saldo pendiente' })).toHaveClass('on');

    await user.click(screen.getByRole('button', { name: 'Filtrar cliente' }));
    await user.type(screen.getByRole('textbox', { name: 'Contiene' }), 'nadie');
    expect(screen.getByText('No hay clientes con ese filtro.')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Cliente/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();
  });
});

describe('Clients on a phone', () => {
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
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('shows the empty state and the dock without the desktop table', () => {
    context.clients = [];
    renderScreen();
    expect(screen.getByTestId('clients-empty')).toHaveTextContent('No hay clientes');
    expect(screen.getByText('0 resultados')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por nombre, DNI o teléfono')).toBeInTheDocument();
    expect(within(screen.getByTestId('mobile-dock')).getByRole('button', { name: 'Nuevo cliente' })).toBeInTheDocument();
    expect(within(screen.getByTestId('mobile-dock')).getByRole('button', { name: 'Importar' })).toBeInTheDocument();
    expect(within(screen.getByTestId('clients-empty')).getByRole('button', { name: 'Nuevo cliente' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Cliente/ })).not.toBeInTheDocument();
    expect(screen.queryByText('No encontré clientes.')).not.toBeInTheDocument();
  });

  it('puts debtors first, with avatar, contact and store amounts', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const open = vi.fn();
    context.clients = [
      client(2, { name: 'Ana Pérez', pendingBalance: 0, totalSpent: 480000, lastPurchaseDate: '2026-10-04', dni: '30000002', phone: '1100000002', email: 'ana@ejemplo.com' }),
      client(3, { name: 'Zoe Díaz', pendingBalance: 1100000, totalSpent: 1100000, lastPurchaseDate: '2026-10-03', dni: '30000003', phone: '1100000003', email: 'zoe@ejemplo.com', tag: 'Mayorista' }),
    ];
    renderScreen(open);
    const list = screen.getByTestId('phone-rows');
    const rows = () => within(list).getAllByTestId(/^client-row-/);
    expect(rows()[0]).toHaveTextContent('Zoe Díaz');
    expect(rows()[0]).toHaveTextContent('ZD');
    expect(rows()[0]).toHaveTextContent('DNI 30000003');
    expect(rows()[0]).toHaveTextContent('Saldo');
    expect(rows()[0]).toHaveTextContent('Última compra');
    expect(rows()[0]).toHaveTextContent('Total gastado');
    expect(rows()[1]).toHaveTextContent('Ana Pérez');
    expect(rows()[1]).toHaveTextContent('Sin saldo');
    expect(screen.getByText('Con saldo')).toBeInTheDocument();
    expect(screen.getAllByTestId('row-menu').length).toBe(2);
    expect(screen.queryByRole('columnheader', { name: /Cliente/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Con saldo pendiente' }));
    expect(screen.getByText('Zoe Díaz')).toBeInTheDocument();
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    await user.click(within(screen.getByTestId('clients-sort')).getByRole('button', { name: 'Ordenar' }));
    await user.click(screen.getByRole('button', { name: 'Nombre' }));
    const sorted = within(screen.getByTestId('phone-rows')).getAllByTestId(/^client-row-/);
    expect(sorted[0]).toHaveTextContent('Ana Pérez');
    expect(sorted[1]).toHaveTextContent('Zoe Díaz');

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const filters = screen.getByRole('dialog', { name: 'Filtros' });
    await user.type(within(filters).getByRole('textbox', { name: 'DNI' }), '30000002');
    await user.click(within(filters).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Zoe Díaz')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Zoe Díaz')).toBeInTheDocument();

    await user.click(within(screen.getByTestId('phone-rows')).getByTestId('client-row-2'));
    expect(open).toHaveBeenCalledWith({ type: 'cl', id: '2' });
  });
});
