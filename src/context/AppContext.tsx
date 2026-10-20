import { setAnalyticsUser } from '../lib/analytics';
import { clearSessionCaches, readBootSession, writeBootSession } from '../lib/boot-cache';
import { cachedAuthUser } from '../lib/cached-auth-user';
import { useBillingState } from '../hooks/useBillingState';
import { useCashState } from './cash-state';
import { useLedgerState } from './ledger-state';
import { useGettingStartedState } from './getting-started-state';
import { usePublicCatalogState } from './public-catalog-state';
import { depositLoadIsCurrent, depositLoadTicket, noteDepositMutation } from './deposit-cache';
import { fetchClientDeposits, createClientDeposit, cancelClientDeposit, applyClientDepositToRepair, type DepositInput } from '../services/deposits-api';
import type { ClientDeposit } from '../types';
import { beginListWrite, snapshotIsCurrent } from './record-generation';
import { toUserMessage } from '../lib/user-message';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, Sale, TradeIn, Client, CustomColumn, ClientCategory, RepairOrder } from '../types';
import { fetchBackendSession } from '../services/backend-session';
import { createBackendClient, deleteBackendClient, fetchBackendClients, updateBackendClient, registerBackendClientPayment } from '../services/clients-api';
import { createBackendInventoryItem, deleteBackendInventoryItem, fetchBackendInventory, updateBackendInventoryItem } from '../services/inventory-api';
import { deleteBackendSale, fetchBackendSales, updateBackendSale } from '../services/sales-api';
import { deleteBackendTradeIn, fetchBackendTradeIns, updateBackendTradeIn } from '../services/trade-ins-api';
import { completeBackendOnboarding } from '../services/onboarding-api';
import { acceptInvitation as acceptInvitationApi } from '../services/invitations-api';
import { updateStoreApi, updateUserProfileApi, type StoreUpdateInput } from '../services/settings-api';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { getAuthAdapter } from '../services/auth-adapter';
import { cancelSaleOperation, cancelTradeOperation, confirmTradeOperation, createOperation, fetchNotifications, fetchOperationDrafts, fetchOperationOptions, fetchSaleOperation, fetchTradeOperation, markAllNotificationsReadApi, markNotificationReadApi, updateSaleOperation, updateTradeOperation, type OperationInput, type OperationNotification, type OperationOptions, type OperationResult, type OperationSource } from '../services/operations-api';
import { changeBackendRepairStatus, createBackendRepair, deleteBackendRepair, restoreBackendRepair, updateBackendRepair, type RepairOrderInput } from '../services/repairs-api';
import { readLocalCustomColumns, useStoreRecords, visibleInventory, withoutStoredCost } from './store-records';
import { creditTotal } from '../desk/client-balance';
import { isActiveTradeOperation } from '../desk/format';

import { fetchCommissionExchangeRate } from '../services/commissions-api';
import { useCommissionState } from './commission-state';
import { useReturnsState } from './returns-state';

