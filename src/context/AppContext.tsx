import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Product, Sale, TradeIn, Client, CustomColumn } from '../types';

interface AppState {
  inventory: Product[];
  sales: Sale[];
  tradeIns: TradeIn[];
  clients: Client[];
  customColumns: CustomColumn[];
  addSale: (sale: Omit<Sale, 'id'>) => void;
  updateSale: (sale: Sale) => void;
  deleteSale: (id: string) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  addClient: (client: Omit<Client, 'id'>) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
  addTradeIn: (tradeIn: Omit<TradeIn, 'id'>) => void;
  updateTradeIn: (tradeIn: TradeIn) => void;
  deleteTradeIn: (id: string) => void;
  addCustomColumn: (column: Omit<CustomColumn, 'id'>) => void;
  removeCustomColumn: (id: string) => void;
}

const mockInventory: Product[] = [
  { id: '1', imei: '3542...9012', model: 'iPhone 15 Pro Max', capacity: '256GB', color: 'Natural Titanium', condition: 'NUEVO', grade: 'A+', batteryHealth: 100, cost: 1150, price: 1399, status: 'DISPONIBLE' },
  { id: '2', imei: '3589...4432', model: 'iPhone 14 Pro', capacity: '128GB', color: 'Space Black', condition: 'USADO', grade: 'A', batteryHealth: 92, cost: 850, price: 1050, status: 'DISPONIBLE' },
  { id: '3', imei: '3511...8890', model: 'iPhone 13', capacity: '128GB', color: 'Starlight', condition: 'USADO', grade: 'B', batteryHealth: 88, cost: 450, price: 599, status: 'DISPONIBLE' },
  { id: '4', imei: '3566...1212', model: 'iPhone 15 Plus', capacity: '128GB', color: 'Blue', condition: 'NUEVO', grade: 'A+', batteryHealth: 100, cost: 900, price: 1100, status: 'DISPONIBLE' },
];

