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
    const onOnline = () => { if (document.visibilityState !== 'hidden') void pingHealth(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onOnline);
    onOnline();
    const health = window.setInterval(onOnline, 5000);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onOnline);
      window.clearInterval(health);
    };
  }, []);
  return <>{children}</>;
}
