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
    const show = () => { if (alive) setDown(true); };
    const hide = () => { if (alive) setDown(false); };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) show();
    const stop = subscribeConnection((online) => { if (online) hide(); else show(); });
    const onOffline = () => show();
    const onOnline = () => { void pingHealth().then((ok) => { if (ok || navigator.onLine !== false) hide(); }); };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    const health = window.setInterval(() => {
      if (!visibleRef.current && navigator.onLine !== false) return;
      void pingHealth().then((ok) => { if (ok) hide(); });
    }, 2000);
    return () => {
      alive = false;
      stop();
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
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
