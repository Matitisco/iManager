import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { Product, Sale, TradeIn, Client, CustomColumn, InventoryCategory, CustomColumnEntity, TradeInCategory, ClientCategory, RepairOrder } from '../types';
import { fetchBackendSession } from '../services/backend-session';
import { createBackendClient, deleteBackendClient, fetchBackendClients, updateBackendClient, registerBackendClientPayment, fetchClientCategoriesApi, createClientCategoryApi, renameClientCategoryApi, deleteClientCategoryApi, reorderClientCategoriesApi, bulkMoveClientCategoryApi } from '../services/clients-api';
import { createBackendInventoryItem, deleteBackendInventoryItem, fetchBackendInventory, updateBackendInventoryItem, fetchCategories, createCategoryApi, renameCategoryApi, deleteCategoryApi, bulkMoveCategoryApi, reorderCategoriesApi } from '../services/inventory-api';
import { deleteBackendSale, fetchBackendSales, updateBackendSale, fetchSalesCategoriesApi, type Category as SaleCategory } from '../services/sales-api';
import { deleteBackendTradeIn, fetchBackendTradeIns, updateBackendTradeIn, fetchTradeInCategoriesApi, createTradeInCategoryApi, renameTradeInCategoryApi, deleteTradeInCategoryApi, reorderTradeInCategoriesApi, bulkMoveTradeInCategoryApi } from '../services/trade-ins-api';
import { completeBackendOnboarding } from '../services/onboarding-api';
import { activateStore as activateStoreApi, createOwnedStore as createOwnedStoreApi } from '../services/stores-api';
import { acceptInvitation as acceptInvitationApi } from '../services/invitations-api';
import { markStoreContactOffer } from '../lib/store-contact';
import { updateStoreApi, updateUserProfileApi, type StoreUpdateInput } from '../services/settings-api';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { getAuthAdapter } from '../services/auth-adapter';
import { normalizeDropdownOptions } from '../utils/dropdown-options';
import { canOpenSection } from '../desk/sections';
import { cancelSaleOperation, cancelTradeOperation, confirmTradeOperation, createOperation, fetchNotifications, fetchOperationDrafts, fetchOperationOptions, fetchSaleOperation, fetchTradeOperation, markAllNotificationsReadApi, markNotificationReadApi, updateSaleOperation, updateTradeOperation, type OperationInput, type OperationNotification, type OperationOptions, type OperationResult, type OperationSource } from '../services/operations-api';
import { changeBackendRepairStatus, createBackendRepair, deleteBackendRepair, fetchBackendRepairs, updateBackendRepair, type RepairOrderInput } from '../services/repairs-api';

