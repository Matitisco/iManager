export type CommissionCurrency = 'ARS' | 'USD';
export type CommissionBasis = 'PROFIT_PERCENT' | 'SALE_PERCENT' | 'FIXED_PER_UNIT';
export type CommissionTotals = Record<CommissionCurrency, number>;
export interface CommissionRuleInput {
  memberId: string | null;
  basis?: CommissionBasis;
  rate: number;
  currency?: CommissionCurrency | null;
  /** ISO timestamp with offset. */
  effectiveFrom: string;
}
export interface CommissionRule extends CommissionRuleInput {
  id: string;
  storeId: string;
  basis: CommissionBasis;
  currency: CommissionCurrency | null;
  createdBy: string;
  createdAt: string;
}
export interface CommissionPaymentInput {
  memberId: string;
  period: string;
  amount: number;
  currency: CommissionCurrency;
  exchangeRate: number;
  settlesCurrency: CommissionCurrency;
  note?: string | null;
}
export interface CommissionPayment extends CommissionPaymentInput {
  id: string;
  storeId: string;
  settledAmount: number;
  createdBy: string;
  createdAt: string;
}
export interface CommissionSale {
  id: string;
  accrualId: string;
  saleNumber: number;
  soldAt: string;
  deviceLabel: string;
  total: number;
  currency: CommissionCurrency;
  exchangeRate: number | null;
  commission: number;
  originalCommission: number;
  cancelled: boolean;
  voidReason: 'CANCELLED' | 'DELETED' | 'EDITED' | null;
  voidedAt: string | null;
  rule: Pick<CommissionRule, 'id' | 'basis' | 'rate' | 'currency'> | null;
  cost?: number;
  takeValue?: number;
  grossProfit?: number;
}
export interface CommissionAdjustment {
  accrualId: string;
  saleId: string;
  saleNumber: number;
  period: string;
  amount: number;
  currency: CommissionCurrency;
  label: 'A descontar';
  reason: CommissionSale['voidReason'];
}
export interface CommissionPerson {
  memberId: string;
  userId: string;
  name: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  salesCount: number;
  previousBalance: CommissionTotals;
  earned: CommissionTotals;
  adjustmentsTotal: CommissionTotals;
  paid: CommissionTotals;
  pending: CommissionTotals;
  carry: CommissionTotals;
  converted: { earned: CommissionTotals; paid: CommissionTotals; pending: CommissionTotals };
  sales: CommissionSale[];
  adjustments: CommissionAdjustment[];
  payments: CommissionPayment[];
}
export interface CommissionPeriod {
  key: string;
  label: string;
  timezone: string;
}
export interface CommissionSummary {
  period: CommissionPeriod;
  summary: Pick<CommissionPerson, 'earned' | 'paid' | 'pending' | 'adjustmentsTotal' | 'salesCount' | 'converted'> & { unassignedSalesCount: number };
  people: Array<Omit<CommissionPerson, 'sales' | 'payments' | 'adjustments'>>;
}
export interface CommissionDetail {
  period: CommissionPeriod;
  person: CommissionPerson;
}
export interface CommissionReport {
  from: string;
  to: string;
  rows: Array<Pick<CommissionPerson, 'memberId' | 'name' | 'salesCount' | 'earned' | 'paid' | 'pending' | 'adjustmentsTotal' | 'converted'> & { period: string }>;
}
