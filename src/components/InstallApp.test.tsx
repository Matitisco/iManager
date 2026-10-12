import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as PWA from '../lib/pwa';

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
let pwa: typeof PWA;
let InstallApp: typeof import('./InstallApp').InstallApp;
let phone = true;
let standalone = false;
const originalMedia = window.matchMedia;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  phone = true; standalone = false;
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(SAFARI);
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes('760') ? phone : standalone, media: query,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  } as unknown as MediaQueryList));
  pwa = await import('../lib/pwa');
  ({ InstallApp } = await import('./InstallApp'));
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); window.matchMedia = originalMedia;
});
const elapsed = (ms = 30_000) => act(() => vi.advanceTimersByTime(ms));
const promptEvent = () => {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: 'accepted' }),
  });
  act(() => window.dispatchEvent(event));
  return event;
};

describe('mobile installation invitation', () => {
  it('waits until a resolved session is eligible and then illustrates Safari controls', () => {
    const view = render(<InstallApp enabled={false} />);
    elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
    view.rerender(<InstallApp enabled />);
    elapsed(29_999);
    expect(screen.queryByTestId('install-app')).toBeNull();
    elapsed(1);
    expect(screen.getByTestId('install-app')).toHaveTextContent('Compartir');
    expect(screen.getByTestId('install-app')).toHaveTextContent('Agregar a inicio');
    expect(screen.queryByRole('button', { name: 'Instalar app' })).toBeNull();
  });
  it('persists dismissal across remounts', () => {
    const view = render(<InstallApp />); elapsed();
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no, no volver a mostrar' }));
    expect(localStorage.getItem(pwa.INSTALL_DISMISSED_KEYS.ios)).toBe('yes');
    view.unmount(); render(<InstallApp />); elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
  });
  it('honors a dismissal from a previous visit', () => {
    localStorage.setItem(pwa.INSTALL_DISMISSED_KEY, 'yes');
    render(<InstallApp />); elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
  });
  it('suppresses the guide for desktop and standalone', () => {
    phone = false;
    const view = render(<InstallApp />); elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
    view.unmount(); phone = true; standalone = true;
    render(<InstallApp />); elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
  });
  it('recognizes the iOS standalone flag even without display-mode', () => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    render(<InstallApp />); elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
  });
  it('does not show the Safari guide in Chrome on iOS', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(SAFARI.replace('Version/18.0', 'CriOS/130.0'));
    render(<InstallApp />); elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
  });
  it('captures Android installability before React mounts and prompts only on click', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130');
    pwa.initializeInstallEvents();
    const event = promptEvent();
    expect(event.defaultPrevented).toBe(true);
    render(<InstallApp />); elapsed();
    expect(event.prompt).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Instalar app' })));
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(pwa.getInstallPrompt()).toBeNull();
    expect(screen.queryByTestId('install-app')).toBeNull();
  });
  it('removes the invitation when installation succeeds in the browser menu', () => {
    pwa.initializeInstallEvents();
    render(<InstallApp />); elapsed();
    act(() => window.dispatchEvent(new Event('appinstalled')));
    expect(screen.queryByTestId('install-app')).toBeNull();
  });
  it('shows an actionable error if the native prompt fails', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130');
    pwa.initializeInstallEvents();
    const event = promptEvent();
    event.prompt.mockRejectedValueOnce(new Error('unavailable'));
    render(<InstallApp />); elapsed();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Instalar app' })));
    expect(screen.getByRole('alert')).toHaveTextContent('menú de tu navegador');
    expect(screen.queryByRole('button', { name: 'Instalar app' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'No volver a mostrar la instalación' }));
    expect(screen.queryByTestId('install-app')).toBeNull();
  });
  it('resets the delay while a business overlay is open', () => {
    const view = render(<InstallApp />); elapsed(20_000);
    view.rerender(<InstallApp enabled={false} />); elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
    view.rerender(<InstallApp enabled />); elapsed(20_000);
    expect(screen.queryByTestId('install-app')).toBeNull();
    elapsed(10_000); expect(screen.getByTestId('install-app')).toBeVisible();
  });
  it('waits for a visible tab', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    render(<InstallApp />); elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange')); elapsed();
    expect(screen.getByTestId('install-app')).toBeVisible();
  });
  it('keeps dismissal in memory if localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const view = render(<InstallApp />); elapsed();
    fireEvent.click(screen.getByRole('button', { name: 'No volver a mostrar la instalación' }));
    view.unmount(); render(<InstallApp />); elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
  });
});

