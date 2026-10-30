export interface Product {
  cantidad?: number;
  catalogVisible?: boolean;
  catalogIncluded?: boolean;
  reservedDepositId?: string | null;
  reservedClientId?: string | null;
  reservedClientName?: string | null;
  reservedAt?: string | null;
  id: string;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: string;
  grade: string;
  entryDate?: string | null;
  batteryNote?: string | null;
  batteryHealth: string;
  cost?: number;
  price: number | null;
  currency?: string | null;
  status: string;
  pendingSaleRegistration?: boolean;
  needsCompletion?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  priceChangedBy?: string | null;
  priceChangedAt?: string | null;
  costChangedBy?: string | null;
  costChangedAt?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  stockPurchaseId?: string | null;
  purchasedAt?: string | null;
  purchaseName?: string | null;
  soldAt?: string | null;
  createdAt?: string;
  customFields?: Record<string, any>;
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
  cantidad?: number;
  depositAppliedAmount?: number;
  sellerMemberId?: string | null;
  registeredByUserId?: string | null;
  exchangeRate?: number | null;
  id: string;
  saleNumber?: number;
  date: string;
  clientId: string;
  clientName?: string;
  productId: string;
  deviceLabel?: string;
  amount: number;
  amountCurrency?: string | null;
  paymentMethod: string;
  status: string;
  openBalance?: number | null;
  categoryId?: string | null;
  customFields?: Record<string, any>;
  tradeInId?: string | null;
  integratedOperation?: boolean;
  requestKey?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  warrantyDays?: number | null;
  soldAt?: string | null;
}

export interface RepairStatusEvent {
  id: string;
  status: string;
  createdAt: string;
}

export interface RepairOrder {
  id: string;
  orderNumber: number;
  code: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  device: string;
  imei: string;
  fault: string;
  faultTags: string[];
  estimate: number | null;
  deposit: number;
  currency?: string | null;
  technician: string;
  status: string;
  estimatedDelivery: string | null;
  notifyWhatsapp: boolean;
  receivedAt: string;
  whatsappUrl: string | null;
  warrantyDays?: number | null;
  warrantyUntil?: string | null;
  warrantyState?: 'sin' | 'pendiente' | 'vigente' | 'vencida';
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  events: RepairStatusEvent[];
}

export interface OperationProductOption {
  cantidad?: number;
  reservedDepositId?: string | null;
  reservedClientId?: string | null;
  reservedClientName?: string | null;
  reservedAt?: string | null;

  id: string;
  model: string;
  capacity: string;
  color: string;
  imei: string;
  price: number;
  currency?: string | null;
  condition?: string;
  grade?: string;
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
  currency?: string | null;
  deviceGiven: string;
  differencePaid: number;
  status: string;
  batteryHealth?: string;
  grade?: string;
  customFields?: Record<string, any>;
  confirmationStatus?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | null;
  saleId?: string | null;
  removedFromSaleNumber?: number | null;
  receivedInventoryItemId?: string | null;
  operationSource?: 'inventory' | 'sales' | 'tradeins' | 'clients' | null;
  draftCantidad?: number;
  draftProductId?: string | null;
  draftDeviceLabel?: string | null;
  draftAmount?: number | null;
  draftSaleCategoryId?: string | null;
  draftPaymentMethod?: string | null;
  draftPaymentStatus?: 'COMPLETADA' | 'PENDIENTE' | null;
  draftSellerMemberId?: string | null;
  draftWarrantyDays?: number | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
}

export interface Client {
  id: string;
  dni: string;
  name: string;
  email: string;
  phone: string;
  instagram?: string;
  lastPurchaseDate: string;
  totalSpent: number;
  importedSpent?: number | null;
  importedSpentCurrency?: string | null;
  pendingBalance: number;
  creditBalance?: number;
  balanceCurrency?: string | null;
  categoryId?: string | null;
  tag?: string | null;
  birthday?: string | null;
  customFields?: Record<string, any>;
  createdAt?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
}

export interface ClientCategory {
  id: string;
  name: string;
}

export type * from './types/commissions';

export interface ClientDeposit {
  id: string;
  clientId: string;
  amount: number;
  currency: 'ARS' | 'USD';
  exchangeRate: number;
  usdAmount: number;
  method: string;
  status: 'ACTIVE' | 'CREDIT' | 'APPLIED' | 'REFUNDED' | 'REVERSED';
  productId: string | null;
  productLabel: string | null;
  previousInventoryStatus: string | null;
  saleId: string | null;
  repairId: string | null;
  appliedAmount: number | null;
  appliedCurrency: string | null;
  appliedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}
