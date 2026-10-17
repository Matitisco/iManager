export const BILLING_RETURN_POLL_MS = 3_000;
export const BILLING_RETURN_WINDOW_MS = 30_000;
/** The return banner stays up long enough to read when the first refresh is already resolved. */
export const BILLING_RETURN_CONFIRMING_MS = 1_200;
const RETURN_KEYS = ['preapproval_id', 'status', 'external_reference'] as const;

export interface BillingReturnSnapshot {
  plan?: string;
  status?: string;
  pendingCheckout?: boolean;
  recentlyActivated?: boolean;
}

export type BillingReturnStep = 'confirming' | 'success' | 'pending' | 'ignore';

export function isBillingReturn(hash: string, search = ''): boolean {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const hashParams = new URLSearchParams(query);
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return RETURN_KEYS.some((key) => hashParams.has(key) || searchParams.has(key));
}

/** Drop Mercado Pago params. The values are never sent to the API. */
export function billingPathFromLocation(href: string): string {
  const url = new URL(href, 'http://127.0.0.1');
  for (const key of RETURN_KEYS) url.searchParams.delete(key);
  const hashBody = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const path = (hashBody.split('?')[0] || '/plan').replace(/^\/+/, '');
  const hash = `#/${path || 'plan'}`;
  return `${url.pathname}${url.search}${hash}`;
}

export function billingReturnStep(details: BillingReturnSnapshot | undefined, elapsedMs: number): BillingReturnStep {
  if (details?.recentlyActivated && (details.plan === 'BASIC' || details.plan === 'BUSINESS')) return 'success';
  if (details?.pendingCheckout) return elapsedMs >= BILLING_RETURN_WINDOW_MS ? 'pending' : 'confirming';
  return 'ignore';
}
