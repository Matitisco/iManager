import { act, cleanup, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { hasInstallBlocker, subscribeInstallBlockers } from './install-visibility';
import type { InstallApp as InstallAppType } from '../components/InstallApp';
let InstallApp: typeof InstallAppType;
const originalMedia = window.matchMedia;
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari/604');
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  window.matchMedia = vi.fn((query: string) => ({ matches: query.includes('760'), addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList));
  ({ InstallApp } = await import('../components/InstallApp'));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); window.matchMedia = originalMedia; });
const elapsed = (ms = 30_000) => act(() => vi.advanceTimersByTime(ms));
for (const kind of ['form', 'dialog', 'overlay']) {
  it(`blocks a local ${kind} before and after appearance and restarts the delay`, async () => {
    const fixture = (open: boolean) => <><InstallApp />{open && (kind === 'form' ? <form><input /></form> : kind === 'dialog' ? <div role="dialog">Modal</div> : <div className="ov">Sheet</div>)}</>;
    const view = render(fixture(true)); elapsed(); expect(screen.queryByTestId('install-app')).toBeNull();
    await act(async () => view.rerender(fixture(false))); elapsed(29_999); expect(screen.queryByTestId('install-app')).toBeNull(); elapsed(1); expect(screen.getByTestId('install-app')).toBeVisible();
    await act(async () => view.rerender(fixture(true))); expect(screen.queryByTestId('install-app')).toBeNull();
    await act(async () => view.rerender(fixture(false))); elapsed(29_999); expect(screen.queryByTestId('install-app')).toBeNull(); elapsed(1); expect(screen.getByTestId('install-app')).toBeVisible();
  });
}
it('ignores hidden forms including ancestors and reacts to revealing them', async () => {
  const view = render(<><InstallApp /><div hidden><form /></div><div style={{ display: 'none' }}><div role="dialog" /></div><div aria-hidden="true"><div className="ov" /></div><div style={{ visibility: 'hidden' }}><form /></div></>);
  elapsed(); expect(screen.getByTestId('install-app')).toBeVisible();
  await act(async () => view.container.querySelector('[hidden]')!.removeAttribute('hidden'));
  expect(screen.queryByTestId('install-app')).toBeNull();
});
it('disconnects subscriptions and leaves no observer after unmount', async () => {
  const changed = vi.fn(); const stop = subscribeInstallBlockers(changed); stop();
  const node = document.createElement('form');
  await act(async () => document.body.append(node)); expect(changed).not.toHaveBeenCalled(); expect(hasInstallBlocker()).toBe(true); node.remove();
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const view = render(<InstallApp />); view.unmount(); expect(disconnect).toHaveBeenCalled();
});
