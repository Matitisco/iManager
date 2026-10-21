import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sale, TradeIn } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';
import { ReportsScreen } from './screens/ReportsScreen';
import type { Overlay } from './types';
import { NETWORK_ERROR_MESSAGE } from '../lib/user-message';

const paymentsApi = vi.hoisted(() => ({
  fetchClientPayments: vi.fn(async () => [] as Array<{ id: string; amount: number; method: string; paidAt: string; kind?: string; saleId?: string | null }>),
}));

const accountsApi = vi.hoisted(() => ({
  fetchSaleAccount: vi.fn(async () => null as { due?: number; installments?: unknown[]; tenders?: unknown[] } | null),
}));

const ctx = vi.hoisted(() => ({
  sales: [] as Sale[],
  tradeIns: [] as TradeIn[],
  user: null as { getIdToken: () => Promise<string> } | null,
  clients: [] as Array<{ id: string; name: string; pendingBalance?: number; totalSpent?: number; phone?: string; email?: string; dni?: string; lastPurchaseDate?: string; balanceCurrency?: string | null }>,
  inventory: [] as { id: string; model: string; capacity: string }[],
  updateSale: vi.fn(),
  deleteSale: vi.fn(),
  updateTradeIn: vi.fn(),
  updateTradeOperation: vi.fn(),
  cancelTradeOperation: vi.fn(),
  deleteTradeIn: vi.fn(),
  fetchSaleOperation: vi.fn(),
  fetchTradeOperation: vi.fn(),
  registerClientPayment: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../services/clients-api', () => paymentsApi);
vi.mock('../services/accounts-api', () => accountsApi);

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

async function openMoreActions(user: ReturnType<typeof userEvent.setup>) {
  const summary = screen.queryByText('Más acciones', { exact: true });
  const disclosure = summary?.closest('details');
  if (summary && disclosure && !(disclosure as HTMLDetailsElement).open) await user.click(summary);
}

function ReportsWithOverlay() {
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  return <DeskProvider value={{ tab: 'reports', go: vi.fn(), open: setOverlay, openRecord: vi.fn(), close: () => setOverlay(null), toast, isStaff: false, canManageSensitive: true }}>
    <ReportsScreen />
    <DeskOverlays overlay={overlay} />
  </DeskProvider>;
}

describe('operation detail', () => {
  beforeEach(() => {
    ctx.sales = [sale()];
    ctx.tradeIns = [trade()];
    ctx.user = null;
    ctx.clients = [];
    paymentsApi.fetchClientPayments.mockReset();
    paymentsApi.fetchClientPayments.mockResolvedValue([]);
    accountsApi.fetchSaleAccount.mockReset();
    accountsApi.fetchSaleAccount.mockResolvedValue(null);
    ctx.inventory = [];
    ctx.updateSale.mockReset();
    ctx.updateSale.mockResolvedValue(undefined);
    ctx.deleteSale.mockReset().mockResolvedValue(undefined);
    ctx.updateTradeIn.mockReset();
    ctx.updateTradeOperation.mockReset();
    ctx.updateTradeOperation.mockResolvedValue({ summary: 'Operación actualizada' });
    ctx.cancelTradeOperation.mockReset();
    ctx.cancelTradeOperation.mockResolvedValue({ summary: 'Operación cancelada' });
    ctx.deleteTradeIn.mockReset().mockResolvedValue(undefined);
    ctx.fetchSaleOperation.mockReset();
    ctx.fetchSaleOperation.mockResolvedValue({});
    ctx.fetchTradeOperation.mockReset();
    ctx.fetchTradeOperation.mockResolvedValue({});
    ctx.registerClientPayment.mockReset();
    ctx.registerClientPayment.mockResolvedValue({ id: 'c1', pendingBalance: 270, balanceCurrency: 'USD' });
    open.mockReset();
    close.mockReset();
    toast.mockReset();
  });

  it('confirms deletion of a cancelled linked sale and keeps failures visible', async () => {
    ctx.sales = [sale({ status: 'CANCELADA' })];
    ctx.deleteSale.mockRejectedValueOnce(new Error('No se pudo eliminar la venta'));
    renderOverlay({ type: 'del', kind: 'sale', id: 's1', label: 'V-0004 · Ana Pérez' });
    const dialog = screen.getByRole('dialog', { name: 'Anular venta V-0004 · Ana Pérez' });
    expect(dialog).toHaveTextContent('no se puede deshacer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Anular' }));
    expect(await screen.findByText('No se pudo eliminar la venta')).toBeVisible();
    expect(close).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Anular' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(ctx.deleteSale).toHaveBeenCalledWith('s1', 'Error de carga');
    expect(toast).toHaveBeenCalledWith('Anulado');
    expect(ctx.updateSale).not.toHaveBeenCalled();
  });

  it('deletes a cancelled trade and keeps a failed delete on screen', async () => {
    ctx.tradeIns = [trade({ confirmationStatus: 'CANCELLED', status: 'CANCELADO' })];
    ctx.deleteTradeIn.mockRejectedValueOnce(new Error('No se pudo eliminar el canje'));
    renderOverlay({ type: 'del', kind: 'cj', id: 't1', label: 'C-0003 · Ana Pérez' });
    const dialog = screen.getByRole('dialog', { name: 'Anular canje' });
    expect(dialog).toHaveTextContent('no se puede deshacer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Anular' }));
    expect(await screen.findByText('No se pudo eliminar el canje')).toBeVisible();
    expect(close).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Anular' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(ctx.deleteTradeIn).toHaveBeenCalledWith('t1', 'Error de carga');
    expect(toast).toHaveBeenCalledWith('Anulado');
    expect(ctx.cancelTradeOperation).not.toHaveBeenCalled();
  });

  it('keeps an active trade confirmation as cancellation', () => {
    ctx.tradeIns = [trade()];
    renderOverlay({ type: 'del', kind: 'cj', id: 't1', label: 'C-0003' });
    expect(screen.getByRole('dialog', { name: 'Cancelar operación' })).toHaveTextContent('quedará en el historial');
  });

  it.each([false, true])('keeps the delete-canje dialog open with a translated network error and allows retry (phone: %s)', async (phone) => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({ ...original(query), matches: phone && query.includes('760') }));
    try {
      ctx.tradeIns = [trade({ confirmationStatus: 'CANCELLED', status: 'CANCELADO' })];
      ctx.deleteTradeIn.mockRejectedValueOnce(new TypeError(phone ? 'Load failed' : 'Failed to fetch'));
      renderOverlay({ type: 'del', kind: 'cj', id: 't1', label: 'C-0003 · Ana Pérez' });
      const dialog = screen.getByRole('dialog', { name: 'Anular canje' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Anular' }));
      expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeVisible();
      expect(dialog).toBeVisible();
      expect(close).not.toHaveBeenCalled();
      expect(toast).not.toHaveBeenCalled();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Anular' }));
      await waitFor(() => expect(close).toHaveBeenCalledOnce());
      expect(ctx.deleteTradeIn).toHaveBeenCalledTimes(2);
      expect(toast).toHaveBeenCalledWith('Anulado');
    } finally { window.matchMedia = original; }
  });

  it('keeps the active linked sale confirmation as cancellation', () => {
    renderOverlay({ type: 'del', kind: 'sale', id: 's1', label: 'V-0004' });
    expect(screen.getByRole('dialog', { name: 'Cancelar operación' })).toHaveTextContent('quedará en el historial');
  });

  it.each([false, true])('keeps sale actions outside the scrollable body (phone: %s)', (phone) => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      ...original(query),
      matches: phone && query.includes('760'),
    }));
    try {
      renderOverlay({ type: 'sale', id: 's1' });
      const dialog = screen.getByRole('dialog', { name: 'V-0004' });
      const body = dialog.querySelector('.sheet-scroll');
      const footer = dialog.querySelector('.sheet-foot');
      expect(body).not.toBeNull();
      expect(footer).not.toBeNull();
      expect(footer?.parentElement).toBe(dialog);
      expect(body).not.toContainElement(footer as HTMLElement);
      expect(body).toContainElement(within(dialog).getByRole('region', { name: 'Canje como parte de pago' }));
      expect(within(footer as HTMLElement).getByRole('button', { name: /^Cerrar$/ })).toBeInTheDocument();
      expect(within(footer as HTMLElement).getByRole('button', { name: /^Compartir comprobante$/ })).toBeInTheDocument();
      expect(footer?.querySelector('.sheet-action-menu-list')).not.toBeNull();
      expect(footer?.querySelector('.sheet-action-menu-list')).toHaveTextContent('Cancelar operaciónEditarDevolver');
      expect(body).not.toContainElement(footer as HTMLElement);
    } finally {
      window.matchMedia = original;
      cleanup();
    }
  });

  it.each([2, 4, 5])('keeps %s sale actions in a primary and secondary footer hierarchy', (count) => {
    ctx.sales = [sale(count === 2 ? { status: 'PENDIENTE' } : count === 4 ? { integratedOperation: false, tradeInId: null } : {})];
    renderOverlay({ type: 'sale', id: 's1' }, count !== 2);
    const dialog = screen.getByRole('dialog', { name: 'V-0004' });
    const footer = dialog.querySelector('.sheet-foot') as HTMLElement;
    const grid = footer.querySelector('.sacts') as HTMLElement;
    const primary = within(footer).getByRole('button', { name: count === 2 ? 'Marcar cobrada' : 'Compartir comprobante' });
    expect(primary).toHaveClass('sheet-primary');
    expect(grid.querySelectorAll('.sheet-primary')).toHaveLength(1);
    expect(within(footer).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    const menu = footer.querySelector('.sheet-action-menu-list');
    if (count === 2) {
      expect(menu).toHaveTextContent('Editar');
      expect(menu).not.toHaveTextContent('Cancelar venta');
    } else if (count === 4) {
      expect(menu).toHaveTextContent('Editar');
      expect(menu).toHaveTextContent('Devolver');
    } else {
      expect(menu).toHaveTextContent('Cancelar operación');
      expect(menu).toHaveTextContent('Editar');
      expect(menu).toHaveTextContent('Devolver');
    }
    expect(footer.querySelectorAll('.sheet-action-menu')).toHaveLength(1);
    expect(dialog.querySelector('.sheet-scroll')).not.toContainElement(footer);
    if (count === 4) {
      expect(within(dialog).queryByRole('region', { name: 'Canje como parte de pago' })).not.toBeInTheDocument();
    }
  });

  it.each(['COMPLETADA', 'PENDIENTE'])('opens the shared compact sale detail from Reportes with grouped trade data (%s)', async (status) => {
    ctx.sales = [sale({ date: new Date().toISOString(), status })];
    render(<ReportsWithOverlay />);
    await userEvent.click(screen.getByRole('button', { name: /V-0004.*Ana Pérez/ }));
    const dialog = screen.getByRole('dialog', { name: 'V-0004' });
    expect(dialog).toHaveClass('sale-detail-sheet');
    const tradeBlock = within(dialog).getByRole('region', { name: 'Canje como parte de pago' });
    expect(within(tradeBlock).getByRole('heading', { name: 'Canje como parte de pago' })).toBeInTheDocument();
    for (const label of ['Equipo recibido', 'Calidad recibida', 'Valor tomado', 'Diferencia del canje', 'Estado técnico', 'Confirmación']) {
      expect(within(dialog).getByText(label).closest('section')).toBe(tradeBlock);
    }
    const footer = dialog.querySelector('.sheet-foot') as HTMLElement;
    expect(footer.parentElement).toBe(dialog);
    expect(dialog.querySelector('.sheet-scroll')).not.toContainElement(footer);
    const user = userEvent.setup();
    await openMoreActions(user);
    expect(within(footer).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('opens a sale without trade-in from Reportes and closes from its footer', async () => {
    ctx.sales = [sale({ date: new Date().toISOString(), integratedOperation: false, tradeInId: null })];
    render(<ReportsWithOverlay />);
    await userEvent.click(screen.getByRole('button', { name: /V-0004.*Ana Pérez/ }));
    const dialog = screen.getByRole('dialog', { name: 'V-0004' });
    const footer = dialog.querySelector('.sheet-foot') as HTMLElement;
    expect(within(footer).getByRole('button', { name: 'Compartir comprobante' })).toHaveClass('sheet-primary');
    expect(dialog.querySelector('.sheet-scroll')).not.toContainElement(footer);
    expect(within(dialog).queryByRole('region', { name: 'Canje como parte de pago' })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await openMoreActions(user);
    expect(within(footer.querySelector('.sheet-action-menu-list') as HTMLElement).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    await user.click(within(footer).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps pending sale actions in the footer and respects cancellation permissions', async () => {
    ctx.sales = [sale({ status: 'PENDIENTE' })];
    renderOverlay({ type: 'sale', id: 's1' }, false);
    const dialog = screen.getByRole('dialog', { name: 'V-0004' });
    const footer = dialog.querySelector('.sheet-foot') as HTMLElement;
    expect(within(footer).getByRole('button', { name: 'Marcar cobrada' })).toBeInTheDocument();
    const user = userEvent.setup();
    await openMoreActions(user);
    expect(within(footer).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Cancelar venta' })).not.toBeInTheDocument();
    expect(dialog.querySelector('.sheet-scroll')).not.toContainElement(footer);
  });

  it('opens the secondary-action disclosure accessibly and gives Escape priority over the sheet', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'sale', id: 's1' });
    const dialog = screen.getByRole('dialog', { name: 'V-0004' });
    const disclosure = dialog.querySelector('.sheet-action-menu') as HTMLDetailsElement;
    const summary = within(disclosure).getByText('Más acciones', { exact: true });

    await user.click(summary);
    expect(disclosure.open).toBe(true);
    expect(within(disclosure).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    summary.focus();
    fireEvent.keyDown(summary, { key: 'Escape', code: 'Escape', bubbles: true });
    expect(disclosure.open).toBe(false);
    expect(dialog).toBeInTheDocument();
    expect(document.activeElement).toBe(summary);
    fireEvent.keyDown(summary, { key: 'Escape', code: 'Escape', bubbles: true });
    expect(close).toHaveBeenCalledOnce();
  });

  it('asks before cancelling a trade and only cancels after confirmation', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'cj', id: 't1' });

    await openMoreActions(user);
    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    expect(ctx.cancelTradeOperation).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Cancelar operación' })).toHaveTextContent('C-0003 se cancelará y quedará en el historial. Se devolverán $ 500.');

    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(ctx.cancelTradeOperation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();

    await openMoreActions(user);
    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    await waitFor(() => expect(ctx.cancelTradeOperation).toHaveBeenCalledWith('tradeins', 't1'));
  });

  it('asks before cancelling an integrated sale', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'sale', id: 's1' });

    await openMoreActions(user);
    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    expect(ctx.updateSale).not.toHaveBeenCalled();
    expect(screen.getByText('V-0004 se cancelará y quedará en el historial. Se devolverán $ 500.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    await waitFor(() => expect(ctx.updateSale).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', status: 'CANCELADA' })));
  });

  it('shows the cash to return before cancelling a partly paid sale', async () => {
    const user = userEvent.setup();
    ctx.user = { getIdToken: async () => 'token' };
    paymentsApi.fetchClientPayments.mockResolvedValue([{ id: 'p1', amount: 300, method: 'TRANSFERENCIA', paidAt: '2026-10-08T12:00:00.000Z', kind: 'PAGO', saleId: 's1' }]);
    ctx.sales = [sale({
      status: 'PENDIENTE',
      amount: 900,
      tradeInId: null,
      clientId: 'c1',
      integratedOperation: true,
    })];
    ctx.tradeIns = [];
    ctx.clients = [{ id: 'c1', name: 'Ana Pérez', pendingBalance: 600 }];
    renderOverlay({ type: 'sale', id: 's1' });

    await openMoreActions(user);
    await user.click(screen.getByRole('button', { name: 'Cancelar venta' }));
    expect(ctx.updateSale).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar operación' });
    expect(await within(dialog).findByText(/Se devolverán \$ 300/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar operación' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar operación' }));
    await waitFor(() => expect(ctx.updateSale).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', status: 'CANCELADA' })));
  });

  it('does not announce a refund when the pending sale was not paid', async () => {
    const user = userEvent.setup();
    ctx.sales = [sale({
      status: 'PENDIENTE',
      amount: 900,
      tradeInId: null,
      clientId: 'c1',
      integratedOperation: true,
    })];
    ctx.tradeIns = [];
    ctx.clients = [{ id: 'c1', name: 'Ana Pérez', pendingBalance: 900 }];
    renderOverlay({ type: 'sale', id: 's1' });

    await openMoreActions(user);
    await user.click(screen.getByRole('button', { name: 'Cancelar venta' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancelar operación' });
    expect(dialog).toHaveTextContent('V-0004 se cancelará y quedará en el historial.');
    expect(dialog).not.toHaveTextContent('Se devolverán');
  });

  it('changes peritaje, revisión and aprobado from the trade card', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'cj', id: 't1' });

    expect(screen.getByRole('button', { name: 'Peritaje téc.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En revisión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toHaveClass('sheet-primary');
    expect(screen.queryByRole('button', { name: 'Guardar estado' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'En revisión' }));
    expect(screen.getByRole('button', { name: 'Guardar estado' })).toHaveClass('sheet-primary');
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
    expect(screen.getByRole('dialog')).toHaveTextContent('Operación cancelada');
    expect(screen.queryByRole('button', { name: 'Guardar estado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar operación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Peritaje téc.' })).not.toBeInTheDocument();
  });

  it('keeps the removed-sale reference in the read-only trade detail', () => {
    ctx.tradeIns = [trade({ confirmationStatus: 'CANCELLED', status: 'CANCELADO', saleId: null, removedFromSaleNumber: 4 })];
    renderOverlay({ type: 'cj', id: 't1' });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Canje quitado de la venta V-0004');
    const status = within(dialog).getByText('Cancelado');
    expect(status.querySelector('svg')).toHaveAttribute('data-icon', 'cerrar');
    expect(within(dialog).queryByRole('button', { name: 'Guardar estado' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('advances a legacy trade along the technical steps', async () => {
    const user = userEvent.setup();
    ctx.tradeIns = [trade({ confirmationStatus: undefined, status: 'PENDIENTE' })];
    renderOverlay({ type: 'cj', id: 't1' });

    expect(screen.getByText('Diferencia a cobrar')).toBeInTheDocument();
    expect(document.querySelectorAll('.steps i')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Enviar a peritaje' }));
    await waitFor(() => expect(ctx.updateTradeIn).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', status: 'PERITAJE TÉC.' })));
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

  it('keeps edit off the desk client sheet and shows it on a phone', () => {
    ctx.clients = [{
      id: 'c1',
      name: 'Ana Pérez',
      pendingBalance: 1500,
      totalSpent: 8000,
      phone: '1100000001',
      email: 'ana@ejemplo.com',
      dni: '30111222',
      lastPurchaseDate: '2026-10-05',
      balanceCurrency: 'ARS',
    }];
    renderOverlay({ type: 'cl', id: 'c1' });
    const desk = screen.getByRole('dialog', { name: 'Ana Pérez' });
    expect(within(desk).getByText('Saldo pendiente')).toBeInTheDocument();
    expect(within(desk).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(within(desk).getByTestId('client-purchases')).toBeInTheDocument();
    expect(within(desk).getByText('Total gastado')).toBeInTheDocument();
    cleanup();

    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('760'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    try {
      renderOverlay({ type: 'cl', id: 'c1' });
      const phone = screen.getByRole('dialog', { name: 'Ana Pérez' });
      expect(phone).toHaveClass('cl-sheet');
      expect(within(phone).getByText('Total gastado')).toBeInTheDocument();
      expect(within(phone).queryByLabelText('Monto')).not.toBeInTheDocument();
      expect(within(phone).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
      expect(within(phone).getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
      expect(within(phone).getByRole('button', { name: 'Nueva venta' })).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
      cleanup();
    }
  });

  it('asks for the amount before saving a payment on the desk', async () => {
    const user = userEvent.setup();
    ctx.clients = [{
      id: 'c1',
      name: 'Ana Pérez',
      pendingBalance: 165,
      totalSpent: 800,
      phone: '1100000001',
      lastPurchaseDate: '2026-10-14',
      balanceCurrency: 'ARS',
    }];
    renderOverlay({ type: 'cl', id: 'c1' });
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(ctx.registerClientPayment).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Registrar pago' });
    const amount = within(dialog).getByLabelText('Monto');
    expect(amount).toHaveValue('165');
    await user.click(within(dialog).getByRole('button', { name: 'Volver' }));
    expect(ctx.registerClientPayment).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Ana Pérez' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    const again = screen.getByRole('dialog', { name: 'Registrar pago' });
    const edited = within(again).getByLabelText('Monto');
    await user.clear(edited);
    await user.type(edited, '40');
    await user.click(within(again).getByRole('button', { name: 'Confirmar pago' }));
    await waitFor(() => expect(ctx.registerClientPayment).toHaveBeenCalledWith('c1', expect.objectContaining({ amount: 40, currency: 'ARS' })));
  });

  it('shows the debt left after a general payment on the sale', async () => {
    ctx.tradeIns = [];
    ctx.clients = [{ id: 'c1', name: 'Ana Pérez', pendingBalance: 70, balanceCurrency: 'ARS' }];
    ctx.sales = [sale({
      status: 'PENDIENTE',
      amount: 100,
      openBalance: 100,
      clientId: 'c1',
      clientName: 'Ana Pérez',
      tradeInId: '',
      integratedOperation: false,
      paymentMethod: 'SIN_PAGO',
      amountCurrency: 'ARS',
    })];
    renderOverlay({ type: 'sale', id: 's1' });
    const dialog = screen.getByRole('dialog', { name: 'V-0004' });
    expect(within(dialog).getByText('Sin pago')).toBeInTheDocument();
    expect(within(dialog).getByText('Deuda $ 70')).toBeInTheDocument();
  });

  it('uses the sale account due when the loaded balance is still the old debt', async () => {
    ctx.user = { getIdToken: async () => 'token' };
    accountsApi.fetchSaleAccount.mockResolvedValue({
      due: 70,
      installments: [
        { sequence: 1, dueDate: '2026-11-14', status: 'PARCIAL', amount: 50, paidAmount: 30 },
        { sequence: 2, dueDate: '2026-12-14', status: 'PENDIENTE', amount: 50, paidAmount: 0 },
      ],
      tenders: [],
    });
    ctx.tradeIns = [];
    ctx.clients = [{ id: 'c1', name: 'Ana Pérez', pendingBalance: 100, balanceCurrency: 'USD' }];
    ctx.sales = [sale({
      status: 'PENDIENTE',
      amount: 100,
      openBalance: 100,
      clientId: 'c1',
      clientName: 'Ana Pérez',
      tradeInId: '',
      integratedOperation: false,
      paymentMethod: 'SIN_PAGO',
      amountCurrency: 'USD',
    })];
    renderOverlay({ type: 'sale', id: 's1' });
    const dialog = screen.getByRole('dialog', { name: 'V-0004' });
    await waitFor(() => expect(within(dialog).getByText('Deuda US$ 70')).toBeInTheDocument());
    expect(within(dialog).queryByText('Deuda US$ 100')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Cuota 1/)).toBeInTheDocument();
  });

  it('asks for the amount before saving a payment on a phone', async () => {
    const user = userEvent.setup();
    ctx.clients = [{
      id: 'c1',
      name: 'Ana Pérez',
      pendingBalance: 320,
      totalSpent: 800,
      phone: '1100000001',
      lastPurchaseDate: '2026-10-14',
      balanceCurrency: 'USD',
    }];
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('760'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    try {
      renderOverlay({ type: 'cl', id: 'c1' });
      await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
      expect(ctx.registerClientPayment).not.toHaveBeenCalled();
      const dialog = screen.getByRole('dialog', { name: 'Registrar pago' });
      const amount = within(dialog).getByLabelText('Monto');
      expect(amount).toHaveValue('320');
      await user.clear(amount);
      await user.type(amount, '50');
      await user.click(within(dialog).getByRole('button', { name: 'Confirmar pago' }));
      await waitFor(() => expect(ctx.registerClientPayment).toHaveBeenCalledWith('c1', expect.objectContaining({ amount: 50, method: 'TRANSFERENCIA', currency: 'USD' })));
    } finally {
      window.matchMedia = original;
    }
  });

  it('keeps the trade sheet actions on a phone and hides cancel without permission', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('760'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    try {
      renderOverlay({ type: 'cj', id: 't1' });
      expect(screen.getByRole('dialog')).toHaveClass('cj-sheet');
      expect(screen.getByRole('button', { name: 'Peritaje téc.' })).toBeInTheDocument();
      const user = userEvent.setup();
      await openMoreActions(user);
      expect(screen.getByRole('button', { name: 'Cancelar operación' })).toBeInTheDocument();
      cleanup();
      renderOverlay({ type: 'cj', id: 't1' }, false);
      expect(screen.getByRole('dialog')).toHaveClass('cj-sheet');
      expect(screen.queryByRole('button', { name: 'Cancelar operación' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Guardar estado' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Editar' })).toHaveClass('sheet-primary');
    } finally {
      window.matchMedia = original;
    }
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
