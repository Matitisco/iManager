import { BillingScreen, BillingAccessBanner } from './screens/BillingScreen';
import { CashScreen } from './screens/CashScreen';
import { CircleHelp } from 'lucide-react';
import { HelpScreen } from './screens/HelpScreen';
import { SampleStockBanner } from './getting-started';
import { PublicCatalogScreen } from './screens/PublicCatalogScreen';
import { toUserMessage, NETWORK_ERROR_MESSAGE } from '../lib/user-message';
import { OfflineScope } from './offline-banner';
import { useOfflineRecovery } from '../lib/offline-recovery';
import { useEffect, useRef, useState } from 'react';
import { BrandIsotipo } from '../components/brand-mark';
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
import { CommissionsScreen } from './screens/CommissionsScreen';
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
import { MobileTabBar } from './mobile-tab-bar';
import { canManageCommissions, canOpenSection, DESK_SECTIONS, mobileTabs, type DeskSectionId } from './sections';
import { ROUTE, tabFromHash } from './hash-route';
import type { DeskTab, Overlay } from './types';
import type { NoticeSection } from './unread-count';
import './desk.css';
import { ROLE_LABEL } from '../lib/roles';
import { InstallApp } from '../components/InstallApp';
import { InstallCard } from '../components/InstallHelp';

const NAV_ICON: Record<DeskSectionId, 'grid' | 'list' | 'cart' | 'swap' | 'user' | 'wrench' | 'bars' | 'bell' | 'comisiones'> = {
  cash: 'grid', publicCatalog: 'list', dashboard: 'grid', inventory: 'list', sales: 'cart', tradeins: 'swap',
  clients: 'user', service: 'wrench', reports: 'bars', commissions: 'comisiones', notifications: 'bell',
};
const MORE_SUB: Record<DeskSectionId, string> = {
  cash: 'Ingresos, egresos y cierre diario',
  dashboard: 'Resumen de la tienda',
  inventory: 'Equipos y stock',
  publicCatalog: 'Tu lista de precios pública',
  sales: 'Registro de ventas',
  reports: 'Ventas, stock, canjes, clientes y servicio',
  tradeins: 'Equipos dados y recibidos',
  clients: 'Agenda y saldos',
  service: 'Órdenes de reparación',
  commissions: 'Vendedores y pagos',
  notifications: 'Avisos de la tienda',
};

function sectionLabel(id: DeskSectionId) {
  return DESK_SECTIONS.find((section) => section.id === id)?.label ?? id;
}

function countWords(count: number, words: string) {
  return `${count} ${words}`;
}

function moreCount(id: DeskSectionId, openTrades: number, openRepairs: number, unreadTotal: number, commissions: number, catalogCount: number) {
  if (id === 'publicCatalog') return countWords(catalogCount, catalogCount === 1 ? 'visible' : 'visibles');
  if (id === 'commissions') return countWords(commissions, 'pendientes');
  if (id === 'tradeins') return countWords(openTrades, 'en curso');
  if (id === 'service') return countWords(openRepairs, openRepairs === 1 ? 'abierta' : 'abiertas');
  if (id === 'notifications') return countWords(unreadTotal, 'sin leer');
  return undefined;
}

