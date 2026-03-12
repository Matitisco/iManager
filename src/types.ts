export interface Product {
  id: string;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: 'NUEVO' | 'USADO' | 'PRE-OWNED';
  grade: 'A+' | 'A' | 'B' | 'C' | 'N/A';
  batteryHealth: number;
  cost: number;
  price: number;
  status: 'DISPONIBLE' | 'VENDIDO' | 'EN_REVISION';
}

export interface Sale {
  id: string;
  date: string;
  clientId: string;
  productId: string;
  amount: number;
  paymentMethod: 'TRANSFERENCIA' | 'EFECTIVO' | 'TARJETA' | 'CANJE / PAGO' | 'T. Crédito';
  status: 'COMPLETADA' | 'PENDIENTE';
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
  batteryHealth?: number;
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
