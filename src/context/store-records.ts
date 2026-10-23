import { cacheEpoch, clearStoreLists, readStoreLists, readStoreListsAsync, writeStoreLists, type StoreLists } from '../lib/boot-cache';
import { toUserMessage } from '../lib/user-message';
import { useOfflineRecovery } from '../lib/offline-recovery';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Client, ClientCategory, CustomColumn, CustomColumnEntity, Product, RepairOrder, Sale, TradeIn } from '../types';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { fetchBackendInventory } from '../services/inventory-api';
import { fetchBackendClients, fetchClientCategoriesApi } from '../services/clients-api';
import { fetchBackendSales } from '../services/sales-api';
import { fetchBackendTradeIns } from '../services/trade-ins-api';
import { fetchBackendRepairs } from '../services/repairs-api';
import { fetchNotifications, fetchOperationDrafts, type OperationNotification, type OperationOptions, type OperationSource } from '../services/operations-api';
import { publishListMutation, useListRefresh } from '../lib/list-sync';
import { normalizeDropdownOptions } from '../utils/dropdown-options';
import { canOpenSection } from '../desk/sections';

const CUSTOM_COLUMN_ENTITIES: CustomColumnEntity[] = ['inventory', 'clients', 'sales', 'trade-ins'];

function normalizeCustomColumn(id: string, raw: Record<string, unknown>): CustomColumn {
  const type = raw.type === 'number' || raw.type === 'enum' || raw.type === 'tags' ? raw.type : 'text';
  const entity = CUSTOM_COLUMN_ENTITIES.includes(raw.entity as CustomColumnEntity)
    ? (raw.entity as CustomColumnEntity)
    : 'inventory';

  return {
    id,
    label: String(raw.label ?? ''),
    type,
    options: type === 'enum'
      ? normalizeDropdownOptions(Array.isArray(raw.options) ? raw.options : [])
      : undefined,
    entity,
  };
}

export function withoutStoredCost(item: Product): Product {
  if (!Object.prototype.hasOwnProperty.call(item, 'cost')) return item;
  const next = { ...item };
  delete next.cost;
  return next;
}

export function visibleInventory(items: Product[], seeCosts: boolean) {
  return seeCosts ? items : items.map(withoutStoredCost);
}

function customColumnsStorageKey(uid: string) {
  return `customColumns:${uid}`;
}

export function readLocalCustomColumns(uid: string): CustomColumn[] {
  try {
    const raw = window.localStorage.getItem(customColumnsStorageKey(uid));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is Record<string, unknown> => !!value && typeof value === 'object')
      .map((value) => normalizeCustomColumn(String(value.id ?? ''), value))
      .filter((column) => column.id);
  } catch {
    return [];
  }
}

type StoreRecordsInput = {
  user: AuthUserLike | null;
  appSession: AppSession | null;
  backendStatus: BackendConnectionStatus;
};

function rememberedLists(storeId: string | null) {
  return storeId ? readStoreLists(storeId) : null;
}

