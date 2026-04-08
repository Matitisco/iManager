import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, Sale, TradeIn, Client, CustomColumn, InventoryCategory, CustomColumnEntity } from '../types';
import { auth, db, googleProvider } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, setDoc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { fetchBackendSession } from '../services/backend-session';
import { createBackendClient, deleteBackendClient, fetchBackendClients, updateBackendClient } from '../services/clients-api';
import { createBackendInventoryItem, deleteBackendInventoryItem, fetchBackendInventory, updateBackendInventoryItem, fetchCategories, createCategoryApi, renameCategoryApi, deleteCategoryApi, bulkMoveCategoryApi, reorderCategoriesApi } from '../services/inventory-api';
import { createBackendSale, deleteBackendSale, fetchBackendSales, updateBackendSale, fetchSalesCategoriesApi, type Category as SaleCategory } from '../services/sales-api';
import { createBackendTradeIn, deleteBackendTradeIn, fetchBackendTradeIns, updateBackendTradeIn } from '../services/trade-ins-api';
import { completeBackendOnboarding } from '../services/onboarding-api';
import { updateStoreApi, updateUserProfileApi, type StoreUpdateInput } from '../services/settings-api';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';

interface AppState {
  inventory: Product[];
  sales: Sale[];
  salesCategories: SaleCategory[];
  tradeIns: TradeIn[];
  clients: Client[];
  customColumns: CustomColumn[];
  addSale: (sale: Omit<Sale, 'id'>) => Promise<void>;
  updateSale: (sale: Sale) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => Promise<Client>;
  updateClient: (client: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addTradeIn: (tradeIn: Omit<TradeIn, 'id'>) => Promise<void>;
  updateTradeIn: (tradeIn: TradeIn) => Promise<void>;
  deleteTradeIn: (id: string) => Promise<void>;
  addCustomColumn: (column: Omit<CustomColumn, 'id'>) => Promise<string | undefined>;
  removeCustomColumn: (id: string) => Promise<void>;
  reloadInventory: () => Promise<void>;
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
  user: User | null;
  loading: boolean;
  appSession: AppSession | null;
  backendStatus: BackendConnectionStatus;
  backendMessage: string | null;
  updateStore: (data: StoreUpdateInput) => Promise<void>;
  updateUserProfile: (data: { displayName: string }) => Promise<void>;
  completeOnboarding: (storeName: string) => Promise<void>;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const generateId = (prefix: string) => `${prefix}-${Math.floor(Math.random() * 1000000)}`;

const CUSTOM_COLUMN_ENTITIES: CustomColumnEntity[] = ['inventory', 'clients', 'sales', 'trade-ins'];

function normalizeCustomColumn(id: string, raw: Record<string, unknown>): CustomColumn {
  const type = raw.type === 'number' || raw.type === 'enum' ? raw.type : 'text';
  const entity = CUSTOM_COLUMN_ENTITIES.includes(raw.entity as CustomColumnEntity)
    ? (raw.entity as CustomColumnEntity)
    : 'inventory';

  return {
    id,
    label: String(raw.label ?? ''),
    type,
    options: Array.isArray(raw.options) ? raw.options.map(String) : undefined,
    entity,
  };
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

function getCustomColumnFingerprint(column: CustomColumn) {
  return [
    column.entity,
    column.type,
    column.label.trim().toLowerCase(),
    (column.options ?? []).map((option) => option.trim().toLowerCase()).join('|'),
  ].join('::');
}

function mergeCustomColumns(remote: CustomColumn[], local: CustomColumn[]) {
  const merged = new Map<string, CustomColumn>();
  const seenFingerprints = new Set<string>();

  const addColumn = (column: CustomColumn) => {
    const fingerprint = getCustomColumnFingerprint(column);
    if (seenFingerprints.has(fingerprint)) {
      return;
    }

    merged.set(column.id, column);
    seenFingerprints.add(fingerprint);
  };

  remote.forEach(addColumn);
  local.forEach((column) => {
    if (!merged.has(column.id)) {
      addColumn(column);
    }
  });

  return Array.from(merged.values());
}

const AppContext = createContext<AppState | undefined>(undefined);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [inventory, setInventory] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesCategories, setSalesCategories] = useState<SaleCategory[]>([]);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<InventoryCategory[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [appSession, setAppSession] = useState<AppSession | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus>('checking');
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [inventorySource, setInventorySource] = useState<'firestore' | 'backend'>('firestore');
  const [clientsSource, setClientsSource] = useState<'firestore' | 'backend'>('firestore');
  const [salesSource, setSalesSource] = useState<'firestore' | 'backend'>('firestore');
  const [tradeInsSource, setTradeInsSource] = useState<'firestore' | 'backend'>('firestore');

  const refreshBackendSession = async (currentUser: User) => {
    const { status, session, message } = await fetchBackendSession(currentUser);
    setBackendStatus(status);
    setAppSession(session);
    setBackendMessage(message);
    return { status, session, message };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setInventory([]);
      setSales([]);
      setSalesCategories([]);
      setTradeIns([]);
      setClients([]);
      setCustomColumns([]);
      setAppSession(null);
      setBackendStatus('checking');
      setBackendMessage(null);
      setInventorySource('firestore');
      setClientsSource('firestore');
      setSalesSource('firestore');
      setTradeInsSource('firestore');
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

    const unsubTradeIns = onSnapshot(collection(db, 'tradeIns'), (snapshot) => {
      setTradeIns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TradeIn)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tradeIns'));

    const customColumnsQuery = query(collection(db, 'customColumns'), where('authorUid', '==', user.uid));

    const unsubCustomColumns = onSnapshot(customColumnsQuery, (snapshot) => {
      const remoteColumns = snapshot.docs.map(snapshotDoc => normalizeCustomColumn(snapshotDoc.id, snapshotDoc.data()));
      const mergedColumns = mergeCustomColumns(remoteColumns, readLocalCustomColumns(user.uid));
      writeLocalCustomColumns(user.uid, mergedColumns);
      setCustomColumns(mergedColumns);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customColumns'));

    return () => {
      cancelled = true;
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
      }
      unsubTradeIns();
      unsubCustomColumns();
    };
  }, [user]);

  const backendInventoryEnabled = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
  const backendClientsEnabled = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
  const backendSalesEnabled = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
  const backendTradeInsEnabled = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    let unsubscribeFirestore: (() => void) | null = null;

    const startFirestoreFallback = () => {
      setInventorySource('firestore');
      unsubscribeFirestore = onSnapshot(collection(db, 'inventory'), (snapshot) => {
        setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'inventory'));
    };

    const loadBackendInventory = async () => {
      try {
        const [backendInventory, cats] = await Promise.all([fetchBackendInventory(user), fetchCategories(user).catch(() => [])]);
        if (cancelled) return;
        setInventory(backendInventory);
        setInventoryCategories(cats);
        setInventorySource('backend');
      } catch (error) {
        if (cancelled) return;
        console.warn('Backend inventory unavailable, falling back to Firestore.', error);
        startFirestoreFallback();
      }
    };

    if (backendInventoryEnabled) {
      void loadBackendInventory();
    } else {
      startFirestoreFallback();
    }

    return () => {
      cancelled = true;
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, [backendInventoryEnabled, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    let unsubscribeFirestore: (() => void) | null = null;

    const startFirestoreFallback = () => {
      setClientsSource('firestore');
      unsubscribeFirestore = onSnapshot(collection(db, 'clients'), (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'clients'));
    };

    const loadBackendClients = async () => {
      try {
        const backendClients = await fetchBackendClients(user);
        if (cancelled) return;
        setClients(backendClients);
        setClientsSource('backend');
      } catch (error) {
        if (cancelled) return;
        console.warn('Backend clients unavailable, falling back to Firestore.', error);
        startFirestoreFallback();
      }
    };

    if (backendClientsEnabled) {
      void loadBackendClients();
    } else {
      startFirestoreFallback();
    }

    return () => {
      cancelled = true;
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, [backendClientsEnabled, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    let unsubscribeFirestore: (() => void) | null = null;

    // Note: Firestore doesn't have sales Categories, so we only fetch them from backend.
    const loadBackendSalesAndCategories = async () => {
      try {
        const [backendSales, fetchedSalesCategories] = await Promise.all([
          fetchBackendSales(user),
          fetchSalesCategoriesApi(user).catch(() => []) // Gracefull fallback
        ]);
        if (cancelled) return;
        setSales(backendSales);
        setSalesCategories(fetchedSalesCategories);
        setSalesSource('backend');
      } catch (error) {
        if (cancelled) return;
        console.warn('Backend sales unavailable, falling back to Firestore.', error);
        setSalesSource('firestore');
        unsubscribeFirestore = onSnapshot(collection(db, 'sales'), (snapshot) => {
          setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales'));
      }
    };

    if (backendSalesEnabled) {
      void loadBackendSalesAndCategories();
    } else {
      setSalesSource('firestore');
      unsubscribeFirestore = onSnapshot(collection(db, 'sales'), (snapshot) => {
        setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales'));
    }

    return () => {
      cancelled = true;
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, [backendSalesEnabled, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    let unsubscribeFirestore: (() => void) | null = null;

    const startFirestoreFallback = () => {
      setTradeInsSource('firestore');
      unsubscribeFirestore = onSnapshot(collection(db, 'tradeIns'), (snapshot) => {
        setTradeIns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TradeIn)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'tradeIns'));
    };

    const loadBackendTradeIns = async () => {
      try {
        const backendTradeIns = await fetchBackendTradeIns(user);
        if (cancelled) return;
        setTradeIns(backendTradeIns);
        setTradeInsSource('backend');
      } catch (error) {
        if (cancelled) return;
        console.warn('Backend trade-ins unavailable, falling back to Firestore.', error);
        startFirestoreFallback();
      }
    };

    if (backendTradeInsEnabled) {
      void loadBackendTradeIns();
    } else {
      startFirestoreFallback();
    }

    return () => {
      cancelled = true;
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, [backendTradeInsEnabled, user]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing in with email", error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error registering with email", error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateStore = async (data: StoreUpdateInput) => {
    if (!user) throw new Error('No authenticated user');
    const updatedStore = await updateStoreApi(user, data);
    setAppSession(prev => prev ? { ...prev, store: updatedStore } : prev);
  };

  const updateUserProfile = async (data: { displayName: string }) => {
    if (!user) throw new Error('No authenticated user');
    const updatedUser = await updateUserProfileApi(user, data);
    setAppSession(prev => prev ? { ...prev, user: updatedUser } : prev);
  };

  const completeOnboarding = async (storeName: string) => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    const session = await completeBackendOnboarding(user, storeName);
    setBackendStatus('ready');
    setBackendMessage(null);
    setAppSession(session);
  };

  const addSale = async (saleData: Omit<Sale, 'id'>) => {
    if (!user) return;
    const canUseBackendSales = salesSource === 'backend' && backendSalesEnabled;
    try {
      if (canUseBackendSales) {
        const createdSale = await createBackendSale(user, saleData);
        setSales(prev => [createdSale, ...prev]);
        setInventory(prev => prev.map(product => (
          product.id === createdSale.productId ? { ...product, status: 'VENDIDO' } : product
        )));
        setClients(prev => prev.map(client => {
          if (client.id !== createdSale.clientId) {
            return client;
          }

          return {
            ...client,
            totalSpent: (client.totalSpent || 0) + createdSale.amount,
            lastPurchaseDate: createdSale.date,
          };
        }));
        return;
      }

      const id = generateId('V');
      const path = `sales/${id}`;
      const createdSale = { id, ...saleData };
      await setDoc(doc(db, 'sales', id), { ...saleData, authorUid: user.uid });
      setSales(prev => [createdSale, ...prev]);

      if (saleData.productId) {
        await updateDoc(doc(db, 'inventory', saleData.productId), { status: 'VENDIDO' });
        setInventory(prev => prev.map(product => (
          product.id === saleData.productId ? { ...product, status: 'VENDIDO' } : product
        )));
      }

      if (saleData.clientId) {
        const client = clients.find(c => c.id === saleData.clientId);
        if (client) {
          await updateDoc(doc(db, 'clients', saleData.clientId), {
            totalSpent: (client.totalSpent || 0) + saleData.amount,
            lastPurchaseDate: saleData.date
          });
          setClients(prev => prev.map(currentClient => (
            currentClient.id === saleData.clientId
              ? {
                  ...currentClient,
                  totalSpent: (currentClient.totalSpent || 0) + saleData.amount,
                  lastPurchaseDate: saleData.date,
                }
              : currentClient
          )));
        }
      }
    } catch (error) {
      if (canUseBackendSales) {
        console.warn('Backend sale create failed, falling back to Firestore.', error);
        setSalesSource('firestore');
        const id = generateId('V');
        const path = `sales/${id}`;
        try {
          const createdSale = { id, ...saleData };
          await setDoc(doc(db, 'sales', id), { ...saleData, authorUid: user.uid });
          setSales(prev => [createdSale, ...prev]);

          if (saleData.productId) {
            await updateDoc(doc(db, 'inventory', saleData.productId), { status: 'VENDIDO' });
            setInventory(prev => prev.map(product => (
              product.id === saleData.productId ? { ...product, status: 'VENDIDO' } : product
            )));
          }

          if (saleData.clientId) {
            const client = clients.find(c => c.id === saleData.clientId);
            if (client) {
              await updateDoc(doc(db, 'clients', saleData.clientId), {
                totalSpent: (client.totalSpent || 0) + saleData.amount,
                lastPurchaseDate: saleData.date
              });
              setClients(prev => prev.map(currentClient => (
                currentClient.id === saleData.clientId
                  ? {
                      ...currentClient,
                      totalSpent: (currentClient.totalSpent || 0) + saleData.amount,
                      lastPurchaseDate: saleData.date,
                    }
                  : currentClient
              )));
            }
          }

          return;
        } catch (fallbackError) {
          handleFirestoreError(fallbackError, OperationType.CREATE, path);
          return;
        }
      }

      const id = generateId('V');
      const path = `sales/${id}`;
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateSale = async (updatedSale: Sale) => {
    if (!user) return;
    const canUseBackendSales = salesSource === 'backend' && backendSalesEnabled;
    try {
      if (canUseBackendSales) {
        const backendSale = await updateBackendSale(user, updatedSale);
        setSales(prev => prev.map(sale => sale.id === backendSale.id ? backendSale : sale));
        return;
      }

      const path = `sales/${updatedSale.id}`;
      const { id, ...data } = updatedSale;
      await updateDoc(doc(db, 'sales', id), data as any);
    } catch (error) {
      if (canUseBackendSales) {
        console.warn('Backend sale update failed, falling back to Firestore.', error);
        setSalesSource('firestore');
        const path = `sales/${updatedSale.id}`;
        try {
          const { id, ...data } = updatedSale;
          await updateDoc(doc(db, 'sales', id), data as any);
          return;
        } catch (fallbackError) {
          handleFirestoreError(fallbackError, OperationType.UPDATE, path);
          return;
        }
      }

      const path = `sales/${updatedSale.id}`;
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteSale = async (id: string) => {
    if (!user) return;
    const canUseBackendSales = salesSource === 'backend' && backendSalesEnabled;
    try {
      const existingSale = sales.find((sale) => sale.id === id);

      if (canUseBackendSales) {
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
        return;
      }

      const path = `sales/${id}`;
      if (existingSale?.productId) {
        await updateDoc(doc(db, 'inventory', existingSale.productId), { status: 'DISPONIBLE' });
      }

      if (existingSale?.clientId) {
        const client = clients.find(c => c.id === existingSale.clientId);
        const remainingClientSales = sales.filter(
          (sale) => sale.clientId === existingSale.clientId && sale.id !== id
        );

        if (client) {
          await updateDoc(doc(db, 'clients', existingSale.clientId), {
            totalSpent: Math.max(0, (client.totalSpent || 0) - existingSale.amount),
            lastPurchaseDate: remainingClientSales[0]?.date || 'N/A'
          });
        }
      }

      await deleteDoc(doc(db, 'sales', id));
    } catch (error) {
      if (canUseBackendSales) {
        console.warn('Backend sale delete failed, falling back to Firestore.', error);
        setSalesSource('firestore');
        const path = `sales/${id}`;
        try {
          const existingSale = sales.find((sale) => sale.id === id);

          if (existingSale?.productId) {
            await updateDoc(doc(db, 'inventory', existingSale.productId), { status: 'DISPONIBLE' });
          }

          if (existingSale?.clientId) {
            const client = clients.find(c => c.id === existingSale.clientId);
            const remainingClientSales = sales.filter(
              (sale) => sale.clientId === existingSale.clientId && sale.id !== id
            );

            if (client) {
              await updateDoc(doc(db, 'clients', existingSale.clientId), {
                totalSpent: Math.max(0, (client.totalSpent || 0) - existingSale.amount),
                lastPurchaseDate: remainingClientSales[0]?.date || 'N/A'
              });
            }
          }

          await deleteDoc(doc(db, 'sales', id));
          return;
        } catch (fallbackError) {
          handleFirestoreError(fallbackError, OperationType.DELETE, path);
          return;
        }
      }

      const path = `sales/${id}`;
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addProduct = async (productData: Omit<Product, 'id'>) => {
    if (!user) return;
    const backendConfigured = backendStatus !== 'unconfigured';
    try {
      if (backendConfigured) {
        if (!backendInventoryEnabled) {
          throw new Error(
            backendMessage ||
              'El backend todavÃ­a no estÃ¡ listo para guardar inventario. ReintentÃ¡ en unos segundos.'
          );
        }

        const createdProduct = await createBackendInventoryItem(user, productData);
        setInventorySource('backend');
        setInventory(prev => [createdProduct, ...prev]);
        return;
      }

      const id = generateId('P');
      const path = `inventory/${id}`;
      const createdProduct = { id, ...productData };
      await setDoc(doc(db, 'inventory', id), { ...productData, authorUid: user.uid });
      setInventory(prev => [createdProduct, ...prev]);
    } catch (error) {
      if (backendConfigured) {
        throw error;
      }

      const id = generateId('P');
      const path = `inventory/${id}`;
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    if (!user) return;
    const backendConfigured = backendStatus !== 'unconfigured';

    // Optimistic update — show new value immediately before the API responds
    let previousItem: Product | undefined;
    setInventory(prev => {
      previousItem = prev.find(p => p.id === updatedProduct.id);
      return prev.map(product => product.id === updatedProduct.id ? updatedProduct : product);
    });

    try {
      if (backendConfigured) {
        if (!backendInventoryEnabled) {
          throw new Error(
            backendMessage ||
              'El backend todavÃ­a no estÃ¡ listo para actualizar inventario. ReintentÃ¡ en unos segundos.'
          );
        }

        const backendProduct = await updateBackendInventoryItem(user, updatedProduct);
        setInventorySource('backend');
        setInventory(prev => prev.map(product => product.id === backendProduct.id ? backendProduct : product));
        return;
      }

      const path = `inventory/${updatedProduct.id}`;
      const { id, ...data } = updatedProduct;
      await updateDoc(doc(db, 'inventory', id), data as any);
    } catch (error) {
      // Revert optimistic update on failure
      if (previousItem) {
        setInventory(prev => prev.map(product => product.id === updatedProduct.id ? previousItem! : product));
      }
      if (backendConfigured) {
        throw error;
      }

      const path = `inventory/${updatedProduct.id}`;
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user) return;
    const backendConfigured = backendStatus !== 'unconfigured';
    try {
      if (backendConfigured) {
        if (!backendInventoryEnabled) {
          throw new Error(
            backendMessage ||
              'El backend todavÃ­a no estÃ¡ listo para eliminar inventario. ReintentÃ¡ en unos segundos.'
          );
        }

        await deleteBackendInventoryItem(user, id);
        setInventorySource('backend');
        setInventory(prev => prev.filter(product => product.id !== id));
        return;
      }

      const path = `inventory/${id}`;
      await deleteDoc(doc(db, 'inventory', id));
    } catch (error) {
      if (backendConfigured) {
        throw error;
      }

      const path = `inventory/${id}`;
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const reloadInventory = async () => {
    if (!user) return;
    const items = await fetchBackendInventory(user);
    setInventory(items);
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

  const addClient = async (clientData: Omit<Client, 'id'>) => {
    if (!user) {
      throw new Error('No authenticated user');
    }
    const canUseBackendClients = clientsSource === 'backend' && backendClientsEnabled;
    try {
      if (canUseBackendClients) {
        const createdClient = await createBackendClient(user, clientData);
        setClients(prev => [createdClient, ...prev]);
        return createdClient;
      }

      const id = generateId('C');
      const createdClient = { id, ...clientData };
      const path = `clients/${id}`;
      await setDoc(doc(db, 'clients', id), { ...clientData, authorUid: user.uid });
      setClients(prev => [createdClient, ...prev]);
      return createdClient;
    } catch (error) {
      if (canUseBackendClients) {
        console.warn('Backend client create failed, falling back to Firestore.', error);
        setClientsSource('firestore');
        const id = generateId('C');
        const createdClient = { id, ...clientData };
        const path = `clients/${id}`;
        try {
          await setDoc(doc(db, 'clients', id), { ...clientData, authorUid: user.uid });
          setClients(prev => [createdClient, ...prev]);
          return createdClient;
        } catch (fallbackError) {
          handleFirestoreError(fallbackError, OperationType.CREATE, path);
          throw fallbackError;
        }
      }

      const id = generateId('C');
      const path = `clients/${id}`;
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  };

  const updateClient = async (updatedClient: Client) => {
    if (!user) return;
    const canUseBackendClients = clientsSource === 'backend' && backendClientsEnabled;
    try {
      if (canUseBackendClients) {
        const backendClient = await updateBackendClient(user, updatedClient);
        setClients(prev => prev.map(client => client.id === backendClient.id ? backendClient : client));
        return;
      }

      const path = `clients/${updatedClient.id}`;
      const { id, ...data } = updatedClient;
      await updateDoc(doc(db, 'clients', id), data as any);
    } catch (error) {
      if (canUseBackendClients) {
        console.warn('Backend client update failed, falling back to Firestore.', error);
        setClientsSource('firestore');
        const path = `clients/${updatedClient.id}`;
        try {
          const { id, ...data } = updatedClient;
          await updateDoc(doc(db, 'clients', id), data as any);
          return;
        } catch (fallbackError) {
          handleFirestoreError(fallbackError, OperationType.UPDATE, path);
          return;
        }
      }

      const path = `clients/${updatedClient.id}`;
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteClient = async (id: string) => {
    if (!user) return;
    const canUseBackendClients = clientsSource === 'backend' && backendClientsEnabled;
    try {
      if (canUseBackendClients) {
        await deleteBackendClient(user, id);
        setClients(prev => prev.filter(client => client.id !== id));
        return;
      }

      const path = `clients/${id}`;
      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
      if (canUseBackendClients) {
        console.warn('Backend client delete failed, falling back to Firestore.', error);
        setClientsSource('firestore');
        const path = `clients/${id}`;
        try {
          await deleteDoc(doc(db, 'clients', id));
          return;
        } catch (fallbackError) {
          handleFirestoreError(fallbackError, OperationType.DELETE, path);
          return;
        }
      }

      const path = `clients/${id}`;
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addTradeIn = async (tradeInData: Omit<TradeIn, 'id'>) => {
    if (!user) return;
    const backendConfigured = backendStatus !== 'unconfigured';
    try {
      if (backendConfigured) {
        if (!backendTradeInsEnabled) {
          throw new Error(
            backendMessage || 'El backend todavía no está listo para guardar canjes. Reintentá en unos segundos.'
          );
        }
        const createdTradeIn = await createBackendTradeIn(user, tradeInData);
        setTradeInsSource('backend');
        setTradeIns(prev => [createdTradeIn, ...prev]);
        return;
      }

      const id = generateId('CAN');
      const createdTradeIn = { id, ...tradeInData };
      await setDoc(doc(db, 'tradeIns', id), { ...tradeInData, authorUid: user.uid });
      setTradeIns(prev => [createdTradeIn, ...prev]);
    } catch (error) {
      if (backendConfigured) {
        throw error;
      }
      handleFirestoreError(error, OperationType.CREATE, 'tradeIns');
    }
  };

  const updateTradeIn = async (updatedTradeIn: TradeIn) => {
    if (!user) return;
    const backendConfigured = backendStatus !== 'unconfigured';
    try {
      if (backendConfigured) {
        if (!backendTradeInsEnabled) {
          throw new Error(
            backendMessage || 'El backend todavía no está listo para actualizar canjes. Reintentá en unos segundos.'
          );
        }
        const backendTradeIn = await updateBackendTradeIn(user, updatedTradeIn);
        setTradeInsSource('backend');
        setTradeIns(prev => prev.map(t => t.id === backendTradeIn.id ? backendTradeIn : t));
        return;
      }

      const { id, ...data } = updatedTradeIn;
      await updateDoc(doc(db, 'tradeIns', id), data as any);
    } catch (error) {
      if (backendConfigured) {
        throw error;
      }
      handleFirestoreError(error, OperationType.UPDATE, `tradeIns/${updatedTradeIn.id}`);
    }
  };

  const deleteTradeIn = async (id: string) => {
    if (!user) return;
    const backendConfigured = backendStatus !== 'unconfigured';
    try {
      if (backendConfigured) {
        if (!backendTradeInsEnabled) {
          throw new Error(
            backendMessage || 'El backend todavía no está listo para eliminar canjes. Reintentá en unos segundos.'
          );
        }
        await deleteBackendTradeIn(user, id);
        setTradeInsSource('backend');
        setTradeIns(prev => prev.filter(t => t.id !== id));
        return;
      }

      await deleteDoc(doc(db, 'tradeIns', id));
    } catch (error) {
      if (backendConfigured) {
        throw error;
      }
      handleFirestoreError(error, OperationType.DELETE, `tradeIns/${id}`);
    }
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

    const id = generateId('COL');
    const createdColumn: CustomColumn = { id, ...columnData };
    try {
      await setDoc(doc(db, 'customColumns', id), { ...columnData, authorUid: user.uid });
      setCustomColumns(prev => (
        prev.some(column => column.id === id)
          ? prev
          : [...prev, createdColumn]
      ));
      return id;
    } catch (error) {
      console.warn('Falling back to local custom column storage.', error);
      const nextColumns = (
        customColumns.some((column) => column.id === id)
          ? customColumns
          : [...customColumns, createdColumn]
      );
      writeLocalCustomColumns(user.uid, nextColumns);
      setCustomColumns(nextColumns);
      return id;
    }
  };

  const removeCustomColumn = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'customColumns', id));
      setCustomColumns(prev => {
        const next = prev.filter(column => column.id !== id);
        writeLocalCustomColumns(user.uid, next);
        return next;
      });
      // Optionally, remove the field from all products
      // This would require a batch update
    } catch (error) {
      console.warn('Falling back to local custom column removal.', error);
      setCustomColumns(prev => {
        const next = prev.filter(column => column.id !== id);
        writeLocalCustomColumns(user.uid, next);
        return next;
      });
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse flex flex-col items-center"><div className="w-12 h-12 bg-black rounded-full mb-4"></div><div className="text-gray-500 font-medium tracking-wide">Cargando...</div></div></div>;
  }



  return (
    <AppContext.Provider value={{
      inventory, sales, tradeIns, clients, customColumns,
      addSale, updateSale, deleteSale,
      addProduct, updateProduct, deleteProduct,
      addClient, updateClient, deleteClient,
      addTradeIn, updateTradeIn, deleteTradeIn,
      addCustomColumn, removeCustomColumn,
      reloadInventory,
      inventoryCategories, createCategory, renameCategory, deleteCategory, bulkMoveCategory, reorderCategories,
      salesCategories, createSaleCategory, renameSaleCategory, deleteSaleCategory, bulkMoveSaleCategory, reorderSaleCategories,
      updateStore, updateUserProfile,
      user, loading, appSession, backendStatus, backendMessage, completeOnboarding, login, loginWithEmail, registerWithEmail, logout
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
