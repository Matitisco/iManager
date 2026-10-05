import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';

const mockState = vi.hoisted(() => ({
  appContext: {
    appSession: { user: { displayName: 'Ana' }, store: { name: 'Local Centro' } },
    backendStatus: 'ready',
    sales: [] as { status: string }[],
    tradeIns: [] as { status: string }[],
    inventory: [] as { status: string }[],
    clients: [] as { pendingBalance: number }[],
  },
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: () => mockState.appContext,
}));

describe('Dashboard focus tasks', () => {
  it('shows pending tasks in Tu foco hoy and opens the matching module', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    mockState.appContext.backendStatus = 'ready';
    mockState.appContext.sales = [{ status: 'PENDIENTE' }, { status: 'PENDIENTE' }];
    mockState.appContext.tradeIns = [{ status: 'PENDIENTE' }];
    mockState.appContext.inventory = [];
    mockState.appContext.clients = [];

    render(<Dashboard onNavigate={onNavigate} />);

    expect(screen.getByRole('heading', { name: 'Tu foco hoy' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /2 ventas pendientes/i }));
    expect(onNavigate).toHaveBeenCalledWith('sales');

    await user.click(screen.getByRole('button', { name: /1 canje en curso/i }));
    expect(onNavigate).toHaveBeenCalledWith('tradeins');
  });

  it('shows an empty state when nothing is pending', () => {
    mockState.appContext.backendStatus = 'ready';
    mockState.appContext.sales = [{ status: 'COMPLETADA' }];
    mockState.appContext.tradeIns = [];
    mockState.appContext.inventory = [];
    mockState.appContext.clients = [];

    render(<Dashboard />);

    expect(screen.getByText('No hay tareas pendientes. El día está al día.')).toBeInTheDocument();
  });
});
