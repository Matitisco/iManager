import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useStoreRecords({ user, appSession, backendStatus }: StoreRecordsInput) {
  const [inventory, setInventory] = useState<Product[]>([]);
  const [repairOrders, setRepairOrders] = useState<RepairOrder[]>([]);
  const [repairOrdersError, setRepairOrdersError] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [operationOptions, setOperationOptions] = useState<Partial<Record<OperationSource, OperationOptions>>>({});
  const [operationDrafts, setOperationDrafts] = useState<TradeIn[]>([]);
  const [operationNotifications, setOperationNotifications] = useState<OperationNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [clientCategories, setClientCategories] = useState<ClientCategory[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const scopeRef = useRef('');
  const generation = useRef(0);
  const refreshTicket = useRef(0);

  const activeStoreId = appSession?.store?.id ?? null;
  const backendReady = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
  const canAccess = (section: OperationSource | 'reports' | 'notifications' | 'service') => canOpenSection(section, appSession?.membership?.sections, appSession?.membership?.role);
  const backendInventoryEnabled = backendReady && canAccess('inventory');
  const loadInventoryEnabled = backendReady && (canAccess('inventory') || canAccess('reports'));
  const backendClientsEnabled = backendReady && canAccess('clients');
  const backendSalesEnabled = backendReady && canAccess('sales');
  const loadSalesEnabled = backendReady && (canAccess('sales') || canAccess('reports'));
  const backendTradeInsEnabled = backendReady && canAccess('tradeins');
  const loadTradeInsEnabled = backendReady && (canAccess('tradeins') || canAccess('reports'));
  const loadRepairsEnabled = backendReady && canAccess('service');
  const currentScope = `${user?.uid ?? ''}:${activeStoreId ?? ''}:${backendReady ? 'ready' : backendStatus}:${appSession?.membership?.role ?? ''}:${[canAccess('inventory'), canAccess('sales'), canAccess('tradeins'), canAccess('clients'), canAccess('service'), canAccess('reports'), canAccess('notifications')].map(Number).join('')}`;
  scopeRef.current = currentScope;

  useEffect(() => {
    setOperationOptions({});
    setOperationDrafts([]);
    setOperationNotifications([]);
    setNotificationsError(null);
    setNotificationsLoading(false);
    if (!backendInventoryEnabled && !loadInventoryEnabled) setInventory([]);
    if (!backendClientsEnabled) setClients([]);
    if (!backendSalesEnabled && !loadSalesEnabled) setSales([]);
    if (!backendTradeInsEnabled && !loadTradeInsEnabled) setTradeIns([]);
    if (!loadRepairsEnabled) { setRepairOrders([]); setRepairOrdersError(null); }
  }, [currentScope]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadBackendInventory = async () => {
      try {
        const backendInventory = await fetchBackendInventory(user);
        if (cancelled) return;
        setInventory(visibleInventory(backendInventory, canAccess('reports')));
      } catch (error) {
        if (cancelled) return;
        console.error('Backend inventory load failed.', error);
      }
    };

    if (loadInventoryEnabled) {
      setInventory([]);
      void loadBackendInventory();
    }

    return () => {
      cancelled = true;
    };
  }, [activeStoreId, loadInventoryEnabled, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchBackendRepairs(user);
        if (cancelled) return;
        setRepairOrders(rows);
        setRepairOrdersError(null);
      } catch (error) {
        if (cancelled) return;
        setRepairOrdersError(error instanceof Error ? error.message : 'No se pudieron cargar las órdenes de servicio.');
      }
    };
    if (loadRepairsEnabled) {
      setRepairOrders([]);
      setRepairOrdersError(null);
      void load();
    }
    return () => { cancelled = true; };
  }, [activeStoreId, loadRepairsEnabled, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadBackendClients = async () => {
      try {
        const [backendClients, fetchedClientCategories] = await Promise.all([
          fetchBackendClients(user),
          fetchClientCategoriesApi(user).catch(() => []),
        ]);
        if (cancelled) return;
        setClients(backendClients);
        setClientCategories(fetchedClientCategories);
      } catch (error) {
        if (cancelled) return;
        console.error('Backend clients load failed.', error);
      }
    };

    if (backendClientsEnabled) {
      setClients([]);
      setClientCategories([]);
      void loadBackendClients();
    }

    return () => {
      cancelled = true;
    };
  }, [activeStoreId, backendClientsEnabled, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadBackendSales = async () => {
      try {
        const backendSales = await fetchBackendSales(user);
        if (cancelled) return;
        setSales(backendSales);
      } catch (error) {
        if (cancelled) return;
        console.error('Backend sales load failed.', error);
      }
    };

    if (loadSalesEnabled) {
      setSales([]);
      void loadBackendSales();
    }

    return () => {
      cancelled = true;
    };
  }, [activeStoreId, loadSalesEnabled, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadBackendTradeIns = async () => {
      try {
        const backendTradeIns = await fetchBackendTradeIns(user);
        if (cancelled) return;
        setTradeIns(backendTradeIns);
      } catch (error) {
        if (cancelled) return;
        console.error('Backend trade-ins load failed.', error);
      }
    };

    if (loadTradeInsEnabled) {
      setTradeIns([]);
      void loadBackendTradeIns();
    }

    return () => {
      cancelled = true;
    };
  }, [activeStoreId, loadTradeInsEnabled, user]);

  useEffect(() => {
    if (!user || !backendReady || !canAccess('notifications')) {
      setOperationNotifications([]);
      setNotificationsError(null);
      setNotificationsLoading(false);
      return;
    }
    let cancelled = false;
    setNotificationsLoading(true);
    setNotificationsError(null);
    fetchNotifications(user).then(({ notifications }) => {
      if (cancelled || !canAccess('notifications')) return;
      setOperationNotifications(notifications.filter((notification) => {
        return ['inventory', 'sales', 'tradeins', 'clients'].includes(notification.section)
          && canAccess(notification.section as OperationSource);
      }));
    }).catch((error: unknown) => {
      if (cancelled) return;
      setNotificationsError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!cancelled) setNotificationsLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentScope, user]);

  const noteLocalMutation = useCallback(() => {
    generation.current += 1;
    if (activeStoreId) publishListMutation(activeStoreId);
  }, [activeStoreId]);

  const refreshLists = useCallback(async () => {
    if (!user || !backendReady) return;
    const ticket = ++refreshTicket.current;
    const seen = generation.current;
    const current = () => ticket === refreshTicket.current && seen === generation.current;
    const jobs: Promise<void>[] = [];
    const guard = (label: string, run: () => Promise<void>) => jobs.push(run().catch((error: unknown) => {
      console.error(label, error);
    }));
    // Replace rows in place. Clearing first would drop an open form's source record.
    if (loadInventoryEnabled) guard('Backend inventory refresh failed.', async () => {
      const items = await fetchBackendInventory(user);
      if (current()) setInventory(visibleInventory(items, canAccess('reports')));
    });
    if (loadSalesEnabled) guard('Backend sales refresh failed.', async () => {
      const items = await fetchBackendSales(user);
      if (current()) setSales(items);
    });
    if (backendClientsEnabled) guard('Backend clients refresh failed.', async () => {
      const [items, categories] = await Promise.all([
        fetchBackendClients(user),
        fetchClientCategoriesApi(user).catch(() => null),
      ]);
      if (!current()) return;
      setClients(items);
      if (categories) setClientCategories(categories);
    });
    if (loadTradeInsEnabled) guard('Backend trade-ins refresh failed.', async () => {
      const items = await fetchBackendTradeIns(user);
      if (current()) setTradeIns(items);
    });
    if (loadRepairsEnabled) guard('Backend repairs refresh failed.', async () => {
      const items = await fetchBackendRepairs(user);
      if (current()) {
        setRepairOrders(items);
        setRepairOrdersError(null);
      }
    });
    const draftSources: OperationSource[] = canAccess('tradeins')
      ? ['tradeins']
      : (['sales', 'inventory', 'clients'] as const).filter((source) => canAccess(source));
    if (draftSources.length) guard('Backend drafts refresh failed.', async () => {
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
    if (canAccess('notifications')) guard('Backend notifications refresh failed.', async () => {
      const { notifications } = await fetchNotifications(user);
      if (!current() || !canAccess('notifications')) return;
      setOperationNotifications(notifications.filter((notification) => {
        return ['inventory', 'sales', 'tradeins', 'clients'].includes(notification.section)
          && canAccess(notification.section as OperationSource);
      }));
    });
    await Promise.all(jobs);
  }, [backendClientsEnabled, backendReady, currentScope, loadInventoryEnabled, loadRepairsEnabled, loadSalesEnabled, loadTradeInsEnabled, user]);

  useListRefresh(Boolean(user) && backendReady, () => { void refreshLists(); }, activeStoreId);

  return {
    inventory, setInventory,
    repairOrders, setRepairOrders, repairOrdersError, setRepairOrdersError,
    sales, setSales,
    tradeIns, setTradeIns,
    clients, setClients, clientCategories, setClientCategories,
    operationOptions, setOperationOptions, operationDrafts, setOperationDrafts,
    operationNotifications, setOperationNotifications,
    notificationsLoading, setNotificationsLoading, notificationsError, setNotificationsError,
    customColumns, setCustomColumns,
    scopeRef, currentScope, canAccess, backendReady,
    backendInventoryEnabled, loadInventoryEnabled, backendClientsEnabled,
    backendSalesEnabled, loadSalesEnabled, backendTradeInsEnabled, loadTradeInsEnabled, loadRepairsEnabled,
    noteLocalMutation,
  };
}