interface AppState {
  inventory: Product[];
  repairOrders: RepairOrder[];
  repairOrdersError: string | null;
  addRepairOrder: (input: RepairOrderInput) => Promise<RepairOrder>;
  updateRepairOrder: (id: string, input: Partial<RepairOrderInput>) => Promise<RepairOrder>;
  changeRepairStatus: (id: string, status: string) => Promise<RepairOrder>;
  deleteRepairOrder: (id: string) => Promise<void>;
  sales: Sale[];
  salesCategories: SaleCategory[];
  tradeIns: TradeIn[];
  clients: Client[];
  customColumns: CustomColumn[];
  operationOptions: Partial<Record<OperationSource, OperationOptions>>;
  operationDrafts: TradeIn[];
  operationNotifications: OperationNotification[];
  notificationsLoading: boolean;
  notificationsError: string | null;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  loadOperationOptions: (source: OperationSource) => Promise<OperationOptions>;
  loadOperationDrafts: (source: OperationSource) => Promise<TradeIn[]>;
  createOperation: (source: OperationSource, input: OperationInput) => Promise<OperationResult>;
  updateSaleOperation: (id: string, input: OperationInput) => Promise<OperationResult>;
  updateTradeOperation: (source: OperationSource, id: string, input: OperationInput) => Promise<OperationResult>;
  confirmTradeOperation: (source: OperationSource, id: string, input: OperationInput) => Promise<OperationResult>;
  cancelSaleOperation: (id: string) => Promise<OperationResult>;
  cancelTradeOperation: (source: OperationSource, id: string) => Promise<OperationResult>;
  fetchSaleOperation: (id: string) => Promise<OperationResult>;
  fetchTradeOperation: (source: OperationSource, id: string) => Promise<OperationResult>;
  applyOperationResult: (result: OperationResult) => void;
  addSale: (sale: Omit<Sale, 'id'>) => Promise<OperationResult>;
  updateSale: (sale: Sale) => Promise<OperationResult | void>;
  deleteSale: (id: string) => Promise<OperationResult | void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => Promise<Client>;
  updateClient: (client: Client) => Promise<void>;
  registerClientPayment: (clientId: string, input: { amount: number; method: string; currency?: string | null }) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  addTradeIn: (tradeIn: Omit<TradeIn, 'id'>) => Promise<OperationResult>;
  updateTradeIn: (tradeIn: TradeIn) => Promise<OperationResult | void>;
  deleteTradeIn: (id: string) => Promise<OperationResult | void>;
  addCustomColumn: (column: Omit<CustomColumn, 'id'>) => Promise<string | undefined>;
  removeCustomColumn: (id: string) => Promise<void>;
  reloadInventory: () => Promise<void>;
  reloadSales: () => Promise<void>;
  reloadClients: () => Promise<void>;
  reloadTradeIns: () => Promise<void>;
  inventoryCategories: InventoryCategory[];
  createCategory: (name: string) => Promise<InventoryCategory>;
  renameCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  bulkMoveCategory: (ids: string[], categoryId: string | null) => Promise<void>;
  reorderCategories: (ids: string[]) => Promise<void>;
  createSaleCategory: (name: string) => Promise<SaleCategory>;
  renameSaleCategory: (id: string, name: string) => Promise<void>;
  deleteSaleCategory: (id: string) => Promise<void>;
  bulkMoveSaleCategory: (ids: string[], categoryId: string | null) => Promise<void>;
  reorderSaleCategories: (ids: string[]) => Promise<void>;
  tradeInCategories: TradeInCategory[];
  createTradeInCategory: (name: string) => Promise<TradeInCategory>;
  renameTradeInCategory: (id: string, name: string) => Promise<void>;
  deleteTradeInCategory: (id: string) => Promise<void>;
  bulkMoveTradeInCategory: (ids: string[], categoryId: string | null) => Promise<void>;
  reorderTradeInCategories: (ids: string[]) => Promise<void>;
  clientCategories: ClientCategory[];
  createClientCategory: (name: string) => Promise<ClientCategory>;
  renameClientCategory: (id: string, name: string) => Promise<void>;
  deleteClientCategory: (id: string) => Promise<void>;
  bulkMoveClientCategory: (ids: string[], categoryId: string | null) => Promise<void>;
  reorderClientCategories: (ids: string[]) => Promise<void>;
  user: AuthUserLike | null;
  loading: boolean;
  appSession: AppSession | null;
  backendStatus: BackendConnectionStatus;
  backendMessage: string | null;
  updateStore: (data: StoreUpdateInput) => Promise<void>;
  updateUserProfile: (data: { displayName: string }) => Promise<void>;
  completeOnboarding: (input: { storeName: string; currency?: 'ARS' | 'USD'; exchangeMode?: 'auto' | 'manual'; exchangeSource?: 'blue' | 'oficial' | 'mep'; manualBuy?: number | null; manualSell?: number | null }) => Promise<void>;
  createOwnedStore: (storeName: string) => Promise<void>;
  activateStore: (storeId: string) => Promise<void>;
  acceptStoreInvitation: (token: string) => Promise<void>;
  reloadSession: () => Promise<void>;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const generateId = (prefix: string) => `${prefix}-${Math.floor(Math.random() * 1000000)}`;

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

function withoutStoredCost(item: Product): Product {
  if (!Object.prototype.hasOwnProperty.call(item, 'cost')) return item;
  const next = { ...item };
  delete next.cost;
  return next;
}

function visibleInventory(items: Product[], seeCosts: boolean) {
  return seeCosts ? items : items.map(withoutStoredCost);
}

function getCustomColumnsStorageKey(uid: string) {
  return `customColumns:${uid}`;
}

function readLocalCustomColumns(uid: string): CustomColumn[] {
  try {
    const raw = window.localStorage.getItem(getCustomColumnsStorageKey(uid));
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

function writeLocalCustomColumns(uid: string, columns: CustomColumn[]) {
  try {
    window.localStorage.setItem(getCustomColumnsStorageKey(uid), JSON.stringify(columns));
  } catch {
    // Ignore storage write failures and keep runtime state.
  }
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const authAdapter = getAuthAdapter();
  const [inventory, setInventory] = useState<Product[]>([]);
  const [repairOrders, setRepairOrders] = useState<RepairOrder[]>([]);
  const [repairOrdersError, setRepairOrdersError] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesCategories, setSalesCategories] = useState<SaleCategory[]>([]);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [tradeInCategories, setTradeInCategories] = useState<TradeInCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [operationOptions, setOperationOptions] = useState<Partial<Record<OperationSource, OperationOptions>>>({});
  const [operationDrafts, setOperationDrafts] = useState<TradeIn[]>([]);
  const [operationNotifications, setOperationNotifications] = useState<OperationNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [clientCategories, setClientCategories] = useState<ClientCategory[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<InventoryCategory[]>([]);
  const [user, setUser] = useState<AuthUserLike | null>(null);
  const [loading, setLoading] = useState(true);
  const [appSession, setAppSession] = useState<AppSession | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus>('checking');
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const scopeRef = useRef('');

  const refreshBackendSession = async (currentUser: AuthUserLike) => {
    const { status, session, message } = await fetchBackendSession(currentUser);
    setBackendStatus(status);
    setAppSession(session);
    setBackendMessage(message);
    return { status, session, message };
  };

  useEffect(() => {
    const unsubscribe = authAdapter.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [authAdapter]);

  useEffect(() => {
    if (!user) {
      setInventory([]);
      setSales([]);
      setSalesCategories([]);
      setTradeIns([]);
      setTradeInCategories([]);
      setClients([]);
      setOperationOptions({});
      setOperationDrafts([]);
      setClientCategories([]);
      setCustomColumns([]);
      setAppSession(null);
      setBackendStatus('checking');
      setBackendMessage(null);
      return;
    }

    let cancelled = false;
    let retryTimeout: number | undefined;

    setBackendStatus('checking');
    setBackendMessage(null);

    const loadBackendSession = async () => {
      try {
        const { status, session, message } = await refreshBackendSession(user);
        if (cancelled) return;

        const shouldRetry = status !== 'ready' || session?.onboardingRequired;
        if (shouldRetry) {
          retryTimeout = window.setTimeout(() => {
            if (!cancelled) {
              void loadBackendSession();
            }
          }, 15000);
        }
      } catch (error) {
        if (cancelled) return;
        setBackendStatus('offline');
        setBackendMessage(error instanceof Error ? error.message : String(error));

        retryTimeout = window.setTimeout(() => {
          if (!cancelled) {
            void loadBackendSession();
          }
        }, 15000);
      }
    };

    void loadBackendSession();

    const localCustomColumns = readLocalCustomColumns(user.uid);
    setCustomColumns(localCustomColumns);

    return () => {
      cancelled = true;
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, [user]);

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
    if (!backendSalesEnabled && !loadSalesEnabled) { setSales([]); setSalesCategories([]); }
    if (!backendTradeInsEnabled && !loadTradeInsEnabled) { setTradeIns([]); setTradeInCategories([]); }
    if (!loadRepairsEnabled) { setRepairOrders([]); setRepairOrdersError(null); }
  }, [currentScope]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadBackendInventory = async () => {
      try {
        const [backendInventory, cats] = await Promise.all([fetchBackendInventory(user), fetchCategories(user).catch(() => [])]);
        if (cancelled) return;
        setInventory(visibleInventory(backendInventory, canAccess('reports')));
        setInventoryCategories(cats);
      } catch (error) {
        if (cancelled) return;
        console.error('Backend inventory load failed.', error);
      }
    };

    if (loadInventoryEnabled) {
      setInventory([]);
      setInventoryCategories([]);
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

    const loadBackendSalesAndCategories = async () => {
      try {
        const [backendSales, fetchedSalesCategories] = await Promise.all([
          fetchBackendSales(user),
          fetchSalesCategoriesApi(user).catch(() => [])
        ]);
        if (cancelled) return;
        setSales(backendSales);
        setSalesCategories(fetchedSalesCategories);
      } catch (error) {
        if (cancelled) return;
        console.error('Backend sales load failed.', error);
      }
    };

    if (loadSalesEnabled) {
      setSales([]);
      setSalesCategories([]);
      void loadBackendSalesAndCategories();
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
        const [backendTradeIns, fetchedTradeInCategories] = await Promise.all([
          fetchBackendTradeIns(user),
          fetchTradeInCategoriesApi(user).catch(() => []),
        ]);
        if (cancelled) return;
        setTradeIns(backendTradeIns);
        setTradeInCategories(fetchedTradeInCategories);
      } catch (error) {
        if (cancelled) return;
        console.error('Backend trade-ins load failed.', error);
      }
    };

    if (loadTradeInsEnabled) {
      setTradeIns([]);
      setTradeInCategories([]);
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

  const login = async () => {
    try {
      await authAdapter.loginWithGoogle();
    } catch (error) {
      console.error("Error signing in", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await authAdapter.loginWithEmail(email, password);
    } catch (error) {
      console.error("Error signing in with email", error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string) => {
    try {
      await authAdapter.registerWithEmail(email, password);
    } catch (error) {
      console.error("Error registering with email", error);
      throw error;
    }
  };

  const logout = async () => {
    await authAdapter.logout();
  };

  const updateStore = async (data: StoreUpdateInput) => {
    if (!user) throw new Error('No authenticated user');
    const updatedStore = await updateStoreApi(user, data);
    setAppSession(prev => prev ? {
      ...prev,
      store: updatedStore,
      stores: prev.stores?.map((store) => store.id === updatedStore.id ? { ...store, name: updatedStore.name } : store),
    } : prev);
  };

  const updateUserProfile = async (data: { displayName: string }) => {
    if (!user) throw new Error('No authenticated user');
    const updatedUser = await updateUserProfileApi(user, data);
    setAppSession(prev => prev ? { ...prev, user: updatedUser } : prev);
  };

  const completeOnboarding = async (input: { storeName: string; currency?: 'ARS' | 'USD'; exchangeMode?: 'auto' | 'manual'; exchangeSource?: 'blue' | 'oficial' | 'mep'; manualBuy?: number | null; manualSell?: number | null }) => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    const session = await completeBackendOnboarding(user, input);
    if (session.store?.id) markStoreContactOffer(session.store.id);
    setBackendStatus('ready');
    setBackendMessage(null);
    setAppSession(session);
  };

  const createOwnedStore = async (storeName: string) => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    const session = await createOwnedStoreApi(user, storeName);
    if (session.store?.id) markStoreContactOffer(session.store.id);
    setBackendStatus('ready');
    setBackendMessage(null);
    setAppSession(session);
  };

  const activateStore = async (storeId: string) => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    const session = await activateStoreApi(user, storeId);
    setBackendStatus('ready');
    setBackendMessage(null);
    setAppSession(session);
  };

  const reloadSession = async () => {
    if (!user) return;
    const { status, session } = await refreshBackendSession(user);
    if (status === 'ready' && session) setAppSession(session);
  };

  const acceptStoreInvitation = async (token: string) => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    const data = await acceptInvitationApi(user, token);
    setBackendStatus('ready');
    setBackendMessage(null);
    setAppSession(data.session);
  };

  const applyOperationResult = (result: OperationResult, requestScope = currentScope) => {
    if (scopeRef.current !== requestScope) return;
    if (result.notifications?.length) {
      setOperationNotifications((current) => {
        const next = new Map(current.map((notification) => [notification.id, notification]));
        for (const notification of result.notifications) {
          if (!['inventory', 'sales', 'tradeins', 'clients'].includes(notification.section)
            || !canAccess(notification.section as OperationSource)) continue;
          next.set(notification.id, { ...notification, readAt: null });
        }
        return [...next.values()];
      });
    }
    setInventory((current) => {
      const next = new Map(current.map((item) => [item.id, item]));
      for (const item of result.inventory ?? []) {
        if (item.archivedAt) next.delete(item.id);
        else {
          const merged = { ...next.get(item.id), ...item };
          if (!canAccess('reports')) delete merged.cost;
          next.set(item.id, merged);
        }
      }
      return [...next.values()];
    });
    setClients((current) => {
      const next = new Map(current.map((item) => [item.id, item]));
      for (const item of result.clients ?? []) next.set(item.id, { ...next.get(item.id), ...item });
      return [...next.values()];
    });
    if (result.sale) setSales((current) => [result.sale!, ...current.filter((item) => item.id !== result.sale!.id)]);
    if (result.tradeIn) {
      setTradeIns((current) => [result.tradeIn!, ...current.filter((item) => item.id !== result.tradeIn!.id)]);
      if (result.tradeIn.confirmationStatus === 'PENDING') {
        setOperationDrafts((current) => [result.tradeIn!, ...current.filter((item) => item.id !== result.tradeIn!.id)]);
      } else {
        setOperationDrafts((current) => current.filter((item) => item.id !== result.tradeIn!.id));
      }
    }
  };

  const requireNotificationAccess = () => {
    if (!user) throw new Error('No hay sesión');
    if (!backendReady || !canAccess('notifications')) throw new Error(backendMessage || 'No tenés permiso para ver notificaciones.');
    return user;
  };

  const refreshNotifications = async () => {
    const currentUser = requireNotificationAccess();
    const requestScope = currentScope;
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const { notifications } = await fetchNotifications(currentUser);
      if (scopeRef.current !== requestScope || !canAccess('notifications')) return;
      setOperationNotifications(notifications.filter((notification) => {
        return ['inventory', 'sales', 'tradeins', 'clients'].includes(notification.section)
          && canAccess(notification.section as OperationSource);
      }));
    } catch (error) {
      if (scopeRef.current === requestScope) setNotificationsError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      if (scopeRef.current === requestScope) setNotificationsLoading(false);
    }
  };

  const markNotificationRead = async (id: string) => {
    const currentUser = requireNotificationAccess();
    const requestScope = currentScope;
    const notification = operationNotifications.find((item) => item.id === id);
    if (!notification || !['inventory', 'sales', 'tradeins', 'clients'].includes(notification.section)
      || !canAccess(notification.section as OperationSource)) throw new Error('No tenés acceso a esta notificación.');
    const result = await markNotificationReadApi(currentUser, id);
    if (scopeRef.current !== requestScope) return;
    setOperationNotifications((current) => current.map((item) => item.id === id ? { ...item, readAt: result.readAt } : item));
  };

  const markAllNotificationsRead = async () => {
    const currentUser = requireNotificationAccess();
    const requestScope = currentScope;
    await markAllNotificationsReadApi(currentUser);
    if (scopeRef.current !== requestScope) return;
    const readAt = new Date().toISOString();
    setOperationNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })));
  };