const mockSales: Sale[] = [
  { id: 'V-00124', date: '12 Oct, 2023', clientId: '1', productId: '1', amount: 1299, paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA' },
  { id: 'V-00123', date: '12 Oct, 2023', clientId: '2', productId: '2', amount: 1050, paymentMethod: 'EFECTIVO', status: 'COMPLETADA' },
  { id: 'V-00122', date: '11 Oct, 2023', clientId: '3', productId: '1', amount: 1399, paymentMethod: 'CANJE / PAGO', status: 'COMPLETADA' },
  { id: 'V-00121', date: '11 Oct, 2023', clientId: '4', productId: '3', amount: 599, paymentMethod: 'T. Crédito', status: 'COMPLETADA' },
  { id: 'V-00120', date: '10 Oct, 2023', clientId: '5', productId: '4', amount: 1100, paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA' },
];

const mockTradeIns: TradeIn[] = [
  { id: 'CAN-2204', date: '12 Oct 2023', clientId: '1', deviceReceived: 'iPhone 11 64GB', deviceReceivedImei: '35678120098311', takeValue: 180, deviceGiven: 'iPhone 15 Pro', differencePaid: 820, status: 'APROBADO', batteryHealth: 88, grade: 'B' },
  { id: 'CAN-2205', date: '11 Oct 2023', clientId: '2', deviceReceived: 'iPhone XR 128GB', deviceReceivedImei: '35992100871142', takeValue: 140, deviceGiven: 'iPhone 13', differencePaid: 410, status: 'RECHAZADO', batteryHealth: 82, grade: 'C' },
  { id: 'CAN-2206', date: '10 Oct 2023', clientId: '3', deviceReceived: 'iPhone 12 Pro Max', deviceReceivedImei: '35442100092281', takeValue: 550, deviceGiven: 'iPhone 15 Pro Max', differencePaid: 650, status: 'PENDIENTE', batteryHealth: 92, grade: 'A' },
];

const mockClients: Client[] = [
  { id: '1', dni: '20-34567890-9', name: 'Juan Pérez', email: 'juan.perez@email.com', phone: '11 4567-8910', lastPurchaseDate: '12 Oct 2023', totalSpent: 150000, pendingBalance: 0 },
  { id: '2', dni: '27-22334455-8', name: 'Marcos Galperín', email: 'mgalperin@mercado.com', phone: '11 2233-4455', lastPurchaseDate: '10 Oct 2023', totalSpent: 2450000, pendingBalance: 15000 },
  { id: '3', dni: '20-11223344-5', name: 'Lucía Fernández', email: 'lfernandez@gmail.com', phone: '11 9988-7766', lastPurchaseDate: '05 Oct 2023', totalSpent: 85000, pendingBalance: 24500 },
  { id: '4', dni: '23-99887766-1', name: 'Roberto Sánchez', email: 'rsanchez@outlook.com', phone: '11 5544-3322', lastPurchaseDate: '01 Oct 2023', totalSpent: 12000, pendingBalance: 0 },
  { id: '5', dni: '27-55667788-9', name: 'Elena Gómez', email: 'egomez@estudio.com', phone: '11 6677-8899', lastPurchaseDate: '28 Sep 2023', totalSpent: 310000, pendingBalance: 110000 },
];

const generateId = (prefix: string) => `${prefix}-${Math.floor(Math.random() * 10000)}`;

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [inventory, setInventory] = useState<Product[]>(mockInventory);
  const [sales, setSales] = useState<Sale[]>(mockSales);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>(mockTradeIns);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);

  const addSale = (saleData: Omit<Sale, 'id'>) => {
    const newSale = { ...saleData, id: generateId('V') };
    setSales([newSale, ...sales]);
    
    // Update product status to VENDIDO
    setInventory(inventory.map(p => p.id === saleData.productId ? { ...p, status: 'VENDIDO' } : p));
    
    // Update client total spent
    setClients(clients.map(c => c.id === saleData.clientId ? { ...c, totalSpent: c.totalSpent + saleData.amount, lastPurchaseDate: saleData.date } : c));
  };

  const updateSale = (updatedSale: Sale) => {
    setSales(sales.map(s => s.id === updatedSale.id ? updatedSale : s));
  };

  const deleteSale = (id: string) => {
    setSales(sales.filter(s => s.id !== id));
  };

  const addProduct = (productData: Omit<Product, 'id'>) => {
    const newProduct = { ...productData, id: generateId('P') };
    setInventory([newProduct, ...inventory]);
  };

  const updateProduct = (updatedProduct: Product) => {
    setInventory(inventory.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  const deleteProduct = (id: string) => {
    setInventory(inventory.filter(p => p.id !== id));
  };

  const addClient = (clientData: Omit<Client, 'id'>) => {
    const newClient = { ...clientData, id: generateId('C') };
    setClients([newClient, ...clients]);
  };

  const updateClient = (updatedClient: Client) => {
    setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
  };

  const deleteClient = (id: string) => {
    setClients(clients.filter(c => c.id !== id));
  };

  const addTradeIn = (tradeInData: Omit<TradeIn, 'id'>) => {
    const newTradeIn = { ...tradeInData, id: generateId('CAN') };
    setTradeIns([newTradeIn, ...tradeIns]);
  };

  const updateTradeIn = (updatedTradeIn: TradeIn) => {
    setTradeIns(tradeIns.map(t => t.id === updatedTradeIn.id ? updatedTradeIn : t));
  };

  const deleteTradeIn = (id: string) => {
    setTradeIns(tradeIns.filter(t => t.id !== id));
  };

  const addCustomColumn = (columnData: Omit<CustomColumn, 'id'>) => {
    const newColumn = { ...columnData, id: generateId('COL') };
    setCustomColumns([...customColumns, newColumn]);
  };

  const removeCustomColumn = (id: string) => {
    setCustomColumns(customColumns.filter(c => c.id !== id));
    // Optionally, remove the field from all products
    setInventory(inventory.map(p => {
      if (p.customFields) {
        const newFields = { ...p.customFields };
        delete newFields[id];
        return { ...p, customFields: newFields };
      }
      return p;
    }));
  };

  return (
    <AppContext.Provider value={{ 
      inventory, sales, tradeIns, clients, customColumns, 
      addSale, updateSale, deleteSale,
      addProduct, updateProduct, deleteProduct,
      addClient, updateClient, deleteClient,
      addTradeIn, updateTradeIn, deleteTradeIn,
      addCustomColumn, removeCustomColumn 
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
