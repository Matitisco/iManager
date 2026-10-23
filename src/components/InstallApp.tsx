import { useEffect, useReducer, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Check, Download, MoreVertical, PlusSquare, Share } from 'lucide-react';
import { usePhoneLayout } from '../lib/phone-layout';
import { useInstallBlocker } from '../lib/install-visibility';
import {
  dismissInstall, getInstallPrompt, INSTALL_DELAY_MS, requestInstall, isAndroid, isIOS,
  installDismissed, isIOSSafari, isAppInstalled, subscribeInstall, snoozeInstall, installRequestAccepted,
} from '../lib/pwa';
import './install-app.css';

export function InstallApp({ enabled = true, dashboard = true }: { enabled?: boolean; dashboard?: boolean }) {
  const phone = usePhoneLayout();
  const blocked = useInstallBlocker();
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(document.visibilityState === 'visible');
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<'later' | 'forever' | null>(null);
  const ios = isIOS();
  const safari = isIOSSafari();
  const prompt = getInstallPrompt();
  const eligible = enabled && dashboard && phone && (ios || isAndroid()) && visible && !blocked
    && !isAppInstalled() && !installDismissed() && !installRequestAccepted();

  useEffect(() => subscribeInstall(refresh), []);
  useEffect(() => {
    const visibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    setReady(false);
    if (!eligible) return;
    const timer = window.setTimeout(() => setReady(true), INSTALL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [eligible]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const dismiss = (forever: boolean) => {
    if (forever) dismissInstall(); else snoozeInstall();
    setNotice(forever ? 'forever' : 'later');
  };
  const install = async () => {
    if (!prompt || installing) return;
    setInstalling(true);
    setError('');
    try {
      if (await requestInstall() === 'dismissed') setNotice('later');
    } catch {
      setError('No se pudo abrir la instalación. Podés instalar desde el menú de tu navegador.');
    } finally { setInstalling(false); }
  };

  return <>
    {/* No exit boundary: route/form/visibility changes must remove this immediately. */}
    {eligible && ready ? <motion.aside
      className="pwa-install" role="region" aria-labelledby="pwa-install-title" data-testid="install-app"
      initial={false}>
      <div className="pwa-heading">
        <img src="/icons/icon-180.png" width="44" height="44" alt="" />
        <div><h2 id="pwa-install-title">iManager en tu inicio</h2><p>Abrí tu tienda con un toque, en pantalla completa.</p></div>
      </div>
      {ios ? <ol className="pwa-steps">
        {!safari && <li><span className="pwa-step-icon"><Share size={21} aria-hidden="true" /></span><span>Abrí iManager en <b>Safari</b>.<small>Entrá a app.imanager.com.ar para agregarla a inicio.</small></span></li>}
        <li><span className="pwa-step-icon"><Share size={21} aria-hidden="true" /></span><span>Tocá <b>Compartir</b> en Safari.<small>El cuadrado con la flecha hacia arriba.</small></span></li>
        <li><span className="pwa-step-icon"><PlusSquare size={21} aria-hidden="true" /></span><span>Elegí <b>Agregar a inicio</b>.<small>Confirmá con Agregar.</small></span></li>
      </ol> : prompt || installing ? <motion.button className="pwa-action" type="button" onClick={install} disabled={installing}
        whileTap={{ scale: .98 }}><Download size={18} aria-hidden="true" />{installing ? 'Abriendo instalación…' : 'Instalar app'}</motion.button>
        : <ol className="pwa-steps">
          <li><span className="pwa-step-icon"><MoreVertical size={21} aria-hidden="true" /></span><span>Abrí el <b>menú del navegador</b>.<small>En Chrome, tocá los tres puntos ⋮.</small></span></li>
          <li><span className="pwa-step-icon"><Download size={21} aria-hidden="true" /></span><span>Elegí <b>Instalar app</b>.<small>Si no aparece, buscá Agregar a pantalla principal y confirmá.</small></span></li>
        </ol>}
      {error && <p className="pwa-error" role="alert">{error}</p>}
      <div className="pwa-dismiss-actions">
        <button className="pwa-later" type="button" onClick={() => dismiss(false)} disabled={installing}>Ahora no</button>
        <button className="pwa-never" type="button" onClick={() => dismiss(true)} disabled={installing}>No volver a mostrar</button>
      </div>
    </motion.aside> : null}
    {notice && enabled && phone && visible && !blocked && !isAppInstalled() ? createPortal(
      <div className="pwa-notice" role="status">
        <span className="pwa-notice-check"><Check size={18} aria-hidden="true" /></span>
        <div><b>{notice === 'later' ? 'Listo, te lo recordamos más adelante' : 'No te lo vamos a mostrar más'}</b>
          <p>{notice === 'later' ? 'Mientras tanto, la tenés en Más › Instalar app.' : 'Si cambiás de idea, podés instalarla desde Ayuda.'}</p></div>
      </div>, document.body) : null}
  </>;
}
