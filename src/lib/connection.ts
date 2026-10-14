import { getBackendBaseUrl } from '../services/backend-session';
import { markOffline, markOnline } from './online';

/**
 * true: the API answered. false: the network failed. null: no probe
 * (no API base, or the server answered with an error).
 * Chrome DevTools "Offline" keeps navigator.onLine true and does not fire
 * `offline`. A cached GET /api/health would also look successful, so the
 * probe uses a unique URL and cache: 'no-store'. The service worker never
 * handles /api/ or cross-origin requests.
 */
export async function pingHealth(): Promise<boolean | null> {
  const base = getBackendBaseUrl();
  if (!base) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return null;
  }
  try {
    const response = await fetch(`${base}/api/health?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (response.ok) {
      markOnline();
      return true;
    }
    return null;
  } catch {
    markOffline();
    return false;
  }
}
