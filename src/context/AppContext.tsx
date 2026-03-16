import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, Sale, TradeIn, Client, CustomColumn } from '../types';
import { auth, db, googleProvider } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, query, getDocs, where } from 'firebase/firestore';

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
  login: () => Promise<void>;
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
      return;
    }

    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'inventory'));

    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales'));

    const unsubTradeIns = onSnapshot(collection(db, 'tradeIns'), (snapshot) => {
      setTradeIns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TradeIn)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tradeIns'));

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'clients'));

    const unsubCustomColumns = onSnapshot(collection(db, 'customColumns'), (snapshot) => {
      setCustomColumns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomColumn)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customColumns'));

    return () => {
      unsubInventory();
      unsubSales();
      unsubTradeIns();
      unsubClients();
      unsubCustomColumns();
    };
  }, [user]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in", error);
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
    const id = generateId('C');
    const path = `clients/${id}`;
    try {
      await setDoc(doc(db, 'clients', id), { ...clientData, authorUid: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateClient = async (updatedClient: Client) => {
    if (!user) return;
    const path = `clients/${updatedClient.id}`;
    try {
      const { id, ...data } = updatedClient;
      await updateDoc(doc(db, 'clients', id), data as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteClient = async (id: string) => {
    if (!user) return;
    const path = `clients/${id}`;
    try {
      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-black rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h1>
          <p className="text-gray-500 mb-8 text-sm">Inicia sesión para acceder al sistema de gestión.</p>
          <button 
            onClick={login}
            className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ 
      inventory, sales, tradeIns, clients, customColumns, 
      addSale, updateSale, deleteSale,
      addProduct, updateProduct, deleteProduct,
      addClient, updateClient, deleteClient,
      addTradeIn, updateTradeIn, deleteTradeIn,
      addCustomColumn, removeCustomColumn,
      user, loading, login, logout
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
