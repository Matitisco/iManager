import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveAppUser } from '../../middleware/resolve-app-user.js';
import { DomainError } from '../../lib/domain-error.js';
import { billingDetails, quoteCheckout, openCheckout, cancelSubscription, reconcilePreapproval, reconcileInvoice, refreshBilling } from './service.js';
import { validSignature } from './mercadopago.js';

function ownerStore(request: FastifyRequest) {
  if (request.appUser?.role !== 'OWNER') throw new DomainError('Solo el propietario puede administrar Plan y facturación.', 403);
  return request.appUser.storeId;
}
const quoteSchema = z.object({ key: z.enum(['BASIC_MONTHLY', 'BASIC_ANNUAL', 'BUSINESS_MONTHLY', 'BUSINESS_ANNUAL']), payerEmail: z.string().trim().email().max(255) });
export async function billingRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, resolveAppUser];
  app.get('/', { preHandler }, request => billingDetails(ownerStore(request)));
  app.post('/quote', { preHandler }, request => {
    const storeId = ownerStore(request); const body = quoteSchema.parse(request.body);
    return quoteCheckout(storeId, body.key, body.payerEmail);
  });
  app.post('/checkout', { preHandler }, request => {
    const storeId = ownerStore(request);
    const body = z.object({ quoteId: z.string().min(1).max(100) }).strict().parse(request.body);
    return openCheckout(storeId, body.quoteId);
  });
  app.post('/cancel', { preHandler }, async request => { await cancelSubscription(ownerStore(request)); return { ok: true }; });
  // back_url may append preapproval_id or status. Activation never reads them.
  app.post('/refresh', { preHandler }, request => {
    const body = request.body;
    const replaceAbandoned = !!body && typeof body === 'object' && (body as { replaceAbandoned?: unknown }).replaceAbandoned === true;
    return refreshBilling(ownerStore(request), console, { replaceAbandoned });
  });
}
export async function mercadoPagoWebhookRoutes(app: FastifyInstance) {
  app.post('/mercadopago', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const body = z.object({ type: z.string().optional(), data: z.object({ id: z.union([z.string(), z.number()]) }).optional() }).parse(request.body ?? {});
    const query = z.object({ 'data.id': z.string().optional(), type: z.string().optional() }).parse(request.query);
    // MP signs data.id from the URL. Require agreement with the body when both are present.
    const id = query['data.id'] ?? (body.data ? String(body.data.id) : undefined);
    if (!id || !/^[a-z\d_-]{1,100}$/i.test(id)) return reply.code(400).send({ error: 'ID de notificación inválido.' });
    if (body.data && String(body.data.id).toLowerCase() !== id.toLowerCase()) return reply.code(400).send({ error: 'La notificación no coincide con su firma.' });
    const header = (key: string) => typeof request.headers[key] === 'string' ? request.headers[key] as string : undefined;
    if (!process.env.MP_WEBHOOK_SECRET?.trim()) request.log.warn('MP_WEBHOOK_SECRET is missing; rejecting Mercado Pago webhook');
    if (!validSignature(id, header('x-request-id'), header('x-signature'))) return reply.code(401).send({ error: 'Firma inválida.' });
    const type = body.type ?? query.type;
    if (type === 'subscription_preapproval') await reconcilePreapproval(id);
    else if (type === 'subscription_authorized_payment') await reconcileInvoice(id);
    return { ok: true };
  });
}
