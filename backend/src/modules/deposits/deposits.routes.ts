import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveAppUser } from '../../middleware/resolve-app-user.js';
import { requireMember, requireSectionAccess } from '../../middleware/section-access.js';
import { canAccessSection } from '../stores/sections.js';
import { requireSensitiveActor } from '../stores/sensitive-access.js';
import { loadActor } from '../audit/audit.js';
import { createDeposit, cancelDeposit, listDeposits, applyDepositToRepair, type DepositInput } from './deposits.service.js';
const params = z.object({ clientId: z.string().min(1), id: z.string().min(1).optional() });
const money = z.number().finite().positive().max(100_000_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Usá hasta dos decimales');
export async function depositsRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, resolveAppUser, requireSectionAccess('clients')];
  app.get('/:clientId/deposits', { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    requireMember(request);
    if (!['clients', 'sales', 'service'].some(section => canAccessSection(section as 'clients' | 'sales' | 'service', request.appUser))) return reply.code(403).send({ error: 'No tenés acceso a señas de clientes' });
    return { deposits: await listDeposits(request.appUser.storeId, params.parse(request.params).clientId) };
  });
  app.post('/:clientId/deposits', { preHandler }, async (request, reply) => {
    requireMember(request);
    const { clientId } = params.parse(request.params);
    const input = z.object({ amount: money, currency: z.enum(['ARS', 'USD']), exchangeRate: money, method: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CRIPTO']), productId: z.string().min(1).nullable().optional(), requestKey: z.string().min(1).max(120) }).parse(request.body) as DepositInput;
    const deposit = await createDeposit(request.appUser.storeId, clientId, input, await loadActor(request.appUser.userId));
    return reply.code(201).send({ deposit });
  });
  app.post('/:clientId/deposits/:id/cancel', { preHandler }, async (request, reply) => {
    requireMember(request);
    const actor = await requireSensitiveActor(request.appUser, reply);
    if (!actor) return;
    const { clientId, id } = params.parse(request.params);
    const { mode } = z.object({ mode: z.enum(['REFUND', 'CREDIT']) }).parse(request.body);
    return { deposit: await cancelDeposit(request.appUser.storeId, clientId, id!, mode, actor) };
  });
  app.post('/:clientId/deposits/:id/repair', { preHandler: [authenticate, resolveAppUser, requireSectionAccess('service')] }, async request => {
    requireMember(request);
    const { clientId, id } = params.parse(request.params);
    const input = z.object({ repairId: z.string().min(1), exchangeRate: money.optional() }).parse(request.body);
    return applyDepositToRepair(request.appUser.storeId, clientId, id!, input.repairId, input.exchangeRate, await loadActor(request.appUser.userId));
  });
}
