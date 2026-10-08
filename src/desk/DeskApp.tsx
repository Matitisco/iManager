import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { hasStoreContactOffer } from '../lib/store-contact';
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
import { canOpenSection } from './sections';
import type { DeskTab, Overlay } from './types';
import './desk.css';

const ROLE: Record<string, string> = { OWNER: 'Propietario', MANAGER: 'Socio', STAFF: 'Empleado' };
const ROUTE: Record<DeskTab, string> = {
  dashboard: 'dash', inventory: 'inv', sales: 'ven', tradeins: 'canjes',
  clients: 'clientes', reports: 'rep', notifications: 'notif', settings: 'config',
};

function tabFromHash(hash: string): DeskTab {
  const name = hash.replace(/^#\/?/, '').split('/')[0];
  return (Object.keys(ROUTE) as DeskTab[]).find((key) => ROUTE[key] === name) ?? 'dashboard';
}

export function DeskApp() {
  const { appSession, tradeIns, inventory, user } = useAppContext();
  const role = appSession?.membership?.role;
  const sections = appSession?.membership?.sections;
  const isStaff = role === 'STAFF';
  const allowed = (id: DeskTab) => canOpenSection(id, sections, role);
  const [tab, setTab] = useState<DeskTab>(() => tabFromHash(window.location.hash));
  const [entered, setEntered] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [pendingRecordOpen, setPendingRecordOpen] = useState<{ tab: DeskTab; overlay: Overlay } | null>(null);
  const overlayScope = useRef('');
  const [message, setMessage] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const unread = useUnreadCount();
  const openTrades = tradeIns.filter((item) => isInProgressTrade(item.status)).length;
  const name = appSession?.user.displayName?.trim() || appSession?.user.email || 'Usuario';
  const operationScope = `${user?.uid ?? ''}:${appSession?.store?.id ?? ''}:${role ?? ''}:${[allowed('inventory'), allowed('sales'), allowed('tradeins'), allowed('clients'), allowed('reports')].map(Number).join('')}`;

  useEffect(() => {
    if (overlayScope.current !== operationScope) {
      overlayScope.current = operationScope;
      setOverlay(null);
    }
  }, [operationScope]);

  useEffect(() => {
    if (!pendingRecordOpen || pendingRecordOpen.tab !== tab) return;
    setOverlay(pendingRecordOpen.overlay);
    setPendingRecordOpen(null);
  }, [pendingRecordOpen, tab]);

  useEffect(() => {
    if (!toastOn) return;
    const timer = window.setTimeout(() => setToastOn(false), 2200);
    return () => window.clearTimeout(timer);
  }, [toastOn, message]);

  useEffect(() => {
    const apply = () => {
      let next = tabFromHash(window.location.hash);
      if (!allowed(next)) {
        next = allowed('dashboard') ? 'dashboard' : 'settings';
        history.replaceState(null, '', `#/${ROUTE[next]}`);
      }
      setTab(next);
      setOverlay(null);
    };
    if (!window.location.hash) history.replaceState(null, '', '#/dash');
    const onHash = () => { apply(); setEntered(true); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [sections, role]);

  useEffect(() => {
    const next = tabFromHash(window.location.hash || '#/dash');
    if (allowed(next)) return;
    const fallback = allowed('dashboard') ? 'dashboard' : 'settings';
    history.replaceState(null, '', `#/${ROUTE[fallback]}`);
    setTab(fallback);
    setOverlay(null);
  }, [sections, role]);

  useEffect(() => {
    const id = appSession?.store?.id;
    if (!id || isStaff || !hasStoreContactOffer(id)) return;
    setOverlay((current) => current ?? { type: 'contact' });
  }, [appSession?.store?.id, isStaff]);

  const go = (next: DeskTab) => {
    if (!allowed(next)) return;
    const hash = `#/${ROUTE[next]}`;
    if (window.location.hash === hash) {
      setTab(next);
      setOverlay(null);
      return;
    }
    window.location.hash = hash;
  };

  const openRecord = (section: string, recordId: string, kind?: string) => {
    if (!(section in ROUTE)) return;
    const target = section as DeskTab;
    if (!allowed(target)) {
      setMessage('No tenés acceso a esta sección.');
      setToastOn(true);
      return;
    }
    let next: Overlay;
    if (target === 'inventory') {
      next = kind === 'ARCHIVED_TRADE_IN_RECEIVED'
        ? { type: 'cj', id: recordId, source: 'inventory', kind }
        : { type: 'eq', id: recordId };
    } else if (target === 'sales') next = { type: 'sale', id: recordId };
    else if (target === 'tradeins') next = { type: 'cj', id: recordId, source: 'tradeins' };
    else if (target === 'clients') next = { type: 'cl', id: recordId };
    else return;
    setPendingRecordOpen({ tab: target, overlay: next });
    go(target);
  };

  const ui = {
    tab,
    go,
    openRecord,
    open: (next: Overlay) => setOverlay(next),
    close: () => setOverlay(null),
    toast: (text: string) => { setMessage(text); setToastOn(true); },
    isStaff,
  };

  const nav: { id: DeskTab; label: string; icon: 'grid' | 'list' | 'cart' | 'swap' | 'user' | 'bars'; size: number; meta?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', size: 22 },
    { id: 'inventory', label: 'Inventario', icon: 'list', size: 22 },
    { id: 'sales', label: 'Ventas', icon: 'cart', size: 22 },
    { id: 'tradeins', label: 'Canjes', icon: 'swap', size: 18, meta: openTrades ? String(openTrades) : undefined },
    { id: 'clients', label: 'Clientes', icon: 'user', size: 18 },
    { id: 'reports', label: 'Reportes', icon: 'bars', size: 22 },
  ];
  const items = nav.filter((item) => allowed(item.id));

  return (
    <CatalogProvider>
    <DeskProvider value={ui}>
      <div className="desk-app">
        <aside className="side">
          <div className="dbrand">
            <div className="dlogo"><Box size={22} aria-hidden="true" /></div>
            <div><b>iManager</b><small>{appSession?.store?.name || 'Tienda'}</small></div>
          </div>
          <div className="dgroup">
            {items.map((item) => (
              <button key={item.id} className={`ditem${tab === item.id ? ' on' : ''}`} type="button" data-testid={`sidebar-tab-${item.id}`} onClick={() => go(item.id)}>
                <span className="dic"><DeskIcon name={item.icon} size={item.size} /></span>
                <span>{item.label}</span>
                {item.meta ? <span className="dmeta">{item.meta}</span> : null}
              </button>
            ))}
          </div>
          <div className="dlabel">Cuenta</div>
          <div className="dgroup">
            {allowed('notifications') ? <button className={`ditem${tab === 'notifications' ? ' on' : ''}`} type="button" onClick={() => go('notifications')}>
              <span className="dic"><DeskIcon name="bell" size={18} /></span><span>Notificaciones</span>
              {unread > 0 ? <span className="dcount">{unread}</span> : null}
            </button> : null}
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
