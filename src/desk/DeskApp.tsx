import { BillingScreen, BillingAccessBanner } from './screens/BillingScreen';
import { NoSectionAccess } from './screens/NoSectionAccess';
import { CashScreen } from './screens/CashScreen';
import { CircleHelp } from 'lucide-react';
import { HelpScreen } from './screens/HelpScreen';
import { SampleStockBanner } from './getting-started';
import { PublicCatalogScreen } from './screens/PublicCatalogScreen';
import { toUserMessage, NETWORK_ERROR_MESSAGE } from '../lib/user-message';
import { OfflineScope } from './offline-banner';
import { useOfflineRecovery } from '../lib/offline-recovery';
import { useEffect, useRef, useState } from 'react';
import { prefetchMainRoutes } from './prefetch-routes';
import { BrandIsotipo } from '../components/brand-mark';
import { hasStoreContactOffer } from '../lib/store-contact';
import { useAppContext } from '../context/AppContext';
import { initials, isInProgressTrade } from './format';
import { ImanagerIcon } from './icons';
import { REPAIR_DELIVERED } from './repairs';
import { usePhoneLayout } from './section-notices';
import { DashboardScreen } from './screens/DashboardScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { SalesScreen } from './screens/SalesScreen';
import { ClientsScreen } from './screens/ClientsScreen';
import { TradeInsScreen } from './screens/TradeInsScreen';
import { NotificationsScreen, SettingsScreen, useUnreadCounts } from './screens/AccountScreens';
import { CommissionsScreen } from './screens/CommissionsScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { ServiceScreen } from './screens/ServiceScreen';
import { BlueDollar } from './BlueDollar';
import { ExchangeProvider, exchangeFromStore, useMoney } from './exchange';
import { DeskOverlays } from './DeskOverlays';
import { CatalogProvider } from './catalog';
import { DeskToast } from './toast';
import { DeskIcon, DeskProvider } from './ui';
import { canManageSensitive as memberCanManageSensitive } from './sensitive-access';
import { MobileTabBar } from './mobile-tab-bar';
import { canManageCommissions } from './sections';
import { HistoryScreen } from './screens/HistoryScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { FollowUpsScreen } from './screens/FollowUps';
import { ReturnsScreen } from './screens/ReturnsScreen';
import { StockCountScreen } from './screens/StockCountScreen';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { canonicalHash, ROUTE, tabFromHash } from './hash-route';
import type { DeskTab, Overlay } from './types';
import { NavChrome } from './group-tabs';
import {
  accessLabel,
  barOwns,
  desktopNav,
  EMPTY_PENDING,
  groupOf,
  groupPending,
  mobileBar,
  moreTestId,
  NAV_GROUPS,
  openGroupsKey,
  readOpenGroups,
  sectionAllowed,
  sectionPending,
  toggleOpenGroup,
  visibleOpenGroups,
  type NavGroupId,
  type NavIcon,
  type PendingInput,
} from './nav';
import { fetchFollowUps } from '../services/accounts-api';
import './desk.css';
import { ROLE_LABEL } from '../lib/roles';
import { InstallApp } from '../components/InstallApp';
import { InstallCard } from '../components/InstallHelp';

const E2E_NAV = import.meta.env.VITE_TEST_AUTH_MODE === 'e2e';

function countWords(count: number, words: string) {
  return `${count} ${words}`;
}

function sectionAside(id: DeskTab, pending: PendingInput, catalogCount: number) {
  if (id === 'publicCatalog') return countWords(catalogCount, catalogCount === 1 ? 'visible' : 'visibles');
  if (id === 'commissions') return countWords(pending.commissions, 'pendientes');
  if (id === 'tradeins') return countWords(pending.openTrades, 'en curso');
  if (id === 'service') return countWords(pending.openRepairs, pending.openRepairs === 1 ? 'abierta' : 'abiertas');
  if (id === 'notifications') return countWords(pending.notifications, 'sin leer');
  if (id === 'followups' && pending.followUps > 0) return countWords(pending.followUps, 'para hoy');
  return undefined;
}

