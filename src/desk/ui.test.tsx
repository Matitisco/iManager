import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuButton, PressTarget, RowMenu } from './ui';

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


describe('dropdown viewport bounds', () => {
  it.each([14, 350])('keeps all options visible next to the edge at x=%s', left => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('menu') ? new DOMRect(0, 0, 200, 160) : new DOMRect(left, 200, 100, 36);
    });
    const changed = vi.fn();
    const { container } = render(<MenuButton label="Ordenar" options={['Recientes', 'Nombre']} value="Recientes" onChange={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar' }));
    const dropdown = container.querySelector<HTMLElement>('.menu')!;
    const visibleLeft = left + Number.parseFloat(dropdown.style.left);
    expect(visibleLeft).toBeGreaterThanOrEqual(12);
    expect(visibleLeft + 200).toBeLessThanOrEqual(378);
    fireEvent.click(screen.getByRole('button', { name: 'Nombre' }));
    expect(changed).toHaveBeenCalledExactlyOnceWith('Nombre');
    expect(container.querySelector('.menu')).toBeNull();
  });
  it('repositions on resize and keeps Escape dismissal', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('menu') ? new DOMRect(0, 0, 200, 160) : new DOMRect(350, 200, 100, 36);
    });
    const { container } = render(<MenuButton label="Ordenar" options={['Recientes']} value="Recientes" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar' }));
    expect(container.querySelector<HTMLElement>('.menu')!.style.left).toBe('-100px');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    fireEvent(window, new Event('resize'));
    expect(container.querySelector<HTMLElement>('.menu')!.style.left).toBe('-172px');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('.menu')).toBeNull();
  });
});
