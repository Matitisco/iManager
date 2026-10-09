import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keyboardInsetPx, useKeyboardInset, usePhoneLayout } from './phone-layout';

describe('keyboardInsetPx', () => {
  it('measures the strip covered by the keyboard', () => {
    expect(keyboardInsetPx(844, 520, 0)).toBe(324);
    expect(keyboardInsetPx(844, 844, 0)).toBe(0);
    expect(keyboardInsetPx(800, 500, 20)).toBe(280);
    expect(keyboardInsetPx(400, 500, 0)).toBe(0);
  });
});

function Probe() {
  const phone = usePhoneLayout();
  const inset = useKeyboardInset(phone);
  useEffect(() => {
    document.body.dataset.phone = phone ? 'yes' : 'no';
    document.body.dataset.inset = String(inset);
  }, [phone, inset]);
  return <div data-testid="probe">{phone ? inset : 'desk'}</div>;
}

describe('useKeyboardInset', () => {
  const originalMatchMedia = window.matchMedia;
  const originalViewport = window.visualViewport;
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.innerHeight = originalInnerHeight;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalViewport });
    delete document.body.dataset.phone;
    delete document.body.dataset.inset;
  });

  it('stays at zero on a desktop viewport', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('desk');
  });

  it('tracks a shrinking visual viewport on a phone', () => {
    const listeners = new Map<string, () => void>();
    const viewport = {
      height: 844,
      offsetTop: 0,
      addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('760'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    window.innerHeight = 844;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    viewport.height = 430;
    render(<Probe />);
    expect(listeners.size).toBeGreaterThan(0);
    expect(screen.getByTestId('probe')).toHaveTextContent('414');

    viewport.height = 844;
    act(() => listeners.get('resize')?.());
    expect(screen.getByTestId('probe')).toHaveTextContent('0');
  });
});
