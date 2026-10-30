import { useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'auto';
export const THEME_KEY = 'imanager-theme';
export const THEME_COLORS = { light: '#FFD000', dark: '#1B1A18' } as const;
const SYSTEM_THEME = '(prefers-color-scheme: dark)';

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'auto';
}

export function readThemePreference(): ThemePreference {
  try { return parseThemePreference(localStorage.getItem(THEME_KEY)); }
  catch { return 'auto'; }
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  return preference === 'auto' ? (systemDark ? 'dark' : 'light') : preference;
}

let preference = readThemePreference();
const listeners = new Set<() => void>();

function systemDark() {
  return typeof window.matchMedia === 'function' && window.matchMedia(SYSTEM_THEME).matches;
}

export function applyTheme(value: ThemePreference, dark = systemDark()) {
  const theme = resolveTheme(value, dark);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

function update(value: ThemePreference) {
  preference = value;
  applyTheme(value);
  listeners.forEach(listener => listener());
}

export function setThemePreference(value: ThemePreference) {
  // A blocked/full storage must not prevent changing the theme for this session.
  try { localStorage.setItem(THEME_KEY, value); } catch { /* Session preference still applies. */ }
  update(value);
}

export function initializeTheme() {
  update(readThemePreference());
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(SYSTEM_THEME) : null;
  const onSystem = () => {
    if (preference === 'auto') {
      applyTheme(preference, media?.matches);
      listeners.forEach(listener => listener());
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) update(readThemePreference());
  };
  media?.addEventListener('change', onSystem);
  window.addEventListener('storage', onStorage);
  return () => {
    media?.removeEventListener('change', onSystem);
    window.removeEventListener('storage', onStorage);
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useThemePreference() {
  return useSyncExternalStore(subscribe, () => preference, () => 'auto' as const);
}

export function useResolvedTheme() {
  return useSyncExternalStore(subscribe, () => {
    const theme = document.documentElement.dataset.theme;
    return theme === 'dark' || theme === 'light' ? theme : resolveTheme(preference, systemDark());
  }, () => 'light' as const);
}
