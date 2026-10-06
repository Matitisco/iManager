import type { Client, Product, Sale, TradeIn } from '../types';
import type { AppState } from '../context/AppContext';

const products: Product[] = [
  { id: 'e1', imei: '350000000000010', model: 'iPhone 13', capacity: '128GB', color: 'Medianoche', condition: 'USADO', grade: 'A', batteryHealth: '89%', cost: 480000, price: 650000, status: 'DISPONIBLE' },
  { id: 'e2', imei: '350000000000020', model: 'iPhone 14 Pro', capacity: '256GB', color: 'Morado', condition: 'USADO', grade: 'A+', batteryHealth: '95%', cost: 820000, price: 1100000, status: 'EN_REVISION' },
  { id: 'e3', imei: '350000000000030', model: 'iPhone 15', capacity: '128GB', color: 'Azul', condition: 'NUEVO', grade: 'N/A', batteryHealth: '100%', cost: 980000, price: 1300000, status: 'DISPONIBLE' },
  { id: 'e4', imei: '350000000000040', model: 'iPhone 12', capacity: '64GB', color: 'Blanco', condition: 'USADO', grade: 'B', batteryHealth: '84%', cost: 300000, price: 420000, status: 'VENDIDO' },
];

const clients: Client[] = [
  { id: 'k1', dni: '30111222', name: 'Cliente Ejemplo A', email: 'a@ejemplo.com', phone: '+54 11 5555-0101', lastPurchaseDate: '05 oct 2026', totalSpent: 650000, pendingBalance: 0 },
  { id: 'k2', dni: '31222333', name: 'Cliente Ejemplo B', email: 'b@ejemplo.com', phone: '+54 11 5555-0102', lastPurchaseDate: '04 oct 2026', totalSpent: 480000, pendingBalance: 0 },
  { id: 'k3', dni: '30444555', name: 'Cliente Ejemplo C', email: 'c@ejemplo.com', phone: '+54 11 5555-0103', lastPurchaseDate: '03 oct 2026', totalSpent: 1100000, pendingBalance: 1100000 },
];

const sales: Sale[] = [
  { id: 'v1', saleNumber: 1, date: '05 oct 2026', clientId: 'k1', productId: 'e4', amount: 650000, paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA' },
  { id: 'v2', saleNumber: 2, date: '04 oct 2026', clientId: 'k2', productId: 'e1', amount: 480000, paymentMethod: 'EFECTIVO', status: 'COMPLETADA' },
  { id: 'v3', saleNumber: 3, date: '03 oct 2026', clientId: 'k3', productId: 'e2', amount: 1100000, paymentMethod: 'TARJETA', status: 'PENDIENTE' },
];

const tradeIns: TradeIn[] = [
  { id: 'c1', date: '05 oct 2026', clientId: 'k1', deviceReceived: 'iPhone 11 64GB', deviceReceivedImei: '350000000000111', takeValue: 300000, deviceGiven: 'iPhone 13 128GB', differencePaid: 350000, status: 'APROBADO', batteryHealth: '80%', grade: 'B' },
  { id: 'c2', date: '04 oct 2026', clientId: 'k2', deviceReceived: 'iPhone 12 128GB', deviceReceivedImei: '350000000000122', takeValue: 420000, deviceGiven: 'iPhone 14 Pro 256GB', differencePaid: 680000, status: 'PERITAJE TÉC.', batteryHealth: '88%', grade: 'A' },
  { id: 'c3', date: '02 oct 2026', clientId: 'k3', deviceReceived: 'iPhone XR 64GB', deviceReceivedImei: '350000000000133', takeValue: 180000, deviceGiven: 'iPhone 12 64GB', differencePaid: 300000, status: 'EN REVISIÓN', batteryHealth: '79%', grade: 'B' },
];

export const previewProducts = products;
export const previewClients = clients;
export const previewSales = sales;
export const previewTradeIns = tradeIns;

export function createPreviewContext(): AppState {
  const asyncNoop = async () => undefined;
  return {
    inventory: products,
    sales,
    salesCategories: [],
    tradeIns,
    clients,
    customColumns: [],
    addSale: asyncNoop,
    updateSale: asyncNoop,
    deleteSale: asyncNoop,
    addProduct: asyncNoop,
    updateProduct: asyncNoop,
    deleteProduct: asyncNoop,
    addClient: async (client) => ({ id: 'new-client', ...client }),
    updateClient: asyncNoop,
    deleteClient: asyncNoop,
    addTradeIn: asyncNoop,
    updateTradeIn: asyncNoop,
    deleteTradeIn: asyncNoop,
    addCustomColumn: async () => 'col',
    removeCustomColumn: asyncNoop,
    reloadInventory: asyncNoop,
    inventoryCategories: [],
    createCategory: async (name) => ({ id: 'cat', name }),
    renameCategory: asyncNoop,
    deleteCategory: asyncNoop,
    bulkMoveCategory: asyncNoop,
    reorderCategories: asyncNoop,
    createSaleCategory: async (name) => ({ id: 'sc', name }),
    renameSaleCategory: asyncNoop,
    deleteSaleCategory: asyncNoop,
    bulkMoveSaleCategory: asyncNoop,
    reorderSaleCategories: asyncNoop,
    tradeInCategories: [],
    createTradeInCategory: async (name) => ({ id: 'tc', name }),
    renameTradeInCategory: asyncNoop,
    deleteTradeInCategory: asyncNoop,
    bulkMoveTradeInCategory: asyncNoop,
    reorderTradeInCategories: asyncNoop,
    clientCategories: [],
    createClientCategory: async (name) => ({ id: 'cc', name }),
    renameClientCategory: asyncNoop,
    deleteClientCategory: asyncNoop,
    bulkMoveClientCategory: asyncNoop,
    reorderClientCategories: asyncNoop,
    user: {
      uid: 'user-1',
      email: 'usuario@ejemplo.com',
      displayName: 'Usuario Ejemplo',
      getIdToken: async () => 'preview-token',
      providerData: [{ providerId: 'password' }],
    },
    loading: false,
    appSession: {
      user: { id: 'user-1', firebaseUid: 'user-1', email: 'usuario@ejemplo.com', displayName: 'Usuario Ejemplo', avatarUrl: null },
      store: { id: 'store-1', name: 'Mi Tienda Ejemplo', legalName: null, taxId: '20-00000000-0', phone: null, address: 'Av. Ejemplo 1234', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires' },
      membership: { role: 'OWNER', isDefault: true },
      onboardingRequired: false,
    },
    backendStatus: 'ready',
    backendMessage: null,
    updateStore: asyncNoop,
    updateUserProfile: asyncNoop,
    completeOnboarding: asyncNoop,
    createOwnedStore: asyncNoop,
    activateStore: asyncNoop,
    acceptStoreInvitation: asyncNoop,
    refreshStoreData: asyncNoop,
    login: asyncNoop,
    loginWithEmail: asyncNoop,
    registerWithEmail: asyncNoop,
    logout: asyncNoop,
  };
}
