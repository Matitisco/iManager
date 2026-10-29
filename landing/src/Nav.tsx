import { APP_URL } from './content';

const LINKS = [
  ['#problema', 'El problema'],
  ['#funciones', 'Cómo lo resuelve'],
  ['#como', 'Cómo empezar'],
  ['#beta', 'Beta'],
] as const;

export function Nav({ path }: { path: string }) {
  return (
    <div className="wrap">
      <div className="nav">
        <a href="/" aria-label="iManager, inicio">
          <img src="/assets/logotipo-horizontal.svg" alt="iManager" width="241" height="64" />
        </a>
        <nav className="lk" aria-label="Secciones">
          {LINKS.map(([href, label]) => <a key={href} href={path === '/' ? href : `/${href}`}>{label}</a>)}
        </nav>
        <div className="rt">
          <a className="en" href={APP_URL}>Entrar</a>
          <a className="btn p sm" href={APP_URL}>Empezar gratis</a>
        </div>
      </div>
    </div>
  );
}
