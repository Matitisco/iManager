export type CashCurrency = 'ARS' | 'USD';
export type CashMethod = 'EFECTIVO' | 'TRANSFERENCIA';
export type CashCount = { id: string; expected: number; counted: number; difference: number; note: string | null; denominations: Record<string, number> | null; countedBy: string; createdAt: string };
export type CashSession = { id: string; day: string; status: 'OPEN' | 'SUBMITTED' | 'RECOUNT' | 'APPROVED'; reviewNote: string | null; counts?: CashCount[] };
export type CashRegister = { id: string; name: string; currency: CashCurrency; method: CashMethod; isDefault: boolean; archivedAt: string | null; balance?: number; session: CashSession | null };
export type CashData = { registers: CashRegister[]; canViewBalances: boolean };
export type CashMovement = { id: string; registerId: string | null; currency: CashCurrency | null; method: CashMethod | null; sessionId: string | null; amount: number; kind: string; category: string | null; note: string | null; sourceType: string | null; sourceId: string | null; exchangeRate: number | null; transferGroup: string | null; reversalOf: string | null; voidedAt: string | null; createdAt: string };
export type CashHistory = { movements: CashMovement[]; total: number; categories: string[] };
export type CashFilters = { from?: string; to?: string; category?: string; offset?: number };
export type CashCommand =
  | { path: ''; method: 'POST'; body: { name: string; currency: CashCurrency; method: CashMethod; opening: number } }
  | { path: `/${string}`; method: 'PATCH'; body: { name?: string; archived?: boolean; isDefault?: boolean } }
  | { path: `/${string}/open`; method: 'POST'; body?: undefined }
  | { path: '/movements'; method: 'POST'; body: { registerId: string; kind: 'INGRESO' | 'EGRESO' | 'AJUSTE'; amount: number; category?: string; note?: string; requestKey: string } }
  | { path: '/transfers'; method: 'POST'; body: { fromId: string; toId: string; amount: number; exchangeRate?: number; note?: string; requestKey: string } }
  | { path: `/movements/${string}/void`; method: 'POST'; body?: undefined }
  | { path: `/movements/${string}/category`; method: 'PATCH'; body: { category: string | null } }
  | { path: `/sessions/${string}/count`; method: 'POST'; body: { denominations?: Record<string, number>; counted?: number; note?: string } }
  | { path: `/sessions/${string}/review`; method: 'POST'; body: { action: 'APPROVE' | 'RECOUNT'; note?: string } };
