import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, Sale, TradeIn, Client, CustomColumn } from '../types';
import { auth, db, googleProvider } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, User } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { fetchBackendSession } from '../services/backend-session';
import { createBackendClient, deleteBackendClient, fetchBackendClients, updateBackendClient } from '../services/clients-api';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';

interface AppState {
  inventory: Product[];
  sales: Sale[];
  tradeIns: TradeIn[];
  clients: Client[];
  customColumns: CustomColumn[];
  addSale: (sale: Omit<Sale, 'id'>) => Promise<void>;
  updateSale: (sale: Sale) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => Promise<void>;
  updateClient: (client: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addTradeIn: (tradeIn: Omit<TradeIn, 'id'>) => Promise<void>;
  updateTradeIn: (tradeIn: TradeIn) => Promise<void>;
  deleteTradeIn: (id: string) => Promise<void>;
  addCustomColumn: (column: Omit<CustomColumn, 'id'>) => Promise<void>;
  removeCustomColumn: (id: string) => Promise<void>;
  user: User | null;
  loading: boolean;
  appSession: AppSession | null;
  backendStatus: BackendConnectionStatus;
  backendMessage: string | null;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const generateId = (prefix: string) => `${prefix}-${Math.floor(Math.random() * 1000000)}`;

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
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [appSession, setAppSession] = useState<AppSession | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus>('checking');
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [clientsSource, setClientsSource] = useState<'firestore' | 'backend'>('firestore');

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
      setTradeIns([]);
      setClients([]);
      setCustomColumns([]);
      setAppSession(null);
      setBackendStatus('checking');
      setBackendMessage(null);
      setClientsSource('firestore');
      return;
    }

    let cancelled = false;

    setBackendStatus('checking');
    setBackendMessage(null);

    fetchBackendSession(user).then(({ status, session, message }) => {
      if (cancelled) return;
      setBackendStatus(status);
      setAppSession(session);
      setBackendMessage(message);
    });

    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'inventory'));

    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales'));

    const unsubTradeIns = onSnapshot(collection(db, 'tradeIns'), (snapshot) => {
      setTradeIns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TradeIn)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tradeIns'));

    const unsubCustomColumns = onSnapshot(collection(db, 'customColumns'), (snapshot) => {
      setCustomColumns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomColumn)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customColumns'));

    return () => {
      cancelled = true;
      unsubInventory();
      unsubSales();
      unsubTradeIns();
      unsubCustomColumns();
    };
  }, [user]);

  const backendClientsEnabled = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;

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

  const addSale = async (saleData: Omit<Sale, 'id'>) => {
    if (!user) return;
    const id = generateId('V');
    const path = `sales/${id}`;
    try {
      await setDoc(doc(db, 'sales', id), { ...saleData, authorUid: user.uid });

      // Update product status
      if (saleData.productId) {
        await updateDoc(doc(db, 'inventory', saleData.productId), { status: 'VENDIDO' });
      }

      // Update client total spent
      if (saleData.clientId) {
        const client = clients.find(c => c.id === saleData.clientId);
        if (client) {
          await updateDoc(doc(db, 'clients', saleData.clientId), {
            totalSpent: (client.totalSpent || 0) + saleData.amount,
            lastPurchaseDate: saleData.date
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateSale = async (updatedSale: Sale) => {
    if (!user) return;
    const path = `sales/${updatedSale.id}`;
    try {
      const { id, ...data } = updatedSale;
      await updateDoc(doc(db, 'sales', id), data as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteSale = async (id: string) => {
    if (!user) return;
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
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addProduct = async (productData: Omit<Product, 'id'>) => {
    if (!user) return;
    const id = generateId('P');
    const path = `inventory/${id}`;
    try {
      await setDoc(doc(db, 'inventory', id), { ...productData, authorUid: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    if (!user) return;
    const path = `inventory/${updatedProduct.id}`;
    try {
      const { id, ...data } = updatedProduct;
      await updateDoc(doc(db, 'inventory', id), data as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user) return;
    const path = `inventory/${id}`;
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addClient = async (clientData: Omit<Client, 'id'>) => {
    if (!user) return;
    const canUseBackendClients = clientsSource === 'backend' && backendClientsEnabled;
    try {
      if (canUseBackendClients) {
        const createdClient = await createBackendClient(user, clientData);
        setClients(prev => [createdClient, ...prev]);
        return;
      }

      const id = generateId('C');
      const path = `clients/${id}`;
      await setDoc(doc(db, 'clients', id), { ...clientData, authorUid: user.uid });
    } catch (error) {
      if (canUseBackendClients) {
        console.warn('Backend client create failed, falling back to Firestore.', error);
        setClientsSource('firestore');
        const id = generateId('C');
        const path = `clients/${id}`;
        try {
          await setDoc(doc(db, 'clients', id), { ...clientData, authorUid: user.uid });
          return;
        } catch (fallbackError) {
          handleFirestoreError(fallbackError, OperationType.CREATE, path);
          return;
        }
      }

      const id = generateId('C');
      const path = `clients/${id}`;
      handleFirestoreError(error, OperationType.CREATE, path);
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
    const id = generateId('CAN');
    const path = `tradeIns/${id}`;
    try {
      await setDoc(doc(db, 'tradeIns', id), { ...tradeInData, authorUid: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateTradeIn = async (updatedTradeIn: TradeIn) => {
    if (!user) return;
    const path = `tradeIns/${updatedTradeIn.id}`;
    try {
      const { id, ...data } = updatedTradeIn;
      await updateDoc(doc(db, 'tradeIns', id), data as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteTradeIn = async (id: string) => {
    if (!user) return;
    const path = `tradeIns/${id}`;
    try {
      await deleteDoc(doc(db, 'tradeIns', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addCustomColumn = async (columnData: Omit<CustomColumn, 'id'>) => {
    if (!user) return;
    const id = generateId('COL');
    const path = `customColumns/${id}`;
    try {
      await setDoc(doc(db, 'customColumns', id), { ...columnData, authorUid: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const removeCustomColumn = async (id: string) => {
    if (!user) return;
    const path = `customColumns/${id}`;
    try {
      await deleteDoc(doc(db, 'customColumns', id));
      // Optionally, remove the field from all products
      // This would require a batch update
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
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
      user, loading, appSession, backendStatus, backendMessage, login, loginWithEmail, registerWithEmail, logout
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
