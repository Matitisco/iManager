import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppContext } from '../context/AppContext';
import type { CreatedInvitation } from '../services/invitations-api';
import {
  canOpenScreen,
  type MobileScreen,
  type ReportPeriod,
  type SalesPeriod,
} from './logic';

export type MenuEntity = 'product' | 'sale' | 'trade' | 'client';
export type ImportEntity = 'inv' | 'ven' | 'cj' | 'cl';

export type Overlay =
  | { type: 'menu'; entity: MenuEntity; id: string; label: string; top: number }
  | { type: 'delete'; entity: MenuEntity; id: string; label: string }
  | { type: 'product'; id: string }
  | { type: 'product-edit'; id: string }
  | { type: 'product-new' }
  | { type: 'sale'; id: string }
  | { type: 'sale-edit'; id: string }
  | { type: 'sale-new'; productId?: string; clientId?: string }
  | { type: 'trade'; id: string }
  | { type: 'trade-edit'; id: string }
  | { type: 'trade-new' }
  | { type: 'client'; id: string }
  | { type: 'client-edit'; id: string }
  | { type: 'client-new' }
  | { type: 'import'; entity: ImportEntity }
  | { type: 'invite' }
  | { type: 'invite-link'; invitation: CreatedInvitation }
  | { type: 'invites' }
  | { type: 'store' }
  | { type: 'profile' }
  | { type: 'password' }
  | { type: 'billing' }
  | { type: 'sort' }
  | { type: 'sale-period' }
  | { type: 'logout' };

interface Checks {
  inv: boolean;
  ven: boolean;
  cj: boolean;
}

const CHECKS_KEY = 'im-mobile-checks';
const READ_KEY = 'im-mobile-read';

function readChecks(): Checks {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CHECKS_KEY) ?? '') as Partial<Checks>;
    return { inv: !!parsed.inv, ven: !!parsed.ven, cj: !!parsed.cj };
  } catch {
    return { inv: false, ven: false, cj: false };
  }
}

