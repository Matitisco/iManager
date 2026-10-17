import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { DomainError } from '../../lib/domain-error.js';

export class MPRejectedRequest extends DomainError {}

const API = 'https://api.mercadopago.com';
const WEBHOOK_SIGNATURE_SKEW_MS = 5 * 60_000;
const MP_HOST = /^(?:[a-z0-9-]+\.)*mercadopago\.com(?:\.[a-z]{2})?$/;

const CONFIG_ERROR = 'La facturación no está disponible en este momento. Contactá a iManager.';
const PREAPPROVAL_ERROR = 'Mercado Pago no pudo iniciar la suscripción. Revisá el email del pagador o probá de nuevo en unos minutos.';
const MIXED_ACCOUNT_ERROR = 'Este email no se puede usar con la cuenta de cobro actual. Probá con otro email o contactá a iManager.';
const PLAN_ERROR = 'No pudimos validar el plan con Mercado Pago. Reintentá.';
const PROVIDER_ERROR = 'No pudimos consultar Mercado Pago. Reintentá en unos minutos.';

export type MpRequestContext = { purpose?: 'plan' };

function providerLog(status: number, raw: string, token: string) {
  let message = '';
  const causes: Array<string | number> = [];
  try {
    const body = JSON.parse(raw) as { message?: unknown; cause?: unknown };
    if (typeof body.message === 'string') message = body.message.replace(/\s+/g, ' ').trim();
    if (Array.isArray(body.cause)) {
      for (const item of body.cause.slice(0, 8)) {
        if (!item || typeof item !== 'object' || !('code' in item)) continue;
        const code = (item as { code?: unknown }).code;
        if (typeof code === 'number' && Number.isFinite(code)) causes.push(code);
        else if (typeof code === 'string' && /^[a-z0-9_-]{1,40}$/i.test(code)) causes.push(code);
      }
    }
  } catch { /* unreadable provider body is not logged */ }
  if (token) message = message.replaceAll(token, '[redacted]');
  message = message.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[redacted-email]').slice(0, 180);
  return { status, message, causes };
}

function mpRejection(status: number, method: string, path: string, message: string, context?: MpRequestContext) {
  const route = path.split('?')[0];
  if (/real or test users/i.test(message)) return { statusCode: 402, message: MIXED_ACCOUNT_ERROR, kind: 'provider' as const };
  if (status === 401 || status === 403) return { statusCode: 503, message: CONFIG_ERROR, kind: 'config' as const };
  if ((status === 400 || status === 422) && method.toUpperCase() === 'POST' && route === '/preapproval') {
    return { statusCode: 402, message: PREAPPROVAL_ERROR, kind: 'provider' as const };
  }
  if (context?.purpose === 'plan' && [400, 404, 422].includes(status) && (method.toUpperCase() === 'GET' || method.toUpperCase() === 'PUT') && route.startsWith('/preapproval_plan/')) {
    return { statusCode: 402, message: PLAN_ERROR, kind: 'provider' as const };
  }
  if ([400, 404, 422].includes(status)) return { statusCode: 502, message: PROVIDER_ERROR, kind: 'provider' as const };
  return null;
}

export async function mpRequest(path: string, method = 'GET', body?: unknown, context?: MpRequestContext): Promise<unknown> {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) throw new DomainError('La facturación todavía no está configurada. Contactá a iManager.', 503);
  try {
    const response = await fetch(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000),
    });
    // Log only status, a sanitized message and cause codes. Never the raw body, headers, tokens or full emails.
    if (!response.ok) {
      const details = providerLog(response.status, await response.text(), token);
      const mapped = mpRejection(response.status, method, path, details.message, context);
      if (mapped) throw new MPRejectedRequest(mapped.message, mapped.statusCode, { ...details, kind: mapped.kind });
      throw new DomainError(PROVIDER_ERROR, 502, { ...details, kind: 'provider' });
    }
    return await response.json();
  } catch (cause) {
    if (cause instanceof DomainError) throw cause;
    throw new DomainError(PROVIDER_ERROR, 502);
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
  const key = secret?.trim();
  if (!key || !requestId || !signature) return false;
  const fields = signature.split(',').map(part => part.trim().split('='));
  const timestamps = fields.filter(([key]) => key === 'ts');
  const signatures = fields.filter(([key]) => key === 'v1');
  if (timestamps.length !== 1 || signatures.length !== 1) return false;
  const ts = timestamps[0][1]; const hash = signatures[0][1];
  if (!ts || !/^\d+$/.test(ts) || !hash || !/^[a-f\d]{64}$/i.test(hash)) return false;
  const issued = Number(ts) * 1000;
  if (!Number.isFinite(issued) || Math.abs(now - issued) > WEBHOOK_SIGNATURE_SKEW_MS) return false;
  const expected = createHmac('sha256', key).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest();
  const actual = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}