  const requireOperationSource = (source: OperationSource) => {
    if (!user) throw new Error('No hay sesión');
    if (!backendReady || !canAccess(source)) {
      throw new Error(backendMessage || 'No tenés permiso para realizar esta operación.');
    }
    return user;
  };

  const loadOperationOptions = async (source: OperationSource) => {
    const currentUser = requireOperationSource(source);
    const requestScope = currentScope;
    const options = await fetchOperationOptions(currentUser, source);
    if (scopeRef.current === requestScope && canAccess(source)) {
      setOperationOptions((current) => ({ ...current, [source]: options }));
    }
    return options;
  };

  const loadOperationDrafts = async (source: OperationSource) => {
    const currentUser = requireOperationSource(source);
    const requestScope = currentScope;
    const { tradeIns: drafts } = await fetchOperationDrafts(currentUser, source);
    if (scopeRef.current === requestScope && canAccess(source)) setOperationDrafts(drafts);
    return drafts;
  };

  const runCreateOperation = async (source: OperationSource, input: OperationInput) => {
    const currentUser = requireOperationSource(source);
    const requestScope = currentScope;
    const result = await createOperation(currentUser, source, input);
    if (scopeRef.current === requestScope && canAccess(source)) applyOperationResult(result, requestScope);
    return result;
  };