it('migrates the old guide dismissal only to iOS and keeps Android install available after closing its guide', () => {
  localStorage.setItem(pwa.INSTALL_DISMISSED_KEY, 'yes');
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130');
  pwa.initializeInstallEvents();
  const event = promptEvent();
  render(<InstallApp />); elapsed();
  expect(localStorage.getItem(pwa.INSTALL_DISMISSED_KEYS.ios)).toBe('yes');
  expect(localStorage.getItem(pwa.INSTALL_DISMISSED_KEY)).toBeNull();
  expect(localStorage.getItem(pwa.INSTALL_DISMISSED_KEYS.android)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Ahora no, no volver a mostrar' }));
  expect(localStorage.getItem(pwa.INSTALL_DISMISSED_KEYS.android)).toBe('yes');
  expect(screen.getByRole('button', { name: 'Instalar app' })).toBeVisible();
  expect(screen.queryByText('iManager en tu inicio')).toBeNull();
  expect(event.prompt).not.toHaveBeenCalled();
});
it('does not suppress the iOS guide when Android was dismissed', () => {
  localStorage.setItem(pwa.INSTALL_DISMISSED_KEYS.android, 'yes');
  render(<InstallApp />); elapsed();
  expect(screen.getByTestId('install-app')).toContainHTML('Compartir');
});

for (const browser of ['Android Chrome/130', 'Android Firefox/130']) {
  it(`shows a delayed manual dashboard card without a native prompt in ${browser}`, () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(browser);
    const view = render(<InstallApp />);
    elapsed(29_999); expect(screen.queryByTestId('install-app')).toBeNull();
    elapsed(1);
    expect(screen.getByTestId('install-app')).toHaveTextContent('Instalá iManager');
    expect(screen.getByTestId('install-app')).toHaveTextContent('Agregar a pantalla principal');
    expect(screen.queryByRole('button', { name: 'Instalar app' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'No volver a mostrar la instalación' }));
    view.unmount(); render(<InstallApp />); elapsed();
    expect(screen.queryByTestId('install-app')).toBeNull();
  });
}
it('does not invite manually outside Dashboard or on a desktop browser with a phone viewport', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130');
  const view = render(<InstallApp dashboard={false} />); elapsed();
  expect(screen.queryByTestId('install-app')).toBeNull();
  view.unmount(); vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Windows Chrome/130');
  render(<InstallApp />); elapsed(); expect(screen.queryByTestId('install-app')).toBeNull();
});
it('removes a visible manual invitation as soon as Dashboard is left', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130');
  const view = render(<InstallApp dashboard />); elapsed();
  expect(screen.getByTestId('install-app')).toBeVisible();
  view.rerender(<InstallApp dashboard={false} />);
  expect(screen.queryByTestId('install-app')).toBeNull();
  elapsed(); expect(screen.queryByTestId('install-app')).toBeNull();
  view.rerender(<InstallApp dashboard />);
  elapsed(29_999); expect(screen.queryByTestId('install-app')).toBeNull();
  elapsed(1); expect(screen.getByTestId('install-app')).toBeVisible();
});
it('switches from manual instructions to the installer when the deferred event arrives late', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130');
  pwa.initializeInstallEvents(); render(<InstallApp />); elapsed();
  expect(screen.getByTestId('install-app')).toHaveTextContent('Agregar a pantalla principal');
  promptEvent();
  expect(screen.getByRole('button', { name: 'Instalar app' })).toBeVisible();
  expect(screen.getByTestId('install-app')).not.toHaveTextContent('Agregar a pantalla principal');
});
