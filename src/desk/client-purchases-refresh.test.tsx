import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Client, Sale } from '../types';
import { ClientDetail } from './overlays/client';
import { DeskProvider } from './ui';
import type { ReturnCaseView } from '../services/returns-api';
import { partialReturn } from '../test/return-fixtures';
import { ExchangeProvider } from './exchange';

const state = vi.hoisted(() => ({
  clients: [{ id: 'jose', name: 'Jose barrera', dni: '', phone: '', email: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 0 }] as Client[],
  sales: [] as Sale[], tradeIns: [], repairOrders: [], inventory: [],
  returns: [] as ReturnCaseView[] | null,
  user: { uid: 'u' }, backendStatus: 'ready',
  appSession: { store: { id: 'ishop-test' }, membership: { role: 'OWNER', sections: ['clients'] }, onboardingRequired: false },
  commissionSellers: [], loadCommissionSellers: vi.fn(async () => undefined), loadClientDeposits: vi.fn(async () => []),
}));
const api = vi.hoisted(() => ({ sales: vi.fn() }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => state }));
vi.mock('../services/clients-api', () => ({ fetchClientPayments: vi.fn(async () => []), fetchClientSales: api.sales }));
vi.mock('../services/sales-api', () => ({ fetchVoidedSales: vi.fn(async () => []) }));
vi.mock('../services/trade-ins-api', () => ({ fetchVoidedTradeIns: vi.fn(async () => []) }));
vi.mock('../services/inventory-api', () => ({ fetchArchivedInventory: vi.fn(async () => []) }));

const sales: Sale[] = [2, 3, 1, 2, 1, 3, 1].map((cantidad, i) => ({
  id: `sale-${i}`, clientId: 'jose', clientName: 'Jose barrera', productId: 'stock',
  deviceLabel: 'iPhone 13', date: '02/11/2026', cantidad, amount: 600 * cantidad,
  amountCurrency: 'USD', paymentMethod: 'EFECTIVO', status: i === 6 ? 'PENDIENTE' : 'COMPLETADA', warrantyDays: 90,
}));
const detail = () => <DeskProvider value={{ tab: 'clients', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><ClientDetail id="jose" /></DeskProvider>;
beforeEach(() => {
  vi.clearAllMocks();
  state.sales = sales.slice(0, 4);
  state.returns = [];
  state.appSession.store.id = 'ishop-test';
  api.sales.mockReset().mockResolvedValue(sales);
});
afterEach(() => vi.restoreAllMocks());

it.each([false, true])('refreshes four cached purchases to seven same-day USD sales (mobile=%s)', async phone => {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: phone && query.includes('760'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  render(detail());
  await waitFor(() => expect(screen.getByTestId('client-purchase-count')).toHaveTextContent(/^7$/));
  expect(within(screen.getByTestId('client-purchase-stats')).getByText('Compras').parentElement).toHaveTextContent(/^Compras7$/);
  expect(api.sales).toHaveBeenCalledWith(state.user, 'jose');
  expect(within(screen.getByTestId('client-purchases')).getAllByTestId(/^purchase-sale-/)).toHaveLength(3);
  await userEvent.click(screen.getByTestId('purchases-more'));
  expect(within(screen.getByRole('dialog', { name: phone ? 'Compras' : 'Compras · Jose barrera' })).getAllByTestId(/^purchase-sale-/)).toHaveLength(7);
});

it('shows a visible failure and retries instead of presenting a partial count as complete', async () => {
  api.sales.mockRejectedValueOnce(new Error('No se pudieron cargar las compras'));
  render(detail());
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las compras');
  expect(screen.queryByTestId('client-purchase-stats')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar compras' }));
  await waitFor(() => expect(screen.getByTestId('client-purchase-count')).toHaveTextContent(/^7$/));
});

it.each([false, true])('combines refreshed pending sales with unit warranties and net returns (mobile=%s)', async phone => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-02T12:00:00-03:00'));
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: phone && query.includes('760'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  try {
    state.returns = null;
    const usdDetail = () => <ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1000 }}>{detail()}</ExchangeProvider>;
    const view = render(usdDetail());
    await waitFor(() => expect(api.sales).toHaveBeenCalledWith(state.user, 'jose'));
    expect(screen.queryByTestId('client-purchase-stats')).not.toBeInTheDocument();
    state.returns = [partialReturn({ saleId: sales[0].id, clientId: 'jose' })];
    view.rerender(usdDetail());
    const stats = await screen.findByTestId('client-purchase-stats');
    expect(within(stats).getByText('Compras').parentElement).toHaveTextContent(/^Compras7$/);
    expect(within(stats).getByText('Garantías').parentElement).toHaveTextContent(/^Garantías13 vigentes$/);
    expect(stats).toHaveTextContent('US$ 7.600');
  } finally { vi.useRealTimers(); }
});

it('ignores an old store response and refreshes after local sale mutations', async () => {
  let resolve!: (rows: Sale[]) => void;
  api.sales.mockReturnValueOnce(new Promise<Sale[]>(done => { resolve = done; }));
  const view = render(detail());
  state.appSession.store.id = 'other-store';
  api.sales.mockResolvedValue([]);
  view.rerender(detail());
  await waitFor(() => expect(screen.getByTestId('client-purchase-count')).toHaveTextContent(/^0$/));
  await act(async () => resolve(sales));
  expect(screen.getByTestId('client-purchase-count')).toHaveTextContent(/^0$/);
  api.sales.mockResolvedValue(sales);
  state.sales = [...sales];
  view.rerender(detail());
  await waitFor(() => expect(screen.getByTestId('client-purchase-count')).toHaveTextContent(/^7$/));
});
