import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Debtor } from '../../services/accounts-api';
import { DeskProvider } from '../ui';
import { AccountCurrent } from './CurrentAccount';
import { SalePaymentsFields } from '../overlays/sale-payments';

const api = vi.hoisted(() => ({
  fetchDebtors: vi.fn(),
  collectAccount: vi.fn(),
  createAccountMovement: vi.fn(),
  fetchFollowUps: vi.fn(),
  saveFollowUpSettings: vi.fn(),
  fetchSaleAccount: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({ user: { getIdToken: async () => 'token' }, reloadClients: vi.fn(), reloadSales: vi.fn() }),
}));
vi.mock('../../services/accounts-api', () => api);

function debtor(): Debtor {
  return {
    clientId: 'c1',
    name: 'Ana Pérez',
    phone: '5492614000000',
    pendingBalance: 500,
    repairBalance: 0,
    currency: 'ARS',
    days: 2,
    tone: 'verde',
    statement: 'Estado de cuenta',
    lines: [{
      id: 's1',
      source: 'VENTA',
      label: 'Venta 12',
      amount: 500,
      currency: 'ARS',
      openedAt: '2026-10-12',
      days: 2,
      tone: 'verde',
      state: 'ABIERTA',
      saleId: 's1',
      repairId: null,
      installments: [],
    }],
  };
}

function renderAccount() {
  return render(
    <DeskProvider value={{ tab: 'clients', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false, canManageSensitive: true }}>
      <AccountCurrent query="" />
    </DeskProvider>,
  );
}

describe('cuenta corriente', () => {
  beforeEach(() => {
    api.fetchDebtors.mockReset();
    api.collectAccount.mockReset();
    api.fetchDebtors.mockResolvedValue({ debtors: [debtor()] });
    api.collectAccount.mockResolvedValue({ client: { id: 'c1' } });
  });

  it('muestra el semáforo y no ofrece exportar la tabla', async () => {
    renderAccount();
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Menos de 7 días')).toBeInTheDocument();
    expect(screen.getByText('Venta 12')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/csv/i)).not.toBeInTheDocument();
  });

  it('registra un pago sobre la venta abierta', async () => {
    const user = userEvent.setup();
    renderAccount();
    await screen.findByText('Ana Pérez');
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    const sheet = screen.getByRole('dialog', { name: 'Registrar pago' });
    await user.type(within(sheet).getByLabelText('Monto'), '200');
    await user.click(within(sheet).getByRole('button', { name: 'Registrar pago' }));
    await waitFor(() => expect(api.collectAccount).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      clientId: 'c1',
      saleId: 's1',
      amount: 200,
      method: 'EFECTIVO',
    })));
  });
});

describe('cuotas en la venta', () => {
  it('no financia a consumidor final', () => {
    render(<SalePaymentsFields clientId="" due={1000} currency="ARS" suggestedRate={null} onChange={() => undefined} />);
    expect(screen.getByRole('checkbox', { name: /Financiar en cuotas/ })).toBeDisabled();
    expect(screen.getByText('Financiar en cuotas no está disponible para consumidor final.')).toBeInTheDocument();
  });
});