  const runUpdateSaleOperation = async (id: string, input: OperationInput) => {
    const currentUser = requireOperationSource('sales');
    const requestScope = currentScope;
    const result = await updateSaleOperation(currentUser, id, input);
    if (scopeRef.current === requestScope && canAccess('sales')) applyOperationResult(result, requestScope);
    return result;
  };

  const runUpdateTradeOperation = async (source: OperationSource, id: string, input: OperationInput) => {
    const currentUser = requireOperationSource(source);
    const requestScope = currentScope;
    const result = await updateTradeOperation(currentUser, source, id, input);
    if (scopeRef.current === requestScope && canAccess(source)) applyOperationResult(result, requestScope);
    return result;
  };

  const runConfirmTradeOperation = async (source: OperationSource, id: string, input: OperationInput) => {
    const currentUser = requireOperationSource(source);
    const requestScope = currentScope;
    const result = await confirmTradeOperation(currentUser, source, id, input);
    if (scopeRef.current === requestScope && canAccess(source)) applyOperationResult(result, requestScope);
    return result;
  };

  const runCancelSaleOperation = async (id: string) => {
    const currentUser = requireOperationSource('sales');
    const requestScope = currentScope;
    const result = await cancelSaleOperation(currentUser, id);
    if (scopeRef.current === requestScope && canAccess('sales')) applyOperationResult(result, requestScope);
    return result;
  };

  const runCancelTradeOperation = async (source: OperationSource, id: string) => {
    const currentUser = requireOperationSource(source);
    const requestScope = currentScope;
    const result = await cancelTradeOperation(currentUser, source, id);
    if (scopeRef.current === requestScope && canAccess(source)) applyOperationResult(result, requestScope);
    return result;
  };

