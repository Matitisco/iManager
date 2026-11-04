import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, RepairOrder, Sale, TradeIn } from '../types';
import type { PermanentDeleteKind } from '../services/permanent-delete-api';
import type { Overlay } from './types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';
import { PermanentDeleteButton } from './PermanentDelete';
import { archivedClient, forgetArchivedRecord, rememberArchivedClients, rememberArchivedProducts, rememberArchivedRepairs, rememberVoidedSales, rememberVoidedTrades } from './archive-cache';
import { useArchivedRows } from './use-archived-rows';

const ctx = vi.hoisted(() => ({
  user: { uid: 'u', getIdToken: async () => 'test' }, backendStatus: 'ready',
  appSession: { store: { id: 'store' }, membership: { role: 'OWNER', sensitiveAccess: true }, onboardingRequired: false },
  inventory: [] as Product[], clients: [] as Client[], sales: [] as Sale[], tradeIns: [] as TradeIn[], repairOrders: [] as RepairOrder[],
  permanentlyDeleteRecord: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
const open = vi.fn(), close = vi.fn(), toast = vi.fn();
const desk = { tab: 'inventory' as const, open, close, toast, go: vi.fn(), openRecord: vi.fn(), isStaff: false, canManageSensitive: true };
const kinds: PermanentDeleteKind[] = ['eq', 'sale', 'cl', 'cj', 'ot'];
const inactiveAt = '2026-11-04T12:00:00Z';

function seed(inactive = true) {
  ctx.inventory = [{ id: 'record', model: 'iPhone 13', capacity: '128GB', imei: '123456789012345', archivedAt: inactive ? inactiveAt : null } as Product];
  ctx.clients = [{ id: 'record', name: 'Ana Ficticia', dni: '30123456', archivedAt: inactive ? inactiveAt : null } as Client];
  ctx.sales = [{ id: 'record', saleNumber: 703, clientName: 'Ana Ficticia', status: 'COMPLETADA', voidedAt: inactive ? inactiveAt : null } as Sale];
  ctx.tradeIns = [{ id: 'record', tradeNumber: 703, deviceReceived: 'iPhone 12', status: 'LISTO', voidedAt: inactive ? inactiveAt : null } as TradeIn];
  ctx.repairOrders = [{ id: 'record', code: 'OT-0703', device: 'iPhone 13', archivedAt: inactive ? inactiveAt : null } as RepairOrder];
}

function mount(overlay: Overlay) {
  return render(<DeskProvider value={desk}><DeskOverlays overlay={overlay} /></DeskProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.appSession.membership.role = 'OWNER';
  ctx.permanentlyDeleteRecord.mockReset().mockResolvedValue(undefined);
  seed();
});
afterEach(() => {
  rememberArchivedClients([]); rememberArchivedProducts([]); rememberArchivedRepairs([]); rememberVoidedSales([]); rememberVoidedTrades([]);
});

describe.each(kinds)('borrado definitivo %s', kind => {
  it.each(['STAFF', 'MANAGER'])('hides the action from %s even with sensitive permissions', role => {
    ctx.appSession.membership.role = role;
    mount({ type: 'ctx', kind, id: 'record', label: 'Registro', x: 0, y: 0 });
    expect(screen.queryByRole('button', { name: 'Borrar definitivamente' })).not.toBeInTheDocument();
  });

  it('hides the action from OWNER while active', () => {
    seed(false);
    mount({ type: 'ctx', kind, id: 'record', label: 'Registro', x: 0, y: 0 });
    expect(screen.queryByRole('button', { name: 'Borrar definitivamente' })).not.toBeInTheDocument();
  });

  it('offers the same guarded action in record details and opens the confirmation', () => {
    render(<DeskProvider value={desk}><PermanentDeleteButton kind={kind} id="record" /></DeskProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar definitivamente' }));
    expect(open).toHaveBeenCalledWith({ type: 'permanent-delete', kind, id: 'record' });
  });

  it('shows identifier and irreversible warning and requires exact BORRAR before submitting', async () => {
    mount({ type: 'permanent-delete', kind, id: 'record' });
    expect(screen.getByText('record')).toBeInTheDocument();
    expect(screen.getByText('Esta acción es irreversible')).toBeInTheDocument();
    expect(screen.getAllByText(/iPhone|Ana Ficticia|V-0703|C-0703/).length).toBeGreaterThan(0);
    const submit = screen.getByRole('button', { name: 'Borrar definitivamente' });
    const input = screen.getByRole('textbox', { name: 'Escribí BORRAR para confirmar' });
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: 'borrar' } });
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: 'BORRAR' } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(ctx.permanentlyDeleteRecord).toHaveBeenCalledWith(kind, 'record'));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith('Registro borrado definitivamente');
  });

  it('keeps the confirmation and record on a backend error', async () => {
    ctx.permanentlyDeleteRecord.mockRejectedValue(new Error('Primero anulá o archivá el registro.'));
    mount({ type: 'permanent-delete', kind, id: 'record' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'BORRAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Borrar definitivamente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Primero anulá o archivá el registro.');
    expect(close).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Borrar definitivamente' })).toBeEnabled();
  });

  it('does not call the backend if cancelled', () => {
    mount({ type: 'permanent-delete', kind, id: 'record' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(close).toHaveBeenCalled();
    expect(ctx.permanentlyDeleteRecord).not.toHaveBeenCalled();
  });
});

it('blocks double submit and closing while deletion is pending', async () => {
  let resolve!: () => void;
  ctx.permanentlyDeleteRecord.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  mount({ type: 'permanent-delete', kind: 'cl', id: 'record' });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'BORRAR' } });
  const submit = screen.getByRole('button', { name: 'Borrar definitivamente' });
  fireEvent.click(submit); fireEvent.click(submit);
  expect(ctx.permanentlyDeleteRecord).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  expect(close).not.toHaveBeenCalled();
  await act(async () => { resolve(); });
  expect(close).toHaveBeenCalledTimes(1);
});

it('resolves archived-only records from the existing cache', () => {
  rememberArchivedClients(ctx.clients);
  ctx.clients = [];
  mount({ type: 'ctx', kind: 'cl', id: 'record', label: 'Ana Ficticia', x: 0, y: 0 });
  expect(screen.getByRole('button', { name: 'Borrar definitivamente' })).toBeInTheDocument();
});

it('invalidates archived rows and discards a response started before permanent deletion', async () => {
  let resolve!: (rows: Client[]) => void;
  const load = vi.fn().mockReturnValueOnce(new Promise<Client[]>(done => { resolve = done; })).mockResolvedValue([]);
  const rows = ctx.clients;
  rememberArchivedClients(rows);
  const { result } = renderHook(() => useArchivedRows(ctx.clients, load, rememberArchivedClients));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  act(() => { forgetArchivedRecord('cl', 'record'); });
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  await act(async () => { resolve(rows); });
  expect(result.current.rows).toEqual([]);
  expect(archivedClient('record')).toBeNull();
});
