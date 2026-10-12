import { useEffect, useReducer, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { usePhoneLayout } from '../lib/phone-layout';
import {
  dismissInstall, getInstallPrompt, INSTALL_DELAY_MS, requestInstall, isAndroid,
  installDismissed, isIOSSafari, isAppInstalled, subscribeInstall,
} from '../lib/pwa';
import './install-app.css';

export function InstallApp({ enabled = true, dashboard = true }: { enabled?: boolean; dashboard?: boolean }) {
  const phone = usePhoneLayout();
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(document.visibilityState === 'visible');
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const safari = isIOSSafari();
  const prompt = getInstallPrompt();
  const dismissed = installDismissed();
  const manual = isAndroid() && !prompt;
  const eligible = enabled && phone && visible && !isAppInstalled() && (safari ? !dismissed : !!prompt || (!dismissed && (manual && dashboard || !!error)));

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

  const install = async () => {
    if (!prompt || installing) return;
    setInstalling(true);
    setError('');
    try {
      await requestInstall();
    } catch {
      setError('No se pudo abrir la instalación. Podés instalar desde el menú de tu navegador.');
    } finally { setInstalling(false); }
  };

  return (
    <AnimatePresence>
      {eligible && ready ? (
        <motion.aside
          className={`pwa-install${!safari ? manual ? ' banner manual' : ' banner' : ''}${!safari && dismissed ? ' compact' : ''}`} role="region" aria-labelledby={!dismissed ? 'pwa-install-title' : undefined} aria-label={dismissed ? 'Instalar iManager' : undefined} data-testid="install-app"
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }}
        >
          {!dismissed && <motion.button type="button" className="pwa-close" aria-label="No volver a mostrar la instalación" onClick={dismissInstall}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><X size={18} /></motion.button>}
          {!dismissed && <div className="pwa-heading">
            <img src="/icons/icon-180.png" width="44" height="44" alt="" />
            <div><h2 id="pwa-install-title">{manual ? 'Instalá iManager' : 'iManager en tu inicio'}</h2>{manual ? <p>Tocá <span className="pwa-menu">⋮</span> y después <b>Agregar a pantalla principal</b></p> : <p>Abrí tu tienda con un toque, como una app.</p>}</div>
          </div>}
          {safari ? (
            <ol className="pwa-steps">
              <li><span className="pwa-step-icon"><Share size={22} aria-hidden="true" /></span><span>Tocá <b>Compartir</b> en Safari.<small>El cuadrado con la flecha hacia arriba.</small></span></li>
              <li><span className="pwa-step-icon"><PlusSquare size={22} aria-hidden="true" /></span><span>Elegí <b>Agregar a inicio</b>.<small>Confirmá con Agregar. Si aparece, activá Abrir como app web.</small></span></li>
            </ol>
          ) : prompt ? (
            <motion.button className="pwa-action" type="button" onClick={install} disabled={installing}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <Download size={18} />{installing ? 'Abriendo instalación…' : 'Instalar app'}
            </motion.button>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
          {!dismissed && !manual && <motion.button className="pwa-dismiss" type="button" onClick={dismissInstall}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>Ahora no, no volver a mostrar</motion.button>}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
