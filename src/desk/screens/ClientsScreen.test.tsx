import { render, screen, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function renderScreen() {
  return render(
    <DeskProvider value={{ tab: 'clients', go: vi.fn(), open: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <ClientsScreen />
    </DeskProvider>,
  );
}

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
