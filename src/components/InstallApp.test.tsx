import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type * as PWA from '../lib/pwa';
const SAFARI = 'iPhone Version/18.0 Mobile Safari/604';
let pwa: typeof PWA;
let InstallApp: typeof import('./InstallApp').InstallApp;
let phone = true;
let standalone = false;
const originalMedia = window.matchMedia;
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); phone = true; standalone = false;
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(SAFARI);
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  window.matchMedia = vi.fn((query: string) => ({ matches: query.includes('760') ? phone : standalone, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList));
  pwa = await import('../lib/pwa'); ({ InstallApp } = await import('./InstallApp'));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); window.matchMedia = originalMedia; });
const elapsed = (ms = 30_000) => act(() => vi.advanceTimersByTime(ms));
const native = (outcome = 'accepted') => {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome }) });
  act(() => window.dispatchEvent(event)); return event;
};
it('waits 30 continuous eligible seconds and illustrates Safari controls', () => {
  const view = render(<InstallApp enabled={false} />); elapsed(); expect(screen.queryByTestId('install-app')).toBeNull();
  view.rerender(<InstallApp />); elapsed(29_999); expect(screen.queryByTestId('install-app')).toBeNull();
  elapsed(1); expect(screen.getByTestId('install-app')).toHaveTextContent('Compartir'); expect(screen.getByTestId('install-app')).toHaveTextContent('Agregar a inicio');
  expect(screen.getByRole('button', { name: 'Ahora no' })).toBeVisible(); expect(screen.getByRole('button', { name: 'No volver a mostrar' })).toBeVisible();
});
it('snoozes for seven days then starts a new 30-second wait without reload', () => {
  render(<InstallApp />); elapsed(); fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
  expect(screen.getByRole('status')).toHaveTextContent('Más › Instalar app'); expect(screen.queryByTestId('install-app')).toBeNull();
  elapsed(pwa.INSTALL_SNOOZE_MS - 1); expect(screen.queryByTestId('install-app')).toBeNull();
  elapsed(1); elapsed(29_999); expect(screen.queryByTestId('install-app')).toBeNull(); elapsed(1); expect(screen.getByTestId('install-app')).toBeVisible();
});
it('permanent dismissal survives remount and confirms only Ayuda', () => {
  const view = render(<InstallApp />); elapsed(); fireEvent.click(screen.getByRole('button', { name: 'No volver a mostrar' }));
  expect(screen.getByRole('status')).toHaveTextContent('Ayuda'); expect(screen.getByRole('status')).not.toHaveTextContent('Más');
  view.unmount(); render(<InstallApp />); elapsed(); expect(screen.queryByTestId('install-app')).toBeNull();
});
for (const browser of [SAFARI, 'Android Chrome/130', 'Android Firefox/130', 'iPhone CriOS/130 Safari/604']) {
  it(`is Dashboard-exclusive and removes immediately on navigation in ${browser}`, () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(browser);
    const view = render(<InstallApp dashboard={false} />); elapsed(); expect(screen.queryByTestId('install-app')).toBeNull();
    view.rerender(<InstallApp dashboard />); elapsed(); expect(screen.getByTestId('install-app')).toBeVisible();
    view.rerender(<InstallApp dashboard={false} />); expect(screen.queryByTestId('install-app')).toBeNull();
    view.rerender(<InstallApp dashboard />); elapsed(29_999); expect(screen.queryByTestId('install-app')).toBeNull(); elapsed(1); expect(screen.getByTestId('install-app')).toBeVisible();
  });
}
it('directs other iOS browsers to Safari', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone CriOS/130 Safari/604'); render(<InstallApp />); elapsed();
  expect(screen.getByTestId('install-app')).toHaveTextContent('Abrí iManager en Safari');
});
it('shows white manual Android steps, updating the same banner when prompt arrives late', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130'); render(<InstallApp />); elapsed();
  const banner = screen.getByTestId('install-app'); expect(banner).toHaveTextContent('Agregar a pantalla principal');
  expect(screen.queryByRole('button', { name: 'Instalar app' })).toBeNull(); const event = native();
  expect(screen.getByTestId('install-app')).toBe(banner); expect(screen.getByRole('button', { name: 'Instalar app' })).toBeVisible(); expect(event.prompt).not.toHaveBeenCalled();
});
it('captures a prompt before mount and consumes only on click without claiming installation', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130'); pwa.initializeInstallEvents(); const event = native(); render(<InstallApp />); elapsed();
  expect(event.defaultPrevented).toBe(true); expect(event.prompt).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Instalar app' })));
  expect(event.prompt).toHaveBeenCalledOnce(); expect(screen.queryByTestId('install-app')).toBeNull(); expect(pwa.isAppInstalled()).toBe(false);
});
it('snoozes native dismissal instead of making it permanent', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130'); render(<InstallApp />); native('dismissed'); elapsed();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Instalar app' })));
  expect(screen.getByRole('status')).toHaveTextContent('más adelante'); expect(pwa.installDismissedForever()).toBe(false);
});
it('shows manual instructions and an error after a failed native prompt', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130'); render(<InstallApp />); const event = native(); event.prompt.mockRejectedValueOnce(Error('unavailable')); elapsed();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Instalar app' })));
  expect(screen.getByRole('alert')).toHaveTextContent('menú de tu navegador'); expect(screen.getByTestId('install-app')).toHaveTextContent('Agregar a pantalla principal');
});
it('removes immediately on global overlay and resets the delay', () => {
  const view = render(<InstallApp />); elapsed(); view.rerender(<InstallApp enabled={false} />); expect(screen.queryByTestId('install-app')).toBeNull();
  view.rerender(<InstallApp />); elapsed(29_999); expect(screen.queryByTestId('install-app')).toBeNull(); elapsed(1); expect(screen.getByTestId('install-app')).toBeVisible();
});
it('removes for a hidden tab and restarts after returning', () => {
  render(<InstallApp />); elapsed(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); fireEvent(document, new Event('visibilitychange'));
  expect(screen.queryByTestId('install-app')).toBeNull(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); fireEvent(document, new Event('visibilitychange'));
  elapsed(29_999); expect(screen.queryByTestId('install-app')).toBeNull(); elapsed(1); expect(screen.getByTestId('install-app')).toBeVisible();
});
for (const mode of ['desktop', 'narrow desktop', 'standalone', 'ios standalone', 'appinstalled']) {
  it(`suppresses installation in ${mode}`, () => {
    if (mode === 'desktop') phone = false;
    if (mode === 'narrow desktop') vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Windows Chrome/130');
    if (mode === 'standalone') standalone = true;
    if (mode === 'ios standalone') Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    render(<InstallApp />); if (mode === 'appinstalled') act(() => window.dispatchEvent(new Event('appinstalled'))); elapsed(); expect(screen.queryByTestId('install-app')).toBeNull();
  });
}
