import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { hasStoreContactOffer } from '../lib/store-contact';
import { useAppContext } from '../context/AppContext';
import { initials, isInProgressTrade } from './format';
import { ImanagerIcon } from './icons';
import { REPAIR_DELIVERED } from './repairs';
import { usePhoneLayout } from './section-notices';
import { ClientsScreen } from './screens/ClientsScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { NotificationsScreen, SettingsScreen, useUnreadCounts } from './screens/AccountScreens';
import { ReportsScreen } from './screens/ReportsScreen';
import { SalesScreen } from './screens/SalesScreen';
import { ServiceScreen } from './screens/ServiceScreen';
import { TradeInsScreen } from './screens/TradeInsScreen';
import { BlueDollar } from './BlueDollar';
import { ExchangeProvider, exchangeFromStore, useMoney } from './exchange';
import { DeskOverlays } from './DeskOverlays';
import { CatalogProvider } from './catalog';
import { DeskToast } from './toast';
import { DeskIcon, DeskProvider } from './ui';
import { canManageSensitive as memberCanManageSensitive } from './sensitive-access';
import { canOpenSection, DESK_SECTIONS, mobileTabs, type DeskSectionId } from './sections';
import type { DeskTab, Overlay } from './types';
import type { NoticeSection } from './unread-count';
import './desk.css';

const ROLE: Record<string, string> = { OWNER: 'Propietario', MANAGER: 'Socio', STAFF: 'Empleado' };
const ROUTE: Record<DeskTab, string> = {
  dashboard: 'dash', inventory: 'inv', sales: 'ven', tradeins: 'canjes',
  clients: 'clientes', service: 'servicio', reports: 'rep', notifications: 'notif', settings: 'config',
  more: 'mas',
};
const NAV_ICON: Record<DeskSectionId, 'grid' | 'list' | 'cart' | 'swap' | 'user' | 'wrench' | 'bars' | 'bell'> = {
  dashboard: 'grid', inventory: 'list', sales: 'cart', tradeins: 'swap',
  clients: 'user', service: 'wrench', reports: 'bars', notifications: 'bell',
};
const MORE_SUB: Record<DeskSectionId, string> = {
  dashboard: 'Resumen de la tienda',
  inventory: 'Equipos y stock',
  sales: 'Registro de ventas',
  reports: 'Ventas, stock y canjes',
  tradeins: 'Equipos dados y recibidos',
  clients: 'Agenda y saldos',
  service: 'Órdenes de reparación',
  notifications: 'Avisos de la tienda',
};

function sectionLabel(id: DeskSectionId) {
  return DESK_SECTIONS.find((section) => section.id === id)?.label ?? id;
}

function countWords(count: number, words: string) {
  return `${count} ${words}`;
}

function moreCount(id: DeskSectionId, openTrades: number, openRepairs: number, unreadTotal: number) {
  if (id === 'tradeins') return countWords(openTrades, 'en curso');
  if (id === 'service') return countWords(openRepairs, openRepairs === 1 ? 'abierta' : 'abiertas');
  if (id === 'notifications') return countWords(unreadTotal, 'sin leer');
  return undefined;
}

