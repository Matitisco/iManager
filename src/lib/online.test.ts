import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeReconnect } from './online';

function mockOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
}
function restoreOnline() {
  Reflect.deleteProperty(navigator, 'onLine');
}

describe('subscribeReconnect', () => {
  const stops: Array<() => void> = [];
  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    restoreOnline();
    vi.useRealTimers();
  });

  it('notifies on the window online event', () => {
    const listener = vi.fn();
    stops.push(subscribeReconnect(listener));
    window.dispatchEvent(new Event('online'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies when the page becomes visible after being offline', () => {
    let online = false;
    mockOnline(online);
    const listener = vi.fn();
    stops.push(subscribeReconnect(listener));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(listener).not.toHaveBeenCalled();
    online = true;
    mockOnline(online);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notices onLine flipping back without an online event', () => {
    vi.useFakeTimers();
    let online = false;
    mockOnline(online);
    const listener = vi.fn();
    stops.push(subscribeReconnect(listener));
    vi.advanceTimersByTime(1000);
    expect(listener).not.toHaveBeenCalled();
    online = true;
    mockOnline(online);
    vi.advanceTimersByTime(1000);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
