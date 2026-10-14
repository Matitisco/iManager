import { useEffect, useState } from 'react';
import { APP_URL, SHOW_PRICING, SIGNUP_URL } from './content';
import { Icon } from './Icon';

const LINKS = [
  ['#funciones', 'Funciones'],
  ['#como', 'Cómo funciona'],
  ...(SHOW_PRICING ? ([['#precios', 'Precios']] as const) : []),
  ['#faq', 'Preguntas'],
] as const;

export function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <header className={`nav${open ? ' open' : ''}`}>
      <div className="wrap">
        <a className="logo" href="/" aria-label="iManager, inicio">
          <img src="/assets/logotipo-horizontal.svg" alt="iManager" width="241" height="64" />
        </a>
        <nav className="links" aria-label="Secciones">
          {LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <span className="sp" />
        <a className="enter" href={APP_URL}>Entrar</a>
        <a className="btn p" href={SIGNUP_URL}>Probar gratis</a>
        <button type="button" className="burger" aria-label="Menú" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name="mas" />
        </button>
      </div>
      {open && (
        <div className="menu">
          {LINKS.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
          <a className="btn p" href={SIGNUP_URL}>Probar gratis</a>
        </div>
      )}
    </header>
  );
}
