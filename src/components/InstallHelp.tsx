import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Download, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { motion } from 'motion/react';
import { getInstallPrompt, isIOS, isAppInstalled, requestInstall, subscribeInstall } from '../lib/pwa';
import { PHONE_QUERY } from '../lib/phone-layout';
import './install-help.css';

type Platform = 'android' | 'iphone';
// One snapshot decides the card's presence during render, including when Más
// mounts after a resize. No effect can insert the card beneath an ongoing tap.
const canShowInstallCard = () => window.matchMedia(PHONE_QUERY).matches && !isAppInstalled();
function subscribeInstallCard(changed: () => void) {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener('change', changed);
  const stop = subscribeInstall(changed);
  return () => { media.removeEventListener('change', changed); stop(); };
}
const steps = {
  android: [
    ['Abrí la app en Chrome', 'Entrá a app.imanager.com.ar'],
    ['Tocá ⋮ arriba', 'El menú de los tres puntos, a la derecha de la dirección'],
    ['Elegí «Instalar app»', 'Si no aparece, buscá «Agregar a pantalla principal»'],
    ['Confirmá con «Instalar»', 'Listo: queda el ícono en tu pantalla'],
  ],
  iphone: [
    ['Abrí la app en Safari', 'Tiene que ser Safari: en otros navegadores no aparece la opción'],
    ['Tocá Compartir', 'El cuadrado con la flecha, en la barra de abajo'],
    ['Elegí «Agregar a inicio»', 'Deslizá la lista hacia abajo si no la ves'],
    ['Tocá «Agregar»', 'Arriba a la derecha. Listo: ya tenés el ícono'],
  ],
} as const;

function Illustration({ platform, step }: { platform: Platform; step: number }) {
  const iphone = platform === 'iphone';
  return <div className={`install-art ${platform} step-${step}`} aria-hidden="true">
    {step <= 2 ? <>
      <div className="art-address">app.imanager.com.ar{!iphone && <span className={step === 2 ? 'art-highlight' : ''}><MoreVertical size={16} /></span>}</div>
      <div className="art-page"><i /><i /><i /></div>
      {iphone && <div className="art-toolbar"><span>‹</span><span>›</span><span className={step === 2 ? 'art-highlight' : ''}><Share size={18} /></span><span>▢</span></div>}
    </> : step === 3 ? <div className="art-options">
      <span>{iphone ? 'Copiar' : 'Nueva pestaña'}</span>
      <span>{iphone ? 'Agregar a favoritos ☆' : 'Historial'}</span>
      <b>{iphone ? <PlusSquare size={13} /> : <Smartphone size={13} />}{iphone ? 'Agregar a inicio' : 'Instalar app'}</b>
    </div> : <div className="art-confirm">
      {iphone && <div className="art-confirm-actions"><span>Cancelar</span><b className="art-highlight">Agregar</b></div>}
      <div className="art-app"><img src="/icons/icon-180.png" alt="" /><b>{iphone ? 'iManager' : '¿Instalar iManager?'}</b></div>
      <small>app.imanager.com.ar</small>
      {!iphone && <div className="art-confirm-actions"><span>Cancelar</span><b className="art-highlight">Instalar</b></div>}
    </div>}
  </div>;
}

function PlatformSteps({ platform, own = false }: { platform: Platform; own?: boolean }) {
  return <section className="install-platform" aria-label={platform === 'iphone' ? 'Pasos para iPhone' : 'Pasos para Android'}>
    <div className="install-platform-heading"><h3>En tu {platform === 'iphone' ? 'iPhone' : 'Android'}</h3>{own && <b>Tu celular</b>}<span>con {platform === 'iphone' ? 'Safari' : 'Chrome'}</span></div>
    <ol className="install-guide-steps">{steps[platform].map(([title, description], index) => <li key={title}>
      <span className="install-number">{index + 1}</span>
      <div className="install-step-copy"><h4>{title}{platform === 'iphone' && index === 1 && <Share size={16} />}</h4><p>{description}</p></div>
      <Illustration platform={platform} step={index + 1} />
    </li>)}</ol>
  </section>;
}

