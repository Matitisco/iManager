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
}));
const api = vi.hoisted(() => ({ sales: vi.fn(), trades: vi.fn(), inventory: vi.fn(), payments: vi.fn(async () => []) }));
const deposits = vi.hoisted(() => ({ rows: [], loading: false, error: null, retry: vi.fn() }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => state }));
vi.mock('../services/sales-api', () => ({ fetchVoidedSales: api.sales }));
vi.mock('../services/trade-ins-api', () => ({ fetchVoidedTradeIns: api.trades }));
vi.mock('../services/inventory-api', () => ({ fetchArchivedInventory: api.inventory }));
vi.mock('../services/clients-api', () => ({ fetchClientPayments: api.payments }));
vi.mock('./overlays/deposits', () => ({ useClientDeposits: () => deposits }));

function mount() {
  return render(<DeskProvider value={{ tab: 'clients', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><ClientDetail id="c" /></DeskProvider>);
}

describe('client purchase history sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByTestId('client-purchase-stats')).toHaveTextContent('Total gastado$ 0');
    expect(screen.queryByTestId('purchase-sale-other-client')).not.toBeInTheDocument();
    expect(api.sales).toHaveBeenCalledWith(state.user);
    expect(state.loadCommissionSellers).toHaveBeenCalledOnce();
  });

  it('shows a visible error when the supplemental history cannot be loaded', async () => {
    api.sales.mockRejectedValue(new Error('No se pudieron cargar las ventas anuladas'));
    mount();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las ventas anuladas'));
  });
});
