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

  it('selects on long press without opening detail/menu; tapping then toggles selection', () => {
    vi.useFakeTimers();
    const activate = vi.fn(); const menu = vi.fn();
    function Card() {
      const selection = useBulkSelection(rows, 's');
      return <PressTarget as="button" className="phone-row" onActivate={activate} onMenu={menu} selection={selection.row('1', 'Equipo 1')}>Equipo 1</PressTarget>;
    }
    render(<Card />);
    const card = screen.getByRole('button', { name: 'Equipo 1' });
    fireEvent.pointerDown(card, { pointerType: 'touch', clientX: 50, clientY: 50 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(card); fireEvent.click(card);
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Equipo 1' })).toBeChecked();
    expect(activate).not.toHaveBeenCalled(); expect(menu).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(800));
    fireEvent.click(card);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
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