  const runFetchSaleOperation = async (id: string) => {
    const currentUser = requireOperationSource('sales');
    const requestScope = currentScope;
    const result = await fetchSaleOperation(currentUser, id);
    if (scopeRef.current === requestScope && canAccess('sales')) applyOperationResult(result, requestScope);
    return result;
  };

  const runFetchTradeOperation = async (source: OperationSource, id: string) => {
    const currentUser = requireOperationSource(source);
    const requestScope = currentScope;
    const result = await fetchTradeOperation(currentUser, source, id);
    if (scopeRef.current === requestScope && canAccess(source)) applyOperationResult(result, requestScope);
    return result;
  };

  const addSale = async (saleData: Omit<Sale, 'id'>) => {
    if (!backendSalesEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para guardar ventas. Reintenta en unos segundos.'
      );
    }

    return await runCreateOperation('sales', {
      ...saleData,
      status: saleData.status === 'PENDIENTE' ? 'PENDIENTE' : 'COMPLETADA',
      draft: false,
      requestKey: saleData.requestKey || `legacy-sale-${crypto.randomUUID()}`,
    });
  };

  const updateSale = async (updatedSale: Sale) => {
    if (!user) return;
    if (!backendSalesEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para actualizar ventas. Reintenta en unos segundos.'
      );
    }

    const previous = sales.find((sale) => sale.id === updatedSale.id);
    if (previous?.integratedOperation || previous?.tradeInId) {
      if (updatedSale.status === 'CANCELADA') return await runCancelSaleOperation(updatedSale.id);
      else return await runUpdateSaleOperation(updatedSale.id, {
        clientId: updatedSale.clientId || null,
        clientName: updatedSale.clientName || null,
        productId: updatedSale.productId || null,
        deviceLabel: updatedSale.deviceLabel || null,
        amount: updatedSale.amount,
        paymentMethod: updatedSale.paymentMethod,
        status: updatedSale.status === 'PENDIENTE' ? 'PENDIENTE' : 'COMPLETADA',
        date: updatedSale.date,
        saleCategoryId: updatedSale.categoryId ?? null,
        customFields: updatedSale.customFields,
      });
    }
    const backendSale = await updateBackendSale(user, updatedSale);
    setSales(prev => prev.map(sale => sale.id === backendSale.id ? backendSale : sale));
    if (previous && previous.productId !== backendSale.productId) {
      setInventory(prev => prev.map(product => {
        if (previous.productId && product.id === previous.productId) return { ...product, status: 'DISPONIBLE' };
        if (backendSale.productId && product.id === backendSale.productId) return { ...product, status: 'VENDIDO' };
        return product;
      }));
    }
  };

  const deleteSale = async (id: string) => {
    if (!user) return;
    if (!backendSalesEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para eliminar ventas. Reintenta en unos segundos.'
      );
    }

    const existingSale = sales.find((sale) => sale.id === id);
    if (existingSale?.integratedOperation || existingSale?.tradeInId) {
      return await runCancelSaleOperation(id);
    }
    await deleteBackendSale(user, id);

    if (existingSale?.productId) {
      setInventory(prev => prev.map(product => (
        product.id === existingSale.productId ? { ...product, status: 'DISPONIBLE' } : product
      )));
    }

    if (existingSale?.clientId) {
      const remainingClientSales = sales.filter(
        (sale) => sale.clientId === existingSale.clientId && sale.id !== id
      );
      setClients(prev => prev.map(client => {
        if (client.id !== existingSale.clientId) {
          return client;
        }

        const nextTotalSpent = remainingClientSales.reduce((sum, sale) => sum + sale.amount, 0);

        return {
          ...client,
          totalSpent: nextTotalSpent,
          lastPurchaseDate: remainingClientSales[0]?.date || 'N/A',
        };
      }));
    }

    setSales(prev => prev.filter(sale => sale.id !== id));
  };

  const rememberClient = (client: Client | null | undefined) => {
    if (!client) return;
    setClients((current) => current.some((item) => item.id === client.id) ? current : [client, ...current]);
  };

  const addRepairOrder = async (input: RepairOrderInput) => {
    if (!user) throw new Error('No hay sesión');
    if (!loadRepairsEnabled) throw new Error(backendMessage || 'El backend todavía no está listo para guardar órdenes de servicio.');
    const result = await createBackendRepair(user, input);
    setRepairOrders((current) => [result.order, ...current.filter((item) => item.id !== result.order.id)]);
    rememberClient(result.client);
    return result.order;
  };

  const updateRepairOrder = async (id: string, input: Partial<RepairOrderInput>) => {
    if (!user) throw new Error('No hay sesión');
    if (!loadRepairsEnabled) throw new Error(backendMessage || 'El backend todavía no está listo para guardar órdenes de servicio.');
    const order = await updateBackendRepair(user, id, input);
    setRepairOrders((current) => current.map((item) => item.id === id ? order : item));
    return order;
  };

  const changeRepairStatus = async (id: string, status: string) => {
    if (!user) throw new Error('No hay sesión');
    if (!loadRepairsEnabled) throw new Error(backendMessage || 'El backend todavía no está listo para guardar órdenes de servicio.');
    const order = await changeBackendRepairStatus(user, id, status);
    setRepairOrders((current) => current.map((item) => item.id === id ? order : item));
    return order;
  };

  const deleteRepairOrder = async (id: string) => {
    if (!user) throw new Error('No hay sesión');
    if (!loadRepairsEnabled) throw new Error(backendMessage || 'El backend todavía no está listo para guardar órdenes de servicio.');
    await deleteBackendRepair(user, id);
    setRepairOrders((current) => current.filter((item) => item.id !== id));
  };

  const addProduct = async (productData: Omit<Product, 'id'>) => {
    if (!user) throw new Error('No authenticated user');
    if (!backendInventoryEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para guardar inventario. Reintenta en unos segundos.'
      );
    }
    const createdProduct = visibleInventory([await createBackendInventoryItem(user, productData)], canAccess('reports'))[0];
    setInventory(prev => [createdProduct, ...prev]);
    if (createdProduct.status === 'VENDIDO' && canAccess('notifications')) void refreshNotifications().catch(() => undefined);
    return createdProduct;
  };

  const updateProduct = async (updatedProduct: Product) => {
    if (!user) return;
    const visibleUpdate = canAccess('reports') ? updatedProduct : withoutStoredCost(updatedProduct);
    let previousItem: Product | undefined;
    setInventory(prev => {
      previousItem = prev.find(p => p.id === visibleUpdate.id);
      return prev.map(product => product.id === visibleUpdate.id ? visibleUpdate : product);
    });
    try {
      if (!backendInventoryEnabled) {
        throw new Error(
          backendMessage || 'El backend todavia no esta listo para actualizar inventario. Reintenta en unos segundos.'
        );
      }
      const backendProduct = visibleInventory([await updateBackendInventoryItem(user, updatedProduct)], canAccess('reports'))[0];
      setInventory(prev => prev.map(product => product.id === backendProduct.id ? backendProduct : product));
      if (backendProduct.status === 'VENDIDO' && previousItem?.status !== 'VENDIDO' && canAccess('notifications')) {
        void refreshNotifications().catch(() => undefined);
      }
    } catch (error) {
      if (previousItem) {
        setInventory(prev => prev.map(product => product.id === updatedProduct.id ? previousItem! : product));
      }
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user) return;
    if (!backendInventoryEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para eliminar inventario. Reintenta en unos segundos.'
      );
    }
    await deleteBackendInventoryItem(user, id);
    setInventory(prev => prev.filter(product => product.id !== id));
  };

  const reloadInventory = async () => {
    if (!user) return;
    const items = await fetchBackendInventory(user);
    setInventory(visibleInventory(items, canAccess('reports')));
  };

  const reloadSales = async () => {
    if (!user) return;
    const items = await fetchBackendSales(user);
    setSales(items);
  };

  const reloadClients = async () => {
    if (!user) return;
    const items = await fetchBackendClients(user);
    setClients(items);
  };

  const reloadTradeIns = async () => {
    if (!user) return;
    const items = await fetchBackendTradeIns(user);
    setTradeIns(items);
  };

  const reloadCategories = async () => {
    if (!user) return;
    try {
      const cats = await fetchCategories(user);
      setInventoryCategories(cats);
    } catch { /* ignore */ }
  };

  const createCategory = async (name: string): Promise<InventoryCategory> => {
    if (!user) throw new Error('No authenticated user');
    const cat = await createCategoryApi(user, name);
    setInventoryCategories(prev => [...prev, cat]);
    return cat;
  };

  const renameCategory = async (id: string, name: string): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const updated = await renameCategoryApi(user, id, name);
    setInventoryCategories(prev => prev.map(c => c.id === id ? updated : c));
  };

  const deleteCategory = async (id: string): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    await deleteCategoryApi(user, id);
    setInventoryCategories(prev => prev.filter(c => c.id !== id));
    setInventory(prev => prev.map(item => item.categoryId === id ? { ...item, categoryId: null } : item));
  };

  const bulkMoveCategory = async (ids: string[], categoryId: string | null): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    await bulkMoveCategoryApi(user, ids, categoryId);
    setInventory(prev => prev.map(item => ids.includes(item.id) ? { ...item, categoryId } : item));
  };

  const reorderCategories = async (ids: string[]): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const prev = inventoryCategories;
    const map = new Map(prev.map(c => [c.id, c]));
    setInventoryCategories(ids.map(id => map.get(id)!).filter(Boolean));
    try {
      await reorderCategoriesApi(user, ids);
    } catch {
      setInventoryCategories(prev);
    }
  };

  // ── Sales Categories ───────────────────────────────────────────────────────

  const createSaleCategory = async (name: string): Promise<SaleCategory> => {
    if (!user) throw new Error('No authenticated user');
    const { createSaleCategoryApi } = await import('../services/sales-api');
    const cat = await createSaleCategoryApi(user, name);
    setSalesCategories(prev => [...prev, cat]);
    return cat;
  };

  const renameSaleCategory = async (id: string, name: string): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const { renameSaleCategoryApi } = await import('../services/sales-api');
    const updated = await renameSaleCategoryApi(user, id, name);
    setSalesCategories(prev => prev.map(c => c.id === id ? updated : c));
  };

  const deleteSaleCategory = async (id: string): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const { deleteSaleCategoryApi } = await import('../services/sales-api');
    await deleteSaleCategoryApi(user, id);
    setSalesCategories(prev => prev.filter(c => c.id !== id));
    setSales(prev => prev.map(item => item.categoryId === id ? { ...item, categoryId: null } : item));
  };

  const bulkMoveSaleCategory = async (ids: string[], categoryId: string | null): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const { bulkMoveSalesCategoryApi } = await import('../services/sales-api');
    await bulkMoveSalesCategoryApi(user, ids, categoryId);
    setSales(prev => prev.map(item => ids.includes(item.id) ? { ...item, categoryId } : item));
  };

  const reorderSaleCategories = async (ids: string[]): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const prev = salesCategories;
    const map = new Map(prev.map(c => [c.id, c]));
    setSalesCategories(ids.map(id => map.get(id)!).filter(Boolean));
    try {
      const { reorderSalesCategoriesApi } = await import('../services/sales-api');
      await reorderSalesCategoriesApi(user, ids);
    } catch {
      setSalesCategories(prev);
    }
  };

  // ── TradeIn Categories ────────────────────────────────────────────────────

  const createTradeInCategory = async (name: string): Promise<TradeInCategory> => {
    if (!user) throw new Error('No authenticated user');
    const cat = await createTradeInCategoryApi(user, name);
    setTradeInCategories(prev => [...prev, cat]);
    return cat;
  };

  const renameTradeInCategory = async (id: string, name: string): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const updated = await renameTradeInCategoryApi(user, id, name);
    setTradeInCategories(prev => prev.map(c => c.id === id ? updated : c));
  };

  const deleteTradeInCategory = async (id: string): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    await deleteTradeInCategoryApi(user, id);
    setTradeInCategories(prev => prev.filter(c => c.id !== id));
    setTradeIns(prev => prev.map(t => t.categoryId === id ? { ...t, categoryId: null } : t));
  };

  const bulkMoveTradeInCategory = async (ids: string[], categoryId: string | null): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    await bulkMoveTradeInCategoryApi(user, ids, categoryId);
    setTradeIns(prev => prev.map(t => ids.includes(t.id) ? { ...t, categoryId } : t));
  };

  const reorderTradeInCategories = async (ids: string[]): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const prev = tradeInCategories;
    const map = new Map(prev.map(c => [c.id, c]));
    setTradeInCategories(ids.map(id => map.get(id)!).filter(Boolean));
    try {
      await reorderTradeInCategoriesApi(user, ids);
    } catch {
      setTradeInCategories(prev);
    }
  };

  // ── Client Categories ─────────────────────────────────────────────────────

  const createClientCategory = async (name: string): Promise<ClientCategory> => {
    if (!user) throw new Error('No authenticated user');
    const cat = await createClientCategoryApi(user, name);
    setClientCategories(prev => [...prev, cat]);
    return cat;
  };

  const renameClientCategory = async (id: string, name: string): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const updated = await renameClientCategoryApi(user, id, name);
    setClientCategories(prev => prev.map(c => c.id === id ? updated : c));
  };

  const deleteClientCategory = async (id: string): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    await deleteClientCategoryApi(user, id);
    setClientCategories(prev => prev.filter(c => c.id !== id));
    setClients(prev => prev.map(c => c.categoryId === id ? { ...c, categoryId: null } : c));
  };

  const bulkMoveClientCategory = async (ids: string[], categoryId: string | null): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    await bulkMoveClientCategoryApi(user, ids, categoryId);
    setClients(prev => prev.map(c => ids.includes(c.id) ? { ...c, categoryId } : c));
  };

  const reorderClientCategories = async (ids: string[]): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const prev = clientCategories;
    const map = new Map(prev.map(c => [c.id, c]));
    setClientCategories(ids.map(id => map.get(id)!).filter(Boolean));
    try {
      await reorderClientCategoriesApi(user, ids);
    } catch {
      setClientCategories(prev);
    }
  };

  const addClient = async (clientData: Omit<Client, 'id'>) => {
    if (!user) {
      throw new Error('No authenticated user');
    }
    if (!backendClientsEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para guardar clientes. Reintenta en unos segundos.'
      );
    }
    const createdClient = await createBackendClient(user, clientData);
    setClients(prev => [createdClient, ...prev]);
    return createdClient;
  };

  const updateClient = async (updatedClient: Client) => {
    if (!user) return;
    if (!backendClientsEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para actualizar clientes. Reintenta en unos segundos.'
      );
    }
    const backendClient = await updateBackendClient(user, updatedClient);
    setClients(prev => prev.map(client => client.id === backendClient.id ? backendClient : client));
  };

  const registerClientPayment = async (clientId: string, input: { amount: number; method: string; currency?: string | null }) => {
    if (!user) throw new Error('No hay sesión');
    if (!backendClientsEnabled) {
      throw new Error(backendMessage || 'El backend todavía no está listo para registrar pagos.');
    }
    const updated = await registerBackendClientPayment(user, clientId, input);
    setClients(prev => prev.map(client => client.id === updated.id ? updated : client));
    return updated;
  };

  const deleteClient = async (id: string) => {
    if (!user) return;
    if (!backendClientsEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para eliminar clientes. Reintenta en unos segundos.'
      );
    }
    await deleteBackendClient(user, id);
    setClients(prev => prev.filter(client => client.id !== id));
  };

  const addTradeIn = async (tradeInData: Omit<TradeIn, 'id'>) => {
    if (!user) return;
    if (!backendTradeInsEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para guardar canjes. Reintenta en unos segundos.'
      );
    }
    return await runCreateOperation('tradeins', {
      date: tradeInData.date,
      clientId: null,
      clientName: null,
      productId: null,
      deviceLabel: tradeInData.deviceGiven,
      amount: tradeInData.takeValue + tradeInData.differencePaid,
      paymentMethod: 'TRANSFERENCIA',
      status: 'COMPLETADA',
      categoryId: tradeInData.categoryId ?? null,
      draft: true,
      requestKey: `legacy-trade-${crypto.randomUUID()}`,
      tradeIn: {
        deviceReceived: tradeInData.deviceReceived,
        deviceReceivedImei: tradeInData.deviceReceivedImei || undefined,
        takeValue: tradeInData.takeValue,
        status: tradeInData.status,
        batteryHealth: tradeInData.batteryHealth,
        grade: tradeInData.grade,
        customFields: tradeInData.customFields,
      },
    });
  };

  const updateTradeIn = async (updatedTradeIn: TradeIn) => {
    if (!user) return;
    if (!backendTradeInsEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para actualizar canjes. Reintenta en unos segundos.'
      );
    }
    const existing = tradeIns.find((trade) => trade.id === updatedTradeIn.id);
    if (existing?.confirmationStatus != null) {
      const result = await runUpdateTradeOperation('tradeins', updatedTradeIn.id, {
        clientId: updatedTradeIn.clientId || null,
        clientName: updatedTradeIn.clientName || null,
        productId: existing.draftProductId ?? null,
        deviceLabel: existing.draftDeviceLabel ?? updatedTradeIn.deviceGiven,
        amount: existing.draftAmount ?? updatedTradeIn.takeValue + updatedTradeIn.differencePaid,
        paymentMethod: existing.draftPaymentMethod ?? 'TRANSFERENCIA',
        status: existing.draftPaymentStatus ?? 'COMPLETADA',
        categoryId: updatedTradeIn.categoryId ?? null,
        tradeIn: {
          deviceReceived: updatedTradeIn.deviceReceived,
          deviceReceivedImei: updatedTradeIn.deviceReceivedImei || undefined,
          takeValue: updatedTradeIn.takeValue,
          status: updatedTradeIn.status,
          batteryHealth: updatedTradeIn.batteryHealth,
          grade: updatedTradeIn.grade,
          customFields: updatedTradeIn.customFields,
        },
      });
      if (!result.tradeIn) return result;
      return result;
    }
    const backendTradeIn = await updateBackendTradeIn(user, updatedTradeIn);
    setTradeIns(prev => prev.map(t => t.id === backendTradeIn.id ? backendTradeIn : t));
  };

  const deleteTradeIn = async (id: string) => {
    if (!user) return;
    if (!backendTradeInsEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para eliminar canjes. Reintenta en unos segundos.'
      );
    }
    const existing = tradeIns.find((trade) => trade.id === id);
    if (existing?.confirmationStatus != null) {
      return await runCancelTradeOperation('tradeins', id);
    }
    await deleteBackendTradeIn(user, id);
    setTradeIns(prev => prev.filter(t => t.id !== id));
  };

  const addCustomColumn = async (columnData: Omit<CustomColumn, 'id'>): Promise<string | undefined> => {
    if (!user) return undefined;
    const existingColumn = customColumns.find((column) =>
      column.entity === columnData.entity &&
      column.type === columnData.type &&
      column.label.trim().toLowerCase() === columnData.label.trim().toLowerCase()
    );
    if (existingColumn) {
      return existingColumn.id;
    }
    const options = columnData.type === 'enum' ? normalizeDropdownOptions(columnData.options ?? []) : undefined;
    if (columnData.type === 'enum' && options.length < 2) {
      throw new Error('Agregá al menos dos opciones distintas.');
    }
    const id = generateId('COL');
    const createdColumn: CustomColumn = {
      id,
      ...columnData,
      label: columnData.label.trim(),
      options,
    };
    const nextColumns = (
      customColumns.some((column) => column.id === id)
        ? customColumns
        : [...customColumns, createdColumn]
    );
    writeLocalCustomColumns(user.uid, nextColumns);
    setCustomColumns(nextColumns);
    return id;
  };

  const removeCustomColumn = async (id: string) => {
    if (!user) return;
    setCustomColumns(prev => {
      const next = prev.filter(column => column.id !== id);
      writeLocalCustomColumns(user.uid, next);
      return next;
    });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse flex flex-col items-center"><div className="w-12 h-12 bg-black rounded-full mb-4"></div><div className="text-gray-500 font-medium tracking-wide">Cargando...</div></div></div>;
  }



  return (
    <AppContext.Provider value={{
      inventory, sales, tradeIns, clients, customColumns,
      repairOrders, repairOrdersError, addRepairOrder, updateRepairOrder, changeRepairStatus, deleteRepairOrder,
      operationOptions, operationDrafts,
      operationNotifications,
      notificationsLoading, notificationsError, refreshNotifications, markNotificationRead, markAllNotificationsRead,
      loadOperationOptions, loadOperationDrafts,
      createOperation: runCreateOperation,
      updateSaleOperation: runUpdateSaleOperation,
      updateTradeOperation: runUpdateTradeOperation,
      confirmTradeOperation: runConfirmTradeOperation,
      cancelSaleOperation: runCancelSaleOperation,
      cancelTradeOperation: runCancelTradeOperation,
      fetchSaleOperation: runFetchSaleOperation,
      fetchTradeOperation: runFetchTradeOperation,
      applyOperationResult,
      addSale, updateSale, deleteSale,
      addProduct, updateProduct, deleteProduct,
      addClient, updateClient, registerClientPayment, deleteClient,
      addTradeIn, updateTradeIn, deleteTradeIn,
      addCustomColumn, removeCustomColumn,
      reloadInventory, reloadSales, reloadClients, reloadTradeIns,
      inventoryCategories, createCategory, renameCategory, deleteCategory, bulkMoveCategory, reorderCategories,
      salesCategories, createSaleCategory, renameSaleCategory, deleteSaleCategory, bulkMoveSaleCategory, reorderSaleCategories,
      tradeInCategories, createTradeInCategory, renameTradeInCategory, deleteTradeInCategory, bulkMoveTradeInCategory, reorderTradeInCategories,
      clientCategories, createClientCategory, renameClientCategory, deleteClientCategory, bulkMoveClientCategory, reorderClientCategories,
      updateStore, updateUserProfile, reloadSession,
      user, loading, appSession, backendStatus, backendMessage, completeOnboarding, createOwnedStore, activateStore, acceptStoreInvitation, login, loginWithEmail, registerWithEmail, logout
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
