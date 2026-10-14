import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { pingHealth } from '../lib/connection';
import { subscribeConnection } from '../lib/online';
import { NETWORK_ERROR_MESSAGE } from '../lib/user-message';

const OfflineScopeContext = createContext(false);

export function useOfflineBannerOwned() {
  return useContext(OfflineScopeContext);
}

export function suppressLocalNetworkBanner(message: string | null | undefined, owned: boolean) {
  return owned && message === NETWORK_ERROR_MESSAGE;
}

export function OfflineScope({ children, forced = false }: { children: ReactNode; forced?: boolean }) {
  const [down, setDown] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const visibleRef = useRef(false);
  visibleRef.current = down || forced;
  useEffect(() => {
    let alive = true;
    // iPhone often flips navigator.onLine without an `offline` event, and can leave it
    // false for several seconds after the network is back. A successful /api/health
    // hides the banner and ignores that stale flag until a new outage or onLine is true.
    let ignoreStaleOffline = false;
    const show = () => {
      ignoreStaleOffline = false;
      if (alive) setDown(true);
    };
    const hideAfterHealth = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) ignoreStaleOffline = true;
      if (alive) setDown(false);
    };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) show();
    const stop = subscribeConnection((online) => {
      if (!alive) return;
      if (online) {
        ignoreStaleOffline = navigator.onLine === false;
        setDown(false);
      } else show();
    });
    const onOffline = () => show();
    const onOnline = () => {
      ignoreStaleOffline = false;
      void pingHealth().then((ok) => {
        if (alive && (ok || navigator.onLine !== false)) hideAfterHealth();
      });
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    const watch = window.setInterval(() => {
      const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (!browserOffline) {
        ignoreStaleOffline = false;
        return;
      }
      if (!ignoreStaleOffline) show();
    }, 1000);
    const health = window.setInterval(() => {
      if (!visibleRef.current && navigator.onLine !== false) return;
      void pingHealth().then((ok) => { if (alive && ok) hideAfterHealth(); });
    }, 2000);
    return () => {
      alive = false;
      stop();
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.clearInterval(watch);
      window.clearInterval(health);
    };
  }, []);
  const visible = down || forced;
  return (
    <OfflineScopeContext.Provider value>
      {visible ? <p className="ferr" role="alert" data-testid="offline-banner">{NETWORK_ERROR_MESSAGE}</p> : null}
      {children}
    </OfflineScopeContext.Provider>
  );
}
