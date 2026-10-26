import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, RepairOrder, Sale, TradeIn } from '../types';
import { ExchangeProvider } from './exchange';
import { ClientPurchases } from './ClientPurchases';
import { clientPurchases, purchaseTotals, purchaseWarranty } from './client-purchases';

const sellers = [{ id: 'lucia', name: 'Lucía', role: 'STAFF' as const }];
const inventory: Product[] = [{
  id: 'p1', imei: '350000000004821', model: 'iPhone 15 Pro', capacity: '256GB', color: 'Negro',
  condition: 'USADO', grade: 'A', batteryHealth: '90%', price: 980, status: 'VENDIDO', currency: 'USD',
}];

function sale(id: string, overrides: Partial<Sale>): Sale {
  return {
    id, date: '16/10/2026', clientId: 'c1', productId: '', deviceLabel: 'Equipo', amount: 100,
    amountCurrency: 'USD', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', warrantyDays: 30,
    sellerMemberId: 'lucia', ...overrides,
  };
}

function repair(id: string, overrides: Partial<RepairOrder>): RepairOrder {
  return {
    id, orderNumber: 1, code: 'OT-0001', clientId: 'c1', clientName: 'Juan', clientPhone: '',
    device: 'iPhone 13', imei: '350000000005512', fault: 'cambio de batería', faultTags: [],
    estimate: 60, deposit: 0, currency: 'USD', technician: 'Martín', status: 'ENTREGADO',
    estimatedDelivery: null, notifyWhatsapp: false, receivedAt: '12/10/2026', whatsappUrl: null,
    warrantyDays: 30, events: [{ id: 'e', status: 'ENTREGADO', createdAt: '12/10/2026' }],
    ...overrides,
  };
}

const rows = {
  sales: [
    sale('s1', { date: '16/10/2026', productId: 'p1', deviceLabel: 'iPhone 15 Pro · 256GB', amount: 980, warrantyDays: 60 }),
    sale('s2', { date: '13/10/2026', deviceLabel: 'iPhone 14 · 128GB', amount: 590, warrantyDays: 1 }),
    sale('s3', { date: '11/10/2026', deviceLabel: 'iPhone 12 · 64GB', amount: 300, warrantyDays: 0, sellerMemberId: null }),
    sale('s4', { date: '04/10/2026', deviceLabel: 'Funda + vidrio', amount: 25, warrantyDays: 0 }),
    sale('s5', { date: '02/07/2026', deviceLabel: 'iPhone 13 · 128GB', amount: 450, warrantyDays: 1 }),
    sale('other', { clientId: 'c2', amount: 9999 }),
    sale('cancelled', { date: '17/10/2026', amount: 9999, status: 'CANCELADA' }),
  ],
  tradeIns: [{
    id: 't1', date: '15/10/2026', clientId: 'c1', deviceReceived: 'iPhone 12 · 128GB', deviceReceivedImei: '350000000000937',
    takeValue: 260, currency: 'USD', deviceGiven: '', differencePaid: 0, status: 'RECIBIDO', confirmationStatus: 'CONFIRMED' as const,
  } satisfies TradeIn, {
    id: 'gone', date: '15/10/2026', clientId: 'c1', deviceReceived: 'Cancelado', deviceReceivedImei: '',
    takeValue: 10, deviceGiven: '', differencePaid: 0, status: 'RECIBIDO', confirmationStatus: 'CANCELLED' as const,
  }],
  repairs: [
    repair('r1', {}),
    repair('r2', {
      id: 'r2', device: 'iPhone 11', fault: 'pin de carga', estimate: 180, technician: '', status: 'RECIBIDO',
      receivedAt: '14/10/2026', imei: '', warrantyDays: 8, events: [{ id: 'e2', status: 'RECIBIDO', createdAt: '14/10/2026' }],
    }),
  ],
};

function renderPurchases() {
  return render(
    <ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1500, manualSell: 1555 }}>
      <ClientPurchases clientName="Nicolás Pereyra" clientId="c1" sales={rows.sales} tradeIns={rows.tradeIns} repairs={rows.repairs} inventory={inventory} sellers={sellers} />
    </ExchangeProvider>,
  );
}

