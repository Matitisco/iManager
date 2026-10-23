import { useEffect, useRef, useState } from 'react';
import { appBuildId, watchControllerUpdates, watchUpdateSafety, watchVersionUpdates } from '../lib/pwa-update';
import './pwa-update.css';
import { showBootSplash } from '../lib/boot-splash';

export const RELOAD_KEY = 'imanager:update-build';
export const LONG_ABSENCE_MS = 3 * 60 * 1000;

export function PwaUpdate() {
  const [available, setAvailable] = useState(false);
  const [needsSave, setNeedsSave] = useState(false);
  const requestUpdate = useRef<() => void>(() => {});
  useEffect(() => {
    let pending = false;
    let reloading = false;
    let remoteId = '';
    let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : null;
    let frame = 0;
    const reload = (manual = false) => {
      if (!pending || reloading || !safety.isSafe() || (!manual && document.visibilityState !== 'hidden')) return false;
      const token = remoteId || 'controller';
      try {
        if (sessionStorage.getItem(RELOAD_KEY) === token) return false;
        sessionStorage.setItem(RELOAD_KEY, token);
      } catch { /* Private mode still reloads. */ }
      reloading = true;
      if (document.visibilityState === 'hidden') window.location.reload();
      else {
        showBootSplash();
        // Two frames give the opaque overlay a paint before navigation blocks JS.
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => window.location.reload()); });
      }
      return true;
    };
    const safety = watchUpdateSafety(() => { reload(); });
    const notice = (buildId?: string) => {
      if (buildId) remoteId = buildId;
      pending = true;
      if (!reload()) setAvailable(true);
    };
    requestUpdate.current = () => {
      if (!safety.isSafe()) { setNeedsSave(true); return; }
      if (!reload(true)) setAvailable(true);
    };
    const stopController = 'serviceWorker' in navigator
      ? watchControllerUpdates(navigator.serviceWorker, () => notice())
      : () => {};
    // Vite's PROD flag follows NODE_ENV. CI builds with NODE_ENV=test, so the
    // production mode is what decides whether this bundle watches for deploys.
    const stopVersion = import.meta.env.MODE === 'production'
      ? watchVersionUpdates(appBuildId(), (buildId) => notice(buildId), {
        worker: 'serviceWorker' in navigator ? navigator.serviceWorker : null,
      })
      : () => {};
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        reload();
      } else {
        const longAbsence = hiddenAt !== null && Date.now() - hiddenAt >= LONG_ABSENCE_MS;
        hiddenAt = null;
        if (longAbsence && pending) reload(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopController();
      stopVersion();
      safety.dispose();
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  if (!available) return null;
  return (
    <aside className="pwa-update" role="status" data-testid="pwa-update-toast">
      <span>Nueva versión disponible · <button type="button" onClick={() => requestUpdate.current()}>Actualizar</button>
        {needsSave && <small>Guardá o cerrá el formulario para actualizar sin perder datos.</small>}
      </span>
    </aside>
  );
}
