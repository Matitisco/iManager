import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getGettingStarted, updateGettingStarted } from '../services/getting-started-api';
import { useGettingStartedState } from './getting-started-state';
import { FirstStepsHelp, FirstStepsIsland } from '../desk/first-steps-island';

const context = vi.hoisted(() => ({
  user: { uid: 'u', email: null, displayName: null, getIdToken: async () => 'test' }, inventory: [], sales: [],
  appSession: { user: { id: 'u' }, store: { id: 's' }, membership: { role: 'OWNER' } },
}));
vi.mock('../services/getting-started-api', () => ({ getGettingStarted: vi.fn(), updateGettingStarted: vi.fn() }));
vi.mock('./AppContext', () => ({ useAppContext: () => ({ ...context, ...useGettingStartedState(context.user, context.appSession.store.id) }) }));
vi.mock('../desk/ui', () => ({ useDesk: () => ({ open: vi.fn() }) }));
beforeEach(() => { vi.mocked(getGettingStarted).mockReset(); vi.mocked(updateGettingStarted).mockReset(); });
afterEach(() => vi.restoreAllMocks());

it.each([{ name: 'Dashboard', Component: FirstStepsIsland }, { name: 'Ayuda', Component: FirstStepsHelp }])('hides failed progress loads in $name and logs the cause', async ({ Component }) => {
  const cause = new Error('No se pudieron cargar tus primeros pasos.');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.mocked(getGettingStarted).mockRejectedValue(cause);
  const view = render(<Component />);
  await waitFor(() => expect(warn).toHaveBeenCalledWith('No se pudieron cargar tus primeros pasos.', cause));
  expect(view.container).toBeEmptyDOMElement();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
  expect(document.querySelector('.ferr')).not.toBeInTheDocument();
});

it('keeps known progress on failed refresh and propagates save errors', async () => {
  const progress = { eligible: true, storeNamed: true };
  vi.mocked(getGettingStarted).mockResolvedValue(progress as Awaited<ReturnType<typeof getGettingStarted>>);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { result } = renderHook(() => useGettingStartedState(context.user, 's'));
  await waitFor(() => expect(result.current.gettingStarted).toEqual(progress));
  const cause = new Error('No se pudieron cargar tus primeros pasos.');
  vi.mocked(getGettingStarted).mockRejectedValue(cause);
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(warn).toHaveBeenCalledWith('No se pudieron cargar tus primeros pasos.', cause);
  expect(result.current.gettingStarted).toEqual(progress);
  vi.mocked(updateGettingStarted).mockRejectedValue(new Error('No se pudo guardar'));
  await expect(result.current.updateGettingStarted({ installed: true })).rejects.toThrow('No se pudo guardar');
});

it('keeps a manual installation save error visible in Help', async () => {
  vi.mocked(getGettingStarted).mockResolvedValue({ eligible: true, storeNamed: true, steps: { store: true } } as Awaited<ReturnType<typeof getGettingStarted>>);
  vi.mocked(updateGettingStarted).mockRejectedValue(new Error('No se pudo guardar'));
  render(<FirstStepsHelp />);
  fireEvent.click(await screen.findByText('Instalá la app'));
  fireEvent.click(screen.getByRole('button', { name: 'Ya la instalé' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
});

it('expone la resolución inicial incluso con error y la reinicia por tienda', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.mocked(getGettingStarted).mockRejectedValue(new Error('offline'));
  const { result, rerender } = renderHook(({ storeId }) => useGettingStartedState(context.user, storeId), { initialProps: { storeId: 's' } });
  expect(result.current.gettingStartedLoaded).toBe(false);
  await waitFor(() => expect(result.current.gettingStartedLoaded).toBe(true));
  expect(result.current.gettingStarted).toBeNull();
  vi.mocked(getGettingStarted).mockReturnValue(new Promise(() => {}));
  rerender({ storeId: 'other' });
  expect(result.current.gettingStartedLoaded).toBe(false);
  expect(result.current.gettingStarted).toBeNull();
  expect(warn).toHaveBeenCalled();
});

it('un guardado confirmado también resuelve el progreso inicial y descarta su lectura anterior', async () => {
  let resolveRead!: (value: Awaited<ReturnType<typeof getGettingStarted>>) => void;
  vi.mocked(getGettingStarted).mockReturnValue(new Promise(resolve => { resolveRead = resolve; }));
  const progress = { eligible: true, storeNamed: true } as Awaited<ReturnType<typeof getGettingStarted>>;
  vi.mocked(updateGettingStarted).mockResolvedValue(progress);
  const { result } = renderHook(() => useGettingStartedState(context.user, 's'));
  expect(result.current.gettingStartedLoaded).toBe(false);
  await act(async () => { await result.current.updateGettingStarted({ visible: true }); });
  expect(result.current.gettingStartedLoaded).toBe(true);
  await act(async () => resolveRead({ ...progress, eligible: false }));
  expect(result.current.gettingStarted).toEqual(progress);
});

it('retains progress identity and does not reload for a new object with the same uid', async () => {
  const progress = { eligible: true, storeNamed: true } as Awaited<ReturnType<typeof getGettingStarted>>;
  vi.mocked(getGettingStarted).mockImplementation(async () => ({ ...progress }));
  const { result, rerender } = renderHook(({ user }) => useGettingStartedState(user, 's'), { initialProps: { user: context.user } });
  await waitFor(() => expect(result.current.gettingStartedLoaded).toBe(true));
  const before = result.current.gettingStarted;
  rerender({ user: { ...context.user } });
  expect(getGettingStarted).toHaveBeenCalledTimes(1);
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(getGettingStarted).toHaveBeenCalledTimes(2);
  expect(result.current.gettingStarted).toBe(before);
  expect(result.current.gettingStartedLoaded).toBe(true);
});
