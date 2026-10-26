import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, Sale } from '../types';
import { ClientDetail } from './overlays/client';
import { DeskProvider } from './ui';

const state = vi.hoisted(() => ({
  clients: [{ id: 'c', name: 'Ana', dni: '', phone: '', email: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 0 }] as Client[],
  sales: [] as Sale[], tradeIns: [], repairOrders: [], inventory: [] as Product[], creditNotes: [],
  user: { uid: 'u' }, backendStatus: 'ready',
  appSession: { store: { id: 'store' }, membership: { role: 'OWNER' }, onboardingRequired: false },
  commissionSellers: [{ id: 'lucia', name: 'Lucía', role: 'STAFF' }],
  loadCommissionSellers: vi.fn(async () => undefined),
  loadClientDeposits: vi.fn(async () => []),
}));
const api = vi.hoisted(() => ({ sales: vi.fn(), trades: vi.fn(), inventory: vi.fn(), payments: vi.fn(async () => []) }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => state }));
vi.mock('../services/sales-api', () => ({ fetchVoidedSales: api.sales }));
vi.mock('../services/trade-ins-api', () => ({ fetchVoidedTradeIns: api.trades }));
vi.mock('../services/inventory-api', () => ({ fetchArchivedInventory: api.inventory }));
vi.mock('../services/clients-api', () => ({ fetchClientPayments: api.payments }));

function mount() {
  return render(<DeskProvider value={{ tab: 'clients', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><ClientDetail id="c" /></DeskProvider>);
}

describe('client purchase history sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.clients[0].creditBalance = 0;
    state.loadClientDeposits.mockReset().mockResolvedValue([]);
    api.trades.mockResolvedValue([]);
    api.inventory.mockResolvedValue([{ id: 'p', imei: '356789104523871', model: 'iPhone 15 Pro', capacity: '256GB' }]);
    api.sales.mockResolvedValue([
      { id: 'void', clientId: 'c', productId: 'p', status: 'COMPLETADA', voidedAt: '2026-10-18', date: '14/10/2026', amount: 780000, sellerMemberId: 'lucia' },
      { id: 'other-client', clientId: 'other', productId: 'p', status: 'ANULADA', date: '14/10/2026', amount: 999 },
    ]);
  });

  it('loads logical deletes and archived IMEI on direct open, scoped to the client and excluded from counts', async () => {
    mount();
    const row = await screen.findByTestId('purchase-sale-void');
    expect(row).toHaveTextContent('IMEI 356789104523871');
    expect(row).toHaveTextContent('Lucía');
    expect(row).toHaveTextContent('Anulada');
    expect(screen.getByTestId('client-purchase-count')).toHaveTextContent('0');
    expect(screen.getByTestId('client-purchase-stats')).toHaveTextContent('Total comprado$ 0');
    expect(screen.queryByTestId('purchase-sale-other-client')).not.toBeInTheDocument();
    expect(api.sales).toHaveBeenCalledWith(state.user);
    expect(state.loadCommissionSellers).toHaveBeenCalledOnce();
  });

  it('keeps purchases visible and logs failed supplemental history without an alert', async () => {
    const cause = new Error('No se pudieron cargar las ventas anuladas');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.sales.mockRejectedValue(cause);
    mount();
    await waitFor(() => expect(warn).toHaveBeenCalledWith('No se pudieron cargar los registros archivados o anulados.', cause));
    expect(screen.getByTestId('client-purchase-count')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
    warn.mockRestore();
  });
  it('hides failed deposits and preserves the known client credit balance', async () => {
    const cause = new Error('No se pudieron cargar las señas');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    state.loadClientDeposits.mockRejectedValueOnce(cause);
    state.clients[0].creditBalance = 500;
    mount();
    await waitFor(() => expect(warn).toHaveBeenCalledWith('No se pudieron cargar las señas.', cause));
    expect(document.querySelector('.tracking-summary .dhero')).toHaveTextContent('Saldo a favor$ 500');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
    expect(screen.queryByText('Todavía no tiene señas.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
    expect(document.querySelector('.ferr')).not.toBeInTheDocument();
    warn.mockRestore();
  });

});
