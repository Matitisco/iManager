import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryScreen } from './HistoryScreen';
import { DeskProvider } from '../ui';
import { fetchHistory, fetchHistoryActors, type HistoryEvent, type HistoryPage } from '../../services/history-api';
import { fetchArchivedInventory } from '../../services/inventory-api';
import { fetchReturns } from '../../services/returns-api';
import { ApiError } from '../../services/api-client';

const ctx = vi.hoisted(() => ({ user: { uid: 'owner' }, appSession: { store: { id: 'store', ownerDisplayName: 'Matias' }, membership: { role: 'OWNER', sections: null as string[] | null } } }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/history-api', () => ({ fetchHistory: vi.fn(), fetchHistoryActors: vi.fn() }));
vi.mock('../../services/inventory-api', () => ({ fetchArchivedInventory: vi.fn() }));
vi.mock('../../services/returns-api', () => ({ fetchReturns: vi.fn() }));
const fetch = vi.mocked(fetchHistory);
const go = vi.fn(), openRecord = vi.fn();
const event = (partial: Partial<HistoryEvent> = {}): HistoryEvent => ({
  id: 'price', createdAt: '2026-10-22T13:42:00Z', action: 'inventory.price', group: 'Edición', section: 'inventory', sectionLabel: 'Inventario',
  actorUserId: 'lucia', actorName: 'Lucía Fernández', actorRole: 'STAFF', actorRoleLabel: 'Empleada', entityType: 'inventory', entityId: 'eq',
  entityLabel: 'iPhone 15 Pro 256GB · IMEI …5673', entityIdentifier: 'IMEI 356789012345673', detail: null,
  changes: [{ field: 'price', label: 'Precio de venta', before: '$ 1.750.000', after: '$ 1.800.000' }], reason: null, source: null, legacy: false,
  title: 'Cambió el precio', verb: 'cambió el precio de', target: 'iPhone 15 Pro', suffix: '', recordState: 'active', ...partial,
});
function mount() {
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'history', go, open: vi.fn(), openRecord, close: vi.fn(), toast: vi.fn(), isStaff: false }}><HistoryScreen /></DeskProvider></div>);
}
function deferred() {
  let resolve!: (page: HistoryPage) => void;
  const promise = new Promise<HistoryPage>(yes => { resolve = yes; });
  return { promise, resolve };
}
beforeEach(() => {
  fetch.mockReset(); fetch.mockResolvedValue({ events: [event()], nextCursor: null });
  vi.mocked(fetchHistoryActors).mockResolvedValue({ actors: [{ userId: 'lucia', name: 'Lucía Fernández', removed: false }] });
  ctx.appSession.membership = { role: 'OWNER', sections: null };
});

