import { getBackendBaseUrl } from '../services/backend-session';
import { markOffline, markOnline } from './online';

/** Confirms the API is reachable even when the phone never fires `online`. */
export async function pingHealth(): Promise<boolean> {
  const base = getBackendBaseUrl();
  if (!base) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    markOnline();
    return true;
  }
  try {
    const response = await fetch(`${base}/api/health`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (response.ok) {
      markOnline();
      return true;
    }
    return false;
  } catch {
    markOffline();
    return false;
  }
}
