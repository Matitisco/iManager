import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Sale, TradeIn } from '../../types';
import { ExchangeProvider } from '../exchange';
import { DeskProvider } from '../ui';
import { DashboardScreen } from './DashboardScreen';

const context = vi.hoisted(() => ({
  appSession: null as {
    user?: { displayName?: string; email?: string };
    store?: { id?: string; name?: string; currency?: 'ARS' | 'USD' };
    membership?: { role?: string; sections?: string[] | null };
  } | null,
  user: null as { uid: string } | null,
  sales: [] as Sale[],
  inventory: [] as never[],
  tradeIns: [] as TradeIn[],
  clients: [] as never[],
  operationNotifications: [] as Array<{ section: string; readAt?: string | null }>,
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/members-api', () => ({ listMembers: vi.fn(async () => []) }));

const go = vi.fn();

function renderScreen() {
  return render(
    <DeskProvider value={{ tab: 'dashboard', go, open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DashboardScreen />
    </DeskProvider>,
  );
}

function phoneMedia() {
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
    expect(screen.getByRole('columnheader', { name: 'Venta' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-bell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-register-sale')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-dock')).not.toBeInTheDocument();
  });
});

describe('Dashboard on a phone', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    go.mockReset();
  });

  it('turns recent sales and open trades into cards and keeps the sale button inside the flow', async () => {
    phoneMedia();
    const user = userEvent.setup();
    context.user = { uid: 'user-1' };
    context.operationNotifications = [{ section: 'sales', readAt: null }, { section: 'tradeins', readAt: null }];
    context.sales = [{
      id: 'sale-1', saleNumber: 4, date: '2026-10-02', clientId: '', clientName: 'Ana Pérez',
      productId: '', deviceLabel: 'Pixel 8 128GB', amount: 650000, amountCurrency: 'ARS',
      paymentMethod: 'EFECTIVO', status: 'COMPLETADA',
    }];
    context.tradeIns = [{
      id: 'trade-1', tradeNumber: 2, date: '2026-10-04', clientId: '', clientName: 'Bruno Díaz',
      deviceReceived: 'iPhone 14 Pro Max 256GB violeta profundo', deviceReceivedImei: '',
      takeValue: 420000, currency: 'ARS', deviceGiven: 'Pixel 8', differencePaid: 180000, status: 'PERITAJE TÉC.',
    }];
    context.inventory = [];
    context.clients = [];
    context.appSession = {
      user: { displayName: 'Luis', email: 'luis@test.com' },
      store: { id: 'store-1', name: 'Centro', currency: 'ARS' },
      membership: { role: 'OWNER', sections: null },
    };

    renderScreen();
    expect(screen.getByRole('heading', { name: /Qué hay para/ })).toBeInTheDocument();
    expect(screen.getByText('hoy')).toHaveClass('hl');
    expect(screen.getByTestId('dashboard-bell')).toHaveAccessibleName('Notificaciones, 2 sin leer');
    expect(screen.getByTestId('dashboard-register-sale')).toHaveTextContent('Registrar venta');
    expect(screen.getByRole('button', { name: 'Registrar venta' })).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-dock')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Venta' })).not.toBeInTheDocument();

    const sales = screen.getByTestId('dashboard-sales');
    expect(sales).toHaveTextContent('#V-0004');
    expect(sales).toHaveTextContent('Ana Pérez');
    expect(sales).toHaveTextContent('Pixel 8 128GB');
    expect(sales).toHaveTextContent('$ 650.000');
    expect(sales).toHaveTextContent('Completada');
    expect(sales).not.toHaveTextContent('Margen');
    expect(sales).not.toHaveTextContent(/costo/i);

    const trades = screen.getByTestId('dashboard-trades');
    expect(trades).toHaveTextContent('#C-0002');
    expect(trades).toHaveTextContent('iPhone 14 Pro Max 256GB violeta profundo');
    expect(trades).toHaveTextContent('Bruno Díaz');
    expect(trades).toHaveTextContent('$ 420.000');
    expect(trades).toHaveTextContent('dif. $ 180.000');
    expect(trades).toHaveTextContent('Peritaje téc.');
    expect(within(sales).getAllByTestId('row-menu').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(go).toHaveBeenCalledWith('sales');
    await user.click(screen.getByRole('button', { name: 'Ver todos' }));
    expect(go).toHaveBeenCalledWith('tradeins');
    await user.click(screen.getByTestId('dashboard-bell'));
    expect(go).toHaveBeenCalledWith('notifications');
  });

  it('hides billing for an employee and shows the store currency on the cards', () => {
    phoneMedia();
    context.user = { uid: 'user-1' };
    context.operationNotifications = [];
    context.sales = [{
      id: 'sale-1', saleNumber: 1, date: '2026-10-02', clientId: '', clientName: 'Ana',
      productId: '', deviceLabel: 'Pixel', amount: 250000, amountCurrency: 'USD',
      paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA',
    }];
    context.tradeIns = [];
    context.inventory = [];
    context.clients = [];
    context.appSession = {
      user: { displayName: 'Luis', email: 'luis@test.com' },
      store: { id: 'store-1', name: 'Centro', currency: 'USD' },
      membership: { role: 'STAFF', sections: ['dashboard', 'sales', 'inventory'] },
    };

    render(
      <ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1100 }}>
        <DeskProvider value={{ tab: 'dashboard', go, open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: true }}>
          <DashboardScreen />
        </DeskProvider>
      </ExchangeProvider>,
    );

    const month = screen.getByRole('button', { name: /Ventas del mes/ });
    expect(month).toHaveTextContent('operaciones');
    expect(month).not.toHaveTextContent('$');
    expect(month).not.toHaveTextContent('Margen');
    const sales = screen.getByTestId('dashboard-sales');
    expect(sales).toHaveTextContent('US$ 250.000');
    expect(sales).not.toHaveTextContent('Margen');
    expect(sales).not.toHaveTextContent(/costo/i);
    expect(screen.queryByTestId('dashboard-bell')).not.toBeInTheDocument();
  });
});
