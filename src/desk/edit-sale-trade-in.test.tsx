import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Sale, TradeIn } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({
  sales: [] as Sale[], tradeIns: [] as TradeIn[], inventory: [] as Product[], clients: [],
  operationOptions: {}, operationDrafts: [],
  loadOperationOptions: vi.fn(), fetchSaleOperation: vi.fn(), fetchTradeOperation: vi.fn(),
  updateSaleOperation: vi.fn(), updateSale: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
const close = vi.fn();
const sale: Sale = {
  id: 'sale', date: '11/10/2026', clientId: 'client', clientName: 'Ana Pérez', productId: 'product',
  deviceLabel: 'iPhone 14 128GB', amount: 1500, paymentMethod: 'EFECTIVO', status: 'PENDIENTE', integratedOperation: true, tradeInId: null,
};
const product: Product = {
  id: 'product', model: 'iPhone 14', capacity: '128GB', color: 'Azul', imei: '',
  condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 900, price: 1500, status: 'VENDIDO',
};
const trade: TradeIn = {
  id: 'trade', date: sale.date, clientId: sale.clientId, clientName: sale.clientName, deviceReceived: 'iPhone 11',
  deviceReceivedImei: '123456789012345', takeValue: 500, deviceGiven: 'iPhone 14', differencePaid: 1000,
  status: 'PENDIENTE', confirmationStatus: 'CONFIRMED', saleId: sale.id,
};
function mount() {
  render(<DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}>
    <DeskOverlays overlay={{ type: 'edit-sale', id: sale.id }} />
  </DeskProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.sales = [{ ...sale }]; ctx.tradeIns = []; ctx.inventory = [product];
  ctx.loadOperationOptions.mockResolvedValue(undefined);
  ctx.fetchSaleOperation.mockResolvedValue({}); ctx.fetchTradeOperation.mockResolvedValue({});
  ctx.updateSaleOperation.mockResolvedValue({ summary: 'Operación actualizada' });
});
afterEach(cleanup);

describe('editing sale trade-in', () => {
  it.each([true, false])('adds a trade-in to an existing sale (integrated: %s)', async (integratedOperation) => {
    ctx.sales = [{ ...sale, integratedOperation }];
    const user = userEvent.setup(); mount();
    const checkbox = screen.getByRole('checkbox', { name: 'Tiene canje' });
    expect(checkbox).toBeEnabled();
    await user.click(checkbox);
    await user.type(screen.getByLabelText('Equipo recibido'), 'iPhone 12');
    await user.type(screen.getByLabelText('Valor tomado'), '600');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateSaleOperation).toHaveBeenCalledWith(sale.id, expect.objectContaining({
      amount: 1500, tradeIn: expect.objectContaining({ deviceReceived: 'iPhone 12', takeValue: 600 }),
    })));
    expect(ctx.updateSale).not.toHaveBeenCalled();
    await waitFor(() => expect(close).toHaveBeenCalled());
  });

  it('removes a linked trade-in explicitly without validating hidden trade fields', async () => {
    ctx.sales = [{ ...sale, tradeInId: trade.id }]; ctx.tradeIns = [{ ...trade }];
    const user = userEvent.setup(); mount();
    await user.clear(screen.getByLabelText('Valor tomado'));
    await user.click(screen.getByRole('checkbox', { name: 'Tiene canje' }));
    expect(screen.queryByLabelText('Equipo recibido')).not.toBeInTheDocument();
    expect(screen.getByText(/se archivará el equipo recibido/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateSaleOperation).toHaveBeenCalledWith(sale.id, expect.objectContaining({ amount: 1500, tradeIn: null })));
  });

  it('edits the received device and clears its optional IMEI', async () => {
    ctx.sales = [{ ...sale, tradeInId: trade.id }]; ctx.tradeIns = [{ ...trade }];
    const user = userEvent.setup(); mount();
    await user.clear(screen.getByLabelText('Equipo recibido'));
    await user.type(screen.getByLabelText('Equipo recibido'), 'iPhone 12');
    await user.clear(screen.getByLabelText('IMEI (opcional)'));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateSaleOperation).toHaveBeenCalledWith(sale.id, expect.objectContaining({ tradeIn: expect.objectContaining({ deviceReceived: 'iPhone 12', deviceReceivedImei: '' }) })));
  });

  it('keeps the form open with a visible error if removing the trade fails', async () => {
    ctx.sales = [{ ...sale, tradeInId: trade.id }]; ctx.tradeIns = [{ ...trade }];
    ctx.updateSaleOperation.mockRejectedValue(new Error('El equipo recibido ya está en uso'));
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('checkbox', { name: 'Tiene canje' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('El equipo recibido ya está en uso')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Editar operación' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Tiene canje' })).not.toBeChecked();
    expect(close).not.toHaveBeenCalled();
  });
});