describe('Historial #372', () => {
  it('starts at 30 days, exposes Acción and preserves selected values and search', async () => {
    mount(); await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ });
    expect(fetch).toHaveBeenCalledWith(ctx.user, expect.objectContaining({ period: '30' }));
    expect(screen.getByRole('combobox', { name: 'Período' })).toHaveValue('30');
    expect(screen.queryByRole('combobox', { name: 'Tipo' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Acción' }), 'Edición');
    expect(screen.getByRole('combobox', { name: 'Acción' }).parentElement).toHaveTextContent('Edición');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Persona' }), 'lucia');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sección' }), 'inventory');
    await userEvent.type(screen.getByPlaceholderText('Buscar equipo, cliente o IMEI'), '5673');
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(ctx.user, expect.objectContaining({ period: '30', group: 'Edición', actorUserId: 'lucia', section: 'inventory', q: '5673' })));
  });

  it('groups unsorted pages by complete day, counts shown rows and retains Cargar más', async () => {
    fetch.mockResolvedValueOnce({ events: [event({ id: 'old', createdAt: '2025-10-22T12:00:00Z' }), event()], nextCursor: 'page2' });
    fetch.mockResolvedValueOnce({ events: [event({ id: 'second', createdAt: '2026-10-22T12:00:00Z' }), event()], nextCursor: null });
    mount(); await screen.findByRole('button', { name: 'Cargar más' });
    const days = screen.getAllByRole('region');
    expect(days[0]).toHaveTextContent('22 OCT 2026'); expect(days[1]).toHaveTextContent('22 OCT 2025');
    expect(within(days[0]).getByText('1 movimiento')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument());
    expect(within(screen.getAllByRole('region')[0]).getByText('2 movimientos')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(ctx.user, expect.objectContaining({ period: '30', cursor: 'page2' }));
  });

  it.each([false, true])('shows structured changes and actual identity in the responsive detail (phone=%s)', async phone => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    mount(); const trigger = await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ });
    await userEvent.click(trigger);
    const modal = screen.getByRole('dialog', { name: 'Cambió el precio' });
    expect(modal).toHaveTextContent('iPhone 15 Pro · 256GB'); expect(modal).toHaveTextContent('IMEI 356789012345673');
    expect(modal).toHaveTextContent('Lucía Fernández'); expect(modal).toHaveTextContent('Empleada · 22/10/2026 · 10:42');
    expect(within(modal).getByRole('columnheader', { name: 'Antes' })).toBeInTheDocument();
    expect(within(modal).getByRole('cell', { name: '$ 1.750.000' })).toBeInTheDocument();
    expect(modal).not.toHaveTextContent('Motivo');
    await userEvent.click(within(modal).getByRole('button', { name: 'Ver equipo' }));
    expect(openRecord).toHaveBeenCalledWith('inventory', 'eq');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it.each(['Ocultar: 1 equipo', 'Precio: $ 1.800.000', '$ 1.750.000 → $ 1.800.000'])('keeps free text without manufacturing a before/after table: %s', async detail => {
    fetch.mockResolvedValue({ events: [event({ changes: [], detail, reason: 'Pedido del dueño' })], nextCursor: null });
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(detail)).toBeInTheDocument(); expect(modal).toHaveTextContent('Motivo Pedido del dueño');
    expect(within(modal).queryByRole('table')).not.toBeInTheDocument();
  });

  it.each([
    { recordState: 'gone' as const }, { legacy: true }, { entityType: 'stockcount' }, { section: 'cash' }, { entityType: 'unknown' },
  ])('omits unavailable record destinations: %j', async partial => {
    fetch.mockResolvedValue({ events: [event(partial)], nextCursor: null });
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ }));
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /Ver equipo|Ver registro|Ver en archivados/ })).not.toBeInTheDocument();
  });

  it('respects section access independently of permission to view history', async () => {
    ctx.appSession.membership = { role: 'STAFF', sections: ['history'] };
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ }));
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Ver equipo' })).not.toBeInTheDocument();
  });

  it('keeps the detail open on archived fetch failure and retries before opening', async () => {
    fetch.mockResolvedValue({ events: [event({ recordState: 'archived' })], nextCursor: null });
    vi.mocked(fetchArchivedInventory).mockRejectedValueOnce(new Error('No se pudo consultar archivados')).mockResolvedValueOnce([]);
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver en archivados' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar archivados'); expect(openRecord).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ver en archivados' }));
    await waitFor(() => expect(openRecord).toHaveBeenCalledWith('inventory', 'eq'));
  });

  it('uses skeletons without visible loading text and retries initial failures', async () => {
    const pending = deferred(); fetch.mockReturnValueOnce(pending.promise);
    mount(); expect(screen.getByTestId('history-loading')).not.toHaveTextContent('Cargando');
    await act(async () => pending.resolve({ events: [], nextCursor: null }));
    expect(await screen.findByTestId('history-empty')).toHaveTextContent('Todavía no hay movimientos');
    fetch.mockRejectedValueOnce(new Error('Error del servidor'));
    await userEvent.selectOptions(screen.getByLabelText('Período'), '7');
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ })).toBeInTheDocument();
  });

  it('loads an archived claim before navigating to its record', async () => {
    fetch.mockResolvedValue({ events: [event({ entityType: 'return', section: 'returns', entityId: 'claim', recordState: 'archived' })], nextCursor: null });
    vi.mocked(fetchReturns).mockResolvedValueOnce([]);
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver en archivados' }));
    expect(fetchReturns).toHaveBeenCalledWith(ctx.user, true);
    await waitFor(() => expect(openRecord).toHaveBeenCalledWith('returns', 'claim'));
  });

  it('shows pagination errors and ignores an old page after changing filters', async () => {
    const pending = deferred();
    fetch.mockResolvedValueOnce({ events: [event()], nextCursor: 'next' }).mockRejectedValueOnce(new Error('Error de página')).mockReturnValueOnce(pending.promise);
    mount(); await userEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de página');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(screen.getByTestId('history-more-loading')).not.toHaveTextContent('Cargando');
    await userEvent.selectOptions(screen.getByLabelText('Período'), '7');
    await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ });
    await act(async () => pending.resolve({ events: [event({ id: 'stale', actorName: 'Respuesta vieja' })], nextCursor: null }));
    expect(screen.queryByText('Respuesta vieja')).not.toBeInTheDocument();
  });

  it('shows access denied from the backend', async () => {
    fetch.mockRejectedValueOnce(new ApiError(403, 'No tenés acceso al historial'));
    mount(); expect(await screen.findByTestId('no-section-access')).toHaveTextContent('Historial');
  });
});
