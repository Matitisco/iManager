import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkActions, type BulkAction } from './bulk-actions';
import { SelectFiltered, useBulkSelection } from './bulk-selection';
import { DeskProvider } from './ui';

const context = vi.hoisted(() => ({ backendStatus: 'ready', appSession: { store: { id: 's' }, onboardingRequired: false } }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => context }));
const execute = vi.fn(); const toast = vi.fn();
const rows = ['a', 'b', 'c'].map((id) => ({ id, name: `Equipo ${id}` }));
function Harness({ permitted = true, scope = 's', unavailable = false, items = rows, doneLabel, recover }: {
  permitted?: boolean; scope?: string; unavailable?: boolean; items?: typeof rows;
  doneLabel?: BulkAction<(typeof rows)[number]>['doneLabel']; recover?: (row: (typeof rows)[number]) => void;
}) {
  const selection = useBulkSelection(items, scope);
  return <DeskProvider value={{ tab: 'inventory', isStaff: false, canManageSensitive: permitted, toast, open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), go: vi.fn() }}>
    <SelectFiltered selection={selection} total={items.length} />
    <BulkActions key={scope} selection={selection} total={items.length} label={(row) => row.name}
      action={{ label: 'Eliminar selección', doneLabel, explanation: 'No se puede deshacer.', execute, recover, unavailable: () => unavailable ? 'Operación no disponible.' : undefined }} />
  </DeskProvider>;
}
function select() { fireEvent.click(screen.getByRole('checkbox')); }
function ask() { fireEvent.click(screen.getByRole('button', { name: 'Eliminar selección' })); }
function confirm() { fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar selección' })); }
beforeEach(() => { execute.mockReset(); execute.mockResolvedValue(undefined); toast.mockReset(); context.backendStatus = 'ready'; });

describe('bulk actions', () => {
  it('hides destructive actions without sensitive access', () => {
    render(<Harness permitted={false} />); select();
    expect(screen.getByText('3 seleccionados')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar selección' })).not.toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();
  });
  it('requires confirmation, preserves selection on dismissal and clears only persisted successes', async () => {
    render(<Harness />); select(); ask();
    expect(execute).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Eliminar selección: 3 registros');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('3 seleccionados')).toBeInTheDocument(); ask(); confirm();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(execute.mock.calls.map(([row]) => row.id)).toEqual(['a', 'b', 'c']);
    expect(screen.queryByRole('region')).not.toBeInTheDocument(); expect(toast).toHaveBeenCalledWith('3 registros procesados');
  });
  it('continues after failure, shows details and retains only failures for a later retry', async () => {
    execute.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('El equipo pertenece a una operación activa'));
    render(<Harness />); select(); ask(); confirm();
    await screen.findByText('2 procesados · 1 no se pudo procesar');
    const result = screen.getByRole('dialog', { name: 'Resultado' });
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    expect(execute.mock.calls.map(([row]) => row.id)).toEqual(['a', 'b', 'c']);
    expect(toast).not.toHaveBeenCalled();
    expect(within(result).queryByRole('button', { name: /Cancelar|Eliminar selección/ })).not.toBeInTheDocument();
    const details = within(result).getByText('Ver detalle').closest('details')!;
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(within(result).getByText('Ver detalle'));
    expect(details).toHaveAttribute('open');
    expect(within(result).getByText('Equipo b')).toBeVisible();
    expect(within(result).getByText('El equipo pertenece a una operación activa')).toBeVisible();
    fireEvent.click(within(result).getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeEnabled();
    ask(); confirm(); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(execute.mock.calls.map(([row]) => row.id)).toEqual(['a', 'b', 'c', 'b']);
    expect(toast).toHaveBeenCalledWith('1 registro procesado');
  });
  it('attempts all 30 items despite interleaved business and network failures', async () => {
    const items = Array.from({ length: 30 }, (_, index) => ({ id: String(index), name: `Equipo ${index}` }));
    execute.mockImplementation(async (row: (typeof rows)[number]) => {
      if (Number(row.id) % 5 === 1) throw new Error('El equipo pertenece a una operación activa');
      if (Number(row.id) % 5 === 3) throw new TypeError('Failed to fetch');
    });
    render(<Harness items={items} doneLabel="archivados" />); select(); ask(); confirm();
    await screen.findByText('18 archivados · 12 no se pudieron archivar');
    expect(execute.mock.calls.map(([row]) => row.id)).toEqual(items.map(row => row.id));
    expect(screen.getByText('12 seleccionados')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver detalle'));
    const list = screen.getByRole('list', { name: 'Registros con errores' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(12);
    expect(within(list).getAllByText('El equipo pertenece a una operación activa')).toHaveLength(6);
    expect(within(list).getAllByText('No se pudo completar. Probá de nuevo.')).toHaveLength(6);
    expect(toast).not.toHaveBeenCalled();
  });
  it('updates live progress after each attempt, including failed ones', async () => {
    let rejectSecond!: (error: Error) => void;
    let resolveThird!: () => void;
    execute.mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectSecond = reject; }))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveThird = resolve; }));
    render(<Harness />); select(); ask();
    fireEvent.change(screen.getByRole('textbox', { name: 'Detalle' }), { target: { value: 'Duplicados del lote' } });
    expect(screen.getByText(/Se procesan uno por uno\. Los que no se puedan procesar se saltean y al final te mostramos cuáles fueron y por qué\./)).toBeInTheDocument();
    confirm();
    await screen.findByText('Procesando 1 de 3…');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await act(async () => rejectSecond(new Error('No se pudo archivar')));
    expect(screen.getByRole('status')).toHaveTextContent('Procesando 2 de 3…');
    await act(async () => resolveThird());
    expect(screen.getByRole('status')).toHaveTextContent('2 procesados · 1 no se pudo procesar');
    expect(execute.mock.calls.map(([, reason]) => reason)).toEqual(Array(3).fill('Duplicados del lote'));
  });
  it('keeps every failed item selected when all attempts fail', async () => {
    execute.mockRejectedValue(new Error('No se pudo guardar'));
    render(<Harness />); select(); ask(); confirm();
    await screen.findByText('0 procesados · 3 no se pudieron procesar');
    expect(execute).toHaveBeenCalledTimes(3);
    expect(screen.getByText('3 seleccionados')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByRole('checkbox')).toBeEnabled();
    expect(toast).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Listo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
  it.each(['archivados', 'anulados'] as const)('uses singular and plural for %s', async (doneLabel) => {
    execute.mockRejectedValueOnce(new Error('Operación activa')).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Operación activa'));
    render(<Harness doneLabel={doneLabel} />); select(); ask(); confirm();
    await screen.findByText(`1 ${doneLabel.slice(0, -1)} · 2 no se pudieron ${doneLabel === 'archivados' ? 'archivar' : 'anular'}`);
  });
  it('offers recovery for the first credit-balance failure even after a different error', async () => {
    const recover = vi.fn();
    execute.mockRejectedValueOnce(new Error('Operación activa'))
      .mockRejectedValueOnce(new Error('El cliente tiene saldo a favor'))
      .mockRejectedValueOnce(new Error('El cliente tiene saldo a favor'));
    render(<Harness doneLabel="archivados" recover={recover} />); select(); ask(); confirm();
    await screen.findByText('0 archivados · 3 no se pudieron archivar');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }));
    expect(recover).toHaveBeenCalledExactlyOnceWith(rows[1]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('3 seleccionados')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeEnabled();
  });
  it('prevents duplicate submission/dismissal while processing', async () => {
    let resolve!: () => void; execute.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    render(<Harness />); select(); ask(); confirm();
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardando…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(execute).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(3));
  });
  it.each(['resolve', 'reject'] as const)('stops the sequence on scope change when the pending item will %s', async (outcome) => {
    let settle!: () => void; execute.mockImplementationOnce(() => new Promise<void>((resolve, reject) => { settle = () => outcome === 'resolve' ? resolve() : reject(new Error('Saldo a favor')); }));
    const { rerender } = render(<Harness />); select(); ask(); confirm();
    rerender(<Harness scope="another-store-or-user" />); await act(async () => settle());
    expect(execute).toHaveBeenCalledTimes(1); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });
  it('stops after unmount while a request is pending', async () => {
    let resolve!: () => void; execute.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    const { unmount } = render(<Harness />); select(); ask(); confirm();
    unmount(); await act(async () => resolve());
    expect(execute).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });
  it('blocks writes when backend or eligibility is unavailable', () => {
    context.backendStatus = 'offline';
    const { rerender } = render(<Harness />); select(); expect(screen.getByRole('button', { name: 'Eliminar selección' })).toBeDisabled();
    context.backendStatus = 'ready'; rerender(<Harness unavailable />);
    expect(screen.getByText('Operación no disponible.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Eliminar selección' })).toBeDisabled();
  });
});
