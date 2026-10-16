import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { DomainError } from '../../lib/domain-error.js';

const API = 'https://api.mercadopago.com';
export async function mpRequest(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) throw new DomainError('La facturación todavía no está configurada. Contactá a iManager.', 503);
  try {
    const response = await fetch(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000),
    });
    // Never include provider error bodies, request headers or credentials in errors/logs.
    if (!response.ok) throw new Error('provider request failed');
    return await response.json();
  } catch {
    throw new DomainError('No pudimos consultar Mercado Pago. Reintentá en unos minutos.', 502);
  }
}
export function parseRemote<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new DomainError('Mercado Pago devolvió una respuesta inválida. Reintentá.', 502);
  return parsed.data;
}
export const remotePlanSchema = z.object({ id: z.string().min(1), init_point: z.string().url(), reason: z.string().optional(), back_url: z.string().optional(), auto_recurring: z.object({ transaction_amount: z.coerce.number().positive(), currency_id: z.literal('ARS'), frequency: z.number().int().positive(), frequency_type: z.literal('months'), free_trial: z.unknown().optional() }) });
export const remoteSubscriptionSchema = z.object({
  id: z.string().min(1), preapproval_plan_id: z.string().optional(), external_reference: z.string().optional(),
  payer_email: z.string().optional(), payer_id: z.number().optional(),
  status: z.enum(['pending', 'authorized', 'paused', 'cancelled']),
  last_modified: z.string().datetime({ offset: true }), date_created: z.string().datetime({ offset: true }).optional(),
  auto_recurring: z.object({ currency_id: z.string(), frequency: z.number(), frequency_type: z.string(), transaction_amount: z.coerce.number().optional() }),
  summarized: z.object({ charged_quantity: z.number().nullish(), last_charged_date: z.string().nullish() }).optional(),
});
export type RemoteSubscription = z.infer<typeof remoteSubscriptionSchema>;
export async function getRemoteSubscription(id: string) {
  const result = remoteSubscriptionSchema.safeParse(await mpRequest(`/preapproval/${encodeURIComponent(id)}`));
  if (!result.success || result.data.id !== id) throw new DomainError('Mercado Pago devolvió una suscripción inválida.', 502);
  return result.data;
}
export function hostedCheckout(initPoint: string, storeId: string, email: string) {
  const url = new URL(initPoint);
  if (url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.ar' || url.pathname !== '/subscriptions/checkout' || url.username || url.password) {
    throw new DomainError('Mercado Pago devolvió un enlace de pago inválido.', 502);
  }
  url.searchParams.set('external_reference', storeId);
  url.searchParams.set('payer_email', email);
  return url.toString();
}
export function validSignature(id: string, requestId: string | undefined, signature: string | undefined, secret = process.env.MP_WEBHOOK_SECRET) {
  if (!secret) return true;
  if (!requestId || !signature) return false;
  const fields = signature.split(',').map(part => part.trim().split('='));
  const timestamps = fields.filter(([key]) => key === 'ts');
  const signatures = fields.filter(([key]) => key === 'v1');
  if (timestamps.length !== 1 || signatures.length !== 1) return false;
  const ts = timestamps[0][1]; const hash = signatures[0][1];
  if (!ts || !/^\d+$/.test(ts) || !hash || !/^[a-f\d]{64}$/i.test(hash)) return false;
  const expected = createHmac('sha256', secret).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest();
  return timingSafeEqual(expected, Buffer.from(hash, 'hex'));
}
