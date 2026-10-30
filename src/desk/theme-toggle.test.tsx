import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializeTheme, setThemePreference, THEME_KEY } from '../lib/theme';
import { ThemeToggle } from './theme-toggle';

let dark = false;
let systemChange: () => void;
let dispose: () => void;

beforeEach(() => {
  dark = false;
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
    get matches() { return dark; },
    addEventListener: (_: string, callback: () => void) => { systemChange = callback; },
    removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  dispose = initializeTheme();
});

afterEach(() => {
  dispose();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
});

it('cambia y persiste ambos temas desde los botones accesibles', async () => {
  const user = userEvent.setup();
  render(<ThemeToggle />);
  expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
  const light = screen.getByRole('button', { name: 'Tema claro' });
  const moon = screen.getByRole('button', { name: 'Tema oscuro' });
  expect(light).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: 'Automático' })).not.toBeInTheDocument();
  await user.click(moon);
  expect(moon).toHaveAttribute('aria-pressed', 'true');
  expect(light).toHaveAttribute('aria-pressed', 'false');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('imanager-theme')).toBe('dark');
  await user.click(light);
  expect(light).toHaveAttribute('aria-pressed', 'true');
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.getItem(THEME_KEY)).toBe('light');
});

it('refleja el sistema en Automático y permite fijar el tema resuelto con teclado', async () => {
  const user = userEvent.setup();
  dark = true;
  act(() => systemChange());
  render(<ThemeToggle />);
  const light = screen.getByRole('button', { name: 'Tema claro' });
  expect(screen.getByRole('button', { name: 'Tema oscuro' })).toHaveAttribute('aria-pressed', 'true');
  dark = false;
  act(() => systemChange());
  expect(light).toHaveAttribute('aria-pressed', 'true');
  expect(localStorage.getItem(THEME_KEY)).toBeNull();
  await user.tab();
  await user.keyboard('{Enter}');
  expect(localStorage.getItem(THEME_KEY)).toBe('light');
  dark = true;
  act(() => systemChange());
  expect(light).toHaveAttribute('aria-pressed', 'true');
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('sincroniza instancias y cambios de Configuración u otra pestaña', () => {
  render(<><ThemeToggle /><ThemeToggle /></>);
  act(() => setThemePreference('dark'));
  for (const button of screen.getAllByRole('button', { name: 'Tema oscuro' })) {
    expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  act(() => {
    localStorage.setItem(THEME_KEY, 'light');
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY }));
  });
  for (const button of screen.getAllByRole('button', { name: 'Tema claro' })) {
    expect(button).toHaveAttribute('aria-pressed', 'true');
  }
});
