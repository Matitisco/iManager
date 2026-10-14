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
    // iPhone can leave navigator.onLine false after the network is back.
    // DevTools "Offline" does the opposite: onLine stays true and no event fires.
    // A live /api/health probe is what shows and hides the banner in both cases.
    // A successful cached GET must not clear it.
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
      if (alive && !online) show();
    });
    const onOffline = () => show();
    const onOnline = () => {
      ignoreStaleOffline = false;
      void pingHealth().then((ok) => {
        if (!alive || ok === false) return;
        if (ok === true || navigator.onLine !== false) hideAfterHealth();
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
      void pingHealth().then((ok) => {
        if (!alive) return;
        if (ok === true) hideAfterHealth();
        else if (ok === false) show();
      });
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
