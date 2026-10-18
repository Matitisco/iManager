import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, RepairOrder, Sale, TradeIn } from '../types';
import { ExchangeProvider } from './exchange';
import { ClientPurchases } from './ClientPurchases';
import { clientPurchases, purchaseTotals } from './client-purchases';

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
      <ClientPurchases clientId="c1" sales={rows.sales} tradeIns={rows.tradeIns} repairs={rows.repairs} inventory={inventory} sellers={sellers} />
    </ExchangeProvider>,
  );
}

describe('client purchases', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('keeps warranties, excludes trade-ins from the totals and shows the full IMEI', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPurchases();
    const stats = screen.getByTestId('client-purchase-stats');
    expect(stats).toHaveTextContent('Total gastado');
    expect(stats).toHaveTextContent('US$ 2.585');
    expect(stats).toHaveTextContent('Compras');
    expect(within(stats).getByText('7')).toBeInTheDocument();
    expect(stats).toHaveTextContent('2 vigentes');
    expect(screen.getByTestId('client-purchase-count')).toHaveTextContent('8');
    expect(screen.queryByText('Funda + vidrio')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument();

    const saleRow = screen.getByTestId('purchase-sale-s1');
    expect(saleRow).toHaveTextContent('iPhone 15 Pro · 256GB');
    expect(saleRow).toHaveTextContent('IMEI ···4821');
    expect(saleRow).toHaveTextContent('Lucía');
    expect(saleRow).toHaveTextContent('US$ 980');
    expect(saleRow).toHaveTextContent(/Vigente · /);
    await user.click(within(saleRow).getByRole('button'));
    expect(screen.getByTestId('purchase-detail-sale-s1')).toHaveTextContent('IMEI 350000000004821');
    expect(screen.getByTestId('purchase-detail-sale-s1')).toHaveTextContent('Vigente hasta el');

    const trade = screen.getByTestId('purchase-trade-t1');
    expect(trade).toHaveTextContent('- US$ 260');
    expect(trade).toHaveTextContent('recibido');
    expect(trade.querySelector('.spill')).toBeNull();

    const pending = screen.getByTestId('purchase-repair-r2');
    expect(pending).toHaveTextContent('iPhone 11 · pin de carga');
    expect(pending).toHaveTextContent('Al entregar');
    expect(pending).toHaveTextContent('US$ 180');
    await user.click(within(pending).getByRole('button'));
    expect(screen.getByTestId('purchase-detail-repair-r2')).toHaveTextContent('empieza al entregar');

    const done = screen.getByTestId('purchase-repair-r1');
    expect(done).toHaveTextContent('Martín (técnico)');
    expect(done).toHaveTextContent(/Vigente · /);

    await user.click(screen.getByRole('button', { name: 'Canjes' }));
    expect(screen.getByTestId('client-purchase-count')).toHaveTextContent('1');
    expect(screen.getByText('iPhone 12 · 128GB')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 15 Pro · 256GB')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reparaciones' }));
    expect(screen.getByTestId('client-purchase-count')).toHaveTextContent('2');
    expect(screen.getByText('iPhone 13 · cambio de batería')).toBeInTheDocument();
    expect(screen.getByText('Al entregar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ventas' }));
    expect(screen.queryByText('iPhone 12 · 128GB')).not.toBeInTheDocument();
    expect(screen.getAllByText('Sin garantía').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Todas' }));
    await user.click(screen.getByTestId('purchases-more'));
    expect(screen.getByText('Funda + vidrio')).toBeInTheDocument();
    expect(screen.getByText('iPhone 13 · 128GB')).toBeInTheDocument();
    expect(screen.getAllByText(/Vencida · /).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('purchases-more')).not.toBeInTheDocument();
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
      { currency: 'USD', amount: 10 },
      { currency: 'ARS', amount: 20 },
    ]);
    expect(purchaseTotals(purchases).count).toBe(2);
  });
});