export function InstallHelp({ onClose, onInstalled }: { onClose: () => void; onInstalled?: () => void }) {
  const titleId = useId();
  const otherId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const own: Platform = isIOS() ? 'iphone' : 'android';
  const other: Platform = own === 'iphone' ? 'android' : 'iphone';
  const [expanded, setExpanded] = useState(false);
  const backdropPressed = useRef(false);
  const closePointer = (event: PointerEvent) => {
    if (event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    // Close on the completed gesture, even when iOS suppresses its synthetic
    // click. Consume a trailing click before the background becomes interactive.
    const swallow = (click: Event) => {
      click.preventDefault();
      click.stopPropagation();
      document.removeEventListener('click', swallow, true);
    };
    document.addEventListener('click', swallow, true);
    window.setTimeout(() => document.removeEventListener('click', swallow, true), 400);
    onClose();
  };

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && !node.contains(dialog.current));
    const previous = background.map((node) => node.inert);
    background.forEach((node) => { node.inert = true; });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === 'Tab') {
        const buttons = [...dialog.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    const containFocus = (event: FocusEvent) => { if (!dialog.current?.contains(event.target as Node)) closeButton.current?.focus(); };
    document.addEventListener('keydown', keys, true);
    document.addEventListener('focusin', containFocus);
    return () => {
      document.removeEventListener('keydown', keys, true);
      document.removeEventListener('focusin', containFocus);
      background.forEach((node, index) => { node.inert = previous[index]; });
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [onClose]);

  return createPortal(<div className="install-help-backdrop"
    onPointerDown={(event) => {
      event.stopPropagation();
      backdropPressed.current = event.target === event.currentTarget;
      if (backdropPressed.current) event.preventDefault();
    }}
    onPointerUp={(event) => {
      event.stopPropagation();
      if (backdropPressed.current && event.target === event.currentTarget) closePointer(event);
      backdropPressed.current = false;
    }}
    onPointerCancel={() => { backdropPressed.current = false; }}
    onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
    <motion.div ref={dialog} className="install-help-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}
      initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .2 }}>
      <div className="install-help-grab" aria-hidden="true" />
      <header className="install-help-header">
        <div className="install-help-heading"><img src="/icons/icon-180.png" width="46" height="46" alt="" /><div><h2 id={titleId}>Instalá iManager</h2><p>Queda en tu pantalla de inicio y abre como una app.</p></div><button ref={closeButton} type="button" aria-label="Cerrar ayuda de instalación" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onPointerUp={closePointer} onClick={onClose}><X size={22} /></button></div>
        <ul className="install-benefits">{['Pantalla completa', 'Abre más rápido', 'Sin tienda de apps'].map((label) => <li key={label}><i aria-hidden="true" />{label}</li>)}</ul>
      </header>
      <div className="install-help-body">
        <PlatformSteps platform={own} own />
        <button className="install-other" type="button" aria-expanded={expanded} aria-controls={otherId} onClick={() => setExpanded((value) => !value)}>
          <span className="install-other-icon"><Smartphone size={22} /></span><span><b>¿Usás {other === 'iphone' ? 'iPhone' : 'Android'}?</b><small>{other === 'iphone' ? 'Safari → Compartir → Agregar a inicio' : 'Chrome → ⋮ → Instalar app'}</small></span><ChevronDown size={18} className={expanded ? 'expanded' : ''} />
        </button>
        <div id={otherId} hidden={!expanded}>{expanded && <PlatformSteps platform={other} />}</div>
        {onInstalled ? <button className="install-installed" type="button" onClick={onInstalled}>Ya la instalé</button> : null}
      </div>
    </motion.div>
  </div>, document.body);
}

/** Explicit entry remains available after the automatic invitation is dismissed. */
export function InstallCard() {
  const visible = useSyncExternalStore(subscribeInstallCard, canShowInstallCard);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = useCallback(() => setOpen(false), []);
  if (!visible) return null;
  const install = async () => {
    if (busy) return;
    if (!getInstallPrompt()) { setOpen(true); return; }
    setBusy(true); setError('');
    try { await requestInstall(); }
    catch { setError('No se pudo abrir la instalación. Seguí los pasos de tu navegador.'); setOpen(true); }
    finally { setBusy(false); }
  };
  return <>
    <div className="install-more-card" data-testid="install-card"><span className="install-card-icon"><Download size={25} /></span><div><h2>Instalar app</h2><p>Tenela en la pantalla de inicio, como cualquier app</p></div><button type="button" onClick={install} disabled={busy}>{busy ? 'Abriendo…' : 'Instalar'}</button></div>
    {error && <p className="install-card-error" role="alert">{error}</p>}
    {open && <InstallHelp onClose={close} />}
  </>;
}