function MoreScreen({
  name, store, role, rows, openTrades, openRepairs, unread, onOpen,
}: {
  name: string;
  store: string;
  role: string;
  rows: DeskSectionId[];
  openTrades: number;
  openRepairs: number;
  unread: number;
  onOpen: (id: DeskTab) => void;
}) {
  return (
    <div className="dscreen mmore" data-testid="more-screen">
      <div className="whead">
        <div>
          <h1>Más</h1>
          <div className="wsub">Todo lo que no entra en la barra</div>
        </div>
      </div>
      <button className="mprofile" type="button" data-testid="more-profile" onClick={() => onOpen('settings')}>
        <div className="av-c b">{initials(name)}</div>
        <span className="info">
          <b>{name}</b>
          <small>{store} · {role}</small>
        </span>
        <span className="chev" aria-hidden="true">›</span>
      </button>
      {rows.length > 0 ? (
        <>
          <div className="mlabel">Módulos</div>
          <div className="card">
            {rows.map((id) => {
              const count = moreCount(id, openTrades, openRepairs, unread);
              return (
                <button key={id} className="member" type="button" data-testid={`sidebar-tab-${id}`} onClick={() => onOpen(id)}>
                  <span className="ico-row"><DeskIcon name={NAV_ICON[id]} size={18} /></span>
                  <span className="info">
                    <span className="name">{sectionLabel(id)}</span>
                    <span className="role">{MORE_SUB[id]}</span>
                  </span>
                  {count ? <span className="rtxt">{count}</span> : null}
                  <span className="chev" aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
      <div className="mlabel">Ajustes</div>
      <div className="card">
        <button className="member" type="button" data-testid="sidebar-tab-settings" onClick={() => onOpen('settings')}>
          <span className="ico-row"><DeskIcon name="gear" size={18} /></span>
          <span className="info">
            <span className="name">Configuración</span>
            <span className="role">Tienda, equipo y tu cuenta</span>
          </span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}

function sectionUnread(counts: Record<NoticeSection, number>, id: DeskTab) {
  if (id === 'inventory' || id === 'sales' || id === 'tradeins' || id === 'clients') return counts[id];
  return 0;
}

function SectionUnread({ label, count }: { label: string; count: number }) {
  if (count <= 0) return null;
  return <span className="dcount" aria-label={`${count} en ${label}`}>{count}</span>;
}

function FxBanner() {
  const warning = useMoney().warning;
  if (!warning) return null;
  return <p className="fx-warn" data-testid="fx-warning" role="status">{warning}</p>;
}

function tabFromHash(hash: string): DeskTab {
  const name = hash.replace(/^#\/?/, '').split('/')[0];
  return (Object.keys(ROUTE) as DeskTab[]).find((key) => ROUTE[key] === name) ?? 'dashboard';
}

export function DeskApp() {
  const { appSession, tradeIns, inventory, user, repairOrders = [] } = useAppContext();
  const role = appSession?.membership?.role;
  const sections = appSession?.membership?.sections;
  const isStaff = role === 'STAFF';
  const phone = usePhoneLayout();
  const mobile = mobileTabs(sections, role);
  const allowed = (id: DeskTab) => id === 'more' || canOpenSection(id, sections, role);
  const [tab, setTab] = useState<DeskTab>(() => tabFromHash(window.location.hash));
  const [entered, setEntered] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [pendingRecordOpen, setPendingRecordOpen] = useState<{ tab: DeskTab; overlay: Overlay } | null>(null);
  const overlayScope = useRef('');
  const [message, setMessage] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const unread = useUnreadCounts();
  const openTrades = tradeIns.filter((item) => isInProgressTrade(item.status)).length;
  const openRepairs = repairOrders.filter((order) => order.status !== REPAIR_DELIVERED).length;
  const name = appSession?.user.displayName?.trim() || appSession?.user.email || 'Usuario';
  const operationScope = `${user?.uid ?? ''}:${appSession?.store?.id ?? ''}:${role ?? ''}:${[allowed('inventory'), allowed('sales'), allowed('tradeins'), allowed('clients'), allowed('service'), allowed('reports')].map(Number).join('')}`;

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
    if (phone || tab !== 'more') return;
    const fallback = allowed('dashboard') ? 'dashboard' : 'settings';
    history.replaceState(null, '', `#/${ROUTE[fallback]}`);
    setTab(fallback);
    setOverlay(null);
  }, [phone, tab, sections, role]);

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
    else if (target === 'service') next = { type: 'ot', id: recordId };
    else return;
    setPendingRecordOpen({ tab: target, overlay: next });
    go(target);
  };

  const showBack = phone && tab !== 'more' && !(mobile.bar as readonly string[]).includes(tab);
  const ui = {
    tab,
    go,
    openRecord,
    open: (next: Overlay) => setOverlay(next),
    close: () => setOverlay(null),
    toast: (text: string) => { setMessage(text); setToastOn(true); },
    isStaff,
    canManageSensitive: memberCanManageSensitive(appSession?.membership),
    back: showBack ? () => go('more') : undefined,
  };

  const nav: { id: DeskTab; label: string; icon: 'grid' | 'list' | 'cart' | 'swap' | 'user' | 'wrench' | 'bars'; size: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', size: 22 },
    { id: 'inventory', label: 'Inventario', icon: 'list', size: 22 },
    { id: 'sales', label: 'Ventas', icon: 'cart', size: 22 },
    { id: 'tradeins', label: 'Canjes', icon: 'swap', size: 18 },
    { id: 'clients', label: 'Clientes', icon: 'user', size: 18 },
    { id: 'service', label: 'Servicio técnico', icon: 'wrench', size: 18 },
    { id: 'reports', label: 'Reportes', icon: 'bars', size: 22 },
  ];
  const items = nav.filter((item) => allowed(item.id));
  const moreActive = !mobile.bar.some((id) => id === tab);

  return (
    <CatalogProvider>
    <ExchangeProvider settings={exchangeFromStore(appSession?.store)}>
    <DeskProvider value={ui}>
      <div className="desk-app">
        {phone ? (
          <header className="mhead" data-testid="mobile-header">
            <div className="mstore">
              <i className="mstore-dot" aria-hidden="true" />
              <b data-testid="mobile-store-name">{appSession?.store?.name || 'Tienda'}</b>
            </div>
            <BlueDollar variant="chip" />
          </header>
        ) : null}
        {phone ? null : (
        <aside className="side">
          <div className="dbrand">
            <div className="dlogo"><Box size={22} aria-hidden="true" /></div>
            <div><b>iManager</b><small>{appSession?.store?.name || 'Tienda'}</small></div>
          </div>
          <div className="dnav">
            <div className="dgroup">
              {items.map((item) => (
                <button key={item.id} className={`ditem${tab === item.id ? ' on' : ''}`} type="button" data-testid={`sidebar-tab-${item.id}`} onClick={() => go(item.id)}>
                  <span className="dic"><DeskIcon name={item.icon} size={item.size} /></span>
                  <span>{item.label}</span>
                  <SectionUnread label={item.label} count={sectionUnread(unread.bySection, item.id)} />
                </button>
              ))}
            </div>
            <div className="dlabel">Cuenta</div>
            <div className="dgroup">
              {allowed('notifications') ? <button className={`ditem${tab === 'notifications' ? ' on' : ''}`} type="button" data-testid="sidebar-tab-notifications" onClick={() => go('notifications')}>
                <span className="dic"><DeskIcon name="bell" size={18} /></span><span>Notificaciones</span>
                {unread.total > 0 ? <span className="dcount" aria-label={`${unread.total} en total`}>{unread.total}</span> : null}
              </button> : null}
              <button className={`ditem${tab === 'settings' ? ' on' : ''}`} type="button" data-testid="sidebar-tab-settings" onClick={() => go('settings')}>
                <span className="dic"><DeskIcon name="gear" size={18} /></span><span>Configuración</span>
              </button>
            </div>
          </div>
          <BlueDollar />
          <button className="duser" type="button" onClick={() => go('settings')}>
            <div className="av-c b">{initials(name)}</div>
            <div className="info"><b>{name}</b><small>{ROLE[appSession?.membership?.role ?? 'STAFF']}</small></div>
          </button>
        </aside>
        )}
        <main className="stage">
          <FxBanner />
          <div key={tab} className={entered ? 'enter-f' : undefined}>
            {tab === 'dashboard' && <DashboardScreen />}
            {tab === 'inventory' && <InventoryScreen />}
            {tab === 'sales' && <SalesScreen />}
            {tab === 'tradeins' && <TradeInsScreen />}
            {tab === 'clients' && <ClientsScreen />}
            {tab === 'service' && <ServiceScreen />}
            {tab === 'reports' && <ReportsScreen />}
            {tab === 'notifications' && <NotificationsScreen />}
            {tab === 'settings' && <SettingsScreen />}
            {tab === 'more' && (
              <MoreScreen
                name={name}
                store={appSession?.store?.name || 'Tienda'}
                role={ROLE[role ?? 'STAFF']}
                rows={mobile.more}
                openTrades={openTrades}
                openRepairs={openRepairs}
                unread={unread.total}
                onOpen={go}
              />
            )}
          </div>
        </main>
        {phone ? (
          <nav className="mtab" data-testid="mobile-tab-bar" aria-label="Secciones">
            {mobile.bar.map((id) => {
              const active = tab === id;
              const pending = sectionUnread(unread.bySection, id);
              return (
                <button key={id} className={active ? 'on' : ''} type="button" data-testid={`sidebar-tab-${id}`} aria-label={sectionLabel(id)} aria-current={active ? 'page' : undefined} onClick={() => go(id)}>
                  <DeskIcon name={NAV_ICON[id]} size={22} />
                  <span className="mtab-label">{sectionLabel(id)}</span>
                  {pending > 0 ? <span className="dcount" aria-label={`${pending} en ${sectionLabel(id)}`}>{pending}</span> : null}
                </button>
              );
            })}
            <button className={moreActive ? 'on' : ''} type="button" data-testid="sidebar-tab-more" aria-label="Más" aria-current={moreActive ? 'page' : undefined} onClick={() => go('more')}>
              <ImanagerIcon name="mas" size={20} />
              <span className="mtab-label">Más</span>
            </button>
          </nav>
        ) : null}
        <DeskToast message={message} show={toastOn} />
        <DeskOverlays overlay={overlay} />
      </div>
    </DeskProvider>
    </ExchangeProvider>
    </CatalogProvider>
  );
}
