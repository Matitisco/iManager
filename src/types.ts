export interface Product {
  id: string;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: string;
  grade: string;
  batteryHealth: string;
  cost: number;
  price: number;
  status: string;
  pendingSaleRegistration?: boolean;
  archivedAt?: string | null;
  categoryId?: string | null;
  soldAt?: string | null;
  createdAt?: string;
  customFields?: Record<string, any>;
}

export interface InventoryCategory {
  id: string;
  name: string;
}

export type CustomColumnEntity = 'inventory' | 'clients' | 'sales' | 'trade-ins';

export interface CustomColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'enum' | 'tags';
  options?: string[];
  entity: CustomColumnEntity;
}

export interface Sale {
  id: string;
  saleNumber?: number;
  date: string;
  clientId: string;
  clientName?: string;
  productId: string;
  deviceLabel?: string;
  amount: number;
  paymentMethod: string;
  status: string;
  categoryId?: string | null;
  customFields?: Record<string, any>;
  tradeInId?: string | null;
  integratedOperation?: boolean;
  requestKey?: string | null;
}

export interface OperationProductOption {
  id: string;
  model: string;
  capacity: string;
  color: string;
  imei: string;
  price: number;
  pendingSaleRegistration: boolean;
}

export interface OperationClientOption {
  id: string;
  name: string;
}

export interface TradeIn {
  id: string;
  tradeNumber?: number;
  date: string;
  clientId: string;
  clientName?: string;
  categoryId?: string | null;
  deviceReceived: string;
  deviceReceivedImei: string;
  takeValue: number;
  deviceGiven: string;
  differencePaid: number;
  status: string;
  batteryHealth?: string;
  grade?: string;
  customFields?: Record<string, any>;
  confirmationStatus?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | null;
  saleId?: string | null;
  receivedInventoryItemId?: string | null;
  operationSource?: 'inventory' | 'sales' | 'tradeins' | 'clients' | null;
  draftProductId?: string | null;
  draftDeviceLabel?: string | null;
  draftAmount?: number | null;
  draftSaleCategoryId?: string | null;
  draftPaymentMethod?: string | null;
  draftPaymentStatus?: 'COMPLETADA' | 'PENDIENTE' | null;
}

export interface TradeInCategory {
  id: string;
  name: string;
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
  categoryId?: string | null;
  tag?: string | null;
  customFields?: Record<string, any>;
}

export interface ClientCategory {
  id: string;
  name: string;
}
