import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PressTarget, RowMenu } from './ui';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('context menu anchors', () => {
  it('passes raw client coordinates from a right click regardless of the row bounds', () => {
    const onMenu = vi.fn();
    render(<PressTarget as="button" onActivate={vi.fn()} onMenu={onMenu}>Venta</PressTarget>);
    const row = screen.getByRole('button', { name: 'Venta' });
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 500, 1000, 60));
    fireEvent.contextMenu(row, { clientX: 464, clientY: 345 });
    expect(onMenu).toHaveBeenCalledExactlyOnceWith({ x: 464, y: 345 });
  });

  it('passes the original pointer coordinates after the long press delay', () => {
    vi.useFakeTimers();
    const onMenu = vi.fn(); const onActivate = vi.fn();
    render(<PressTarget as="button" onActivate={onActivate} onMenu={onMenu}>Venta</PressTarget>);
    const row = screen.getByRole('button', { name: 'Venta' });
    // jsdom does not implement PointerEvent in all supported versions.
    const event = new MouseEvent('pointerdown', { bubbles: true, clientX: 464, clientY: 345 });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    fireEvent(row, event);
    act(() => vi.advanceTimersByTime(479));
    expect(onMenu).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onMenu).toHaveBeenCalledExactlyOnceWith({ x: 464, y: 345 });
    fireEvent.pointerUp(row); fireEvent.click(row);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('keeps the button bounds in the point spread by the screens', () => {
    const onMenu = vi.fn();
    render(<RowMenu onMenu={onMenu} />);
    const button = screen.getByRole('button', { name: 'Más acciones' });
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(500, 548, 32, 32));
    fireEvent.click(button);
    expect(onMenu).toHaveBeenCalledExactlyOnceWith({ x: 500, y: 580, anchorTop: 548, anchorBottom: 580, anchorRight: 532 });
  });
});
