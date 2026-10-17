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
  firstChargeAt?: string | null;
  chargeReminder?: boolean;
}
export interface BillingPlanOffer {
  key: BillingPlanKey;
  plan: string;
  name: string;
  period: string;
  usd: number;
  months: number;
  users: number;
  amountArs?: number | null;
  exchangeRate?: number | null;
}
export interface BillingDetails extends BillingSummary {
  pendingCheckout?: boolean;
  pendingPlan?: (BillingPlanOffer & { amountArs: number | null }) | null;
  recentlyActivated?: boolean;
  plans: BillingPlanOffer[];
}
export interface BillingQuote {
  id: string; key: BillingPlanKey; usd: number; amountArs: number; exchangeRate: number;
  payerEmail: string; expiresAt: string; firstChargeAt?: string | null;
}
