import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RepairOrder, Sale } from '../types';
import { clientPurchases, purchaseTotals } from './client-purchases';
import { clientSpendingById, formatClientSpending } from './client-spending';
import { ExchangeProvider, useMoney } from './exchange';

function purchaseSale(id: string, overrides: Partial<Sale> = {}): Sale {
  return { id, clientId: 'c1', productId: '', deviceLabel: 'Equipo', date: '25/10/2026', amount: 600, amountCurrency: 'USD', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', ...overrides };
}

function purchaseRepair(id: string, overrides: Partial<RepairOrder> = {}): RepairOrder {
  return { id, orderNumber: 1, code: 'OT-0001', clientId: 'c1', clientName: 'Cliente', clientPhone: '', device: 'Equipo', imei: '', fault: 'Batería', faultTags: [], estimate: 80, deposit: 20, currency: 'USD', technician: '', status: 'ENTREGADO', estimatedDelivery: null, notifyWhatsapp: false, receivedAt: '25/10/2026', whatsappUrl: null, events: [], ...overrides };
}

function Spending({ sales, repairs = [] }: { sales: Sale[]; repairs?: RepairOrder[] }) {
  const money = useMoney();
  const parts = clientSpendingById(sales, repairs, money.active).get('c1') ?? [];
  return <output>{formatClientSpending(parts, money)}</output>;
}

function renderSpending(sales: Sale[], repairs: RepairOrder[] = [], currency: 'ARS' | 'USD' = 'ARS', rate: number | null = 1565) {
  return render(<ExchangeProvider settings={{ currency, exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: rate, manualSell: rate }}><Spending sales={sales} repairs={repairs} /></ExchangeProvider>);
}

describe('shared client spending', () => {
  it('matches the detail definition, excludes other clients and annulments, and counts repair estimates once', () => {
    const sales = [purchaseSale('valid'), purchaseSale('other', { clientId: 'c2', amount: 20 }), purchaseSale('cancelled', { status: 'CANCELADA' }), purchaseSale('annulled', { status: 'ANULADA' }), purchaseSale('voided', { voidedAt: '2026-10-26' })];
    const repairs = [purchaseRepair('estimated'), purchaseRepair('deposit-only', { estimate: null }), purchaseRepair('zero-estimate', { estimate: 0 }), purchaseRepair('void', { archivedAt: '2026-10-26' }), purchaseRepair('other', { clientId: 'c2' })];
    const spending = clientSpendingById(sales, repairs, 'ARS');
    const detail = purchaseTotals(clientPurchases({ clientId: 'c1', sales, repairs, tradeIns: [{ id: 't', clientId: 'c1', date: '25/10/2026', deviceReceived: 'Canje', deviceReceivedImei: '', takeValue: 9999, currency: 'USD', deviceGiven: '', differencePaid: 0, status: 'RECIBIDO' }], inventory: [], sellers: [] }), 'ARS');
    expect(spending.get('c1')).toEqual([{ currency: 'USD', amount: 700 }]);
    expect(spending.get('c2')).toEqual([{ currency: 'USD', amount: 100 }]);
    expect(spending.get('c1')).toEqual(detail.spent);
    expect(clientSpendingById([], [], 'ARS').size).toBe(0);
  });

  it('shows the audited USD 600 purchase as ARS 939,000 using the system rate', () => {
    renderSpending([purchaseSale('qa')]);
    expect(screen.getByRole('status')).toHaveTextContent('$ 939.000');
  });

  it.each([1565, null])('keeps mixed ARS and USD subtotals separate with rate %s', rate => {
    renderSpending([purchaseSale('usd'), purchaseSale('ars', { amount: 1000, amountCurrency: 'ARS' })], [purchaseRepair('repair')], 'ARS', rate);
    expect(screen.getByRole('status')).toHaveTextContent('$ 1.000 + US$ 680');
  });

  it.each(['ARS', 'USD'] as const)('groups missing and explicit %s currency together using the active currency', currency => {
    const sales = [purchaseSale('legacy', { amount: 10, amountCurrency: null }), purchaseSale('explicit', { amount: 20, amountCurrency: currency })];
    expect(clientSpendingById(sales, [], currency).get('c1')).toEqual([{ currency, amount: 30 }]);
    renderSpending(sales, [], currency);
    expect(screen.getByRole('status')).toHaveTextContent(currency === 'USD' ? 'US$ 30' : '$ 30');
  });

  it('retains the source currency if conversion is unavailable', () => {
    renderSpending([purchaseSale('qa')], [], 'ARS', null);
    expect(screen.getByRole('status')).toHaveTextContent('US$ 600');
  });

  it('shows zero for a client with no purchases', () => {
    renderSpending([], [], 'USD');
    expect(screen.getByRole('status')).toHaveTextContent('US$ 0');
  });
});
