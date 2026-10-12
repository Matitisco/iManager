import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { watchControllerUpdates, watchUpdateSafety } from './pwa-update';

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