export function useStoreRecords({ user, appSession, backendStatus }: StoreRecordsInput) {
  const activeStoreAtStart = appSession?.store?.id ?? null;
  const remembered = rememberedLists(activeStoreAtStart);
  const [inventory, setInventory] = useState<Product[]>(() => remembered?.inventory ?? []);
  const [repairOrders, setRepairOrders] = useState<RepairOrder[]>([]);
  const [repairOrdersError, setRepairOrdersError] = useState<string | null>(null);
  const [repairRetry, setRepairRetry] = useState(0);
  const [sales, setSales] = useState<Sale[]>(() => remembered?.sales ?? []);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>(() => remembered?.tradeIns ?? []);
  const [clients, setClients] = useState<Client[]>(() => remembered?.clients ?? []);
  const [operationOptions, setOperationOptions] = useState<Partial<Record<OperationSource, OperationOptions>>>({});
  const [operationDrafts, setOperationDrafts] = useState<TradeIn[]>([]);
  const [operationNotifications, setOperationNotifications] = useState<OperationNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notificationRetry, setNotificationRetry] = useState(0);
  useOfflineRecovery(repairOrdersError, () => setRepairRetry(value => value + 1));
  useOfflineRecovery(notificationsError, () => setNotificationRetry(value => value + 1));
  const [clientCategories, setClientCategories] = useState<ClientCategory[]>(() => remembered?.clientCategories ?? []);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [listsResolvedFor, setListsResolvedFor] = useState<string | null>(() => remembered ? `${user?.uid ?? ''}:${activeStoreAtStart ?? ''}` : null);
  const [listsFetch, setListsFetch] = useState<{ scope: string; failed: boolean } | null>(null);
  const scopeRef = useRef('');
  const generation = useRef(0);
  const readTickets = useRef(new Map<string, number>());
  const pendingWrites = useRef(0);
  const initialReads = useRef(0);
  const scopeEpoch = useRef({ key: '', epoch: 0 });
  const shownStore = useRef(activeStoreAtStart);

  const activeStoreId = appSession?.store?.id ?? null;
  const backendReady = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
  const canAccess = (section: OperationSource | 'reports' | 'notifications' | 'service') => canOpenSection(section, appSession?.membership?.sections, appSession?.membership?.role);
  const backendInventoryEnabled = backendReady && canAccess('inventory');
  const loadInventoryEnabled = backendReady && canAccess('inventory');
  const backendClientsEnabled = backendReady && canAccess('clients');
  const backendSalesEnabled = backendReady && canAccess('sales');
  const loadSalesEnabled = backendReady && canAccess('sales');
  const backendTradeInsEnabled = backendReady && canAccess('tradeins');
  const loadTradeInsEnabled = backendReady && canAccess('tradeins');
  const loadRepairsEnabled = backendReady && canAccess('service');
  const scopeKey = `${user?.uid ?? ''}:${activeStoreId ?? ''}:${backendReady ? 'ready' : backendStatus}:${appSession?.membership?.role ?? ''}:${[canAccess('inventory'), canAccess('sales'), canAccess('tradeins'), canAccess('clients'), canAccess('service'), canAccess('reports'), canAccess('notifications')].map(Number).join('')}`;
  if (scopeEpoch.current.key !== scopeKey) {
    scopeEpoch.current = { key: scopeKey, epoch: scopeEpoch.current.epoch + 1 };
    pendingWrites.current = 0;
    initialReads.current = 0;
  }
  const currentScope = `${scopeKey}:${scopeEpoch.current.epoch}`;
  scopeRef.current = currentScope;
  const beginRead = useCallback((key: string) => {
    if (scopeRef.current !== currentScope) return () => false;
    const ticket = (readTickets.current.get(key) ?? 0) + 1;
    readTickets.current.set(key, ticket);
    const seen = generation.current;
    return () => scopeRef.current === currentScope && pendingWrites.current === 0
      && generation.current === seen && readTickets.current.get(key) === ticket;
  }, [currentScope]);
  const scopedSetter = <T,>(setter: Dispatch<SetStateAction<T>>): Dispatch<SetStateAction<T>> => value => {
    if (scopeRef.current !== currentScope) return;
    setter(previous => scopeRef.current !== currentScope ? previous
      : typeof value === 'function' ? (value as (previous: T) => T)(previous) : value);
  };

  const trackInitialRead = () => {
    initialReads.current += 1;
    return () => { if (scopeRef.current === currentScope) initialReads.current -= 1; };
  };

  const listKey = `${user?.uid ?? ''}:${activeStoreId ?? ''}`;
  const sessionOpen = Boolean(user) && !appSession?.onboardingRequired && (backendStatus === 'ready' || backendStatus === 'checking');
  if (shownStore.current !== activeStoreId) {
    shownStore.current = activeStoreId;
    const next = rememberedLists(activeStoreId);
    setInventory(next?.inventory ?? []);
    setSales(next?.sales ?? []);
    setTradeIns(next?.tradeIns ?? []);
    setClients(next?.clients ?? []);
    setClientCategories(next?.clientCategories ?? []);
    setListsResolvedFor(next ? listKey : null);
  }
  const listsLoaded = !sessionOpen || listsResolvedFor === listKey;

  useEffect(() => {
    setOperationOptions({});
    setOperationDrafts([]);
    setOperationNotifications([]);
    setNotificationsError(null);
    setNotificationsLoading(false);
    if (backendStatus === 'checking') return;
    if (!backendInventoryEnabled && !loadInventoryEnabled) setInventory([]);
    if (!backendClientsEnabled) setClients([]);
    if (!backendSalesEnabled && !loadSalesEnabled) setSales([]);
    if (!backendTradeInsEnabled && !loadTradeInsEnabled) setTradeIns([]);
    if (!loadRepairsEnabled) { setRepairOrders([]); setRepairOrdersError(null); }
  }, [currentScope]);

  useEffect(() => {
    const previous = shownStore.current;
    return () => {
      if (previous && previous !== shownStore.current) clearStoreLists(previous);
    };
  }, [activeStoreId]);

  useEffect(() => {
    if (!sessionOpen || !activeStoreId || readStoreLists(activeStoreId) || listsResolvedFor === listKey) return;
    let cancelled = false;
    const current = beginRead('cache');
    void readStoreListsAsync(activeStoreId).then((cached) => {
      if (cancelled || !current() || !cached || shownStore.current !== activeStoreId) return;
      setInventory(cached.inventory);
      setSales(cached.sales);
      setTradeIns(cached.tradeIns);
      setClients(cached.clients);
      setClientCategories(cached.clientCategories);
      setListsResolvedFor(listKey);
    });
    return () => { cancelled = true; };
  }, [sessionOpen, activeStoreId, listKey, listsResolvedFor, currentScope]);

  useEffect(() => {
    if (!activeStoreId || listsResolvedFor !== listKey) return;
    const ticket = cacheEpoch();
    const snapshot: StoreLists = { inventory, sales, tradeIns, clients, clientCategories, savedAt: Date.now() };
    const timer = window.setTimeout(() => {
      if (ticket !== cacheEpoch()) return;
      writeStoreLists(activeStoreId, snapshot);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [activeStoreId, listKey, listsResolvedFor, inventory, sales, tradeIns, clients, clientCategories]);

  useEffect(() => {
    if (!user || !sessionOpen) return;
    let cancelled = false;
    const key = listKey;
    const inventoryCurrent = beginRead('inventory');
    const salesCurrent = beginRead('sales');
    const clientsCurrent = beginRead('clients');
    const tradesCurrent = beginRead('tradeIns');
    const storeId = activeStoreId;
    const seeCosts = canAccess('reports');
    const wantInventory = backendStatus === 'checking' || loadInventoryEnabled;
    const wantSales = backendStatus === 'checking' || loadSalesEnabled;
    const wantClients = backendStatus === 'checking' || backendClientsEnabled;
    const wantTrades = backendStatus === 'checking' || loadTradeInsEnabled;
    const load = async () => {
      try {
        await user.getIdToken();
      } catch (error) {
        if (cancelled) return;
        console.error('Backend list load failed.', error);
        if (scopeRef.current === currentScope) {
          setListsResolvedFor(key);
          setListsFetch({ scope: currentScope, failed: true });
        }
        return;
      }
      if (cancelled) return;
      const [inventoryResult, salesResult, clientsResult, tradesResult] = await Promise.all([
        wantInventory
          ? fetchBackendInventory(user).then((items) => visibleInventory(items, seeCosts)).catch((error: unknown) => {
            console.error('Backend inventory load failed.', error);
            return null;
          })
          : Promise.resolve(undefined),
        wantSales
          ? fetchBackendSales(user).catch((error: unknown) => {
            console.error('Backend sales load failed.', error);
            return null;
          })
          : Promise.resolve(undefined),
        wantClients
          ? Promise.all([
            fetchBackendClients(user),
            fetchClientCategoriesApi(user).catch(() => [] as ClientCategory[]),
          ]).catch((error: unknown) => {
            console.error('Backend clients load failed.', error);
            return null;
          })
          : Promise.resolve(undefined),
        wantTrades
          ? fetchBackendTradeIns(user).catch((error: unknown) => {
            console.error('Backend trade-ins load failed.', error);
            return null;
          })
          : Promise.resolve(undefined),
      ]);
      if (cancelled || scopeRef.current !== currentScope || shownStore.current !== storeId) return;
      if (inventoryCurrent() && Array.isArray(inventoryResult)) setInventory(inventoryResult);
      if (salesCurrent() && Array.isArray(salesResult)) setSales(salesResult);
      if (clientsCurrent() && clientsResult) {
        setClients(clientsResult[0]);
        setClientCategories(clientsResult[1]);
      }
      if (tradesCurrent() && Array.isArray(tradesResult)) setTradeIns(tradesResult);
      setListsResolvedFor(key);
      setListsFetch({ scope: currentScope, failed: [inventoryResult, salesResult, clientsResult, tradesResult].some(result => result === null) });
    };
    const finished = trackInitialRead();
    void load().finally(finished);
    return () => { cancelled = true; };
  }, [currentScope, sessionOpen, listKey, activeStoreId, backendStatus, loadInventoryEnabled, loadSalesEnabled, backendClientsEnabled, loadTradeInsEnabled, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const current = beginRead('repairs');
    const load = async () => {
      try {
        const rows = await fetchBackendRepairs(user);
        if (cancelled || !current()) return;
        setRepairOrders(rows);
        setRepairOrdersError(null);
      } catch (error) {
        if (cancelled || !current()) return;
        setRepairOrdersError(toUserMessage(error, 'No se pudieron cargar las órdenes de servicio.'));
      }
    };
    if (loadRepairsEnabled) {
      setRepairOrders([]);
      setRepairOrdersError(null);
      const finished = trackInitialRead();
      void load().finally(finished);
    }
    return () => { cancelled = true; };
  }, [currentScope, activeStoreId, loadRepairsEnabled, user, repairRetry]);

  useEffect(() => {
    if (!user || !backendReady || !canAccess('notifications')) {
      setOperationNotifications([]);
      setNotificationsError(null);
      setNotificationsLoading(false);
      return;
    }
    let cancelled = false;
    const current = beginRead('notifications');
    setNotificationsLoading(true);
    setNotificationsError(null);
    fetchNotifications(user).then(({ notifications }) => {
      if (cancelled || !current() || !canAccess('notifications')) return;
      setOperationNotifications(notifications.filter((notification) => {
        return ['inventory', 'sales', 'tradeins', 'clients'].includes(notification.section)
          && canAccess(notification.section as OperationSource);
      }));
    }).catch((error: unknown) => {
      if (cancelled) return;
      setNotificationsError(toUserMessage(error));
    }).finally(() => {
      if (!cancelled) setNotificationsLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentScope, user, notificationRetry]);

  const noteLocalMutation = useCallback(() => {
    if (scopeRef.current !== currentScope) return;
    generation.current += 1;
    if (activeStoreId) publishListMutation(activeStoreId);
  }, [activeStoreId, currentScope]);

  const refreshLists = useCallback(async () => {
    if (!user || !backendReady || scopeRef.current !== currentScope || pendingWrites.current > 0) return;
    const jobs: Promise<void>[] = [];
    const guard = (key: string, label: string, run: (current: () => boolean) => Promise<void>) => {
      const current = beginRead(key);
      jobs.push(run(current).catch((error: unknown) => { console.error(label, error); }));
    };
    // Replace rows in place. Clearing first would drop an open form's source record.
    if (loadInventoryEnabled) guard('inventory', 'Backend inventory refresh failed.', async (current) => {
      const items = await fetchBackendInventory(user);
      if (current()) setInventory(visibleInventory(items, canAccess('reports')));
    });
    if (loadSalesEnabled) guard('sales', 'Backend sales refresh failed.', async (current) => {
      const items = await fetchBackendSales(user);
      if (current()) setSales(items);
    });
    if (backendClientsEnabled) guard('clients', 'Backend clients refresh failed.', async (current) => {
      const [items, categories] = await Promise.all([
        fetchBackendClients(user),
        fetchClientCategoriesApi(user).catch(() => null),
      ]);
      if (!current()) return;
      setClients(items);
      if (categories) setClientCategories(categories);
    });
    if (loadTradeInsEnabled) guard('tradeIns', 'Backend trade-ins refresh failed.', async (current) => {
      const items = await fetchBackendTradeIns(user);
      if (current()) setTradeIns(items);
    });
    if (loadRepairsEnabled) guard('repairs', 'Backend repairs refresh failed.', async (current) => {
      const items = await fetchBackendRepairs(user);
      if (current()) {
        setRepairOrders(items);
        setRepairOrdersError(null);
      }
    });
    const draftSources: OperationSource[] = canAccess('tradeins')
      ? ['tradeins']
      : (['sales', 'inventory', 'clients'] as const).filter((source) => canAccess(source));
    if (draftSources.length) guard('drafts', 'Backend drafts refresh failed.', async (current) => {
      const settled = await Promise.allSettled(draftSources.map((source) => fetchOperationDrafts(user, source)));
      if (!current() || settled.every((item) => item.status === 'rejected')) return;
      const merged = new Map<string, TradeIn>();
      for (const item of settled) {
        if (item.status === 'fulfilled') {
          for (const trade of item.value.tradeIns) merged.set(trade.id, trade);
        }
      }
      setOperationDrafts([...merged.values()]);
    });
    if (canAccess('notifications')) guard('notifications', 'Backend notifications refresh failed.', async (current) => {
      const { notifications } = await fetchNotifications(user);
      if (!current() || !canAccess('notifications')) return;
      setOperationNotifications(notifications.filter((notification) => {
        return ['inventory', 'sales', 'tradeins', 'clients'].includes(notification.section)
          && canAccess(notification.section as OperationSource);
      }));
      setNotificationsError(null);
    });
    await Promise.all(jobs);
  }, [backendClientsEnabled, backendReady, currentScope, loadInventoryEnabled, loadRepairsEnabled, loadSalesEnabled, loadTradeInsEnabled, user]);

  useListRefresh(Boolean(user) && backendReady, () => { void refreshLists(); }, activeStoreId);

  return {
    inventory, setInventory: scopedSetter(setInventory), listsLoaded,
    // Cached lists may render immediately elsewhere. Dashboard waits for this batch.
    listsSettled: listsFetch?.scope === currentScope,
    listsLoadFailed: listsFetch?.scope === currentScope && listsFetch.failed,
    repairOrders, setRepairOrders: scopedSetter(setRepairOrders), repairOrdersError, setRepairOrdersError: scopedSetter(setRepairOrdersError),
    sales, setSales: scopedSetter(setSales),
    tradeIns, setTradeIns: scopedSetter(setTradeIns),
    clients, setClients: scopedSetter(setClients), clientCategories, setClientCategories: scopedSetter(setClientCategories),
    operationOptions, setOperationOptions: scopedSetter(setOperationOptions), operationDrafts, setOperationDrafts: scopedSetter(setOperationDrafts),
    operationNotifications, setOperationNotifications: scopedSetter(setOperationNotifications),
    notificationsLoading, setNotificationsLoading: scopedSetter(setNotificationsLoading), notificationsError, setNotificationsError: scopedSetter(setNotificationsError),
    customColumns, setCustomColumns: scopedSetter(setCustomColumns),
    scopeRef, currentScope, canAccess, backendReady,
    backendInventoryEnabled, loadInventoryEnabled, backendClientsEnabled,
    backendSalesEnabled, loadSalesEnabled, backendTradeInsEnabled, loadTradeInsEnabled, loadRepairsEnabled,
    noteLocalMutation,
    recordsGeneration: generation, pendingWrites, initialReads, beginRead, refreshLists,
  };
}
