import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sale, TradeIn } from '../../types';
import { DeskProvider } from '../ui';
import { TradeDetail } from './trade';

const state = vi.hoisted(() => ({
  sales: [] as Sale[],
  tradeIns: [] as TradeIn[],
  clients: [{ id: 'client', name: 'QA canjes', pendingBalance: 200000 }],
  user: { getIdToken: async () => 'local-test' },
  fetchTradeOperation: vi.fn(),
}));
const payments = vi.hoisted(() => ({ fetchClientPayments: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => state }));
vi.mock('../../services/clients-api', () => payments);
vi.mock('../../services/history-api', () => ({ fetchHistory: vi.fn(async () => ({ events: [], nextCursor: null })) }));

function renderDetail() {
  return render(<DeskProvider value={{ tab: 'tradeins', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
    <TradeDetail id="trade" run={vi.fn()} busy={false} error={null} />
  </DeskProvider>);
}

function amountFor(label: string) {
  return screen.getByText(label, { exact: true }).closest('.kv')?.querySelector('b');
}

describe('Trade detail outstanding debt', () => {
  beforeEach(() => {
    state.tradeIns = [{ id: 'trade', tradeNumber: 1, date: '2026-10-24', clientId: 'client', deviceReceived: 'QA canjes recibido', deviceReceivedImei: '', deviceGiven: 'QA canjes salida', takeValue: 200000, differencePaid: 300000, currency: 'ARS', status: 'PENDIENTE', confirmationStatus: 'CONFIRMED', saleId: 'sale' }];
    state.sales = [{ id: 'sale', date: '2026-10-24', clientId: 'client', productId: '', amount: 500000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'PENDIENTE', integratedOperation: true, tradeInId: 'trade', openBalance: 300000 }];
    state.clients = [{ id: 'client', name: 'QA canjes', pendingBalance: 200000 }];
    state.fetchTradeOperation.mockReset().mockResolvedValue({});
    payments.fetchClientPayments.mockReset().mockResolvedValue([{ id: 'payment', amount: 100000, method: 'EFECTIVO', paidAt: '2026-10-24', kind: 'PAGO', saleId: null }]);
  });

  it('subtracts a general partial payment while retaining the original difference', async () => {
    renderDetail();
    await waitFor(() => expect(payments.fetchClientPayments).toHaveBeenCalled());
    await waitFor(() => expect(amountFor('Deuda')).toHaveTextContent('$ 200.000'));
    expect(screen.getByText('Diferencia', { exact: true }).closest('.dhero')).toHaveTextContent('$ 300.000');
    expect(amountFor('Precio de salida')).toHaveTextContent('$ 500.000');
  });

  it('respects the explicit sale balance without subtracting a linked payment twice', async () => {
    state.sales[0].openBalance = 200000;
    payments.fetchClientPayments.mockResolvedValue([{ id: 'payment', amount: 100000, method: 'EFECTIVO', paidAt: '2026-10-24', kind: 'PAGO', saleId: 'sale' }]);
    renderDetail();
    await waitFor(() => expect(amountFor('Deuda')).toHaveTextContent('$ 200.000'));
  });

  it('uses the sale returned with the operation when absent from the global list', async () => {
    const linkedSale = { ...state.sales[0], openBalance: 200000 };
    state.sales = [];
    payments.fetchClientPayments.mockResolvedValue([]);
    state.fetchTradeOperation.mockResolvedValue({ sale: linkedSale });
    renderDetail();
    await waitFor(() => expect(amountFor('Precio de salida')).toHaveTextContent('$ 500.000'));
    expect(amountFor('Deuda')).toHaveTextContent('$ 200.000');
  });

  it('shows zero debt for a fully paid trade', async () => {
    state.sales[0].status = 'COMPLETADA';
    state.sales[0].openBalance = 0;
    state.clients[0].pendingBalance = 0;
    payments.fetchClientPayments.mockResolvedValue([]);
    renderDetail();
    await waitFor(() => expect(amountFor('Deuda')).toHaveTextContent('$ 0'));
  });
});
