import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, Sale, TradeIn, Client, CustomColumn, ClientCategory, RepairOrder } from '../types';
import { fetchBackendSession } from '../services/backend-session';
import { createBackendClient, deleteBackendClient, fetchBackendClients, updateBackendClient, registerBackendClientPayment } from '../services/clients-api';
import { createBackendInventoryItem, deleteBackendInventoryItem, fetchBackendInventory, updateBackendInventoryItem } from '../services/inventory-api';
import { deleteBackendSale, fetchBackendSales, updateBackendSale } from '../services/sales-api';
import { deleteBackendTradeIn, fetchBackendTradeIns, updateBackendTradeIn } from '../services/trade-ins-api';
import { completeBackendOnboarding } from '../services/onboarding-api';
import { acceptInvitation as acceptInvitationApi } from '../services/invitations-api';
import { markStoreContactOffer } from '../lib/store-contact';
import { updateStoreApi, updateUserProfileApi, type StoreUpdateInput } from '../services/settings-api';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { getAuthAdapter } from '../services/auth-adapter';
import { cancelSaleOperation, cancelTradeOperation, confirmTradeOperation, createOperation, fetchNotifications, fetchOperationDrafts, fetchOperationOptions, fetchSaleOperation, fetchTradeOperation, markAllNotificationsReadApi, markNotificationReadApi, updateSaleOperation, updateTradeOperation, type OperationInput, type OperationNotification, type OperationOptions, type OperationResult, type OperationSource } from '../services/operations-api';
import { changeBackendRepairStatus, createBackendRepair, deleteBackendRepair, updateBackendRepair, type RepairOrderInput } from '../services/repairs-api';
import { readLocalCustomColumns, useStoreRecords, visibleInventory, withoutStoredCost } from './store-records';

interface AppState {
  inventory: Product[];
  repairOrders: RepairOrder[];
  repairOrdersError: string | null;
  addRepairOrder: (input: RepairOrderInput) => Promise<RepairOrder>;
  updateRepairOrder: (id: string, input: Partial<RepairOrderInput>) => Promise<RepairOrder>;
  changeRepairStatus: (id: string, status: string) => Promise<RepairOrder>;
  deleteRepairOrder: (id: string) => Promise<void>;
  sales: Sale[];
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
  cancelTradeOperation: (source: OperationSource, id: string) => Promise<OperationResult>;
  fetchSaleOperation: (id: string) => Promise<OperationResult>;
  fetchTradeOperation: (source: OperationSource, id: string) => Promise<OperationResult>;
  updateSale: (sale: Sale) => Promise<OperationResult | void>;
  deleteSale: (id: string) => Promise<OperationResult | void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => Promise<Client>;
  updateClient: (client: Client) => Promise<void>;
  registerClientPayment: (clientId: string, input: { amount: number; method: string; currency?: string | null }) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  updateTradeIn: (tradeIn: TradeIn) => Promise<OperationResult | void>;
  deleteTradeIn: (id: string) => Promise<OperationResult | void>;
  reloadInventory: () => Promise<void>;
  reloadSales: () => Promise<void>;
  reloadClients: () => Promise<void>;
  reloadTradeIns: () => Promise<void>;
  clientCategories: ClientCategory[];
  user: AuthUserLike | null;
  loading: boolean;
  appSession: AppSession | null;
  backendStatus: BackendConnectionStatus;
  backendMessage: string | null;
  updateStore: (data: StoreUpdateInput) => Promise<void>;
  updateUserProfile: (data: { displayName: string }) => Promise<void>;
  completeOnboarding: (input: { storeName: string; instagram: string; currency?: 'ARS' | 'USD'; exchangeMode?: 'auto' | 'manual'; exchangeSource?: 'blue' | 'oficial' | 'mep'; manualBuy?: number | null; manualSell?: number | null }) => Promise<void>;
  acceptStoreInvitation: (token: string) => Promise<void>;
  reloadSession: () => Promise<void>;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const authAdapter = getAuthAdapter();
  const [user, setUser] = useState<AuthUserLike | null>(null);
  const [loading, setLoading] = useState(true);
  const [appSession, setAppSession] = useState<AppSession | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus>('checking');
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const {
    inventory, setInventory,
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
  } = useStoreRecords({ user, appSession, backendStatus });

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
      setTradeIns([]);
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

  const completeOnboarding = async (input: { storeName: string; instagram: string; currency?: 'ARS' | 'USD'; exchangeMode?: 'auto' | 'manual'; exchangeSource?: 'blue' | 'oficial' | 'mep'; manualBuy?: number | null; manualSell?: number | null }) => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    const session = await completeBackendOnboarding(user, input);
    if (session.store?.id) markStoreContactOffer(session.store.id);
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

  const runOperation = async (source: OperationSource, call: (currentUser: AuthUserLike) => Promise<OperationResult>) => {
    const currentUser = requireOperationSource(source);
    const requestScope = currentScope;
    const result = await call(currentUser);
    if (scopeRef.current === requestScope && canAccess(source)) applyOperationResult(result, requestScope);
    return result;
  };

  const runCreateOperation = (source: OperationSource, input: OperationInput) =>
    runOperation(source, (currentUser) => createOperation(currentUser, source, input));
  const runUpdateSaleOperation = (id: string, input: OperationInput) =>
    runOperation('sales', (currentUser) => updateSaleOperation(currentUser, id, input));
  const runUpdateTradeOperation = (source: OperationSource, id: string, input: OperationInput) =>
    runOperation(source, (currentUser) => updateTradeOperation(currentUser, source, id, input));
  const runConfirmTradeOperation = (source: OperationSource, id: string, input: OperationInput) =>
    runOperation(source, (currentUser) => confirmTradeOperation(currentUser, source, id, input));
  const runCancelSaleOperation = (id: string) =>
    runOperation('sales', (currentUser) => cancelSaleOperation(currentUser, id));
  const runCancelTradeOperation = (source: OperationSource, id: string) =>
    runOperation(source, (currentUser) => cancelTradeOperation(currentUser, source, id));
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
    const result = await updateBackendRepair(user, id, input);
    setRepairOrders((current) => current.map((item) => item.id === id ? result.order : item));
    rememberClient(result.client);
    return result.order;
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
      cancelTradeOperation: runCancelTradeOperation,
      fetchSaleOperation: runFetchSaleOperation,
      fetchTradeOperation: runFetchTradeOperation,
      updateSale, deleteSale,
      addProduct, updateProduct, deleteProduct,
      addClient, updateClient, registerClientPayment, deleteClient,
      updateTradeIn, deleteTradeIn,
      reloadInventory, reloadSales, reloadClients, reloadTradeIns,
      clientCategories,
      updateStore, updateUserProfile, reloadSession,
      user, loading, appSession, backendStatus, backendMessage, completeOnboarding, acceptStoreInvitation, login, loginWithEmail, registerWithEmail, logout
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
