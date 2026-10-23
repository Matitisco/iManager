import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LONG_ABSENCE_MS, PwaUpdate, RELOAD_KEY } from './PwaUpdate';
import { readRemoteBuildId } from '../lib/pwa-update';
import { showBootSplash } from '../lib/boot-splash';

const watcher = vi.hoisted(() => ({ update: () => {}, safe: false, onSafe: () => {} }));
vi.mock('../lib/boot-splash', () => ({ showBootSplash: vi.fn() }));
vi.mock('../lib/pwa-update', () => ({
  appBuildId: () => 'test-build',
  readRemoteBuildId: vi.fn(async () => null),
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
  vi.mocked(readRemoteBuildId).mockResolvedValue(null);
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
async function controllerUpdate() { await act(async () => { await watcher.update(); }); }
it('preserves unsaved input even on explicit click and waits for a safe hidden tab', async () => {
  render(<><form><input aria-label="Cliente" defaultValue="Borrador sin guardar" /></form><PwaUpdate /></>);
  await controllerUpdate();
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  expect(screen.getByRole('status')).toHaveTextContent('Guardá o cerrá el formulario');
  expect(screen.getByLabelText('Cliente')).toHaveValue('Borrador sin guardar');
  visibility('hidden');
  expect(reload).not.toHaveBeenCalled();
  watcher.safe = true;
  act(() => watcher.onSafe());
  expect(reload).toHaveBeenCalledTimes(1);
});
it('defers a safe visible update until hidden, with no reload on focus or safe DOM changes', async () => {
  watcher.safe = true;
  render(<PwaUpdate />);
  await controllerUpdate();
  act(() => { watcher.onSafe(); window.dispatchEvent(new Event('focus')); });
  expect(screen.getByRole('status')).toHaveTextContent('Nueva versión disponible · Actualizar');
  expect(reload).not.toHaveBeenCalled();
  expect(showBootSplash).not.toHaveBeenCalled();
  visibility('hidden');
  expect(reload).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(RELOAD_KEY)).toBe('controller');
});
it('reloads an update detected while hidden immediately when safe', async () => {
  visibility('hidden'); watcher.safe = true;
  render(<PwaUpdate />);
  await controllerUpdate();
  expect(reload).toHaveBeenCalledTimes(1);
});
it('paints the splash before reloading after a long absence with a pending update', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  render(<PwaUpdate />);
  await controllerUpdate();
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
it('keeps an unsafe long-return draft and does not reload on a brief return', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  render(<PwaUpdate />);
  await controllerUpdate();
  visibility('hidden'); vi.advanceTimersByTime(LONG_ABSENCE_MS); visibility('visible');
  expect(showBootSplash).not.toHaveBeenCalled();
  visibility('hidden'); vi.advanceTimersByTime(1000); watcher.safe = true; visibility('visible');
  expect(reload).not.toHaveBeenCalled();
});
it('honors the persisted loop guard on remount and on manual requests', async () => {
  sessionStorage.setItem(RELOAD_KEY, 'controller'); watcher.safe = true;
  render(<PwaUpdate />);
  await controllerUpdate();
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  visibility('hidden');
  expect(showBootSplash).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});
it('manual update also paints the splash first', async () => {
  watcher.safe = true;
  render(<PwaUpdate />);
  await controllerUpdate();
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  expect(showBootSplash).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
  act(() => { frames.shift()!(0); frames.shift()!(16); });
  expect(reload).toHaveBeenCalledTimes(1);
});

it('ignores a late controller claim when the loaded bundle is already current', async () => {
  vi.mocked(readRemoteBuildId).mockResolvedValue('test-build');
  watcher.safe = true;
  render(<PwaUpdate />);
  await controllerUpdate();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  visibility('hidden');
  expect(reload).not.toHaveBeenCalled();
});
it('keeps a genuinely newer controller update and its build loop guard', async () => {
  vi.mocked(readRemoteBuildId).mockResolvedValue('next-build');
  watcher.safe = true;
  render(<PwaUpdate />);
  await controllerUpdate();
  expect(screen.getByRole('status')).toHaveTextContent('Nueva versión disponible');
  visibility('hidden');
  expect(reload).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(RELOAD_KEY)).toBe('next-build');
});
it('discards a controller version response after unmount', async () => {
  let resolve!: (build: string) => void;
  vi.mocked(readRemoteBuildId).mockReturnValue(new Promise(done => { resolve = done; }));
  watcher.safe = true;
  visibility('hidden');
  const view = render(<PwaUpdate />);
  const pending = watcher.update();
  view.unmount();
  await act(async () => { resolve('next-build'); await pending; });
  expect(reload).not.toHaveBeenCalled();
});
