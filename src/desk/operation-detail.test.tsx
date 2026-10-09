import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sale, TradeIn } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';
import type { Overlay } from './types';

const ctx = vi.hoisted(() => ({
  sales: [] as Sale[],
  tradeIns: [] as TradeIn[],
  clients: [] as { id: string; name: string }[],
  inventory: [] as { id: string; model: string; capacity: string }[],
  updateSale: vi.fn(),
  updateTradeIn: vi.fn(),
  updateTradeOperation: vi.fn(),
  cancelTradeOperation: vi.fn(),
  fetchSaleOperation: vi.fn(),
  fetchTradeOperation: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));

const open = vi.fn();
const close = vi.fn();
const toast = vi.fn();

function trade(overrides: Partial<TradeIn> = {}): TradeIn {
  return {
    id: 't1',
    tradeNumber: 3,
    date: '2026-10-08',
    clientId: '',
    clientName: 'Ana Pérez',
    deviceReceived: 'iPhone 11',
    deviceReceivedImei: '',
    takeValue: 1000,
    deviceGiven: 'iPhone 13',
    differencePaid: 500,
    status: 'PERITAJE TÉC.',
    confirmationStatus: 'CONFIRMED',
    saleId: 's1',
    ...overrides,
  };
}

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 's1',
    saleNumber: 4,
    date: '2026-10-08',
    clientId: '',
    clientName: 'Ana Pérez',
    productId: '',
    deviceLabel: 'iPhone 13',
    amount: 1500,
    paymentMethod: 'EFECTIVO',
    status: 'COMPLETADA',
    integratedOperation: true,
    tradeInId: 't1',
    ...overrides,
  };
}

function renderOverlay(overlay: Overlay, canManageSensitive = true) {
  return render(
    <DeskProvider value={{ tab: 'tradeins', go: vi.fn(), open, openRecord: vi.fn(), close, toast, isStaff: false, canManageSensitive }}>
      <DeskOverlays overlay={overlay} />
    </DeskProvider>,
  );
}

describe('operation detail', () => {
  beforeEach(() => {
    ctx.sales = [sale()];
    ctx.tradeIns = [trade()];
    ctx.clients = [];
    ctx.inventory = [];
    ctx.updateSale.mockReset();
    ctx.updateSale.mockResolvedValue(undefined);
    ctx.updateTradeIn.mockReset();
    ctx.updateTradeOperation.mockReset();
    ctx.updateTradeOperation.mockResolvedValue({ summary: 'Operación actualizada' });
    ctx.cancelTradeOperation.mockReset();
    ctx.cancelTradeOperation.mockResolvedValue({ summary: 'Operación cancelada' });
    ctx.fetchSaleOperation.mockReset();
    ctx.fetchSaleOperation.mockResolvedValue({});
    ctx.fetchTradeOperation.mockReset();
    ctx.fetchTradeOperation.mockResolvedValue({});
    open.mockReset();
    close.mockReset();
    toast.mockReset();
  });

  it('asks before cancelling a trade and only cancels after confirmation', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'cj', id: 't1' });

    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    expect(ctx.cancelTradeOperation).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Cancelar operación' })).toHaveTextContent('C-0003 se cancelará y quedará en el historial.');

    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(ctx.cancelTradeOperation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    await waitFor(() => expect(ctx.cancelTradeOperation).toHaveBeenCalledWith('tradeins', 't1'));
  });

  it('asks before cancelling an integrated sale', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'sale', id: 's1' });

    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    expect(ctx.updateSale).not.toHaveBeenCalled();
    expect(screen.getByText('V-0004 se cancelará y quedará en el historial.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    await waitFor(() => expect(ctx.updateSale).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', status: 'CANCELADA' })));
  });

  it('changes peritaje, revisión and aprobado from the trade card', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'cj', id: 't1' });

    expect(screen.getByRole('button', { name: 'Peritaje téc.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En revisión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar estado' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'En revisión' }));
    await user.click(screen.getByRole('button', { name: 'Guardar estado' }));
    await waitFor(() => expect(ctx.updateTradeOperation).toHaveBeenCalledWith('tradeins', 't1', {
      tradeIn: expect.objectContaining({ deviceReceived: 'iPhone 11', takeValue: 1000, status: 'EN REVISIÓN' }),
    }));

    await user.click(screen.getByRole('button', { name: 'Aprobado' }));
    await user.click(screen.getByRole('button', { name: 'Guardar estado' }));
    await waitFor(() => expect(ctx.updateTradeOperation).toHaveBeenLastCalledWith('tradeins', 't1', {
      tradeIn: expect.objectContaining({ status: 'APROBADO' }),
    }));
    expect(open).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps a cancelled trade read-only', () => {
    ctx.tradeIns = [trade({ confirmationStatus: 'CANCELLED', status: 'APROBADO' })];
    renderOverlay({ type: 'cj', id: 't1' });

    expect(screen.getByText('Aprobado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar estado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar operación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Peritaje téc.' })).not.toBeInTheDocument();
  });

  it('hides cancel and delete when the member cannot manage sensitive actions', () => {
    renderOverlay({ type: 'cj', id: 't1' }, false);
    expect(screen.queryByRole('button', { name: 'Cancelar operación' })).not.toBeInTheDocument();
    cleanup();

    renderOverlay({ type: 'ctx', kind: 'sale', id: 's1', label: 'V-0004', x: 10, y: 10 }, false);
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  it('shows who cancelled the sale on the record', () => {
    ctx.sales = [sale({
      status: 'CANCELADA',
      tradeInId: null,
      cancelledBy: 'Ana Pérez',
      cancelledAt: '2026-10-09T15:04:00.000Z',
    })];
    renderOverlay({ type: 'sale', id: 's1' });
    expect(screen.getByText('Cancelada por Ana Pérez el 09/10/2026 12:04')).toBeInTheDocument();
  });

  it('shows who cancelled the trade on the record', () => {
    ctx.tradeIns = [trade({
      confirmationStatus: 'CANCELLED',
      status: 'CANCELADO',
      cancelledBy: 'Luis Socio',
      cancelledAt: '2026-10-09T18:30:00.000Z',
    })];
    renderOverlay({ type: 'cj', id: 't1' });
    expect(screen.getByText('Cancelada por Luis Socio el 09/10/2026 15:30')).toBeInTheDocument();
  });
});
