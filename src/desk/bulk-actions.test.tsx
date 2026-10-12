import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkActions } from './bulk-actions';
import { SelectFiltered, useBulkSelection } from './bulk-selection';
import { DeskProvider } from './ui';

const context = vi.hoisted(() => ({ backendStatus: 'ready', appSession: { store: { id: 's' }, onboardingRequired: false } }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => context }));
const execute = vi.fn(); const toast = vi.fn();
const rows = ['a', 'b', 'c'].map((id) => ({ id, name: `Equipo ${id}` }));
function Harness({ permitted = true, scope = 's', unavailable = false }: { permitted?: boolean; scope?: string; unavailable?: boolean }) {
  const selection = useBulkSelection(rows, scope);
  return <DeskProvider value={{ tab: 'inventory', isStaff: false, canManageSensitive: permitted, toast, open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), go: vi.fn() }}>
    <SelectFiltered selection={selection} total={rows.length} />
    <BulkActions key={scope} selection={selection} total={rows.length} label={(row) => row.name}
      action={{ label: 'Eliminar selección', explanation: 'No se puede deshacer.', execute, unavailable: () => unavailable ? 'Operación no disponible.' : undefined }} />
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
  it('stops on failure, reports partial results and retries only pending rows', async () => {
    execute.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('El equipo pertenece a una operación activa'));
    render(<Harness />); select(); ask(); confirm();
    await screen.findByText(/1 completados · 2 pendientes.*Equipo b: El equipo pertenece/);
    expect(screen.getByText('2 seleccionados')).toBeInTheDocument();
    expect(execute).toHaveBeenCalledTimes(2); expect(toast).not.toHaveBeenCalled();
    confirm(); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(execute.mock.calls.map(([row]) => row.id)).toEqual(['a', 'b', 'b', 'c']);
  });
  it('prevents duplicate submission/dismissal while processing', async () => {
    let resolve!: () => void; execute.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    render(<Harness />); select(); ask(); confirm();
    expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(execute).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(3));
  });
  it('stops the sequence and clears selection when store/user scope changes', async () => {
    let resolve!: () => void; execute.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    const { rerender } = render(<Harness />); select(); ask(); confirm();
    rerender(<Harness scope="another-store" />); await act(async () => resolve());
    expect(execute).toHaveBeenCalledTimes(1); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
  it('blocks writes when backend or eligibility is unavailable', () => {
    context.backendStatus = 'offline';
    const { rerender } = render(<Harness />); select(); expect(screen.getByRole('button', { name: 'Eliminar selección' })).toBeDisabled();
    context.backendStatus = 'ready'; rerender(<Harness unavailable />);
    expect(screen.getByText('Operación no disponible.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Eliminar selección' })).toBeDisabled();
  });
});
