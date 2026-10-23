import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { hideBootSplash, showBootSplash, whenBootContentReady } from './boot-splash';

beforeEach(() => { vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList); });
afterEach(() => { document.getElementById('boot-splash')?.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('creates one static overlay and removes it once after a short exit', () => {
  vi.useFakeTimers();
  const splash = showBootSplash();
  expect(showBootSplash()).toBe(splash);
  expect(splash.textContent).toBe('');
  expect(splash.querySelector('img')).toHaveAttribute('src', '/icons/icon-192.png');
  hideBootSplash();
  vi.advanceTimersByTime(60);
  hideBootSplash();
  expect(splash).toHaveStyle({ opacity: '0' });
  vi.advanceTimersByTime(60);
  expect(splash.isConnected).toBe(false);
  hideBootSplash();
});
it('removes immediately for reduced motion and on transition completion', () => {
  const splash = showBootSplash();
  hideBootSplash();
  splash.dispatchEvent(new Event('transitionend'));
  expect(splash.isConnected).toBe(false);
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
  const reduced = showBootSplash();
  hideBootSplash();
  expect(reduced.isConnected).toBe(false);
});
it('cancels an outgoing splash before a reload overlay is shown', () => {
  vi.useFakeTimers();
  const splash = showBootSplash();
  hideBootSplash();
  showBootSplash();
  splash.dispatchEvent(new Event('transitionend'));
  vi.advanceTimersByTime(200);
  expect(splash.isConnected).toBe(true);
  expect(splash).toHaveStyle({ opacity: '1', transition: 'none' });
});

it('waits until the committed screen is no longer busy before revealing it', async () => {
  const root = document.createElement('main');
  root.innerHTML = '<section aria-busy="true"><span></span></section>';
  const ready = vi.fn();
  const stop = whenBootContentReady(root, ready);
  expect(ready).not.toHaveBeenCalled();
  root.firstElementChild!.setAttribute('aria-busy', 'false');
  await Promise.resolve();
  expect(ready).toHaveBeenCalledTimes(1);
  root.firstElementChild!.remove();
  await Promise.resolve();
  expect(ready).toHaveBeenCalledTimes(1);
  stop();
});
it('disconnects a pending screen observer on scope change', async () => {
  const root = document.createElement('main');
  root.innerHTML = '<section aria-busy="true"></section>';
  const ready = vi.fn();
  const stop = whenBootContentReady(root, ready);
  stop();
  root.innerHTML = '';
  await Promise.resolve();
  expect(ready).not.toHaveBeenCalled();
});
