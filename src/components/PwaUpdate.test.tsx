import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LONG_ABSENCE_MS, PwaUpdate, RELOAD_KEY } from './PwaUpdate';
import { showBootSplash } from '../lib/boot-splash';

const watcher = vi.hoisted(() => ({ update: () => {}, safe: false, onSafe: () => {} }));
vi.mock('../lib/boot-splash', () => ({ showBootSplash: vi.fn() }));
vi.mock('../lib/pwa-update', () => ({
  appBuildId: () => 'test-build',
  watchControllerUpdates: (_worker: unknown, update: () => void) => { watcher.update = update; return vi.fn(); },
  watchVersionUpdates: () => vi.fn(),
  watchUpdateSafety: (onSafe: () => void) => { watcher.onSafe = onSafe; return { isSafe: () => watcher.safe, dispose: vi.fn() }; },
}));
const reload = vi.fn();
let frames: FrameRequestCallback[];
function visibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
}
beforeEach(() => {
  sessionStorage.clear();
  reload.mockClear();
  vi.mocked(showBootSplash).mockClear();
  watcher.safe = false;
  frames = [];
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: new EventTarget() });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  const realWindow = window;
  vi.stubGlobal('window', new Proxy(realWindow, { get: (target, key) => key === 'location' ? { reload } : Reflect.get(target, key, target) }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('preserves unsaved input even on explicit click and waits for a safe hidden tab', () => {
  render(<><form><input aria-label="Cliente" defaultValue="Borrador sin guardar" /></form><PwaUpdate /></>);
  act(() => watcher.update());
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  expect(screen.getByRole('status')).toHaveTextContent('Guardá o cerrá el formulario');
  expect(screen.getByLabelText('Cliente')).toHaveValue('Borrador sin guardar');
  visibility('hidden');
  expect(reload).not.toHaveBeenCalled();
  watcher.safe = true;
  act(() => watcher.onSafe());
  expect(reload).toHaveBeenCalledTimes(1);
});
it('defers a safe visible update until hidden, with no reload on focus or safe DOM changes', () => {
  watcher.safe = true;
  render(<PwaUpdate />);
  act(() => { watcher.update(); watcher.onSafe(); window.dispatchEvent(new Event('focus')); });
  expect(screen.getByRole('status')).toHaveTextContent('Nueva versión disponible · Actualizar');
  expect(reload).not.toHaveBeenCalled();
  expect(showBootSplash).not.toHaveBeenCalled();
  visibility('hidden');
  expect(reload).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(RELOAD_KEY)).toBe('controller');
});
it('reloads an update detected while hidden immediately when safe', () => {
  visibility('hidden'); watcher.safe = true;
  render(<PwaUpdate />);
  act(() => watcher.update());
  expect(reload).toHaveBeenCalledTimes(1);
});
it('paints the splash before reloading after a long absence with a pending update', () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  render(<PwaUpdate />);
  act(() => watcher.update());
  visibility('hidden');
  vi.advanceTimersByTime(LONG_ABSENCE_MS);
  watcher.safe = true;
  visibility('visible');
  expect(showBootSplash).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
  act(() => frames.shift()!(0));
  expect(reload).not.toHaveBeenCalled();
  act(() => frames.shift()!(16));
  expect(reload).toHaveBeenCalledTimes(1);
});
it('keeps an unsafe long-return draft and does not reload on a brief return', () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  render(<PwaUpdate />);
  act(() => watcher.update());
  visibility('hidden'); vi.advanceTimersByTime(LONG_ABSENCE_MS); visibility('visible');
  expect(showBootSplash).not.toHaveBeenCalled();
  visibility('hidden'); vi.advanceTimersByTime(1000); watcher.safe = true; visibility('visible');
  expect(reload).not.toHaveBeenCalled();
});
it('honors the persisted loop guard on remount and on manual requests', () => {
  sessionStorage.setItem(RELOAD_KEY, 'controller'); watcher.safe = true;
  render(<PwaUpdate />);
  act(() => watcher.update());
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  visibility('hidden');
  expect(showBootSplash).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});
it('manual update also paints the splash first', () => {
  watcher.safe = true;
  render(<PwaUpdate />);
  act(() => watcher.update());
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  expect(showBootSplash).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
  act(() => { frames.shift()!(0); frames.shift()!(16); });
  expect(reload).toHaveBeenCalledTimes(1);
});
