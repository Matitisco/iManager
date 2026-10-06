import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';

const mockState = vi.hoisted(() => ({
  appContext: {
    appSession: { user: { displayName: 'Ana' }, store: { name: 'Local Centro' } },
    backendStatus: 'ready',
    sales: [] as { status: string; amount?: number; id?: string; clientId?: string; productId?: string; date?: string }[],
    tradeIns: [] as { status: string; id?: string; clientId?: string; deviceReceived?: string; differencePaid?: number; date?: string }[],
    inventory: [] as { status: string; id?: string }[],
    clients: [] as { pendingBalance: number; id?: string; name?: string }[],
  },
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: () => mockState.appContext,
}));

describe('Dashboard', () => {
  it('opens sales and trade-ins from the stat cards', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    mockState.appContext.sales = [{ status: 'PENDIENTE' }, { status: 'PENDIENTE' }];
    mockState.appContext.tradeIns = [{ status: 'PENDIENTE' }];
    mockState.appContext.inventory = [];
    mockState.appContext.clients = [];

    render(<Dashboard onNavigate={onNavigate} />);

    expect(screen.getByRole('heading', { name: /qué hay para hoy/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Flujo sugerido' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ventas del mes/i }));
    expect(onNavigate).toHaveBeenCalledWith('sales');

    await user.click(screen.getByRole('button', { name: /canjes en curso/i }));
    expect(onNavigate).toHaveBeenCalledWith('tradeins');
  });

  it('shows an empty trade-in list when nothing is open', () => {
    mockState.appContext.sales = [{ status: 'COMPLETADA' }];
    mockState.appContext.tradeIns = [];
    mockState.appContext.inventory = [];
    mockState.appContext.clients = [];

    render(<Dashboard />);

    expect(screen.getByText('No hay canjes en curso.')).toBeInTheDocument();
  });
});
