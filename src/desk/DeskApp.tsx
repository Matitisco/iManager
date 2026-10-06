import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { initials, isInProgressTrade } from './format';
import { ClientsScreen } from './screens/ClientsScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { NotificationsScreen, SettingsScreen, useUnreadCount } from './screens/AccountScreens';
import { ReportsScreen } from './screens/ReportsScreen';
import { SalesScreen } from './screens/SalesScreen';
import { TradeInsScreen } from './screens/TradeInsScreen';
import { DeskOverlays } from './DeskOverlays';
import { CatalogProvider } from './catalog';
import { DeskIcon, DeskProvider } from './ui';
import type { DeskTab, Overlay } from './types';
import './desk.css';

const ROLE: Record<string, string> = { OWNER: 'Propietario', MANAGER: 'Socio', STAFF: 'Agente' };
const ROUTE: Record<DeskTab, string> = {
  dashboard: 'dash', inventory: 'inv', sales: 'ven', tradeins: 'canjes',
  clients: 'clientes', reports: 'rep', notifications: 'notif', settings: 'config',
};

function tabFromHash(hash: string): DeskTab {
  const name = hash.replace(/^#\/?/, '').split('/')[0];
  return (Object.keys(ROUTE) as DeskTab[]).find((key) => ROUTE[key] === name) ?? 'dashboard';
}

export function DeskApp() {
  const { appSession, tradeIns } = useAppContext();
  const isStaff = appSession?.membership?.role === 'STAFF';
  const [tab, setTab] = useState<DeskTab>(() => tabFromHash(window.location.hash));
  const [entered, setEntered] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [message, setMessage] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const unread = useUnreadCount();
  const openTrades = tradeIns.filter((item) => isInProgressTrade(item.status)).length;
  const name = appSession?.user.displayName?.trim() || appSession?.user.email || 'Usuario';

  useEffect(() => {
    if (!toastOn) return;
    const timer = window.setTimeout(() => setToastOn(false), 2200);
    return () => window.clearTimeout(timer);
  }, [toastOn, message]);

  useEffect(() => {
    const apply = () => {
      let next = tabFromHash(window.location.hash);
      if (isStaff && next === 'reports') {
        next = 'dashboard';
        history.replaceState(null, '', '#/dash');
      }
      setTab(next);
      setOverlay(null);
    };
    if (!window.location.hash) history.replaceState(null, '', '#/dash');
    const onHash = () => { apply(); setEntered(true); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [isStaff]);

  const go = (next: DeskTab) => {
    if (isStaff && next === 'reports') return;
    const hash = `#/${ROUTE[next]}`;
    if (window.location.hash === hash) {
      setTab(next);
      setOverlay(null);
      return;
    }
    window.location.hash = hash;
  };

  const ui = {
    tab,
    go,
    open: (next: Overlay) => setOverlay(next),
    close: () => setOverlay(null),
    toast: (text: string) => { setMessage(text); setToastOn(true); },
    isStaff,
  };

  const items: { id: DeskTab; label: string; icon: 'grid' | 'list' | 'cart' | 'swap' | 'user' | 'bars'; size: number; meta?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', size: 22 },
    { id: 'inventory', label: 'Inventario', icon: 'list', size: 22 },
    { id: 'sales', label: 'Ventas', icon: 'cart', size: 22 },
    { id: 'tradeins', label: 'Canjes', icon: 'swap', size: 18, meta: openTrades ? String(openTrades) : undefined },
    { id: 'clients', label: 'Clientes', icon: 'user', size: 18 },
    ...(isStaff ? [] : [{ id: 'reports' as const, label: 'Reportes', icon: 'bars' as const, size: 22 }]),
  ];

  return (
    <CatalogProvider>
    <DeskProvider value={ui}>
      <div className="desk-app">
        <aside className="side">
          <div className="dbrand">
            <div className="dlogo"><DeskIcon name="logo" size={22} strokeWidth={2.2} /></div>
            <div><b>iManager</b><small>{appSession?.store?.name || 'Tienda'}</small></div>
          </div>
          <div className="dgroup">
            {items.map((item) => (
              <button key={item.id} className={`ditem${tab === item.id ? ' on' : ''}`} type="button" onClick={() => go(item.id)}>
                <span className="dic"><DeskIcon name={item.icon} size={item.size} /></span>
                <span>{item.label}</span>
                {item.meta ? <span className="dmeta">{item.meta}</span> : null}
              </button>
            ))}
          </div>
          <div className="dlabel">Cuenta</div>
          <div className="dgroup">
            <button className={`ditem${tab === 'notifications' ? ' on' : ''}`} type="button" onClick={() => go('notifications')}>
              <span className="dic"><DeskIcon name="bell" size={18} /></span><span>Notificaciones</span>
              {unread > 0 ? <span className="dcount">{unread}</span> : null}
            </button>
            <button className={`ditem${tab === 'settings' ? ' on' : ''}`} type="button" onClick={() => go('settings')}>
              <span className="dic"><DeskIcon name="gear" size={18} /></span><span>Configuración</span>
            </button>
          </div>
          <div className="dspacer" />
          <button className="duser" type="button" onClick={() => go('settings')}>
            <div className="av-c b">{initials(name)}</div>
            <div className="info"><b>{name}</b><small>{ROLE[appSession?.membership?.role ?? 'STAFF']}</small></div>
          </button>
        </aside>
        <main className="stage">
          <div key={tab} className={entered ? 'enter-f' : undefined}>
            {tab === 'dashboard' && <DashboardScreen />}
            {tab === 'inventory' && <InventoryScreen />}
            {tab === 'sales' && <SalesScreen />}
            {tab === 'tradeins' && <TradeInsScreen />}
            {tab === 'clients' && <ClientsScreen />}
            {tab === 'reports' && <ReportsScreen />}
            {tab === 'notifications' && <NotificationsScreen />}
            {tab === 'settings' && <SettingsScreen />}
          </div>
        </main>
        <div className={`toast${toastOn ? ' show' : ''}`}><i />{message}</div>
        <DeskOverlays overlay={overlay} />
      </div>
    </DeskProvider>
    </CatalogProvider>
  );
}
