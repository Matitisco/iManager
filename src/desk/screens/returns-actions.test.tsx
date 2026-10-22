import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReturnCaseView } from '../../services/returns-api';
import { DeskOverlays } from '../DeskOverlays';
import { DeskProvider } from '../ui';
import { ReturnsScreen } from './ReturnsScreen';

const ctx = vi.hoisted(() => ({ returns: [] as ReturnCaseView[], returnsError: '', user: null }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
const open = vi.fn();
const claim = { id: 'claim', code: 'RMA-0001', clientName: 'Lucía', deviceLabel: 'iPhone 13', imei: '359123456789012', openedOn: '2026-10-21', moneyAmount: 1200, moneyCurrency: 'ARS', status: 'ABIERTO', deletedAt: null, rmaStatus: null } as ReturnCaseView;
function mount(child: ReactNode, sensitive = true) {
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'returns', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: !sensitive, canManageSensitive: sensitive }}>{child}</DeskProvider></div>);
}
beforeEach(() => { vi.clearAllMocks(); ctx.returns = [claim]; });
afterEach(() => vi.useRealTimers());
describe('acciones de fila de reclamos', () => {
  it('opens the contextual actions with right click and the explicit menu button', async () => {
    mount(<ReturnsScreen />);
    fireEvent.contextMenu(screen.getByTestId('return-claim'), { clientX: 200, clientY: 150 });
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'ctx', kind: 'return', id: 'claim', label: 'RMA-0001' }));
    open.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'ctx', kind: 'return' }));
  });
  it('opens on long press without activating the record on release', () => {
    vi.useFakeTimers(); mount(<ReturnsScreen />);
    const row = screen.getByTestId('return-claim');
    fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 120, clientY: 180 });
    act(() => vi.advanceTimersByTime(480));
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'ctx', kind: 'return' }));
    fireEvent.pointerUp(row); fireEvent.click(row);
    expect(open).toHaveBeenCalledOnce();
  });
  it('cancels a long press when scrolling starts', () => {
    vi.useFakeTimers(); mount(<ReturnsScreen />);
    fireEvent.pointerDown(screen.getByTestId('return-claim'), { pointerType: 'touch' });
    fireEvent.scroll(window);
    act(() => vi.advanceTimersByTime(500));
    expect(open).not.toHaveBeenCalled();
  });
  it('routes Editar to the prefilled form and Eliminar to confirmation', async () => {
    mount(<DeskOverlays overlay={{ type: 'ctx', kind: 'return', id: 'claim', label: 'RMA-0001', x: 10, y: 20 }} />);
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Eliminar' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(open).toHaveBeenLastCalledWith({ type: 'edit-return', id: 'claim' });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(open).toHaveBeenLastCalledWith({ type: 'del', kind: 'return', id: 'claim', label: 'RMA-0001' });
  });
  it('hides deletion for staff without sensitive access', () => {
    mount(<DeskOverlays overlay={{ type: 'ctx', kind: 'return', id: 'claim', label: 'RMA-0001', x: 10, y: 20 }} />, false);
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Eliminar' })).not.toBeInTheDocument();
  });
  it('keeps cancelled claims red, labels them Anulado ahead of old RMA state and excludes them from Activos', async () => {
    ctx.returns = [claim, { ...claim, id: 'cancelled', code: 'RMA-0002', status: 'ANULADO', rmaStatus: 'APROBADO' }];
    mount(<ReturnsScreen />);
    expect(screen.getByTestId('return-cancelled')).toHaveClass('is-void');
    expect(screen.getByTestId('return-cancelled')).toHaveTextContent('Anulado');
    expect(screen.getByTestId('return-cancelled')).not.toHaveTextContent('Aprobado');
    await userEvent.click(screen.getByRole('button', { name: 'Activos' }));
    expect(screen.queryByTestId('return-cancelled')).not.toBeInTheDocument();
    expect(screen.getByTestId('return-claim')).toBeInTheDocument();
  });
  it('disables edit and delete in a cancelled row menu', () => {
    ctx.returns = [{ ...claim, status: 'ANULADO' }];
    mount(<DeskOverlays overlay={{ type: 'ctx', kind: 'return', id: 'claim', label: 'RMA-0001', x: 10, y: 20 }} />);
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Eliminar' })).toBeDisabled();
  });
});
