import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Sale } from '../../types';
import { DeskProvider } from '../ui';
import { SalesScreen } from './SalesScreen';
import { ClientsScreen } from './ClientsScreen';

const context = vi.hoisted(() => ({ sales: [] as Sale[], clients: [] as Client[], inventory: [] }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
function content(kind: 'sales' | 'clients') {
  return <DeskProvider value={{ tab: kind, go: vi.fn(), open: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
    {kind === 'sales' ? <SalesScreen /> : <ClientsScreen />}
  </DeskProvider>;
}
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('Sales and Clients pagination', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T12:00:00-03:00'));
    context.clients = Array.from({ length: 17 }, (_, i) => ({
      id: String(i + 1), name: `Cliente ${i + 1}`, dni: `DNI-${i + 1}`, email: '', phone: '', lastPurchaseDate: '',
      totalSpent: 0, pendingBalance: i < 9 ? 100 : 0,
    }));
    context.sales = context.clients.map((client, i) => ({
      id: String(i + 1), saleNumber: i + 1, clientId: client.id, productId: '', amount: 100,
      date: i === 16 ? '2026-09-15' : '2026-10-07', status: 'COMPLETADA', paymentMethod: 'EFECTIVO',
    }));
  });
  afterEach(() => vi.useRealTimers());

  it('connects Sales to pages of eight, reaches all seventeen once and resets search/period or reduced data', async () => {
    const user = userEvent.setup();
    const view = render(content('sales'));
    const visited: string[] = [];
    for (const [index, count] of [8, 8, 1].entries()) {
      expect(rows()).toHaveLength(count);
      expect(screen.getByText(`${index * 8 + 1}–${Math.min((index + 1) * 8, 17)} de 17`)).toBeInTheDocument();
      visited.push(...rows().map(row => within(row).getAllByRole('cell')[0].textContent!));
      if (index < 2) await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    }
    expect(visited).toEqual(Array.from({ length: 17 }, (_, i) => `#V-${String(i + 1).padStart(4, '0')}`));
    expect(new Set(visited).size).toBe(17);
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    const search = screen.getByPlaceholderText('Buscar cliente, equipo o número');
    await user.type(search, 'Cliente');
    expect(rows()).toHaveLength(8);
    expect(screen.getByText('1–8 de 17')).toBeInTheDocument();
    await user.clear(search);
    await user.click(screen.getByRole('button', { name: 'Página 3' }));
    await user.click(screen.getByRole('button', { name: 'Mes' }));
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    expect(rows()).toHaveLength(8);
    expect(screen.getByText('1–8 de 16')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(rows()).toHaveLength(8);
    await user.type(search, 'V-0002');
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('#V-0002')).toBeInTheDocument();
    await user.clear(search);
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    context.sales = context.sales.slice(0, 6);
    view.rerender(content('sales'));
    expect(rows()).toHaveLength(6);
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });

  it('connects Clients to eight plus eight plus one and preserves the limit after balance/search filters and removals', async () => {
    const user = userEvent.setup();
    const view = render(content('clients'));
    const visited: string[] = [];
    for (const [index, count] of [8, 8, 1].entries()) {
      expect(rows()).toHaveLength(count);
      expect(screen.getByText(`${index * 8 + 1}–${Math.min((index + 1) * 8, 17)} de 17`)).toBeInTheDocument();
      visited.push(...rows().map(row => within(row).getAllByRole('cell')[1].textContent!));
      if (index < 2) await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    }
    expect(visited).toEqual(Array.from({ length: 17 }, (_, i) => `DNI-${i + 1}`));
    expect(new Set(visited).size).toBe(17);
    await user.click(screen.getByRole('button', { name: 'Con saldo pendiente' }));
    expect(rows()).toHaveLength(8);
    expect(screen.getByText('1–8 de 9')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(rows()).toHaveLength(1);
    const search = screen.getByPlaceholderText('Buscar por nombre, DNI o teléfono');
    await user.type(search, 'DNI-9');
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('DNI-9')).toBeInTheDocument();
    await user.clear(search);
    expect(rows()).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: 'Todos' }));
    await user.click(screen.getByRole('button', { name: 'Página 3' }));
    await user.type(search, 'Cliente 17');
    expect(rows()).toHaveLength(1);
    await user.clear(search);
    expect(screen.getByText('1–8 de 17')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página 3' }));
    context.clients = context.clients.slice(0, 8);
    view.rerender(content('clients'));
    expect(rows()).toHaveLength(8);
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });
});
