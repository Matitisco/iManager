import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PwaUpdate } from './PwaUpdate';

const watcher = vi.hoisted(() => ({ update: () => {}, safe: false }));
vi.mock('../lib/pwa-update', () => ({
  watchControllerUpdates: (_worker: unknown, update: () => void) => { watcher.update = update; return vi.fn(); },
  watchUpdateSafety: () => ({ isSafe: () => watcher.safe, dispose: vi.fn() }),
}));
afterEach(() => vi.unstubAllGlobals());
it('shows a non-blocking update action and preserves unsaved form input even on explicit click', () => {
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: new EventTarget() });
  render(<><form><input aria-label="Cliente" defaultValue="Borrador sin guardar" /></form><PwaUpdate /></>);
  act(() => watcher.update());
  expect(screen.getByRole('status')).toHaveTextContent('Nueva versión disponible · Actualizar');
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  expect(screen.getByRole('status')).toHaveTextContent('Guardá o cerrá el formulario');
  expect(screen.getByLabelText('Cliente')).toHaveValue('Borrador sin guardar');
  expect(screen.queryByRole('dialog')).toBeNull();
});
