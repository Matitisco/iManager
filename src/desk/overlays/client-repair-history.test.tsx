import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Client, RepairOrder } from '../../types';
import { fetchHistory, type HistoryEvent, type HistoryPage } from '../../services/history-api';
import { RepairOrderDetail } from '../RepairForms';
import { DeskProvider } from '../ui';
import { ClientDetail } from './client';

const ctx = vi.hoisted(() => ({
  user: { uid: 'owner' },
  appSession: { store: { id: 'store' }, membership: { role: 'OWNER' } },
  clients: [{ id: 'client-ana', name: 'Ana Gómez', dni: '', phone: '', email: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 100 }] as Client[],
  repairOrders: [{
    id: 'repair-12', orderNumber: 12, code: 'OT-0012', device: 'iPhone 13', clientId: 'client-ana', clientName: 'Ana Gómez', clientPhone: '',
    imei: '', fault: 'Pantalla', faultTags: [], estimate: 200, deposit: 0, technician: '', status: 'RECIBIDO',
    estimatedDelivery: null, notifyWhatsapp: false, receivedAt: '22/10/2026', whatsappUrl: null,
    events: [{ id: 'received', status: 'RECIBIDO', createdAt: '22/10/2026' }],
  }] as RepairOrder[],
  sales: [], tradeIns: [], inventory: [],
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/history-api', () => ({ fetchHistory: vi.fn() }));
vi.mock('../../services/clients-api', () => ({ fetchClientPayments: vi.fn(async () => []) }));
vi.mock('../../services/sales-api', () => ({ fetchVoidedSales: vi.fn(async () => []) }));
vi.mock('../../services/trade-ins-api', () => ({ fetchVoidedTradeIns: vi.fn(async () => []) }));
vi.mock('../../services/inventory-api', () => ({ fetchArchivedInventory: vi.fn(async () => []) }));

const close = vi.fn();
beforeEach(() => { vi.mocked(fetchHistory).mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

it.each([
  { entityType: 'client', phone: false }, { entityType: 'client', phone: true },
  { entityType: 'repair', phone: false }, { entityType: 'repair', phone: true },
] as const)('opens shared history on demand and preserves $entityType detail (phone=$phone)', async ({ entityType, phone }) => {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: phone && query.includes('760'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  let resolve!: (page: HistoryPage) => void;
  vi.mocked(fetchHistory).mockReturnValue(new Promise<HistoryPage>(done => { resolve = done; }));
  render(<div className="desk-app"><DeskProvider value={{ tab: entityType === 'client' ? 'clients' : 'service', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}>
    {entityType === 'client' ? <ClientDetail id="client-ana" /> : <RepairOrderDetail id="repair-12" busy={false} />}
  </DeskProvider></div>);
  const parent = screen.getByRole('dialog');
  const trigger = within(parent).getByRole('button', { name: 'Historial' });
  expect(trigger.textContent).toBe('');
  expect(trigger).toHaveClass('btn2', 's', 'record-history-button');
  expect(trigger.parentElement).toHaveClass(entityType === 'client' ? 'tracking-summary' : 'tracking-history-action');
  if (entityType === 'client') expect(trigger.parentElement?.querySelector('.dhero')).toHaveTextContent('Saldo pendiente');
  expect(parent).not.toHaveTextContent(/Ocultar historial|Ver historial|Sin movimientos recientes|Ver todo/);
  expect(parent.querySelector('.svc-log')).toBeNull();
  expect(within(parent).queryByText('Historial', { selector: 'span' })).not.toBeInTheDocument();
  expect(fetchHistory).not.toHaveBeenCalled();

  await userEvent.click(trigger);
  const history = screen.getByRole('dialog', { name: 'Historial' });
  expect(within(history).getByRole('heading', { name: 'Historial' })).toBeInTheDocument();
  expect(history.querySelector('.sub')).not.toBeInTheDocument();
  expect(history).toHaveClass('hist-screen');
  expect(within(history).getByRole('button', { name: phone ? 'Volver' : 'Cerrar' })).toBeInTheDocument();
  expect(history.closest('.record-history-layer')?.parentElement).toHaveClass('desk-app');
  expect(within(history).getByRole('status', { name: 'Cargando' })).toHaveAttribute('aria-busy', 'true');
  expect(history).not.toHaveTextContent('Cargando');
  expect(fetchHistory).toHaveBeenCalledExactlyOnceWith(ctx.user, { entityType, entityId: entityType === 'client' ? 'client-ana' : 'repair-12', limit: 50 });
  await act(async () => resolve({ events: [], nextCursor: null }));
  expect(within(history).getByText('Sin movimientos')).toBeInTheDocument();

  if (phone) await userEvent.click(within(history).getByRole('button', { name: 'Volver' }));
  else await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: 'Historial' })).not.toBeInTheDocument();
  expect(parent).toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
  await waitFor(() => expect(trigger).toHaveFocus());
});

it.each([false, true])('shows receipt, every status change and delivery only in the second repair modal (phone=%s)', async phone => {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: phone && query.includes('760'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  const statuses = ['RECIBIDO', 'EN_REPARACION', 'LISTO_PARA_RETIRAR', 'ENTREGADO'];
  const events: HistoryEvent[] = statuses.map((status, i) => ({
    id: `event-${i}`, createdAt: `2026-10-22T1${i}:00:00.000Z`, action: i ? 'repair.status' : 'repair.created',
    group: i ? 'Cambio de estado' : 'Alta', section: 'service', sectionLabel: 'Servicio técnico',
    actorUserId: 'owner', actorName: 'Ana', actorRole: 'OWNER', actorRoleLabel: 'Propietaria',
    entityType: 'repair', entityId: 'repair-12', entityLabel: 'OT-0012 · iPhone 13', detail: null,
    changes: [{ field: 'status', label: 'Estado', before: statuses[i - 1] ?? null, after: status }],
    reason: null, source: 'app', legacy: false, title: 'Movimiento',
    verb: i ? 'cambió el estado de' : 'registró la orden', target: 'OT-0012', suffix: '', recordState: 'active',
  }));
  vi.mocked(fetchHistory).mockResolvedValue({ events: [...events].reverse(), nextCursor: null });
  render(<div className="desk-app"><DeskProvider value={{ tab: 'service', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}>
    <RepairOrderDetail id="repair-12" busy={false} />
  </DeskProvider></div>);
  const parent = screen.getByRole('dialog');
  expect(parent.querySelector('ol')).toBeNull();
  expect(fetchHistory).not.toHaveBeenCalled();
  await userEvent.click(within(parent).getByRole('button', { name: 'Historial' }));
  const modal = screen.getByRole('dialog', { name: 'Historial' });
  expect(await within(modal).findByText('Pasó a Entregado')).toBeInTheDocument();
  expect(within(modal).getByText('Pasó a En reparación')).toBeInTheDocument();
  expect(within(modal).getByText('Pasó a Listo para retirar')).toBeInTheDocument();
  expect(within(modal).getByText('registró la orden OT-0012')).toBeInTheDocument();
  expect(within(modal).getAllByRole('listitem')).toHaveLength(4);
  expect(modal).not.toHaveTextContent(/RECIBIDO|EN_REPARACION|LISTO_PARA_RETIRAR|ENTREGADO|Cargando/);
  expect(parent.querySelector('ol')).toBeNull();
});
