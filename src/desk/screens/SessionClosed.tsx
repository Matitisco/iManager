import { Box } from 'lucide-react';
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
        <div className="logo"><Box size={40} aria-hidden="true" /></div>
        <div className="brand">iManager</div>
        <h1>Sesión cerrada</h1>
        <p>Tu inventario, ventas y canjes siguen guardados en {storeName}.</p>
        <button className="cta" type="button" onClick={() => { sessionStorage.removeItem(FLAG); history.replaceState(null, '', window.location.pathname); onRelogin(); }}>Volver a entrar</button>
      </div>
    </div>
  );
}
