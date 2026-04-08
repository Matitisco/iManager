export interface Product {
  id: string;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: 'NUEVO' | 'USADO' | 'PRE-OWNED';
  grade: 'A+' | 'A' | 'B' | 'C' | 'N/A';
  batteryHealth: string;
  cost: number;
  price: number;
  status: 'DISPONIBLE' | 'VENDIDO' | 'EN_REVISION';
  categoryId?: string | null;
  soldAt?: string | null;
  customFields?: Record<string, any>;
}

export interface InventoryCategory {
  id: string;
  name: string;
}

export interface CustomColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'enum';
  options?: string[];
}

export interface Sale {
  id: string;
  saleNumber?: number;
  date: string;
  clientId: string;
  productId: string;
  amount: number;
  paymentMethod: 'TRANSFERENCIA' | 'EFECTIVO' | 'TARJETA' | 'CANJE / PAGO' | 'T. Crédito';
  status: 'COMPLETADA' | 'PENDIENTE';
  categoryId?: string | null;
}

export interface TradeIn {
  id: string;
  date: string;
  clientId: string;
  deviceReceived: string;
  deviceReceivedImei: string;
  takeValue: number;
  deviceGiven: string;
  differencePaid: number;
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'EN REVISIÓN' | 'PERITAJE TÉC.' | 'LISTO';
  batteryHealth?: string;
  grade?: string;
}

export interface Client {
  id: string;
  dni: string;
  name: string;
  email: string;
  phone: string;
  lastPurchaseDate: string;
  totalSpent: number;
  pendingBalance: number;
}
