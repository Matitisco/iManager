import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordHistoryButton } from './RecordHistoryButton';
import { Sheet } from './ui';
import { fetchHistory, type HistoryEvent, type HistoryPage } from '../services/history-api';

const ctx = vi.hoisted(() => ({ user: { uid: 'owner' }, appSession: { store: { id: 'store' } } }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../services/history-api', () => ({ fetchHistory: vi.fn() }));
const fetch = vi.mocked(fetchHistory);
const event = (id: string): HistoryEvent => ({
  id, createdAt: '2026-10-22T17:30:00Z', action: 'UPDATE', group: 'Edición', section: 'inventory', sectionLabel: 'Stock',
  actorUserId: 'lucia', actorName: 'Lucía', actorRole: 'OWNER', actorRoleLabel: 'Propietaria', entityType: 'inventory', entityId: 'eq',
  entityLabel: 'iPhone 13', detail: null, changes: [{ field: 'status', label: 'Estado', before: 'Disponible', after: 'En revisión' }],
  reason: 'Revisar batería', source: null, legacy: false, title: `Evento ${id}`, verb: `Cambió estado ${id}`, target: '', suffix: '', recordState: 'active',
});
function deferred() {
  let resolve!: (value: HistoryPage) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<HistoryPage>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function mount(entityId = 'eq') {
  return render(<div className="desk-app"><Sheet title="Seguimiento" onClose={vi.fn()}>
    <input aria-label="Borrador" defaultValue="Disponible" />
    <RecordHistoryButton entityType="inventory" entityId={entityId} label="iPhone 13" />
  </Sheet></div>);
}
beforeEach(() => { fetch.mockReset(); fetch.mockResolvedValue({ events: [], nextCursor: null }); ctx.appSession.store.id = 'store'; });

describe('historial apilado compartido', () => {
  it.each([false, true])('opens on demand, preserves draft and returns focus with Escape (phone=%s)', async phone => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    fetch.mockResolvedValue({ events: [event('1')], nextCursor: null });
    mount();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText(/Ocultar historial|Ver todo|Sin movimientos recientes/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Borrador'), ' modificado');
    const trigger = screen.getByRole('button', { name: 'Historial' });
    await userEvent.click(trigger);
    const modal = await screen.findByRole('dialog', { name: 'Historial' });
    expect(modal.closest('.record-history-layer')?.parentElement).toHaveClass('desk-app');
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(await within(modal).findByText('Cambió estado 1')).toBeInTheDocument();
    expect(modal.querySelector('time')).toHaveTextContent('22/10/2026');
    expect(modal.querySelector('time')).toHaveTextContent('14:30');
    expect(within(modal).getByText(/Lucía/)).toBeInTheDocument();
    expect(within(modal).getByText(/Disponible/)).toHaveTextContent('Disponible → En revisión');
    expect(within(modal).getByText('Revisar batería')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Historial' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Seguimiento' })).toBeInTheDocument();
    expect(screen.getByLabelText('Borrador')).toHaveValue('Disponible modificado');
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it.each(['close', 'backdrop'])('closes only history with %s', async method => {
    mount(); await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    const modal = screen.getByRole('dialog', { name: 'Historial' });
    if (method === 'close') await userEvent.click(within(modal).getByRole('button', { name: 'Cerrar' }));
    else fireEvent.mouseDown(modal.closest('.ov')!);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Historial' })).toHaveAttribute('aria-expanded', 'false');
  });
  it('shows skeleton without visible loading text and fetches every cursor with the same record', async () => {
    const second = deferred();
    fetch.mockResolvedValueOnce({ events: Array.from({ length: 50 }, (_, i) => event(String(i))), nextCursor: 'page2' }).mockReturnValueOnce(second.promise);
    mount(); await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith(ctx.user, { entityType: 'inventory', entityId: 'eq', limit: 50, cursor: 'page2' });
    const modal = screen.getByRole('dialog', { name: 'Historial' });
    expect(within(modal).getByRole('status', { name: 'Cargando' })).toHaveAttribute('aria-busy', 'true');
    expect(modal).not.toHaveTextContent(/Cargando|Todo/);
    expect(within(modal).getAllByRole('listitem')).toHaveLength(50);
    await act(async () => second.resolve({ events: [event('51')], nextCursor: null }));
    expect(within(modal).getAllByRole('listitem')).toHaveLength(51);
    expect(within(modal).queryByRole('status')).not.toBeInTheDocument();
  });
  it('shows API/permission errors and retries without misrepresenting them as empty history', async () => {
    fetch.mockRejectedValueOnce(new Error('No tenés acceso al historial'));
    mount(); await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No tenés acceso al historial');
    expect(screen.queryByText('Sin movimientos')).not.toBeInTheDocument();
    fetch.mockResolvedValueOnce({ events: [event('retry')], nextCursor: null });
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Cambió estado retry')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('offers an empty state only after a successful empty response', async () => {
    mount(); await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(await screen.findByText('Sin movimientos')).toBeInTheDocument();
  });
  it('ignores late responses after closing and refreshes on reopen', async () => {
    const first = deferred(); fetch.mockReturnValueOnce(first.promise);
    mount(); await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    await userEvent.keyboard('{Escape}');
    fetch.mockResolvedValueOnce({ events: [event('new')], nextCursor: null });
    await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    await screen.findByText('Cambió estado new');
    await act(async () => first.resolve({ events: [event('stale')], nextCursor: null }));
    expect(screen.queryByText('Cambió estado stale')).not.toBeInTheDocument();
  });
  it('discards old records and store responses while the dialog remains open', async () => {
    const old = deferred(); fetch.mockReturnValueOnce(old.promise);
    const tree = (id: string) => <StrictMode><div className="desk-app"><Sheet title="Seguimiento" onClose={vi.fn()}><RecordHistoryButton entityType="sale" entityId={id} label={id} /></Sheet></div></StrictMode>;
    const view = render(tree('one'));
    await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    fetch.mockResolvedValue({ events: [event('current')], nextCursor: null });
    ctx.appSession.store.id = 'other-store'; view.rerender(tree('two'));
    await screen.findByText('Cambió estado current');
    await act(async () => old.resolve({ events: [event('old')], nextCursor: null }));
    expect(screen.queryByText('Cambió estado old')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(ctx.user, { entityType: 'sale', entityId: 'two', limit: 50 });
  });
});
