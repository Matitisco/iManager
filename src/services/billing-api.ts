import type { AuthUserLike } from '../types/auth-user';
import type { BillingDetails, BillingPlanKey, BillingQuote } from '../types/billing';
import { apiRequest } from './api-client';

export const fetchBilling = (user: AuthUserLike, refresh = false) => apiRequest<BillingDetails>(user, refresh ? '/api/billing/refresh' : '/api/billing', { method: refresh ? 'POST' : 'GET', fallback: 'No se pudo cargar Plan y facturación.', timeoutMs: 35_000 });
export const quoteBilling = (user: AuthUserLike, key: BillingPlanKey, payerEmail: string) => apiRequest<BillingQuote>(user, '/api/billing/quote', { method: 'POST', body: { key, payerEmail }, fallback: 'No se pudo consultar el importe en pesos.', timeoutMs: 35_000 });
export const checkoutBilling = (user: AuthUserLike, quoteId: string) => apiRequest<{ initPoint: string }>(user, '/api/billing/checkout', { method: 'POST', body: { quoteId }, fallback: 'No se pudo abrir Mercado Pago. Actualizá el estado del pago antes de reintentar.', revealFriendlyServerError: true, timeoutMs: 60_000 });
export const cancelBilling = (user: AuthUserLike) => apiRequest<{ ok: boolean }>(user, '/api/billing/cancel', { method: 'POST', fallback: 'No se pudo cancelar la suscripción.', timeoutMs: 40_000 });
