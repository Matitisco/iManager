import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Product, Sale, TradeIn } from '../../types';
import { EquipmentDetail, EquipmentForm } from './equipment';
import { SaleDetail } from './operation';
import { TradeDetail, TradeForm } from './trade';
import { DeskProvider } from '../ui';
import { DeskOverlays } from '../DeskOverlays';
import { rememberVoidedSales } from '../archive-cache';
import { fetchHistory } from '../../services/history-api';

const ctx = vi.hoisted(() => ({
  user: { uid: 'owner' }, appSession: { store: { id: 'store' }, membership: { role: 'OWNER' } },
  inventory: [] as Product[], sales: [] as Sale[], tradeIns: [] as TradeIn[], clients: [], suppliers: [], repairOrders: [],
  updateProduct: vi.fn(), updateTradeIn: vi.fn(), updateTradeOperation: vi.fn(), cancelTradeOperation: vi.fn(), fetchTradeOperation: vi.fn(),
  updateSale: vi.fn(), deleteSale: vi.fn(), fetchSaleOperation: vi.fn(), commissionSellers: [],
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/history-api', () => ({ fetchHistory: vi.fn() }));
vi.mock('../screens/CurrentAccount', () => ({ SaleAccountPanel: () => null }));
const close = vi.fn();
const run = vi.fn();
const form = { run, busy: false, error: null };
function mount(child: ReactNode) {
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}>{child}</DeskProvider></div>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchHistory).mockResolvedValue({ events: [], nextCursor: null });
  ctx.fetchTradeOperation.mockResolvedValue(null);
  ctx.inventory = [{ id: 'eq', model: 'iPhone 13', capacity: '128GB', imei: '', color: 'Azul', condition: 'USADO', batteryHealth: '90%', grade: 'A', price: 500, cost: 200, status: 'DISPONIBLE', priceChangedBy: 'Lucía', priceChangedAt: '2026-10-22T17:30:00Z' }];
  ctx.sales = [{ id: 'sale', productId: 'eq', clientId: '', date: '2026-10-22', amount: 500, status: 'COMPLETADA', paymentMethod: 'EFECTIVO' }];
  ctx.tradeIns = [{ id: 'trade', clientId: '', clientName: 'Ana', date: '2026-10-22', deviceReceived: 'iPhone 12', deviceReceivedImei: '', deviceGiven: 'iPhone 13', takeValue: 200, differencePaid: 300, status: 'PENDIENTE' }];
});
it.each(['inventory', 'sale', 'trade', 'integrated-trade'] as const)('offers only the shared history button in %s tracking and preserves the parent', async kind => {
  if (kind === 'integrated-trade') ctx.tradeIns[0].confirmationStatus = 'CONFIRMED';
  mount(kind === 'inventory' ? <EquipmentDetail id="eq" /> : kind === 'sale' ? <SaleDetail id="sale" {...form} /> : <TradeDetail id="trade" {...form} />);
  const parent = screen.getByRole('dialog');
  expect(within(parent).getAllByRole('button', { name: 'Historial' })).toHaveLength(1);
  expect(within(parent).getByRole('button', { name: 'Historial' }).textContent).toBe('');
  expect(parent).not.toHaveTextContent(/Ocultar historial|Sin movimientos recientes|Ver todo|Precio cambiado por/);
  expect(fetchHistory).not.toHaveBeenCalled();
  if (kind === 'inventory') await userEvent.click(screen.getByRole('button', { name: 'En revisión' }));
  await userEvent.click(within(parent).getByRole('button', { name: 'Historial' }));
  const history = screen.getByRole('dialog', { name: 'Historial' });
  expect(await within(history).findByText('Sin movimientos')).toBeInTheDocument();
  expect(fetchHistory).toHaveBeenCalledWith(ctx.user, { entityType: kind.includes('trade') ? 'trade' : kind, entityId: kind === 'inventory' ? 'eq' : kind.includes('trade') ? 'trade' : 'sale', limit: 50 });
  await userEvent.keyboard('{Escape}');
  expect(parent).toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
  if (kind === 'inventory') {
    await userEvent.click(screen.getByRole('button', { name: 'Guardar estado' }));
    await waitFor(() => expect(ctx.updateProduct).toHaveBeenCalledWith(expect.objectContaining({ status: 'EN_REVISION' })));
  }
});
it.each(['equipment', 'trade'])('does not add a history control to %s editing', kind => {
  mount(kind === 'equipment' ? <EquipmentForm id="eq" {...form} /> : <TradeForm id="trade" {...form} />);
  expect(screen.queryByRole('button', { name: 'Historial' })).not.toBeInTheDocument();
  expect(fetchHistory).not.toHaveBeenCalled();
});

it.each([false, true])('hides Anular in the context menu and detail for voided sales (phone=%s)', phone => {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: phone && query.includes('760'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  try {
    for (const state of ['date', 'status', 'cached'] as const) {
      const sale: Sale = { ...ctx.sales[0], status: state === 'status' ? 'CANCELADA' : 'COMPLETADA', voidedAt: state === 'status' ? null : '2026-10-29T12:00:00Z' };
      ctx.sales = state === 'cached' ? [] : [sale];
      rememberVoidedSales(state === 'cached' ? [sale] : []);
      const menu = mount(<DeskOverlays overlay={{ type: 'ctx', kind: 'sale', id: 'sale', label: 'Venta', x: 20, y: 20 }} />);
      expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
      menu.unmount();
      const detail = mount(<SaleDetail id="sale" {...form} />);
      expect(within(document.querySelector('.sheet-foot')!).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument();
      detail.unmount();
    }
  } finally {
    window.matchMedia = original;
    rememberVoidedSales([]);
  }
});

it('keeps Anular available for an active sale', async () => {
  mount(<DeskOverlays overlay={{ type: 'ctx', kind: 'sale', id: 'sale', label: 'Venta', x: 20, y: 20 }} />);
  expect(screen.getByRole('button', { name: 'Anular' })).toBeEnabled();
});
