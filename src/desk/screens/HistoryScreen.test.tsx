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
  vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  fetch.mockReset(); fetch.mockResolvedValue({ events: [event()], nextCursor: null });
  vi.mocked(fetchHistoryActors).mockResolvedValue({ actors: [{ userId: 'lucia', name: 'Lucía Fernández', removed: false }] });
  ctx.appSession.membership = { role: 'OWNER', sections: null };
});

describe('Historial #372', () => {
  it.each([false, true])('conserva la identidad completa y adapta la búsqueda y el registro (móvil=%s)', async phone => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    mount();
    const trigger = await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ });
    const search = screen.getByPlaceholderText(phone ? 'Buscar' : 'Buscar equipo, cliente o IMEI');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(trigger.querySelector('.history-record > b')).toHaveTextContent(phone ? 'iPhone 15 Pro · 256GB · Lucía' : 'iPhone 15 Pro · 256GB');
    if (phone) {
      expect(trigger.querySelector('.history-record > b')).not.toHaveTextContent('Fernández');
      expect(search.closest('.history-filters')).toContainElement(screen.getByRole('combobox', { name: 'Período' }));
    } else {
      expect(trigger.querySelector('.history-record > b')).not.toHaveTextContent('Lucía');
      expect(search.closest('.dtop')).toBeInTheDocument();
    }
    await userEvent.type(search, '5673');
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(ctx.user, expect.objectContaining({ q: '5673', period: '30' })));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Período' }), '7');
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(ctx.user, expect.objectContaining({ q: '5673', period: '7' })));
    await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Lucía Fernández');
    vi.restoreAllMocks();
  });

  it('starts at 30 days, exposes Acción and preserves selected values and search', async () => {
    mount(); await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ });
    expect(fetch).toHaveBeenCalledWith(ctx.user, expect.objectContaining({ period: '30' }));
    expect(screen.getByRole('combobox', { name: 'Período' })).toHaveValue('30');
    expect(screen.queryByRole('combobox', { name: 'Tipo' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Acción' }), 'Edición');
    expect(screen.getByRole('combobox', { name: 'Acción' }).parentElement).toHaveTextContent('Edición');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Persona' }), 'lucia');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sección' }), 'inventory');
    await userEvent.type(screen.getByRole('textbox'), '5673');
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(ctx.user, expect.objectContaining({ period: '30', group: 'Edición', actorUserId: 'lucia', section: 'inventory', q: '5673' })));
  });

  it('groups unsorted pages by complete day, counts shown rows and retains Cargar más', async () => {
    fetch.mockResolvedValueOnce({ events: [event({ id: 'old', createdAt: '2025-10-22T12:00:00Z' }), event()], nextCursor: 'page2' });
    fetch.mockResolvedValueOnce({ events: [event({ id: 'second', createdAt: '2026-10-22T12:00:00Z' }), event()], nextCursor: null });
    mount(); await screen.findByRole('button', { name: 'Cargar más' });
    const days = screen.getAllByRole('region');
    expect(days[0]).toHaveTextContent('22 oct'); expect(days[1]).toHaveTextContent('22 oct 2025');
    expect(within(days[0]).getByLabelText('1 movimiento')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument());
    expect(within(screen.getAllByRole('region')[0]).getByLabelText('2 movimientos')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(ctx.user, expect.objectContaining({ period: '30', cursor: 'page2' }));
  });

  it.each([false, true])('shows structured changes and actual identity in the responsive detail (phone=%s)', async phone => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    mount(); const trigger = await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ });
    await userEvent.click(trigger);
    const modal = screen.getByRole('dialog', { name: 'Cambió el precio' });
    expect(modal).toHaveTextContent('iPhone 15 Pro · 256GB'); expect(modal).toHaveTextContent('IMEI 356789012345673');
    expect(modal).toHaveTextContent('Lucía Fernández');
    expect(modal.querySelector('.history-detail-person time')).toHaveTextContent(/(?:Hoy|Ayer|22\/10\/2026) · 10:42/);
    expect(modal).not.toHaveTextContent('Empleada');
    expect(modal).not.toHaveTextContent('Inventario ·');
    expect(modal).toHaveClass('sheet-frame', 'sheet-detail');
    expect(modal.querySelector('.sheet-h')).toHaveTextContent('Cambió el precio');
    expect(modal.querySelector('.sheet-scroll')?.firstElementChild).toHaveClass('history-detail-person');
    expect(modal.querySelector('.sheet-scroll')?.children[1]).toHaveClass('history-detail-record');
    expect(modal.querySelector('.sheet-foot')).toContainElement(within(modal).getByRole('button', { name: 'Ver equipo' }));
    expect(within(modal).getAllByRole('button', { name: 'Cerrar' })).toHaveLength(phone ? 1 : 2);
    expect(modal.querySelector('.sheet-grab') !== null).toBe(phone);
    expect(within(modal).getByRole('columnheader', { name: 'Antes' })).toBeInTheDocument();
    expect(within(modal).getByRole('cell', { name: '$ 1.750.000' })).toBeInTheDocument();
    expect(modal).not.toHaveTextContent('Motivo');
    await userEvent.click(within(modal).getByRole('button', { name: 'Ver equipo' }));
    expect(openRecord).toHaveBeenCalledWith('inventory', 'eq');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it.each([false, true])('conserva comparaciones reales y omite Antes solo en campos sin valor anterior (phone=%s)', async phone => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    fetch.mockResolvedValue({ events: [event({ changes: [
      { field: 'status', label: 'Estado', before: 'Disponible', after: 'Vendido' },
      { field: 'notes', label: 'Nota', before: null, after: 'Revisar' },
      { field: 'quantity', label: 'Cantidad', before: '0', after: '1' },
      { field: 'supplier', label: 'Proveedor', before: 'Proveedor anterior', after: null },
      { field: 'empty', label: 'Sin datos', before: null, after: null },
    ] })], nextCursor: null });
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ }));
    const table = within(screen.getByRole('dialog')).getByRole('table');
    const status = within(table).getByRole('row', { name: /Estado Disponible Vendido/ });
    expect(within(status).getByText('Antes')).toBeInTheDocument();
    expect(within(status).getByText('Después')).toBeInTheDocument();
    expect(status).not.toHaveClass('history-diff-after-only');
    const note = within(table).getByRole('row', { name: /Nota Revisar/ });
    expect(within(note).queryByText('Antes')).not.toBeInTheDocument();
    expect(within(note).queryByText('Después')).not.toBeInTheDocument();
    expect(within(note).queryByText('—')).not.toBeInTheDocument();
    expect(within(note).getAllByRole('cell')).toHaveLength(1);
    expect(within(note).getByRole('cell', { name: 'Revisar' })).toHaveAttribute('colspan', '2');
    expect(note).toHaveClass('history-diff-after-only');
    const quantity = within(table).getByRole('row', { name: /Cantidad 0 1/ });
    expect(within(quantity).getByRole('cell', { name: '0' })).toBeInTheDocument();
    expect(within(quantity).getByText('Antes')).toBeInTheDocument();
    expect(quantity).not.toHaveClass('history-diff-after-only');
    const supplier = within(table).getByRole('row', { name: /Proveedor Proveedor anterior —/ });
    expect(within(supplier).getByText('Antes')).toBeInTheDocument();
    expect(within(supplier).getByRole('cell', { name: '—' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Antes' })).toBeInTheDocument();
    expect(within(table).queryByText('Sin datos')).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it.each([null, '', ' \t\n ', '—'])('muestra solo el valor nuevo, sin etiquetas, cuando Antes es %j', async before => {
    fetch.mockResolvedValue({ events: [event({ changes: [
      { field: 'notes', label: 'Nota', before, after: 'Revisar equipo' },
    ] })], nextCursor: null });
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ }));
    const table = within(screen.getByRole('dialog')).getByRole('table');
    expect(within(table).queryByText('Antes')).not.toBeInTheDocument();
    expect(within(table).queryByText('Después')).not.toBeInTheDocument();
    expect(within(table).queryByText('—')).not.toBeInTheDocument();
    const row = within(table).getByRole('row', { name: 'Nota Revisar equipo' });
    expect(row).toHaveClass('history-diff-after-only');
    expect(within(row).getAllByRole('cell')).toHaveLength(1);
    expect(within(row).queryByText('Después')).not.toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: 'Revisar equipo' })).toBeInTheDocument();
  });

  it.each([false, true])('muestra el cierre de control de stock sin Antes vacíos (phone=%s)', async phone => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    fetch.mockResolvedValue({ events: [event({
      action: 'stockcount.closed', entityType: 'stockcount', title: 'Cerró un control de stock',
      changes: [
        { field: 'expected', label: 'Esperados', before: null, after: '12' },
        { field: 'scanned', label: 'Contados', before: null, after: '10' },
        { field: 'missing', label: 'Faltantes', before: null, after: '2' },
      ],
    })], nextCursor: null });
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cerró un control de stock/ }));
    const table = within(screen.getByRole('dialog', { name: 'Cerró un control de stock' })).getByRole('table');
    expect(within(table).queryByText('Antes')).not.toBeInTheDocument();
    expect(within(table).queryByText('—')).not.toBeInTheDocument();
    for (const [label, value] of [['Esperados', '12'], ['Contados', '10']]) {
      const row = within(table).getByRole('row', { name: `${label} ${value}` });
      expect(row).toHaveClass('history-diff-after-only');
      expect(within(row).queryByText('Después')).not.toBeInTheDocument();
      expect(within(row).getAllByRole('cell')).toHaveLength(1);
      expect(within(row).getByRole('cell', { name: value })).toBeInTheDocument();
    }
    const counter = within(screen.getByRole('dialog')).getByRole('group', { name: 'Resultado del control' });
    expect(counter).toHaveTextContent('2Sin escanear');
    expect(counter.children).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it.each([false, true])('presenta el alta sin comparación ni etiquetas extra (phone=%s)', async phone => {
    vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    fetch.mockResolvedValue({ events: [event({
      action: 'inventory.created', title: 'Registró un equipo',
      changes: [
        { field: 'status', label: 'Estado', before: null, after: 'Disponible' },
        { field: 'price', label: 'Precio', before: null, after: '$ 1.450.000' },
      ],
    })], nextCursor: null });
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Registró un equipo/ }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByRole('row', { name: 'Estado Disponible' })).toBeInTheDocument();
    expect(within(modal).getByRole('row', { name: 'Precio $ 1.450.000' })).toBeInTheDocument();
    expect(within(modal).queryByText('Antes')).not.toBeInTheDocument();
    expect(within(modal).queryByText('Después')).not.toBeInTheDocument();
    expect(within(modal).queryByText('—')).not.toBeInTheDocument();
  });

  it.each([false, true])('usa los cuatro contadores guardados sin fabricar equipos y navega al control (phone=%s)', async phone => {
    vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    fetch.mockResolvedValue({ events: [event({
      action: 'stockcount.closed', entityType: 'stockcount', title: 'Cerró un control de stock', entityLabel: 'Control de stock', entityIdentifier: null,
      changes: [
        { field: 'counters', label: 'Contaron', before: null, after: 'Lucía Fernández' },
        { field: 'matched', label: 'Coinciden', before: null, after: '27' },
        { field: 'missing', label: 'Faltan', before: null, after: '40' },
        { field: 'surplus', label: 'Sobran', before: null, after: '0' },
        { field: 'sold', label: 'Figuran vendidos', before: null, after: '1' },
        { field: 'when', label: 'Hora', before: null, after: '10:42' },
      ],
    })], nextCursor: null });
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cerró un control/ }));
    const modal = screen.getByRole('dialog');
    const counters = within(modal).getByRole('group', { name: 'Resultado del control' });
    expect([...counters.children].map(counter => counter.textContent)).toEqual(['27Coinciden', '40Sin escanear', '0Sin cargar', '1Figuran vendidos']);
    expect(counters.querySelector('.on')).toHaveTextContent('40Sin escanear');
    expect(within(modal).queryByRole('table')).not.toBeInTheDocument();
    expect(within(modal).queryByText(/IMEI|iPhone/)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();
    await userEvent.click(within(modal).getByRole('button', { name: 'Ver control' }));
    expect(go).toHaveBeenCalledWith('stockCount');
    expect(openRecord).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('omite Ver control para quien solo tiene permiso de Historial', async () => {
    ctx.appSession.membership = { role: 'STAFF', sections: ['history'] };
    fetch.mockResolvedValue({ events: [event({ action: 'stockcount.closed', entityType: 'stockcount' })], nextCursor: null });
    mount(); await userEvent.click(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ }));
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Ver control' })).not.toBeInTheDocument();
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
    const empty = await screen.findByTestId('history-empty');
    expect(empty).toHaveTextContent('Todavía no hay movimientos');
    expect(empty).toHaveClass('inv-empty-box');
    fetch.mockRejectedValueOnce(new Error('Error del servidor'));
    await userEvent.selectOptions(screen.getByLabelText('Período'), '7');
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ })).toBeInTheDocument();
  });

  it('uses the standard empty state for no filter matches and clears the filters', async () => {
    mount(); await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ });
    fetch.mockResolvedValueOnce({ events: [], nextCursor: null });
    await userEvent.selectOptions(screen.getByLabelText('Período'), '7');
    const empty = await screen.findByTestId('history-empty');
    expect(empty).toHaveClass('inv-empty-box');
    expect(empty).toHaveTextContent('Nada con esos filtros');
    await userEvent.click(within(empty).getByRole('button', { name: 'Limpiar filtros' }));
    await screen.findByRole('button', { name: /Lucía Fernández · Cambió el precio/ });
    expect(screen.queryByTestId('history-empty')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Período')).toHaveValue('30');
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
