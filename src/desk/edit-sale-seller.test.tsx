import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Sale, TradeIn } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { ExchangeProvider } from './exchange';
import type { Overlay } from './types';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({
  sales: [] as Sale[], tradeIns: [] as TradeIn[], inventory: [] as Product[], clients: [],
  operationOptions: {}, operationDrafts: [],
  commissionSellers: [{ id: 'seller', name: 'Ana Vendedora', role: 'STAFF' }],
  loadOperationOptions: vi.fn(), fetchSaleOperation: vi.fn(), fetchTradeOperation: vi.fn(),
  loadCommissionSellers: vi.fn(), updateSaleOperation: vi.fn(), confirmTradeOperation: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
const close = vi.fn();
const open = vi.fn();
const original: Sale = {
  id: 'sale', date: '11/10/2026', clientId: 'client', clientName: 'Ana Pérez', productId: 'product',
  deviceLabel: 'iPhone 14 128GB', amount: 1500.31, amountCurrency: 'USD', paymentMethod: 'EFECTIVO',
  status: 'COMPLETADA', integratedOperation: true, tradeInId: null,
};
function mount(overlay: Overlay = { type: 'edit-sale', id: 'sale' }, active: 'ARS' | 'USD' = 'ARS') {
  return render(<ExchangeProvider settings={{ currency: active, exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1190, manualSell: 1234.56 }}>
    <DeskProvider value={{ tab: 'sales', go: vi.fn(), open, openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={overlay} />
    </DeskProvider>
  </ExchangeProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.sales = [{ ...original }]; ctx.tradeIns = [];
  ctx.inventory = [{ id: 'product', model: 'iPhone 14', capacity: '128GB', color: 'Azul', imei: '', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 900, price: 1500.31, currency: 'USD', status: 'VENDIDO' }];
  ctx.loadOperationOptions.mockResolvedValue(undefined);
  ctx.fetchSaleOperation.mockResolvedValue({}); ctx.fetchTradeOperation.mockResolvedValue({});
  ctx.loadCommissionSellers.mockResolvedValue(undefined);
  ctx.updateSaleOperation.mockResolvedValue({ summary: 'Operación actualizada' });
});
afterEach(() => vi.restoreAllMocks());

describe('sale seller editing', () => {
  it.each([390, 1440])('anchors the real edit form calendar and persists the chosen date at %s px', async width => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const rect = this.matches('.sheet-scroll')
        ? { x: 0, y: 140, width, height: 600 }
        : this.matches('input') ? { x: 16, y: 250, width: 350, height: 48 } : null;
      return rect ? { ...rect, left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height, toJSON: () => ({}) } : originalRect.call(this);
    });
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario: fecha de la venta' }));
    const panel = screen.getByRole('dialog', { name: 'Elegir fecha de la venta' }).parentElement!;
    expect(parseFloat(panel.style.top)).toBe(306);
    expect(parseFloat(panel.style.maxHeight)).toBe(426);
    fireEvent.scroll(screen.getByRole('dialog', { name: 'Editar operación' }).querySelector('.sheet-scroll')!);
    expect(parseFloat(panel.style.top)).toBe(306);
    await userEvent.click(screen.getByRole('button', { name: 'lunes, 12 de octubre de 2026' }));
    expect(screen.queryByRole('dialog', { name: 'Elegir fecha de la venta' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de la venta')).toHaveValue('12/10/2026');
    expect(screen.getByLabelText('Fecha de la venta')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateSaleOperation).toHaveBeenCalledWith('sale', expect.objectContaining({ date: '12/10/2026', amount: original.amount, currency: original.amountCurrency })));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it.each(['CANCELADA', 'COMPLETADA', 'PENDIENTE'] as const)('detail edit visibility for %s', status => {
    ctx.sales[0].status = status;
    mount({ type: 'sale', id: 'sale' });
    if (status === 'CANCELADA') expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    else expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled();
  });
  it.each(['CANCELADA', 'COMPLETADA', 'PENDIENTE'] as const)('context menu edit and cancel visibility for %s', status => {
    ctx.sales[0].status = status;
    mount({ type: 'ctx', kind: 'sale', id: 'sale', label: 'V-0001', x: 10, y: 10 });
    if (status === 'CANCELADA') expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument();
    else expect(screen.getByRole('button', { name: 'Anular' })).toBeEnabled();
    if (status === 'CANCELADA') expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    else expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled();
  });
  it('blocks a stale cancelled form without sending any update', async () => {
    ctx.sales[0].status = 'CANCELADA'; mount();
    expect(screen.getByText('Esta venta está cancelada y no se puede editar.')).toBeVisible();
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(save).toBeDisabled(); await userEvent.click(save);
    expect(ctx.updateSaleOperation).not.toHaveBeenCalled();
  });
  it.each([
    { currency: 'USD', active: 'ARS', status: 'COMPLETADA', integratedOperation: true, trade: false, deposit: 0 },
    { currency: 'ARS', active: 'USD', status: 'COMPLETADA', integratedOperation: true, trade: false, deposit: 0 },
    { currency: 'USD', active: 'ARS', status: 'COMPLETADA', integratedOperation: false, trade: false, deposit: 0 },
    { currency: 'USD', active: 'ARS', status: 'COMPLETADA', integratedOperation: true, trade: true, deposit: 0 },
    { currency: 'ARS', active: 'USD', status: 'COMPLETADA', integratedOperation: true, trade: true, deposit: 50 },
    { currency: 'USD', active: 'ARS', status: 'PENDIENTE', integratedOperation: true, trade: false, deposit: 50 },
  ] as const)('preserves sale money on seller-only edit: %j', async variant => {
    ctx.sales[0] = { ...original, amountCurrency: variant.currency, status: variant.status, integratedOperation: variant.integratedOperation, depositAppliedAmount: variant.deposit, tradeInId: variant.trade ? 'trade' : null };
    if (variant.trade) ctx.tradeIns = [{ id: 'trade', date: original.date, clientId: 'client', clientName: 'Ana Pérez', deviceReceived: 'iPhone 11', deviceReceivedImei: '', takeValue: 300.21, currency: variant.currency, deviceGiven: original.deviceLabel!, differencePaid: original.amount - 300.21, status: 'PENDIENTE', confirmationStatus: 'CONFIRMED', saleId: 'sale' }];
    mount(undefined, variant.active);
    await userEvent.click(screen.getByRole('combobox', { name: 'Vendedor' }));
    await userEvent.click(screen.getByRole('option', { name: /Ana Vendedora/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateSaleOperation).toHaveBeenCalledWith('sale', expect.objectContaining({ sellerMemberId: 'seller', amount: original.amount, currency: variant.currency, status: variant.status, clientId: original.clientId })));
    if (variant.trade) expect(ctx.updateSaleOperation.mock.calls[0][1].tradeIn.takeValue).toBe(300.21);
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it('clears the seller explicitly', async () => {
    ctx.sales[0].sellerMemberId = 'seller'; mount();
    await userEvent.click(screen.getByRole('combobox', { name: 'Vendedor' }));
    await userEvent.click(screen.getByRole('option', { name: 'Sin vendedor' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateSaleOperation).toHaveBeenCalledWith('sale', expect.objectContaining({ sellerMemberId: null, amount: original.amount, currency: original.amountCurrency })));
  });
  it.each([false, true])('scrolls save errors into view and keeps the form open (phone: %s)', async phone => {
    const media = window.matchMedia('(max-width: 760px)');
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ ...media, media: query, matches: phone && query.includes('760') }));
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    ctx.updateSaleOperation.mockRejectedValue(new Error('No se puede guardar la venta'));
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const notice = await screen.findByText('No se puede guardar la venta');
    expect(notice).toHaveClass('ferr');
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    expect(scroll.mock.contexts).toContain(notice);
    expect(close).not.toHaveBeenCalled();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });
});

describe('retomar canjes pendientes', () => {
  it.each([90, 0])('recupera vendedor y garantía %s y los envía al confirmar', async warrantyDays => {
    ctx.sales = [];
    ctx.inventory[0].status = 'DISPONIBLE';
    ctx.tradeIns = [{ id: 'trade', date: original.date, clientId: 'client', clientName: 'Ana Pérez',
      deviceReceived: 'iPhone 11 ficticio', deviceReceivedImei: '', takeValue: 300,
      currency: 'USD', deviceGiven: original.deviceLabel!, differencePaid: 0, status: 'PENDIENTE',
      confirmationStatus: 'PENDING', draftProductId: 'product', draftAmount: 675,
      draftSellerMemberId: 'seller', draftWarrantyDays: warrantyDays }];
    ctx.confirmTradeOperation.mockResolvedValue({ summary: 'Canje confirmado' });
    mount({ type: 'edit-cj', id: 'trade' }, 'USD');
    expect(screen.getByRole('combobox', { name: 'Vendedor' })).toHaveTextContent('Ana Vendedora');
    if (warrantyDays === 0) expect(screen.getByLabelText('Días de garantía')).toHaveValue('0');
    else expect(screen.getByRole('button', { name: '90 días' })).toHaveClass('on');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar canje' }));
    await waitFor(() => expect(ctx.confirmTradeOperation).toHaveBeenCalledWith('tradeins', 'trade', expect.objectContaining({ sellerMemberId: 'seller', warrantyDays })));
  });
});
