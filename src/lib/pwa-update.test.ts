import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { appBuildId, readRemoteBuildId, watchControllerUpdates, watchUpdateSafety, watchVersionUpdates } from './pwa-update';

afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });
it('ignores first installation but detects successive controllers with the same script URL', () => {
  const worker = Object.assign(new EventTarget(), { controller: null as null | { scriptURL: string } });
  const update = vi.fn();
  const stop = watchControllerUpdates(worker as unknown as ServiceWorkerContainer, update);
  worker.controller = { scriptURL: '/sw.js' }; worker.dispatchEvent(new Event('controllerchange'));
  expect(update).not.toHaveBeenCalled();
  worker.controller = { scriptURL: '/sw.js' }; worker.dispatchEvent(new Event('controllerchange'));
  expect(update).toHaveBeenCalledOnce();
  worker.dispatchEvent(new Event('controllerchange')); expect(update).toHaveBeenCalledOnce();
  stop(); worker.controller = { scriptURL: '/sw.js' }; worker.dispatchEvent(new Event('controllerchange'));
  expect(update).toHaveBeenCalledOnce();
});
it('detects an update of an already controlled tab', () => {
  const worker = Object.assign(new EventTarget(), { controller: { scriptURL: '/sw.js' } });
  const update = vi.fn(); watchControllerUpdates(worker as unknown as ServiceWorkerContainer, update);
  worker.controller = { scriptURL: '/sw.js' }; worker.dispatchEvent(new Event('controllerchange'));
  expect(update).toHaveBeenCalledOnce();
});
it('notices a controller that is committed after the event', async () => {
  const worker = Object.assign(new EventTarget(), { controller: { scriptURL: '/sw.js' } as { scriptURL: string } });
  const update = vi.fn();
  watchControllerUpdates(worker as unknown as ServiceWorkerContainer, update);
  worker.dispatchEvent(new Event('controllerchange'));
  expect(update).not.toHaveBeenCalled();
  worker.controller = { scriptURL: '/sw.js' };
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(update).toHaveBeenCalledOnce();
});
it('keeps custom modal drafts, native forms, inline input and active saves safe until removed', async () => {
  vi.useFakeTimers();
  const safe = vi.fn(); const guard = watchUpdateSafety(safe);
  expect(guard.isSafe()).toBe(true);
  for (const markup of ['<form><input></form>', '<div class="ov"><input></div>', '<div role="dialog"><button>Modelo</button></div>', '<div aria-busy="true"></div>', '<div contenteditable="true"></div>']) {
    document.body.innerHTML = markup;
    expect(guard.isSafe()).toBe(false);
    await vi.advanceTimersByTimeAsync(200); expect(safe).not.toHaveBeenCalled();
  }
  document.body.innerHTML = '<input value="Original">';
  fireEvent.input(document.querySelector('input')!, { target: { value: 'Borrador' } });
  expect(guard.isSafe()).toBe(false);
  await vi.advanceTimersByTimeAsync(200); expect(safe).not.toHaveBeenCalled();
  document.body.innerHTML = '<main>Guardado</main>';
  await vi.advanceTimersByTimeAsync(200); expect(guard.isSafe()).toBe(true); expect(safe).toHaveBeenCalledOnce();
  guard.dispose();
  document.body.innerHTML = ''; await vi.advanceTimersByTimeAsync(200); expect(safe).toHaveBeenCalledOnce();
});

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body });

it('reads a build id with no-store and ignores failures', async () => {
  const fetchImpl = vi.fn(async () => jsonResponse({ buildId: 'abc' }));
  expect(await readRemoteBuildId(fetchImpl as unknown as typeof fetch)).toBe('abc');
  expect(fetchImpl).toHaveBeenCalledWith('/version.json', expect.objectContaining({ cache: 'no-store' }));
  expect(await readRemoteBuildId(vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBeNull();
  expect(await readRemoteBuildId(vi.fn(async () => jsonResponse({}, false)) as unknown as typeof fetch)).toBeNull();
  expect(appBuildId()).toBe('dev');
});

it('reports a new build on focus, visibility and the interval, once', async () => {
  vi.useFakeTimers();
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ buildId: 'local' }))
    .mockResolvedValueOnce(jsonResponse({ buildId: 'remote' }))
    .mockResolvedValue(jsonResponse({ buildId: 'remote' }));
  const update = vi.fn();
  const registration = new EventTarget();
  const worker = { getRegistration: vi.fn(async () => registration) };
  const stop = watchVersionUpdates('local', update, {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    intervalMs: 180_000,
    worker: worker as unknown as ServiceWorkerContainer,
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(update).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('focus'));
  await vi.advanceTimersByTimeAsync(0);
  expect(update).toHaveBeenCalledExactlyOnceWith('remote');
  document.dispatchEvent(new Event('visibilitychange'));
  registration.dispatchEvent(new Event('updatefound'));
  await vi.advanceTimersByTimeAsync(180_000);
  expect(update).toHaveBeenCalledOnce();
  stop();
  window.dispatchEvent(new Event('focus'));
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(5);
});

it('skips version checks while the tab is hidden', async () => {
  vi.useFakeTimers();
  const fetchImpl = vi.fn(async () => jsonResponse({ buildId: 'remote' }));
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const update = vi.fn();
  const stop = watchVersionUpdates('local', update, { fetchImpl: fetchImpl as unknown as typeof fetch, intervalMs: 180_000 });
  await vi.advanceTimersByTimeAsync(180_000);
  expect(fetchImpl).not.toHaveBeenCalled();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(0);
  expect(update).toHaveBeenCalledExactlyOnceWith('remote');
  stop();
});
