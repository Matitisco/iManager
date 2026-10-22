export const INSTALL_DISMISSED_KEY = 'imanager:install-dismissed';
export const INSTALL_DISMISSED_KEYS = {
  ios: 'imanager:install-dismissed:ios',
  android: 'imanager:install-dismissed:android',
} as const;
export const INSTALL_DELAY_MS = 30_000;
export const INSTALL_PREFERENCE_KEY = 'imanager:install-preference:v2';
export const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export interface InstallPreference {
  version: 2;
  dismissedForever: boolean;
  snoozedUntil: number | null;
}
const emptyPreference = (): InstallPreference => ({ version: 2, dismissedForever: false, snoozedUntil: null });

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isAppInstalled() { return installed || isStandalone(); }

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isAndroid() { return /Android/i.test(navigator.userAgent); }

export function isIOSSafari() {
  return isIOS() && /Safari/.test(navigator.userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(navigator.userAgent);
}

let memoryPreference = emptyPreference();
let memoryOnly = false;
let pendingPrompt: InstallPromptEvent | null = null;
let initialized = false;
let installed = false;
let prompting = false;
let accepted = false;
let expiryTimer: number | undefined;
const listeners = new Set<() => void>();
const legacyKeys = [INSTALL_DISMISSED_KEY, ...Object.values(INSTALL_DISMISSED_KEYS)];

export function getInstallPreference(): InstallPreference {
  if (memoryOnly) return memoryPreference;
  try {
    const raw = localStorage.getItem(INSTALL_PREFERENCE_KEY);
    if (raw) {
      try {
        const value = JSON.parse(raw) as Partial<InstallPreference>;
        if (value?.version === 2 && typeof value.dismissedForever === 'boolean'
          && (value.snoozedUntil === null || typeof value.snoozedUntil === 'number' && Number.isFinite(value.snoozedUntil) && value.snoozedUntil >= 0)) {
          memoryPreference = value as InstallPreference;
          return memoryPreference;
        }
      } catch { /* Recover a corrupt preference from historical flags, if present. */ }
    }
    if (legacyKeys.some((key) => localStorage.getItem(key) === 'yes')) {
      memoryPreference = { version: 2, dismissedForever: true, snoozedUntil: null };
      // Do not remove historical choices unless their replacement is durable.
      try { localStorage.setItem(INSTALL_PREFERENCE_KEY, JSON.stringify(memoryPreference)); }
      catch { memoryOnly = true; return memoryPreference; }
      for (const key of legacyKeys) {
        try { localStorage.removeItem(key); } catch { /* The v2 choice is already durable. */ }
      }
      return memoryPreference;
    }
    memoryPreference = emptyPreference();
  } catch { /* Use the last known preference when storage cannot be read. */ }
  return memoryPreference;
}

export function installDismissedForever() { return getInstallPreference().dismissedForever; }
export function installRequestAccepted() { return accepted; }
export function installDismissed() {
  const preference = getInstallPreference();
  return preference.dismissedForever || (preference.snoozedUntil ?? 0) > Date.now();
}

function scheduleExpiry() {
  window.clearTimeout(expiryTimer);
  expiryTimer = undefined;
  if (!listeners.size) return;
  const remaining = (getInstallPreference().snoozedUntil ?? 0) - Date.now();
  if (remaining > 0) expiryTimer = window.setTimeout(changed, Math.min(remaining, 2_147_483_647));
}
function changed() {
  scheduleExpiry();
  listeners.forEach((listener) => listener());
}
function savePreference(preference: InstallPreference) {
  memoryPreference = preference;
  try {
    localStorage.setItem(INSTALL_PREFERENCE_KEY, JSON.stringify(preference));
    memoryOnly = false;
  } catch { memoryOnly = true; }
  changed();
}
export function dismissInstall() {
  savePreference({ version: 2, dismissedForever: true, snoozedUntil: null });
}
export function snoozeInstall() {
  if (installDismissedForever()) return;
  savePreference({ version: 2, dismissedForever: false, snoozedUntil: Date.now() + INSTALL_SNOOZE_MS });
}

/** Browser events are single-use; acceptance alone does not prove installation. */
export async function requestInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!pendingPrompt || prompting) return 'unavailable';
  const event = pendingPrompt;
  pendingPrompt = null;
  prompting = true;
  try {
    // Keep this call in the user's gesture, before notifying React subscribers.
    const opening = event.prompt();
    changed();
    await opening;
    const { outcome } = await event.userChoice;
    if (outcome === 'dismissed') snoozeInstall();
    else { accepted = true; changed(); }
    return outcome;
  } finally { prompting = false; changed(); }
}

export function getInstallPrompt() { return pendingPrompt; }
export function clearInstallPrompt() { pendingPrompt = null; changed(); }
export function subscribeInstall(listener: () => void) {
  initializeInstallEvents();
  listeners.add(listener);
  scheduleExpiry();
  return () => { listeners.delete(listener); scheduleExpiry(); };
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
    installed = true;
    pendingPrompt = null;
    changed();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', changed);
  document.addEventListener('visibilitychange', changed);
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === INSTALL_PREFERENCE_KEY || legacyKeys.some((key) => key === event.key)) {
      memoryOnly = false;
      changed();
    }
  });
}

export function registerServiceWorker() {
  if (import.meta.env.MODE !== 'production' || !('serviceWorker' in navigator)) return;
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
