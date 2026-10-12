import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectFiltered, useBulkSelection } from './bulk-selection';
import { PressTarget } from './ui';

const rows = Array.from({ length: 12 }, (_, index) => ({ id: String(index), name: `Equipo ${index}` }));
afterEach(() => vi.useRealTimers());

describe('filtered bulk selection', () => {
  it('selects the entire filtered list across pages and toggles all off', () => {
    const { result } = renderHook(() => useBulkSelection(rows, 'store|user'));
    act(() => result.current.toggleAll());
    expect(result.current.selected).toHaveLength(12);
    expect(result.current.all).toBe(true);
    act(() => result.current.toggleAll());
    expect(result.current.selected).toEqual([]);
  });

  it('supports Shift ranges in the current order, including reverse ranges and deselection', () => {
    const { result } = renderHook(() => useBulkSelection(rows, 's'));
    act(() => result.current.row('5', '5').toggle());
    act(() => result.current.row('2', '2').toggle(true));
    expect(result.current.selected.map((row) => row.id)).toEqual(['2', '3', '4', '5']);
    act(() => result.current.row('5', '5').toggle(true));
    expect(result.current.selected).toEqual([]);
  });

  it('prunes hidden/deleted records without restoring them when filters clear, and resets on scope switch', () => {
    const { result, rerender } = renderHook(({ list, scope }) => useBulkSelection(list, scope), { initialProps: { list: rows, scope: 's|u' } });
    act(() => result.current.toggleAll());
    rerender({ list: rows.slice(0, 2), scope: 's|u' });
    expect(result.current.selected).toHaveLength(2);
    rerender({ list: rows, scope: 's|u' });
    expect(result.current.selected).toHaveLength(2);
    rerender({ list: rows, scope: 'other|u' });
    expect(result.current.selected).toEqual([]);
    act(() => result.current.toggleAll());
    rerender({ list: rows, scope: 'other|new-user' });
    expect(result.current.selected).toEqual([]);
  });

  it('shows an indeterminate header and prevents changes while locked', () => {
    function Table() {
      const selection = useBulkSelection(rows, 's');
      return <><SelectFiltered selection={selection} total={12} /><button onClick={() => selection.row('1', '1').toggle()}>Una</button><button onClick={() => selection.setLocked(true)}>Bloquear</button><output>{selection.selected.length}</output></>;
    }
    render(<Table />);
    fireEvent.click(screen.getByText('Una'));
    const header = screen.getByRole('checkbox') as HTMLInputElement;
    expect(header.indeterminate).toBe(true);
    fireEvent.click(screen.getByText('Bloquear'));
    expect(header).toBeDisabled();
    fireEvent.click(screen.getByText('Una'));
    expect(screen.getByRole('status')).toHaveTextContent('1');
  });

  it.each(['timer', 'contextmenu'])('opens the original menu on %s without selecting or opening detail', (gesture) => {
    vi.useFakeTimers();
    const activate = vi.fn(); const menu = vi.fn(); const toggle = vi.fn();
    render(<PressTarget as="button" className="phone-row" onActivate={activate} onMenu={menu}
      selection={{ active: false, visible: false, checked: false, disabled: false, label: 'Seleccionar Equipo 1', toggle }}>Equipo 1</PressTarget>);
    const card = screen.getByRole('button', { name: 'Equipo 1' });
    fireEvent.pointerDown(card, { pointerType: 'touch', clientX: 50, clientY: 50 });
    act(() => vi.advanceTimersByTime(479));
    expect(menu).not.toHaveBeenCalled();
    if (gesture === 'contextmenu') fireEvent.contextMenu(card);
    else act(() => vi.advanceTimersByTime(1));
    fireEvent.pointerUp(card); fireEvent.click(card);
    expect(menu).toHaveBeenCalledOnce();
    expect(toggle).not.toHaveBeenCalled(); expect(activate).not.toHaveBeenCalled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(701)); fireEvent.click(card);
    expect(activate).toHaveBeenCalledOnce();
  });

  it('starts with one selected row, keeps mode when empty and clears mode on exit/scope change', () => {
    const { result, rerender } = renderHook(({ scope }) => useBulkSelection(rows, scope), { initialProps: { scope: 's' } });
    act(() => result.current.start('1'));
    expect(result.current.mode).toBe(true); expect(result.current.selected.map((row) => row.id)).toEqual(['1']);
    act(() => result.current.row('1', '1').toggle());
    expect(result.current.mode).toBe(true); expect(result.current.selected).toEqual([]);
    act(() => result.current.clear()); expect(result.current.mode).toBe(false);
    act(() => result.current.start('1')); rerender({ scope: 'other' });
    expect(result.current.mode).toBe(false); expect(result.current.selected).toEqual([]);
  });

  it('keeps the desktop row menu on right click', () => {
    const menu = vi.fn();
    render(<table><tbody><PressTarget as="tr" onActivate={vi.fn()} onMenu={menu}><td>Venta</td></PressTarget></tbody></table>);
    fireEvent.contextMenu(screen.getByRole('row'));
    expect(menu).toHaveBeenCalledOnce();
  });

  it('cancels a hold on scroll or pointer cancel and cleans up on unmount', () => {
    vi.useFakeTimers();
    const toggle = vi.fn(); const menu = vi.fn();
    const { unmount } = render(<PressTarget as="button" onActivate={vi.fn()} onMenu={menu} selection={{ active: false, checked: false, disabled: false, label: 'Seleccionar', toggle }}>Equipo</PressTarget>);
    const card = screen.getByRole('button', { name: 'Equipo' });
    fireEvent.pointerDown(card, { pointerType: 'touch' }); fireEvent.scroll(window);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerDown(card, { pointerType: 'touch' }); fireEvent.pointerCancel(card);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerDown(card, { pointerType: 'touch' }); unmount();
    act(() => vi.advanceTimersByTime(500));
    expect(toggle).not.toHaveBeenCalled(); expect(menu).not.toHaveBeenCalled();
  });
});
