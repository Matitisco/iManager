export const INSTALL_DISMISSED_KEY = 'imanager:install-dismissed';
export const INSTALL_DISMISSED_KEYS = {
  ios: 'imanager:install-dismissed:ios',
  android: 'imanager:install-dismissed:android',
} as const;
export const INSTALL_DELAY_MS = 30_000;

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isIOSSafari() {
  return isIOS() && /Safari/.test(navigator.userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(navigator.userAgent);
}

const dismissed = new Set<'ios' | 'android'>();
let pendingPrompt: InstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

const installPlatform = () => isIOS() ? 'ios' : 'android';

export function installDismissed() {
  const platform = installPlatform();
  try {
    // The legacy guide flag belongs to iOS. Never suppress Android's native action.
    if (localStorage.getItem(INSTALL_DISMISSED_KEY) === 'yes') {
      localStorage.setItem(INSTALL_DISMISSED_KEYS.ios, 'yes');
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
    }
    return dismissed.has(platform) || localStorage.getItem(INSTALL_DISMISSED_KEYS[platform]) === 'yes';
  } catch { return dismissed.has(platform); }
}

export function dismissInstall() {
  const platform = installPlatform();
  dismissed.add(platform);
  try { localStorage.setItem(INSTALL_DISMISSED_KEYS[platform], 'yes'); } catch { /* Private storage may be unavailable. */ }
  changed();
}

export function getInstallPrompt() { return pendingPrompt; }
export function clearInstallPrompt() { pendingPrompt = null; changed(); }
export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function initializeInstallEvents() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    pendingPrompt = event as InstallPromptEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    pendingPrompt = null;
    dismissInstall();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', changed);
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === INSTALL_DISMISSED_KEY || Object.values(INSTALL_DISMISSED_KEYS).some((key) => key === event.key)) changed();
  });
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let registered = false;
  const register = () => {
    if (registered) return;
    registered = true;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        const update = () => { if (document.visibilityState === 'visible' && navigator.onLine) void registration.update().catch(() => {}); };
        document.addEventListener('visibilitychange', update);
        window.addEventListener('online', update);
        window.setInterval(update, 60_000);
      })
      .catch((error: unknown) => console.warn('No se pudo preparar iManager para instalar:', error));
  };
  if (document.readyState === 'complete') register();
  else {
    // Prefer waiting for load, but a slow third-party frame (e.g. Firebase auth) must not block installation.
    window.addEventListener('load', register, { once: true });
    window.setTimeout(register, 4_000);
  }
}
