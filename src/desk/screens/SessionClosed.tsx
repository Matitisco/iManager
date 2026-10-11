import { BrandIsotipo } from '../../components/brand-mark';
import '../desk.css';

const FLAG = 'imanager-session-closed';

export function sessionClosedStore(): string | null {
  return sessionStorage.getItem(FLAG);
}

export function clearSessionClosed() {
  sessionStorage.removeItem(FLAG);
}

export function markSessionClosed(storeName: string) {
  sessionStorage.setItem(FLAG, storeName);
  window.location.hash = '#/salida';
}

export function SessionClosed({ storeName, onRelogin }: { storeName: string; onRelogin: () => void }) {
  return (
    <div className="desk-app out">
      <div className="s-out">
        <BrandIsotipo size={84} className="logo" />
        <div className="brand">iManager</div>
        <p className="tagline">Gestión para tiendas de celulares</p>
        <h1>Sesión cerrada</h1>
        <p>Tu inventario, ventas y canjes siguen guardados en {storeName}.</p>
        <button className="cta" type="button" onClick={() => { sessionStorage.removeItem(FLAG); history.replaceState(null, '', window.location.pathname); onRelogin(); }}>Volver a entrar</button>
      </div>
    </div>
  );
}