function loadReadIds(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(READ_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export interface MobileUi {
  screen: MobileScreen;
  go: (screen: MobileScreen) => void;
  back: () => void;
  toast: (message: string) => void;
  toastMessage: string;
  overlay: Overlay | null;
  openOverlay: (overlay: Overlay) => void;
  closeOverlay: () => void;
  openMenu: (entity: MenuEntity, id: string, label: string, point: { x: number; y: number }) => void;
  revision: number;
  refresh: () => Promise<void>;
  searchOn: Record<string, boolean>;
  toggleSearch: (key: string) => void;
  queries: Record<string, string>;
  setQuery: (key: string, value: string) => void;
  invChip: string;
  setInvChip: (label: string) => void;
  invSort: 'Recientes' | 'Precio ↑' | 'Precio ↓';
  setInvSort: (sort: 'Recientes' | 'Precio ↑' | 'Precio ↓') => void;
  salePeriod: SalesPeriod;
  setSalePeriod: (period: SalesPeriod) => void;
  tradeChip: string;
  setTradeChip: (label: string) => void;
  clientChip: 'Todos' | 'Con saldo pendiente';
  setClientChip: (chip: 'Todos' | 'Con saldo pendiente') => void;
  notifChip: 'Todas' | 'Sin leer';
  setNotifChip: (chip: 'Todas' | 'Sin leer') => void;
  repTab: 'Ventas' | 'Stock' | 'Canjes';
  setRepTab: (tab: 'Ventas' | 'Stock' | 'Canjes') => void;
  repPeriod: ReportPeriod;
  setRepPeriod: (period: ReportPeriod) => void;
  repBar: number | null;
  setRepBar: (index: number | null) => void;
  repCat: string | null;
  setRepCat: (cat: string | null) => void;
  canBack: boolean;
  readIds: string[];
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  checks: Checks;
  toggleCheck: (key: keyof Checks) => void;
}

const MobileUiContext = createContext<MobileUi | null>(null);

export function useMobileUi() {
  const value = useContext(MobileUiContext);
  if (!value) throw new Error('El layout móvil no está listo');
  return value;
}

export function MobileProvider({
  children,
  initialScreen = 'dash',
  onNavigate,
}: {
  children: ReactNode;
  initialScreen?: MobileScreen;
  onNavigate?: (screen: MobileScreen) => void;
}) {
  const { appSession, refreshStoreData } = useAppContext();
  const role = appSession?.membership?.role;
  const [screen, setScreen] = useState<MobileScreen>(initialScreen);
  const [history, setHistory] = useState<MobileScreen[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [revision, setRevision] = useState(0);
  const [searchOn, setSearchOn] = useState<Record<string, boolean>>({});
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [invChip, setInvChip] = useState('Todos');
  const [invSort, setInvSort] = useState<'Recientes' | 'Precio ↑' | 'Precio ↓'>('Recientes');
  const [salePeriod, setSalePeriod] = useState<SalesPeriod>('Mes');
  const [tradeChip, setTradeChip] = useState('Todos');
  const [clientChip, setClientChip] = useState<'Todos' | 'Con saldo pendiente'>('Todos');
  const [notifChip, setNotifChip] = useState<'Todas' | 'Sin leer'>('Todas');
  const [repTab, setRepTab] = useState<'Ventas' | 'Stock' | 'Canjes'>('Ventas');
  const [repPeriod, setRepPeriod] = useState<ReportPeriod>('Mes');
  const [repBar, setRepBar] = useState<number | null>(null);
  const [repCat, setRepCat] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>(loadReadIds);
  const [checks, setChecks] = useState<Checks>(readChecks);

  const toast = (message: string) => {
    setToastMessage('');
    window.setTimeout(() => setToastMessage(message), 10);
    window.setTimeout(() => setToastMessage(''), 2300);
  };

  const go = (next: MobileScreen) => {
    if (!canOpenScreen(role, next)) return;
    if (onNavigate && next !== initialScreen) {
      onNavigate(next);
      setOverlay(null);
      return;
    }
    const mainTabs: MobileScreen[] = ['dash', 'inv', 'ven', 'rep', 'mas'];
    if (mainTabs.includes(next)) {
      setHistory([]);
    } else {
      setHistory((prev) => [...prev, screen]);
    }
    setScreen(next);
    setOverlay(null);
  };

  useEffect(() => {
    if (role === 'STAFF' && screen === 'rep') setScreen('dash');
  }, [role, screen]);

  const back = () => {
    setHistory((prev) => {
      const previous = prev[prev.length - 1] ?? 'mas';
      setScreen(previous);
      return prev.slice(0, -1);
    });
    setOverlay(null);
  };

  const value = useMemo<MobileUi>(() => ({
    screen,
    go,
    back,
    toast,
    toastMessage,
    overlay,
    openOverlay: setOverlay,
    closeOverlay: () => setOverlay(null),
    openMenu: (entity, id, label, point) => {
      const phone = document.querySelector('.im-app .phone');
      const bounds = phone?.getBoundingClientRect();
      const y = bounds ? point.y - bounds.top : point.y;
      const height = bounds?.height ?? window.innerHeight;
      const top = y + 160 < height - 80 ? y + 8 : Math.max(72, y - 150);
      setOverlay({ type: 'menu', entity, id, label, top });
    },
    revision,
    refresh: async () => {
      await refreshStoreData();
      setRevision((current) => current + 1);
    },
    searchOn,
    toggleSearch: (key) => {
      setSearchOn((prev) => ({ ...prev, [key]: !prev[key] }));
      if (searchOn[key]) setQueries((prev) => ({ ...prev, [key]: '' }));
    },
    queries,
    setQuery: (key, query) => setQueries((prev) => ({ ...prev, [key]: query })),
    invChip,
    setInvChip,
    invSort,
    setInvSort,
    salePeriod,
    setSalePeriod,
    tradeChip,
    setTradeChip,
    clientChip,
    setClientChip,
    notifChip,
    setNotifChip,
    repTab,
    setRepTab: (tab) => {
      setRepTab(tab);
      setRepCat(null);
      setRepBar(null);
    },
    repPeriod,
    setRepPeriod: (period) => {
      setRepPeriod(period);
      setRepBar(null);
    },
    repBar,
    setRepBar,
    repCat,
    setRepCat: (cat) => setRepCat((current) => current === cat ? null : cat),
    canBack: history.length > 0,
    readIds,
    markRead: (id) => {
      setReadIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        sessionStorage.setItem(READ_KEY, JSON.stringify(next));
        return next;
      });
    },
    markAllRead: (ids) => {
      setReadIds((prev) => {
        const next = Array.from(new Set([...prev, ...ids]));
        sessionStorage.setItem(READ_KEY, JSON.stringify(next));
        return next;
      });
    },
    checks,
    toggleCheck: (key) => {
      setChecks((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        sessionStorage.setItem(CHECKS_KEY, JSON.stringify(next));
        return next;
      });
    },
  }), [
    screen, history.length, toastMessage, overlay, revision, searchOn, queries, invChip, invSort, salePeriod,
    tradeChip, clientChip, notifChip, repTab, repPeriod, repBar, repCat, readIds, checks, role, refreshStoreData,
    onNavigate, initialScreen,
  ]);

  return <MobileUiContext.Provider value={value}>{children}</MobileUiContext.Provider>;
}
