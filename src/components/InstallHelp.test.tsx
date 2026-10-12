import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type * as PWA from '../lib/pwa';

let pwa: typeof PWA;
let InstallCard: typeof import('./InstallHelp').InstallCard;
let phone = true;
let standalone = false;
const originalMedia = window.matchMedia;
beforeEach(async () => {
  vi.resetModules(); phone = true; standalone = false;
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130');
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
  window.matchMedia = vi.fn((query: string) => ({ matches: query.includes('760') ? phone : standalone, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList));
  pwa = await import('../lib/pwa');
  ({ InstallCard } = await import('./InstallHelp'));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.matchMedia = originalMedia; });
const native = (prompt = vi.fn().mockResolvedValue(undefined)) => {
  pwa.initializeInstallEvents();
  act(() => window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) })));
  return prompt;
};

it('opens Android first despite banner dismissal and expands the alternate four steps', () => {
  pwa.dismissInstall();
  render(<InstallCard />);
  const install = screen.getByRole('button', { name: 'Instalar' });
  install.focus(); fireEvent.click(install);
  const sheet = screen.getByRole('dialog', { name: 'Instalá iManager' });
  expect(within(sheet).getByText('Tu celular')).toBeVisible();
  expect(within(sheet).getByRole('region', { name: 'Pasos para Android' })).toBeVisible();
  expect(within(sheet).getAllByRole('listitem')).toHaveLength(7);
  const alternate = within(sheet).getByRole('button', { name: /¿Usás iPhone/ });
  expect(alternate).toHaveAttribute('aria-expanded', 'false');
  expect(within(sheet).queryByText('Abrí la app en Safari')).toBeNull();
  fireEvent.click(alternate);
  expect(within(sheet).getByText('Abrí la app en Safari')).toBeVisible();
  expect(alternate).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(alternate);
  expect(within(sheet).queryByText('Abrí la app en Safari')).toBeNull();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(install).toHaveFocus();
  expect(pwa.installDismissed()).toBe(true);
});
it('shows Safari-only instructions first on iPhone even in Chrome', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone CriOS/130 Safari/604');
  render(<InstallCard />); fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
  expect(screen.getByText(/Tiene que ser Safari/)).toBeVisible();
  expect(screen.getByText('Tocá Compartir')).toBeVisible();
  expect(screen.getByText('Elegí «Agregar a inicio»')).toBeVisible();
  expect(screen.getByText('Tocá «Agregar»')).toBeVisible();
  expect(screen.getByRole('button', { name: /¿Usás Android/ })).toHaveAttribute('aria-expanded', 'false');
});
it('consumes a native event only on tap without opening help', async () => {
  const prompt = native(); render(<InstallCard />);
  expect(prompt).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Instalar' })));
  expect(prompt).toHaveBeenCalledOnce(); expect(pwa.getInstallPrompt()).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
  expect(screen.getByRole('dialog')).toBeVisible();
});
it('blocks duplicate native prompts while the browser choice is pending', async () => {
  let finish!: () => void;
  const prompt = native(vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })));
  render(<InstallCard />); fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
  expect(screen.getByRole('button', { name: 'Abriendo…' })).toBeDisabled();
  expect(await pwa.requestInstall()).toBe(false);
  await act(async () => finish()); expect(prompt).toHaveBeenCalledOnce();
});
it('falls back to instructions with a visible error when the native prompt fails', async () => {
  native(vi.fn().mockRejectedValue(new Error('unavailable'))); render(<InstallCard />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Instalar' })));
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo abrir');
  expect(screen.getByRole('dialog')).toBeVisible();
});
it('contains focus, makes the background inert and restores it after backdrop close', () => {
  const view = render(<InstallCard />);
  fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
  expect(view.container.inert).toBe(true);
  const close = screen.getByRole('button', { name: 'Cerrar ayuda de instalación' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: /¿Usás iPhone/ })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' }); expect(close).toHaveFocus();
  fireEvent.click(screen.getByRole('dialog').parentElement!);
  expect(screen.queryByRole('dialog')).toBeNull(); expect(view.container.inert).toBeFalsy();
});
it('hides the card on desktop and standalone and after appinstalled', () => {
  phone = false; const view = render(<InstallCard />); expect(screen.queryByTestId('install-card')).toBeNull();
  view.unmount(); phone = true; standalone = true;
  const second = render(<InstallCard />); expect(screen.queryByTestId('install-card')).toBeNull();
  second.unmount(); standalone = false; pwa.initializeInstallEvents();
  render(<InstallCard />); expect(screen.getByTestId('install-card')).toBeVisible();
  act(() => window.dispatchEvent(new Event('appinstalled')));
  expect(screen.queryByTestId('install-card')).toBeNull();
});