describe('client purchases', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('shows three rows with full IMEI, keeps annulled records and opens a separate full list', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPurchases();
    const preview = screen.getByTestId('client-purchases');
    const stats = screen.getByTestId('client-purchase-stats');
    expect(stats).toHaveTextContent('US$ 2.585');
    expect(within(stats).getByText('7')).toBeInTheDocument();
    expect(stats).toHaveTextContent('2 vigentes');
    expect(screen.getByTestId('client-purchase-count')).toHaveTextContent('8');
    expect(within(preview).getAllByTestId(/^purchase-(sale|trade|repair)-/)).toHaveLength(3);
    const annulled = screen.getByTestId('purchase-sale-cancelled');
    expect(annulled).toHaveClass('annulled');
    expect(annulled).toHaveTextContent('Anulada');
    expect(annulled.querySelector('.buy-pill')).toHaveClass('annulled');
    expect(screen.getByTestId('purchase-sale-s1')).toHaveTextContent('IMEI 350000000004821');
    expect(screen.getByTestId('purchase-sale-s1')).toHaveTextContent('Vigente · hasta 15/12/2026');

    await user.click(screen.getByTestId('purchases-more'));
    const dialog = screen.getByRole('dialog', { name: 'Compras · Nicolás Pereyra' });
    expect(within(dialog).getAllByTestId(/^purchase-(sale|trade|repair)-/)).toHaveLength(10);
    expect(within(dialog).getByTestId('purchase-trade-t1')).toHaveTextContent('IMEI 350000000000937');
    expect(within(dialog).getByTestId('purchase-trade-t1')).toHaveTextContent('- US$ 260');
    expect(within(dialog).getByTestId('purchase-trade-t1').querySelector('.spill')).toBeNull();
    expect(within(dialog).getByTestId('purchase-repair-r1')).toHaveTextContent('Por vencer · hasta 11/11/2026');
    expect(within(dialog).getByTestId('purchase-sale-s2')).toHaveTextContent('Vencida · 14/10/2026');
    await user.click(within(dialog).getByRole('button', { name: 'Canjes' }));
    expect(within(dialog).getAllByTestId(/^purchase-/)).toHaveLength(2);
    expect(within(dialog).getByText('1', { selector: '.buy-count' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('purchases-more')).toHaveFocus();
    expect(within(preview).getAllByTestId(/^purchase-(sale|trade|repair)-/)).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Reparaciones' }));
    expect(screen.getByTestId('client-purchase-count')).toHaveTextContent('2');
    expect(screen.getByText('Al entregar')).toBeInTheDocument();
    expect(screen.queryByTestId('purchases-more')).not.toBeInTheDocument();
  });

  it.each([
    { status: 'CANCELADA' }, { status: 'ANULADA' }, { status: 'COMPLETADA', voidedAt: '2026-10-18' },
  ])('retains annulled sales but excludes them from every aggregate: %j', (voidFields) => {
    const purchases = clientPurchases({ clientId: 'c1', sales: [sale('valid', { amount: 42 }), sale('void', { amount: 9999, ...voidFields })], tradeIns: [], repairs: [], inventory, sellers });
    expect(purchases).toHaveLength(2);
    expect(purchases.find(row => row.annulled)).toMatchObject({ countsInTotals: false, warranty: null });
    expect(purchaseTotals(purchases)).toEqual({ count: 1, activeWarranties: 1, spent: [{ currency: 'USD', amount: 42 }] });
  });

  it.each([
    ['18/11/2026', 'vigente'], // 31 days
    ['17/11/2026', 'por-vencer'], // inclusive 30 days
    ['18/10/2026', 'por-vencer'], // inclusive expiry day
    ['17/10/2026', 'vencida'],
  ])('computes coverage on calendar dates: %s is %s', (until, expected) => {
    const view = purchaseWarranty(expected === 'vencida' ? 'vencida' : 'vigente', until, 'Cobertura', new Date(2026, 9, 18, 23, 59));
    expect(view.state).toBe(expected);
    expect(view.badge).toContain(until);
  });

  it.each([
    ['18/10/2026', 31, 'vigente'],
    ['18/10/2026', 30, 'por-vencer'],
    ['18/09/2026', 30, 'por-vencer'],
    ['17/09/2026', 30, 'vencida'],
    ['18/10/2026', 0, 'sin'],
  ])('derives sale coverage from its date and duration: %s + %i', (date, warrantyDays, expected) => {
    const purchases = clientPurchases({ clientId: 'c1', sales: [sale('dated', { date, warrantyDays })], tradeIns: [], repairs: [], inventory: [], sellers: [] });
    expect(purchases[0].warranty?.state).toBe(expected);
  });

  it('handles no coverage and pending delivery without inventing a date', () => {
    expect(purchaseWarranty('sin', null, 'Sin garantía')).toMatchObject({ state: 'sin', badge: 'Sin garantía' });
    expect(purchaseWarranty('pendiente', null, 'Al entregar')).toMatchObject({ state: 'pendiente', badge: 'Al entregar' });
  });

  it('shows the approved empty state and zero totals', () => {
    render(<ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1500, manualSell: 1555 }}><ClientPurchases clientName="Julieta Ramos" clientId="empty" sales={[]} tradeIns={[]} repairs={[]} inventory={[]} sellers={[]} /></ExchangeProvider>);
    expect(screen.getByText('Todavía no tiene compras')).toBeInTheDocument();
    expect(screen.getByTestId('client-purchase-stats')).toHaveTextContent('US$ 0');
    expect(screen.getByText('0 vigentes')).toBeInTheDocument();
    expect(screen.queryByTestId('purchases-more')).not.toBeInTheDocument();
  });

  it('opens mobile purchases full screen with a return to the client', async () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: true, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPurchases();
      await user.click(screen.getByTestId('purchases-more'));
      const dialog = screen.getByRole('dialog', { name: 'Compras' });
      expect(dialog).toHaveClass('buy-sheet');
      expect(within(dialog).getByText('Nicolás Pereyra')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Volver a la ficha del cliente' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('purchases-more')).toHaveFocus();
    } finally { matchMedia.mockRestore(); }
  });

  it('sums each currency when the store cannot convert them', () => {
    const purchases = clientPurchases({
      clientId: 'c1',
      sales: [sale('a', { amount: 10, amountCurrency: 'USD' }), sale('b', { amount: 20, amountCurrency: 'ARS' })],
      tradeIns: [],
      repairs: [],
      inventory: [],
      sellers: [],
      now: new Date(2026, 9, 18, 12),
    });
    expect(purchaseTotals(purchases).spent).toEqual([
      { currency: 'ARS', amount: 20 },
      { currency: 'USD', amount: 10 },
    ]);
    expect(purchaseTotals(purchases).count).toBe(2);
  });
});
