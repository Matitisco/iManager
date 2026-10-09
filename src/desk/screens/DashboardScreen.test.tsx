import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Sale } from '../../types';
import { DeskProvider } from '../ui';
import { DashboardScreen } from './DashboardScreen';

const context = vi.hoisted(() => ({
  appSession: null as {
    user?: { displayName?: string; email?: string };
    store?: { id?: string; name?: string };
    membership?: { role?: string; sections?: string[] | null };
  } | null,
  user: null as { uid: string } | null,
  sales: [] as Sale[],
  inventory: [] as never[],
  tradeIns: [] as never[],
  clients: [] as never[],
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/members-api', () => ({ listMembers: vi.fn(async () => []) }));

function renderScreen() {
  return render(
    <DeskProvider value={{ tab: 'dashboard', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DashboardScreen />
    </DeskProvider>,
  );
}

describe('Dashboard billing', () => {
  it('shows the month total only when the member can open reports', () => {
    context.user = { uid: 'user-1' };
    context.sales = [{
      id: '1', saleNumber: 1, date: '2026-10-02', clientId: '', clientName: 'Ana',
      productId: '', deviceLabel: 'Pixel', amount: 250000, paymentMethod: 'EFECTIVO', status: 'COMPLETADA',
    }];
    context.inventory = [];
    context.tradeIns = [];
    context.clients = [];
    context.appSession = {
      user: { displayName: 'Luis', email: 'luis@test.com' },
      store: { id: 'store-1', name: 'Centro' },
      membership: { role: 'OWNER', sections: null },
    };

    const owner = renderScreen();
    expect(screen.getByRole('button', { name: /Ventas del mes/ })).toHaveTextContent('$ 250.000');
    owner.unmount();

    context.appSession = {
      ...context.appSession,
      membership: { role: 'STAFF', sections: null },
    };
    renderScreen();
    const card = screen.getByRole('button', { name: /Ventas del mes/ });
    expect(card).toHaveTextContent('operaciones');
    expect(card).not.toHaveTextContent('$');
  });
});
