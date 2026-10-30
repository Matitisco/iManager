import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, initializeTheme, parseThemePreference, readThemePreference, resolveTheme, setThemePreference, THEME_COLORS, THEME_KEY } from './theme';

let dark = false;
let change: (() => void) | undefined;
let dispose: (() => void) | undefined;

beforeEach(() => {
  dark = false;
  change = undefined;
  document.head.innerHTML = '<meta name="theme-color" content="#FFD000">';
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
    get matches() { return dark; },
    addEventListener: (_: string, fn: () => void) => { change = fn; },
    removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
});

afterEach(() => { dispose?.(); vi.restoreAllMocks(); document.documentElement.removeAttribute('data-theme'); document.documentElement.style.colorScheme = ''; });

describe('tema del dispositivo', () => {
  it('resuelve preferencias válidas, ausentes y corruptas', () => {
    expect(parseThemePreference(null)).toBe('auto');
    expect(parseThemePreference('unknown')).toBe('auto');
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('persiste y aplica el atributo, color-scheme y meta del navegador', () => {
    setThemePreference('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(readThemePreference()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta')?.content).toBe(THEME_COLORS.dark);
    applyTheme('light');
    expect(document.querySelector('meta')?.content).toBe(THEME_COLORS.light);
  });

  it('sigue al sistema solo en automático y sincroniza otras pestañas', () => {
    dispose = initializeTheme();
    dark = true; change?.();
    expect(document.documentElement.dataset.theme).toBe('dark');
    setThemePreference('light');
    change?.();
    expect(document.documentElement.dataset.theme).toBe('light');
    localStorage.setItem(THEME_KEY, 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    dark = false; change?.();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('permite cambiar si localStorage está bloqueado', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readThemePreference()).toBe('auto');
    expect(() => setThemePreference('dark')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it.each([
    ['dark', false, 'dark'], ['light', true, 'light'], [null, true, 'dark'], ['invalid', false, 'light'],
  ] as const)('el bootstrap previo al render coincide con runtime (%s)', (stored, system, expected) => {
    if (stored !== null) localStorage.setItem(THEME_KEY, stored);
    dark = system;
    const html = readFileSync('index.html', 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
    expect(html.indexOf(script)).toBeLessThan(html.indexOf('<body>'));
    window.eval(script);
    expect(document.documentElement.dataset.theme).toBe(expected);
    expect(document.querySelector('meta')?.content).toBe(THEME_COLORS[expected]);
    dispose = initializeTheme();
    expect(document.documentElement.dataset.theme).toBe(expected);
  });

  it('el bootstrap soporta storage bloqueado y navegador sin matchMedia', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.stubGlobal('matchMedia', undefined);
    const script = readFileSync('index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)![1];
    expect(() => window.eval(script)).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('light');
    vi.unstubAllGlobals();
  });
});
