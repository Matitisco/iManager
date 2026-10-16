import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { DomainError } from '../../lib/domain-error.js';

export class MPRejectedRequest extends DomainError {}

const API = 'https://api.mercadopago.com';
const WEBHOOK_SIGNATURE_SKEW_MS = 5 * 60_000;
const MP_HOST = /^(?:[a-z0-9-]+\.)*mercadopago\.com(?:\.[a-z]{2})?$/;

function providerLog(status: number, raw: string, token: string) {
  let message = '';
  const causes: Array<string | number> = [];
  try {
    const body = JSON.parse(raw) as { message?: unknown; cause?: unknown };
    if (typeof body.message === 'string') message = body.message.replace(/\s+/g, ' ').slice(0, 180);
    if (Array.isArray(body.cause)) {
      for (const item of body.cause.slice(0, 8)) {
        if (!item || typeof item !== 'object' || !('code' in item)) continue;
        const code = (item as { code?: unknown }).code;
        if (typeof code === 'number' && Number.isFinite(code)) causes.push(code);
        else if (typeof code === 'string' && /^[a-z0-9_-]{1,40}$/i.test(code)) causes.push(code);
      }
    }
  } catch { /* unreadable provider body is not logged */ }
  if (token && message.includes(token)) message = message.replaceAll(token, '[redacted]');
  return { status, message, causes };
}

export async function mpRequest(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) throw new DomainError('La facturación todavía no está configurada. Contactá a iManager.', 503);
  try {
    const response = await fetch(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000),
    });
    // Log only status, message and cause codes. Never the raw body, headers or credentials.
    if (!response.ok) {
      const details = providerLog(response.status, await response.text(), token);
      if ([400, 401, 403, 404, 422].includes(response.status)) throw new MPRejectedRequest('Mercado Pago rechazó el pago. Revisá los datos de la tarjeta o probá con otra.', 402, details);
      throw new DomainError('No pudimos consultar Mercado Pago. Reintentá en unos minutos.', 502, details);
    }
    return await response.json();
  } catch (cause) {
    if (cause instanceof DomainError) throw cause;
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
  id: z.string().min(1), preapproval_plan_id: z.string().optional(), external_reference: z.string().nullish(),
  payer_email: z.string().nullish(), payer_id: z.number().nullish(), init_point: z.string().nullish(),
  status: z.enum(['pending', 'authorized', 'paused', 'cancelled']),
  last_modified: z.string().datetime({ offset: true }), date_created: z.string().datetime({ offset: true }).optional(),
  auto_recurring: z.object({ currency_id: z.string(), frequency: z.number(), frequency_type: z.string(), transaction_amount: z.coerce.number().optional() }),
  summarized: z.object({ charged_quantity: z.number().nullish(), last_charged_date: z.string().nullish() }).optional(),
});
export type RemoteSubscription = z.infer<typeof remoteSubscriptionSchema>;
export function assertMercadoPagoCheckoutUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new DomainError('Mercado Pago no devolvió el checkout.', 502); }
  if (url.protocol !== 'https:' || url.username || url.password || !MP_HOST.test(url.hostname.toLowerCase())) {
    throw new DomainError('Mercado Pago no devolvió el checkout.', 502);
  }
  return url.toString();
}
export async function getRemoteSubscription(id: string) {
  const result = remoteSubscriptionSchema.safeParse(await mpRequest(`/preapproval/${encodeURIComponent(id)}`));
  if (!result.success || result.data.id !== id) throw new DomainError('Mercado Pago devolvió una suscripción inválida.', 502);
  return result.data;
}
export function validSignature(id: string, requestId: string | undefined, signature: string | undefined, secret = process.env.MP_WEBHOOK_SECRET, now = Date.now()) {
  if (!secret) return true;
  if (!requestId || !signature) return false;
  const fields = signature.split(',').map(part => part.trim().split('='));
  const timestamps = fields.filter(([key]) => key === 'ts');
  const signatures = fields.filter(([key]) => key === 'v1');
  if (timestamps.length !== 1 || signatures.length !== 1) return false;
  const ts = timestamps[0][1]; const hash = signatures[0][1];
  if (!ts || !/^\d+$/.test(ts) || !hash || !/^[a-f\d]{64}$/i.test(hash)) return false;
  const issued = Number(ts) * 1000;
  if (!Number.isFinite(issued) || Math.abs(now - issued) > WEBHOOK_SIGNATURE_SKEW_MS) return false;
  const expected = createHmac('sha256', secret).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest();
  const actual = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}
