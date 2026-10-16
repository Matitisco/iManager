export type BillingPlanKey = 'BASIC_MONTHLY' | 'BASIC_ANNUAL' | 'BUSINESS_MONTHLY' | 'BUSINESS_ANNUAL';
export interface BillingSummary {
  plan: string;
  status: string;
  period: string | null;
  trialEndsAt: string | null;
  paidThrough: string | null;
  trialDaysLeft: number;
  readOnly: boolean;
  memberLimit: number | null;
  members: number;
  overLimit: boolean;
  canCancel: boolean;
}
export interface BillingDetails extends BillingSummary {
  plans: { key: BillingPlanKey; plan: string; name: string; period: string; usd: number; months: number; users: number }[];
}
export interface BillingQuote {
  publicKey: string;
  id: string; key: BillingPlanKey; usd: number; amountArs: number; exchangeRate: number;
  payerEmail: string; expiresAt: string;
}
