import { useEffect, useRef, useState } from 'react';
import { appBuildId, watchControllerUpdates, watchUpdateSafety, watchVersionUpdates } from '../lib/pwa-update';
import './pwa-update.css';

const RELOAD_KEY = 'imanager:update-build';

export function PwaUpdate() {
  const [available, setAvailable] = useState(false);
  const [needsSave, setNeedsSave] = useState(false);
  const requestUpdate = useRef<() => void>(() => {});
  useEffect(() => {
    let pending = false;
    let reloading = false;
    let remoteId = '';
    const reload = () => {
      if (!pending || reloading || !safety.isSafe() || document.visibilityState !== 'visible') return false;
      const token = remoteId || 'controller';
      try {
        if (sessionStorage.getItem(RELOAD_KEY) === token) return false;
        sessionStorage.setItem(RELOAD_KEY, token);
      } catch { /* Private mode still reloads. */ }
      reloading = true;
      window.location.reload();
      return true;
    };
    const safety = watchUpdateSafety(reload);
    const notice = (buildId?: string) => {
      if (buildId) remoteId = buildId;
      pending = true;
      if (!reload()) setAvailable(true);
    };
    requestUpdate.current = () => {
      if (!safety.isSafe()) { setNeedsSave(true); return; }
      if (!reload()) setAvailable(true);
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
    document.addEventListener('visibilitychange', reload);
    return () => {
      stopController();
      stopVersion();
      safety.dispose();
      document.removeEventListener('visibilitychange', reload);
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
