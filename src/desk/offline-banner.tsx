import { useEffect, type ReactNode } from 'react';
import { pingHealth } from '../lib/connection';
import { isNetworkErrorMessage } from '../lib/user-message';

export function suppressLocalNetworkBanner(message: string | null | undefined) {
  return isNetworkErrorMessage(message);
}

export function OfflineScope({ children }: { children: ReactNode; forced?: boolean }) {
  useEffect(() => {
    // Health probes publish reconnection events even when the browser misses
    // `online` (iPhone) or navigator.onLine stays true (DevTools Offline).
    const onOnline = () => { void pingHealth(); };
    window.addEventListener('online', onOnline);
    const health = window.setInterval(onOnline, 2000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(health);
    };
  }, []);
  return <>{children}</>;
}