function NavGlyph({ name, size }: { name: NavIcon; size: number }) {
  if (name === 'help') return <CircleHelp size={size} />;
  return <DeskIcon name={name} size={size} />;
}

function badgeLabel(id: DeskTab, label: string, count: number) {
  return id === 'notifications' ? `${count} en total` : `${count} en ${label}`;
}

function MoreRow({ id, label, subtitle, icon, aside, onOpen }: {
  id: DeskTab;
  label: string;
  subtitle: string;
  icon: NavIcon;
  aside?: string;
  onOpen: (id: DeskTab) => void;
}) {
  return (
    <button className="member" type="button" data-testid={moreTestId(id)} onClick={() => onOpen(id)}>
      <span className="ico-row"><NavGlyph name={icon} size={18} /></span>
      <span className="info">
        <span className="name">{label}</span>
        <span className="role">{subtitle}</span>
      </span>
      {aside ? <span className="rtxt">{aside}</span> : null}
      <span className="chev" aria-hidden="true">›</span>
    </button>
  );
}

function MoreScreen({
  name, store, role, nav, pending, catalogCount, onOpen,
}: {
  name: string;
  store: string;
  role: string;
  nav: ReturnType<typeof desktopNav>;
  pending: PendingInput;
  catalogCount: number;
  onOpen: (id: DeskTab) => void;
}) {
  return (
    <div className="dscreen mmore" data-testid="more-screen">
      <div className="whead">
        <div>
          <h1>Más</h1>
          <div className="wsub">Todas las secciones, agrupadas</div>
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
      {nav.main.map((block) => block.kind === 'link' ? (
        <div className="card" key={block.item.id}>
          <MoreRow {...block.item} aside={sectionAside(block.item.id, pending, catalogCount)} onOpen={onOpen} />
        </div>
      ) : (
        <div key={block.id}>
          <div className="mlabel">{block.label}</div>
          <div className="card">
            {block.items.map((item) => (
              <MoreRow key={item.id} {...item} aside={sectionAside(item.id, pending, catalogCount)} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
      <div className="mlabel">Cuenta</div>
      <div className="card">
        {nav.cuenta.map((item) => (
          <MoreRow key={item.id} {...item} aside={sectionAside(item.id, pending, catalogCount)} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function SideLink({ item, on, count, sub, onOpen }: {
  item: { id: DeskTab; label: string; icon: NavIcon };
  on: boolean;
  count: number;
  sub?: boolean;
  onOpen: (id: DeskTab) => void;
}) {
  return (
    <button className={`ditem${sub ? ' sub' : ''}${on ? ' on' : ''}`} type="button" data-testid={`sidebar-tab-${item.id}`} onClick={() => onOpen(item.id)}>
      <span className="dic"><NavGlyph name={item.icon} size={18} /></span>
      <span>{item.label}</span>
      {count > 0 ? <span className="dcount" aria-label={badgeLabel(item.id, item.label, count)}>{count}</span> : null}
    </button>
  );
}

function FxBanner() {
  const warning = useMoney().warning;
  if (!warning) return null;
  return <p className="fx-warn" data-testid="fx-warning" role="status">{warning}</p>;
}

export function DeskApp({ installEnabled = true }: { installEnabled?: boolean }) {
  const { appSession, gettingStarted, tradeIns, inventory, user, repairOrders = [], commissionSummaries = {}, commissionDetails = {}, loadCommissions, backendStatus, sessionConfirmed } = useAppContext();
  useEffect(() => { void prefetchMainRoutes(); }, []);
  const role = appSession?.membership?.role;
  const sections = appSession?.membership?.sections;
  const commissionAccess = canManageCommissions(sections, role);
  const commissionPeriod = new Intl.DateTimeFormat('sv', { timeZone: appSession?.store?.timezone || 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit' }).format(new Date());
  const [commissionCountError, setCommissionCountError] = useState('');
  const [commissionRetry, setCommissionRetry] = useState(0);
  useOfflineRecovery(commissionCountError, () => setCommissionRetry(value => value + 1));
  const isStaff = role === 'STAFF';
  const phone = usePhoneLayout();
  const allowed = (id: DeskTab) => sectionAllowed(id, sections, role);
  const [tab, setTab] = useState<DeskTab>(() => tabFromHash(window.location.hash));
  const [followUpCount, setFollowUpCount] = useState(0);
  const [storedGroups, setStoredGroups] = useState<NavGroupId[]>(() => (
    E2E_NAV ? NAV_GROUPS.map((group) => group.id) : readOpenGroups(localStorage.getItem(openGroupsKey(user?.uid || '')))
  ));
  useEffect(() => {
    if (sessionConfirmed === false || !user || backendStatus !== 'ready' || !loadCommissions || !appSession?.store || (tab !== 'more' && tab !== 'dashboard')) return;
    let active = true;
    setCommissionCountError('');
    void loadCommissions(commissionPeriod).catch((cause: unknown) => { if (active) setCommissionCountError(toUserMessage(cause, 'No se pudieron cargar las comisiones')); });
    return () => { active = false; };
  }, [appSession?.store?.id, commissionAccess, commissionPeriod, tab, backendStatus, commissionRetry, sessionConfirmed]);
  const ownPending = commissionDetails[`mine:${commissionPeriod}`]?.person.pending;
  const pendingCommissions = commissionAccess ? (commissionSummaries[commissionPeriod]?.people.filter(person => person.pending.ARS > 0 || person.pending.USD > 0).length ?? 0) : Number(Boolean(ownPending && (ownPending.ARS > 0 || ownPending.USD > 0)));
  useEffect(() => {
    if (E2E_NAV) {
      setStoredGroups(NAV_GROUPS.map((group) => group.id));
      return;
    }
    setStoredGroups(readOpenGroups(localStorage.getItem(openGroupsKey(user?.uid || 'local'))));
  }, [user?.uid]);
  useEffect(() => {
    if (E2E_NAV) return;
    localStorage.setItem(openGroupsKey(user?.uid || 'local'), JSON.stringify(storedGroups));
  }, [storedGroups, user?.uid]);
  useEffect(() => {
    if (!user || !sectionAllowed('followups', sections, role)) {
      setFollowUpCount(0);
      return;
    }
    let active = true;
    void fetchFollowUps(user).then((data) => { if (active) setFollowUpCount(data.cards.length); }).catch(() => { if (active) setFollowUpCount(0); });
    return () => { active = false; };
  }, [user, sections, role, appSession?.store?.id]);

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
    const apply = (closeOverlay: boolean) => {
      const canonical = canonicalHash(window.location.hash);
      if (canonical && canonical !== window.location.hash) history.replaceState(null, '', canonical);
      setTab(tabFromHash(window.location.hash));
      if (closeOverlay) setOverlay(null);
    };
    if (!window.location.hash) history.replaceState(null, '', '#/dashboard');
    // Role arrives after the first paint. Read the hash again so a navigation
    // that landed before this listener was attached still opens that screen.
    apply(false);
    const onHash = () => { apply(true); setEntered(true); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
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
    else if (target === 'suppliers') next = { type: 'supplier', id: recordId };
    else if (target === 'returns') next = { type: 'return', id: recordId };
    else if (target === 'expenses') next = { type: 'edit-expense', id: recordId };
    else return;
    setPendingRecordOpen({ tab: target, overlay: next });
    go(target);
  };

  const slots = mobileBar(sections, role);
  const showBack = phone && tab !== 'more' && !barOwns(tab, slots);
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

  const nav = desktopNav(sections, role);
  const pending: PendingInput = {
    ...EMPTY_PENDING,
    unread: unread.bySection,
    openTrades,
    openRepairs,
    followUps: followUpCount,
    notifications: unread.total,
    commissions: pendingCommissions,
  };
  const activeGroup = groupOf(tab);
  const openGroups = visibleOpenGroups(storedGroups, activeGroup);
  const moreActive = !barOwns(tab, slots);

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
              {nav.main.map((block) => block.kind === 'link' ? (
                <SideLink key={block.item.id} item={block.item} on={tab === block.item.id} count={sectionPending(block.item.id, pending)} onOpen={go} />
              ) : (
                <div key={block.id}>
                  <button className={`ditem dgroup-h${openGroups.has(block.id) ? ' open' : ''}`} type="button" data-testid={`nav-group-${block.id}`} aria-expanded={openGroups.has(block.id)} onClick={() => setStoredGroups((current) => toggleOpenGroup(current, block.id, activeGroup))}>
                    <span className="dic"><NavGlyph name={block.icon} size={18} /></span>
                    <span>{block.label}</span>
                    {!openGroups.has(block.id) && groupPending(block.items.map((item) => item.id), pending) > 0 ? <span className="dcount" aria-label={`${groupPending(block.items.map((item) => item.id), pending)} en ${block.label}`}>{groupPending(block.items.map((item) => item.id), pending)}</span> : null}
                    <span className="chev" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></span>
                  </button>
                  {openGroups.has(block.id) ? block.items.map((item) => (
                    <SideLink key={item.id} item={item} sub on={tab === item.id} count={sectionPending(item.id, pending)} onOpen={go} />
                  )) : null}
                </div>
              ))}
            </div>
            <div className="dlabel">Cuenta</div>
            <div className="dgroup">
              {nav.cuenta.map((item) => (
                <SideLink key={item.id} item={item} on={tab === item.id} count={sectionPending(item.id, pending)} onOpen={go} />
              ))}
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
          <NavChrome pending={pending}>
          <div key={tab} className={entered ? 'enter-f' : undefined}>
            {!allowed(tab) ? <NoSectionAccess section={accessLabel(tab)} ownerName={appSession?.store?.ownerDisplayName || 'el propietario'} onDashboard={() => go('dashboard')} /> : <>
            {tab === 'help' && <HelpScreen />}
            {tab === 'dashboard' && <DashboardScreen />}
            {tab === 'inventory' && <InventoryScreen />}
            {tab === 'stockCount' && <StockCountScreen standalone onBack={() => go('inventory')} />}
            {tab === 'suppliers' && <SuppliersScreen />}
            {tab === 'publicCatalog' && <PublicCatalogScreen />}
            {tab === 'sales' && <SalesScreen />}
            {tab === 'returns' && <ReturnsScreen />}
            {tab === 'tradeins' && <TradeInsScreen />}
            {tab === 'clients' && <ClientsScreen />}
            {tab === 'followups' && <FollowUpsScreen />}
            {tab === 'service' && <ServiceScreen />}
            {tab === 'cash' && <CashScreen />}
            {tab === 'expenses' && <ExpensesScreen />}
            {tab === 'commissions' && <CommissionsScreen />}
            {tab === 'reports' && <ReportsScreen />}
            {tab === 'history' && <HistoryScreen />}
            {tab === 'notifications' && <NotificationsScreen />}
            {tab === 'billing' && <BillingScreen key={appSession?.store?.id} />}
            {tab === 'settings' && <SettingsScreen />}
            {tab === 'more' && (
              <MoreScreen
                name={name}
                store={appSession?.store?.name || 'Tienda'}
                role={ROLE_LABEL[role ?? 'STAFF']}
                nav={nav}
                pending={pending}
                catalogCount={inventory.filter(item => item.catalogIncluded).length}
                onOpen={go}
              />
            )}
            </>}
          </div>
          </NavChrome>
          </OfflineScope>
        </main>
        {phone ? (
          <MobileTabBar
            buttons={[
              ...slots.map((slot) => ({
                id: slot.id,
                label: slot.label,
                active: slot.activeIds.includes(tab),
                pending: groupPending(slot.activeIds, pending),
                testId: slot.testId,
                icon: <NavGlyph name={slot.icon} size={22} />,
                onClick: () => go(slot.target),
              })),
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