function MoreScreen({
  name, store, role, rows, openTrades, openRepairs, unread, commissions, catalogCount, ownCommissions, onOpen,
}: {
  name: string;
  store: string;
  role: string;
  rows: DeskSectionId[];
  openTrades: number;
  openRepairs: number;
  unread: number;
  commissions: number;
  catalogCount: number;
  ownCommissions: boolean;
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
      <InstallCard />
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
              const count = moreCount(id, openTrades, openRepairs, unread, commissions, catalogCount);
              return (
                <button key={id} className="member" type="button" data-testid={`sidebar-tab-${id}`} onClick={() => onOpen(id)}>
                  <span className="ico-row"><DeskIcon name={NAV_ICON[id]} size={18} /></span>
                  <span className="info">
                    <span className="name">{id === 'commissions' && ownCommissions ? 'Mis comisiones' : sectionLabel(id)}</span>
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
      <div className="mlabel">Cuenta</div>
      <div className="card">
        <button className="member" type="button" data-testid="sidebar-tab-help" onClick={() => onOpen('help')}><span className="ico-row"><CircleHelp size={18} /></span><span className="info"><span className="name">Ayuda</span><span className="role">Guías y primeros pasos</span></span><span className="chev">›</span></button>
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

export function DeskApp({ installEnabled = true }: { installEnabled?: boolean }) {
  const { appSession, gettingStarted, tradeIns, inventory, user, repairOrders = [], commissionSummaries = {}, commissionDetails = {}, loadCommissions, backendStatus } = useAppContext();
  const role = appSession?.membership?.role;
  const sections = appSession?.membership?.sections;
  const commissionAccess = canManageCommissions(sections, role);
  const commissionPeriod = new Intl.DateTimeFormat('sv', { timeZone: appSession?.store?.timezone || 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit' }).format(new Date());
  const [commissionCountError, setCommissionCountError] = useState('');
  const [commissionRetry, setCommissionRetry] = useState(0);
  useOfflineRecovery(commissionCountError, () => setCommissionRetry(value => value + 1));
  const isStaff = role === 'STAFF';
  const phone = usePhoneLayout();
  const mobile = mobileTabs(sections, role);
  const allowed = (id: DeskTab) => id === 'billing' ? role === 'OWNER' : id === 'help' || id === 'more' || canOpenSection(id, sections, role);
  const [tab, setTab] = useState<DeskTab>(() => tabFromHash(window.location.hash));
  useEffect(() => {
    if (!user || backendStatus !== 'ready' || !loadCommissions || !appSession?.store || (tab !== 'more' && tab !== 'dashboard')) return;
    let active = true;
    setCommissionCountError('');
    void loadCommissions(commissionPeriod).catch((cause: unknown) => { if (active) setCommissionCountError(toUserMessage(cause, 'No se pudieron cargar las comisiones')); });
    return () => { active = false; };
  }, [appSession?.store?.id, commissionAccess, commissionPeriod, tab, backendStatus, commissionRetry]);
  const ownPending = commissionDetails[`mine:${commissionPeriod}`]?.person.pending;
  const pendingCommissions = commissionAccess ? (commissionSummaries[commissionPeriod]?.people.filter(person => person.pending.ARS > 0 || person.pending.USD > 0).length ?? 0) : Number(Boolean(ownPending && (ownPending.ARS > 0 || ownPending.USD > 0)));

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
    open: (next: Overlay) => {
      const writing = /^(new-|edit-)/.test(next.type) || ['del', 'import', 'store', 'warranty', 'invite', 'onboarding-stock', 'new-deposit', 'repair-deposit'].includes(next.type);
      if (writing && appSession?.billing?.readOnly) {
        setMessage('La tienda está en modo solo lectura. Revisá Plan y facturación.');
        setToastOn(true); return;
      }
      setOverlay(next);
    },
    close: () => setOverlay(null),
    toast: (text: string) => { setMessage(text); setToastOn(true); },
    isStaff,
    canManageSensitive: memberCanManageSensitive(appSession?.membership),
    back: showBack ? () => go('more') : undefined,
  };

  const nav: { id: DeskTab; label: string; icon: 'grid' | 'list' | 'cart' | 'swap' | 'user' | 'wrench' | 'bars' | 'comisiones'; size: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', size: 22 },
    { id: 'inventory', label: 'Inventario', icon: 'list', size: 22 },
    { id: 'publicCatalog', label: 'Catálogo', icon: 'list', size: 18 },
    { id: 'sales', label: 'Ventas', icon: 'cart', size: 22 },
    { id: 'tradeins', label: 'Canjes', icon: 'swap', size: 18 },
    { id: 'clients', label: 'Clientes', icon: 'user', size: 18 },
    { id: 'service', label: 'Servicio técnico', icon: 'wrench', size: 18 },
    { id: 'cash', label: 'Cajas', icon: 'grid', size: 20 },
    { id: 'reports', label: 'Reportes', icon: 'bars', size: 22 },
    { id: 'commissions', label: commissionAccess ? 'Comisiones' : 'Mis comisiones', icon: 'comisiones', size: 20 },
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
              <BrandIsotipo size={32} className="mstore-logo" />
              <span className="mstore-copy">
                <b className="mstore-word">iManager</b>
                <small data-testid="mobile-store-name" title={appSession?.store?.name || 'Tienda'}>{appSession?.store?.name || 'Tienda'}</small>
              </span>
            </div>
            <BlueDollar variant="chip" />
          </header>
        ) : null}
        {phone ? null : (
        <aside className="side">
          <div className="dbrand">
            <BrandIsotipo size={38} className="dlogo" />
            <div className="dbrand-copy">
              <b>iManager</b>
              <small title={appSession?.store?.name || 'Tienda'}>{appSession?.store?.name || 'Tienda'}</small>
            </div>
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
              <button className={`ditem${tab === 'help' ? ' on' : ''}`} type="button" data-testid="sidebar-tab-help" onClick={() => go('help')}><span className="dic"><CircleHelp size={18} /></span><span>Ayuda</span></button>
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
            <div className="info"><b>{name}</b><small>{ROLE_LABEL[appSession?.membership?.role ?? 'STAFF']}</small></div>
          </button>
        </aside>
        )}
        <main className="stage">
          <InstallApp enabled={installEnabled && !overlay && !toastOn} dashboard={tab === 'dashboard'} />
          <FxBanner />
          <BillingAccessBanner dashboard={tab === 'dashboard' && !appSession?.store?.onboardingStartedAt && !gettingStarted?.eligible} />
          <SampleStockBanner />
          <OfflineScope forced={commissionCountError === NETWORK_ERROR_MESSAGE}>
          {commissionCountError && commissionCountError !== NETWORK_ERROR_MESSAGE && tab === 'more' ? <p className="ferr" role="alert">{commissionCountError}</p> : null}
          <div key={tab} className={entered ? 'enter-f' : undefined}>
            {tab === 'help' && <HelpScreen />}
            {tab === 'dashboard' && <DashboardScreen />}
            {tab === 'inventory' && <InventoryScreen />}
            {tab === 'publicCatalog' && <PublicCatalogScreen />}
            {tab === 'sales' && <SalesScreen />}
            {tab === 'tradeins' && <TradeInsScreen />}
            {tab === 'clients' && <ClientsScreen />}
            {tab === 'service' && <ServiceScreen />}
            {tab === 'cash' && <CashScreen />}
            {tab === 'commissions' && <CommissionsScreen />}
            {tab === 'reports' && <ReportsScreen />}
            {tab === 'notifications' && <NotificationsScreen />}
            {tab === 'billing' && <BillingScreen key={appSession?.store?.id} />}
            {tab === 'settings' && <SettingsScreen />}
            {tab === 'more' && (
              <MoreScreen
                name={name}
                store={appSession?.store?.name || 'Tienda'}
                role={ROLE_LABEL[role ?? 'STAFF']}
                rows={mobile.more}
                openTrades={openTrades}
                openRepairs={openRepairs}
                commissions={pendingCommissions}
                catalogCount={inventory.filter(item => item.catalogIncluded).length}
                ownCommissions={!commissionAccess}
                unread={unread.total}
                onOpen={go}
              />
            )}
          </div>
          </OfflineScope>
        </main>
        {phone ? (
          <MobileTabBar
            buttons={[
              ...mobile.bar.map((id) => {
                const pending = sectionUnread(unread.bySection, id);
                return {
                  id,
                  label: sectionLabel(id),
                  active: tab === id,
                  pending,
                  testId: `sidebar-tab-${id}`,
                  icon: <DeskIcon name={NAV_ICON[id]} size={22} />,
                  onClick: () => go(id),
                };
              }),
              {
                id: 'more',
                label: 'Más',
                active: moreActive,
                pending: 0,
                testId: 'sidebar-tab-more',
                icon: <ImanagerIcon name="mas" size={20} />,
                onClick: () => go('more'),
              },
            ]}
          />
        ) : null}
        <DeskToast message={message} show={toastOn} />
        <DeskOverlays overlay={overlay} />
      </div>
    </DeskProvider>
    </ExchangeProvider>
    </CatalogProvider>
  );
}