interface AppState extends ReturnType<typeof useGettingStartedState>, ReturnType<typeof useCashState>, ReturnType<typeof useLedgerState>, ReturnType<typeof useCommissionState>, ReturnType<typeof usePublicCatalogState>, ReturnType<typeof useReturnsState> {
  inventory: Product[];
  repairOrders: RepairOrder[];
  repairOrdersError: string | null;
  addRepairOrder: (input: RepairOrderInput) => Promise<RepairOrder>;
  updateRepairOrder: (id: string, input: Partial<RepairOrderInput>) => Promise<RepairOrder>;
  changeRepairStatus: (id: string, status: string) => Promise<RepairOrder>;
  deleteRepairOrder: (id: string, reason?: string) => Promise<void>;
  restoreRepairOrder: (id: string) => Promise<void>;
  sales: Sale[];
  tradeIns: TradeIn[];
  clients: Client[];
  listsLoaded: boolean;
  clientDeposits: Record<string, ClientDeposit[]>;
  loadClientDeposits: (clientId: string) => Promise<ClientDeposit[]>;
  addClientDeposit: (clientId: string, input: DepositInput) => Promise<ClientDeposit>;
  cancelClientDeposit: (clientId: string, id: string, mode: 'REFUND' | 'CREDIT') => Promise<ClientDeposit>;
  applyClientDepositToRepair: (clientId: string, id: string, repairId: string, exchangeRate?: number) => Promise<void>;
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
  cancelTradeOperation: (source: OperationSource, id: string) => Promise<OperationResult>;
  fetchSaleOperation: (id: string) => Promise<OperationResult>;
  fetchTradeOperation: (source: OperationSource, id: string) => Promise<OperationResult>;
  updateSale: (sale: Sale) => Promise<OperationResult | void>;
  deleteSale: (id: string, reason?: string) => Promise<OperationResult | void>;
  addProduct: (product: Omit<Product, 'id'>, options?: { restockRetired?: boolean }) => Promise<Product>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string, reason?: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => Promise<Client>;
  updateClient: (client: Client) => Promise<void>;
  registerClientPayment: (clientId: string, input: { amount: number; method: string; currency?: string | null }) => Promise<Client>;
  deleteClient: (id: string, reason?: string) => Promise<void>;
  updateTradeIn: (tradeIn: TradeIn) => Promise<OperationResult | void>;
  deleteTradeIn: (id: string, reason?: string) => Promise<OperationResult | void>;
  reloadInventory: () => Promise<void>;
  reloadSales: () => Promise<void>;
  reloadClients: () => Promise<void>;
  reloadTradeIns: () => Promise<void>;
  clientCategories: ClientCategory[];
  user: AuthUserLike | null;
  loading: boolean;
  appSession: AppSession | null;
  billingDetails: ReturnType<typeof useBillingState>['billingDetails'];
  loadBilling: ReturnType<typeof useBillingState>['loadBilling'];
  quoteSubscription: ReturnType<typeof useBillingState>['quoteSubscription'];
  openSubscriptionCheckout: ReturnType<typeof useBillingState>['openSubscriptionCheckout'];
  cancelSubscription: ReturnType<typeof useBillingState>['cancelSubscription'];
  backendStatus: BackendConnectionStatus;
  sessionConfirmed: boolean;
  backendMessage: string | null;
  updateStore: (data: StoreUpdateInput) => Promise<void>;
  updateUserProfile: (data: { displayName: string }) => Promise<void>;
  completeOnboarding: (input: { storeName: string; instagram?: string; currency?: 'ARS' | 'USD'; exchangeMode?: 'auto' | 'manual'; exchangeSource?: 'blue' | 'oficial' | 'mep'; manualBuy?: number | null; manualSell?: number | null }) => Promise<void>;
  acceptStoreInvitation: (token: string) => Promise<void>;
  reloadSession: () => Promise<void>;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

function rememberSession(currentUser: AuthUserLike, session: AppSession) {
  writeBootSession({
    uid: currentUser.uid,
    email: currentUser.email,
    displayName: currentUser.displayName,
    photoURL: currentUser.photoURL ?? null,
    session,
  });
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const authAdapter = getAuthAdapter();
  const boot = readBootSession();
  const [user, setUser] = useState<AuthUserLike | null>(() => boot ? cachedAuthUser(boot) : null);
  const [loading, setLoading] = useState(() => !boot);
  const [appSession, setAppSession] = useState<AppSession | null>(() => boot?.session ?? null);
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus>(() => boot ? 'ready' : 'checking');
  const [sessionConfirmed, setSessionConfirmed] = useState(false);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const {
    inventory, setInventory, listsLoaded,
    repairOrders, setRepairOrders, repairOrdersError,
    sales, setSales,
    tradeIns, setTradeIns,
    clients, setClients, clientCategories, setClientCategories,
    operationOptions, setOperationOptions, operationDrafts, setOperationDrafts,
    operationNotifications, setOperationNotifications,
    notificationsLoading, setNotificationsLoading, notificationsError, setNotificationsError,
    customColumns, setCustomColumns,
    scopeRef, currentScope, canAccess, backendReady,
    backendInventoryEnabled, backendClientsEnabled, backendSalesEnabled,
    backendTradeInsEnabled, loadRepairsEnabled,
    noteLocalMutation,
    recordsGeneration,
  } = useStoreRecords({ user, appSession, backendStatus });

  const billingState = useBillingState(user, appSession?.store?.id, appSession?.membership?.role);
  const cashState = useCashState(user, appSession, backendStatus);
  const ledgerState = useLedgerState(user, appSession, backendStatus);
  const commissions = useCommissionState(user, appSession, backendStatus, sessionConfirmed);
  const catalogState = usePublicCatalogState(user, appSession, backendStatus, (catalog) => {
    const visibility = new Map(catalog?.items.map(item => [item.id, item]));
    setInventory(items => items.map(item => {
      const managed = visibility.get(item.id);
      return managed ? { ...item, catalogVisible: managed.catalogVisible, catalogIncluded: Boolean(catalog?.active && !managed.reason) } : item;
    }));
  });
  const [depositState, setDepositState] = useState<{ scope: string; rows: Record<string, ClientDeposit[]> }>({ scope: currentScope, rows: {} });
  const depositGenerations = React.useRef<Record<string, number>>({});
  const clientDeposits = depositState.scope === currentScope ? depositState.rows : {};
  const requireDeposits = () => {
    if (!user || !backendReady || !['clients', 'sales', 'service'].some(section => canAccess(section as 'clients' | 'sales' | 'service'))) throw new Error('El backend todavía no está listo o no tenés acceso a señas');
    return user;
  };
  const rememberCredit = (clientId: string, rows: ClientDeposit[]) => {
    setClients(old => old.map(client => client.id === clientId ? { ...client, creditBalance: creditTotal(rows, client.balanceCurrency ?? null) } : client));
  };
  const loadClientDeposits = async (clientId: string) => {
    const ticket = depositLoadTicket(depositGenerations.current, clientId);
    const rows = await fetchClientDeposits(requireDeposits(), clientId);
    if (scopeRef.current === currentScope && depositLoadIsCurrent(depositGenerations.current, clientId, ticket)) {
      setDepositState(old => ({ scope: currentScope, rows: { ...(old.scope === currentScope ? old.rows : {}), [clientId]: rows } }));
      rememberCredit(clientId, rows);
    }
    return rows;
  };
  const mergeDeposit = (row: ClientDeposit) => {
    if (scopeRef.current !== currentScope) return;
    depositGenerations.current = noteDepositMutation(depositGenerations.current, row.clientId);
    setDepositState(old => {
      const rows = old.scope === currentScope ? old.rows : {};
      const next = [row, ...(rows[row.clientId] ?? []).filter(item => item.id !== row.id)];
      rememberCredit(row.clientId, next);
      return { scope: currentScope, rows: { ...rows, [row.clientId]: next } };
    });
    noteLocalMutation();
  };
  const addClientDeposit = async (clientId: string, input: DepositInput) => {
    const row = await createClientDeposit(requireDeposits(), clientId, input);
    if (scopeRef.current === currentScope) {
      mergeDeposit(row);
      if (row.productId && row.status === 'ACTIVE') setInventory(old => old.map(item => item.id === row.productId ? { ...item, status: 'RESERVADO', reservedDepositId: row.id, reservedClientId: clientId, reservedClientName: clients.find(client => client.id === clientId)?.name, reservedAt: row.createdAt } : item));
    }
    return row;
  };
  const runCancelClientDeposit = async (clientId: string, id: string, mode: 'REFUND' | 'CREDIT') => {
    const row = await cancelClientDeposit(requireDeposits(), clientId, id, mode);
    if (scopeRef.current === currentScope) {
      mergeDeposit(row);
      setInventory(old => old.map(item => item.reservedDepositId === id ? { ...item, status: row.previousInventoryStatus ?? 'DISPONIBLE', reservedDepositId: null, reservedClientId: null, reservedClientName: null, reservedAt: null } : item));
    }
    return row;
  };
  const runApplyClientDepositToRepair = async (clientId: string, id: string, repairId: string, exchangeRate?: number) => {
    const result = await applyClientDepositToRepair(requireDeposits(), clientId, id, repairId, exchangeRate);
    if (scopeRef.current === currentScope) {
      mergeDeposit(result.deposit);
      setRepairOrders(old => old.map(order => order.id === repairId ? { ...order, deposit: result.repairDeposit, currency: result.repairCurrency } : order));
    }
  };

  const refreshBackendSession = async (currentUser: AuthUserLike) => {
    const { status, session, message } = await fetchBackendSession(currentUser);
    setBackendStatus(status);
    setAppSession(session);
    setBackendMessage(message);
    return { status, session, message };
  };

  useEffect(() => {
    const unsubscribe = authAdapter.onAuthStateChanged((currentUser) => {
      setAnalyticsUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        clearSessionCaches();
        setUser(null);
        return;
      }
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [authAdapter]);

  useEffect(() => {
    if (!user) {
      setInventory([]);
      setSales([]);
      setTradeIns([]);
      setClients([]);
      setOperationOptions({});
      setOperationDrafts([]);
      setClientCategories([]);
      setCustomColumns([]);
      setAppSession(null);
      setBackendStatus('checking');
      setSessionConfirmed(false);
      setBackendMessage(null);
      return;
    }

    let cancelled = false;
    let retryTimeout: number | undefined;

    const loadBackendSession = async () => {
      try {
        const { status, session, message } = await fetchBackendSession(user);
        if (cancelled) return;
        if (status === 'unauthorized') {
          clearSessionCaches();
          setBackendStatus('unauthorized');
          setSessionConfirmed(false);
          setBackendMessage(message);
          setAppSession(null);
          await authAdapter.logout();
          return;
        }
        if (status === 'ready' && session) {
          rememberSession(user, session);
          setBackendStatus('ready');
          setAppSession(session);
          setSessionConfirmed(true);
          setBackendMessage(message);
          if (session.onboardingRequired) {
            retryTimeout = window.setTimeout(() => {
              if (!cancelled) void loadBackendSession();
            }, 15000);
          }
          return;
        }
        if (readBootSession()?.uid === user.uid) {
          setBackendStatus('ready');
          setBackendMessage(message);
        } else {
          setBackendStatus(status);
          setAppSession(session);
          setBackendMessage(message);
        }
        retryTimeout = window.setTimeout(() => {
          if (!cancelled) void loadBackendSession();
        }, 15000);
      } catch (error) {
        if (cancelled) return;
        if (readBootSession()?.uid === user.uid) setBackendStatus('ready');
        else setBackendStatus('offline');
        setBackendMessage(toUserMessage(error));

        retryTimeout = window.setTimeout(() => {
          if (!cancelled) void loadBackendSession();
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
    clearSessionCaches();
    await authAdapter.logout();
  };

  const updateStore = async (data: StoreUpdateInput) => {
    if (!user) throw new Error('No authenticated user');
    const updatedStore = await updateStoreApi(user, data);
    setAppSession(prev => prev ? {
      ...prev,
      store: { ...updatedStore, ownerDisplayName: prev.store?.id === updatedStore.id ? prev.store.ownerDisplayName : undefined },
      stores: prev.stores?.map((store) => store.id === updatedStore.id ? { ...store, name: updatedStore.name } : store),
    } : prev);
  };

  const updateUserProfile = async (data: { displayName: string }) => {
    if (!user) throw new Error('No authenticated user');
    const updatedUser = await updateUserProfileApi(user, data);
    setAppSession(prev => prev ? { ...prev, user: updatedUser } : prev);
  };

  useEffect(() => {
    const storeId = appSession?.store?.id;
    if (!user || !storeId || appSession?.billing?.plan === 'INTERNAL' || !appSession?.billing) return;
    let active = true;
    const refresh = async () => {
      try {
        const { session } = await fetchBackendSession(user);
        if (active && session?.store?.id === storeId) setAppSession(current => current?.store?.id === storeId ? { ...current, billing: session.billing } : current);
      } catch { /* The existing session remains readable; each write is guarded by the server. */ }
    };
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user, appSession?.store?.id, appSession?.billing?.plan]);

  const gettingStartedState = useGettingStartedState(user, backendStatus === 'ready' ? appSession?.store?.id : undefined);
  const returnsState = useReturnsState(user, appSession, backendStatus);

  const completeOnboarding = async (input: { storeName: string; instagram?: string; currency?: 'ARS' | 'USD'; exchangeMode?: 'auto' | 'manual'; exchangeSource?: 'blue' | 'oficial' | 'mep'; manualBuy?: number | null; manualSell?: number | null }) => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    const session = await completeBackendOnboarding(user, input);
    // Contact details can be completed later from settings.
    setBackendStatus('ready');
    setSessionConfirmed(true);
    setBackendMessage(null);
    setAppSession(session);
    rememberSession(user, session);
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
    setSessionConfirmed(true);
    setBackendMessage(null);
    setAppSession(data.session);
    rememberSession(user, data.session);
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
      if (scopeRef.current === requestScope) setNotificationsError(toUserMessage(error));
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

  const runOperation = async (source: OperationSource, call: (currentUser: AuthUserLike) => Promise<OperationResult>, mutate = false) => {
    const currentUser = requireOperationSource(source);
    const requestScope = currentScope;
    const seen = recordsGeneration.current;
    if (mutate) recordsGeneration.current += 1;
    const result = await call(currentUser);
    if (scopeRef.current === requestScope && canAccess(source)) {
      if (mutate || snapshotIsCurrent(seen, recordsGeneration.current)) applyOperationResult(result, requestScope);
      if (mutate) {
        noteLocalMutation();
        // Invalidate receipts after consumption/restoration; the next sheet loads authoritative state.
        setDepositState({ scope: currentScope, rows: {} });
      }
    }
    return result;
  };

  const runCreateOperation = (source: OperationSource, input: OperationInput) =>
    runOperation(source, async (currentUser) => {
      const exchangeRate = !input.draft ? input.exchangeRate ?? await fetchCommissionExchangeRate(currentUser) : input.exchangeRate;
      if (scopeRef.current !== currentScope) throw new Error('La tienda cambió. Volvé a abrir la venta.');
      return createOperation(currentUser, source, { ...input, ...(exchangeRate ? { exchangeRate } : {}) });
    }, true);
  const runUpdateSaleOperation = (id: string, input: OperationInput) =>
    runOperation('sales', (currentUser) => updateSaleOperation(currentUser, id, input), true);
  const runUpdateTradeOperation = (source: OperationSource, id: string, input: OperationInput) =>
    runOperation(source, (currentUser) => updateTradeOperation(currentUser, source, id, input), true);
  const runConfirmTradeOperation = (source: OperationSource, id: string, input: OperationInput) =>
    runOperation(source, async (currentUser) => {
      const exchangeRate = input.exchangeRate ?? await fetchCommissionExchangeRate(currentUser);
      if (scopeRef.current !== currentScope) throw new Error('La tienda cambió. Volvé a abrir la venta.');
      return confirmTradeOperation(currentUser, source, id, { ...input, exchangeRate });
    }, true);
  const runCancelSaleOperation = (id: string) =>
    runOperation('sales', (currentUser) => cancelSaleOperation(currentUser, id), true);
  const runCancelTradeOperation = (source: OperationSource, id: string) =>
    runOperation(source, (currentUser) => cancelTradeOperation(currentUser, source, id), true);
  const runFetchSaleOperation = (id: string) =>
    runOperation('sales', (currentUser) => fetchSaleOperation(currentUser, id));
  const runFetchTradeOperation = (source: OperationSource, id: string) =>
    runOperation(source, (currentUser) => fetchTradeOperation(currentUser, source, id));

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
    noteLocalMutation();
    if (previous && previous.productId !== backendSale.productId) {
      setInventory(prev => prev.map(product => {
        if (previous.productId && product.id === previous.productId) return { ...product, status: 'DISPONIBLE' };
        if (backendSale.productId && product.id === backendSale.productId) return { ...product, status: 'VENDIDO' };
        return product;
      }));
    }
  };

  const deleteSale = async (id: string, reason?: string) => {
    if (!user) return;
    if (!backendSalesEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para eliminar ventas. Reintenta en unos segundos.'
      );
    }

    const existingSale = sales.find((sale) => sale.id === id);
    const cancelled = existingSale?.status === 'CANCELADA';
    if (!cancelled && (existingSale?.integratedOperation || existingSale?.tradeInId)) {
      return await runCancelSaleOperation(id);
    }
    await deleteBackendSale(user, id, reason);

    if (!cancelled && existingSale?.productId) {
      setInventory(prev => prev.map(product => (
        product.id === existingSale.productId ? { ...product, status: 'DISPONIBLE' } : product
      )));
    }

    if (!cancelled && existingSale?.clientId) {
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
    noteLocalMutation();
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
    noteLocalMutation();
    return result.order;
  };

  const updateRepairOrder = async (id: string, input: Partial<RepairOrderInput>) => {
    if (!user) throw new Error('No hay sesión');
    if (!loadRepairsEnabled) throw new Error(backendMessage || 'El backend todavía no está listo para guardar órdenes de servicio.');
    const result = await updateBackendRepair(user, id, input);
    setRepairOrders((current) => current.map((item) => item.id === id ? result.order : item));
    rememberClient(result.client);
    noteLocalMutation();
    return result.order;
  };

  const changeRepairStatus = async (id: string, status: string) => {
    if (!user) throw new Error('No hay sesión');
    if (!loadRepairsEnabled) throw new Error(backendMessage || 'El backend todavía no está listo para guardar órdenes de servicio.');
    const order = await changeBackendRepairStatus(user, id, status);
    setRepairOrders((current) => current.map((item) => item.id === id ? order : item));
    noteLocalMutation();
    return order;
  };

  const deleteRepairOrder = async (id: string, reason?: string) => {
    if (!user) throw new Error('No hay sesión');
    if (!loadRepairsEnabled) throw new Error(backendMessage || 'El backend todavía no está listo para guardar órdenes de servicio.');
    await deleteBackendRepair(user, id, reason);
    setRepairOrders((current) => current.filter((item) => item.id !== id));
    noteLocalMutation();
  };

  const restoreRepairOrder = async (id: string) => {
    if (!user) throw new Error('No hay sesión');
    if (!loadRepairsEnabled) throw new Error(backendMessage || 'El backend todavía no está listo para guardar órdenes de servicio.');
    const order = await restoreBackendRepair(user, id);
    setRepairOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
    noteLocalMutation();
  };

  const addProduct = async (productData: Omit<Product, 'id'>, options?: { restockRetired?: boolean }) => {
    if (!user) throw new Error('No authenticated user');
    if (!backendInventoryEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para guardar inventario. Reintenta en unos segundos.'
      );
    }
    const createdProduct = visibleInventory([await createBackendInventoryItem(user, productData, options)], canAccess('reports'))[0];
    setInventory(prev => [createdProduct, ...prev]);
    noteLocalMutation();
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
      noteLocalMutation();
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

  const deleteProduct = async (id: string, reason?: string) => {
    if (!user) return;
    if (!backendInventoryEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para eliminar inventario. Reintenta en unos segundos.'
      );
    }
    await deleteBackendInventoryItem(user, id, reason);
    setInventory(prev => prev.filter(product => product.id !== id));
    noteLocalMutation();
  };

  const reloadInventory = async () => {
    if (!user) return;
    const items = await fetchBackendInventory(user);
    setInventory(visibleInventory(items, canAccess('reports')));
    noteLocalMutation();
  };

  const reloadSales = async () => {
    if (!user) return;
    recordsGeneration.current += 1;
    const seen = recordsGeneration.current;
    const items = await fetchBackendSales(user);
    if (!snapshotIsCurrent(seen, recordsGeneration.current)) return;
    setSales(items);
    noteLocalMutation();
  };

  const reloadClients = async () => {
    if (!user) return;
    recordsGeneration.current += 1;
    const seen = recordsGeneration.current;
    const items = await fetchBackendClients(user);
    if (!snapshotIsCurrent(seen, recordsGeneration.current)) return;
    setClients(items);
    noteLocalMutation();
  };

  const reloadTradeIns = async () => {
    if (!user) return;
    const items = await fetchBackendTradeIns(user);
    setTradeIns(items);
    noteLocalMutation();
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
    noteLocalMutation();
    return createdClient;
  };

  const updateClient = async (updatedClient: Client) => {
    if (!user) return;
    if (!backendClientsEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para actualizar clientes. Reintenta en unos segundos.'
      );
    }
    const seen = beginListWrite(recordsGeneration);
    const backendClient = await updateBackendClient(user, updatedClient);
    if (!snapshotIsCurrent(seen, recordsGeneration.current)) return;
    setClients(prev => prev.map(client => client.id === backendClient.id ? { ...backendClient, creditBalance: backendClient.creditBalance || client.creditBalance } : client));
    noteLocalMutation();
  };

  const registerClientPayment = async (clientId: string, input: { amount: number; method: string; currency?: string | null }) => {
    if (!user) throw new Error('No hay sesión');
    if (!backendClientsEnabled) {
      throw new Error(backendMessage || 'El backend todavía no está listo para registrar pagos.');
    }
    recordsGeneration.current += 1;
    const seen = recordsGeneration.current;
    const updated = await registerBackendClientPayment(user, clientId, input);
    if (!snapshotIsCurrent(seen, recordsGeneration.current)) return updated;
    setClients(prev => prev.map(client => client.id === updated.id ? { ...updated, creditBalance: updated.creditBalance || client.creditBalance } : client));
    noteLocalMutation();
    return updated;
  };

  const deleteClient = async (id: string, reason?: string) => {
    if (!user) return;
    if (!backendClientsEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para eliminar clientes. Reintenta en unos segundos.'
      );
    }
    await deleteBackendClient(user, id, reason);
    setClients(prev => prev.filter(client => client.id !== id));
    noteLocalMutation();
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
      return result;
    }
    const backendTradeIn = await updateBackendTradeIn(user, updatedTradeIn);
    setTradeIns(prev => prev.map(t => t.id === backendTradeIn.id ? backendTradeIn : t));
    noteLocalMutation();
  };

  const deleteTradeIn = async (id: string, reason?: string) => {
    if (!user) return;
    if (!backendTradeInsEnabled) {
      throw new Error(
        backendMessage || 'El backend todavia no esta listo para eliminar canjes. Reintenta en unos segundos.'
      );
    }
    const existing = tradeIns.find((trade) => trade.id === id);
    if (existing && isActiveTradeOperation(existing)) {
      return await runCancelTradeOperation('tradeins', id);
    }
    await deleteBackendTradeIn(user, id, reason);
    setTradeIns(prev => prev.filter(t => t.id !== id));
    noteLocalMutation();
  };

  return (
    <AppContext.Provider value={{
      ...cashState,
      ...ledgerState,
      ...gettingStartedState,
      ...commissions,
      ...catalogState,
      ...returnsState,
      inventory, sales, tradeIns, clients, listsLoaded, customColumns,
      repairOrders, repairOrdersError, addRepairOrder, updateRepairOrder, changeRepairStatus, deleteRepairOrder, restoreRepairOrder,
      operationOptions, operationDrafts,
      operationNotifications,
      notificationsLoading, notificationsError, refreshNotifications, markNotificationRead, markAllNotificationsRead,
      loadOperationOptions, loadOperationDrafts,
      createOperation: runCreateOperation,
      updateSaleOperation: runUpdateSaleOperation,
      updateTradeOperation: runUpdateTradeOperation,
      confirmTradeOperation: runConfirmTradeOperation,
      cancelTradeOperation: runCancelTradeOperation,
      fetchSaleOperation: runFetchSaleOperation,
      fetchTradeOperation: runFetchTradeOperation,
      updateSale, deleteSale,
      addProduct, updateProduct, deleteProduct,
      addClient, updateClient, registerClientPayment, deleteClient,
      clientDeposits, loadClientDeposits, addClientDeposit, cancelClientDeposit: runCancelClientDeposit, applyClientDepositToRepair: runApplyClientDepositToRepair,
      updateTradeIn, deleteTradeIn,
      reloadInventory, reloadSales, reloadClients, reloadTradeIns,
      clientCategories,
      updateStore, updateUserProfile, reloadSession,
      ...billingState,
      user, loading, appSession, backendStatus, sessionConfirmed, backendMessage, completeOnboarding, acceptStoreInvitation, login, loginWithEmail, registerWithEmail, logout
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
