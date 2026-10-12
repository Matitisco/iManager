import { useEffect, useRef, useState } from 'react';
import { watchControllerUpdates, watchUpdateSafety } from '../lib/pwa-update';
import './pwa-update.css';

export function PwaUpdate() {
  const [available, setAvailable] = useState(false);
  const [needsSave, setNeedsSave] = useState(false);
  const requestUpdate = useRef<() => void>(() => {});
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let pending = false;
    let reloading = false;
    const reload = () => {
      if (!pending || reloading || !safety.isSafe() || document.visibilityState !== 'visible') return false;
      reloading = true;
      window.location.reload();
      return true;
    };
    const safety = watchUpdateSafety(reload);
    requestUpdate.current = () => { if (!reload()) setNeedsSave(true); };
    const stop = watchControllerUpdates(navigator.serviceWorker, () => {
      pending = true;
      if (!reload()) setAvailable(true);
    });
    document.addEventListener('visibilitychange', reload);
    return () => { stop(); safety.dispose(); document.removeEventListener('visibilitychange', reload); };
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
