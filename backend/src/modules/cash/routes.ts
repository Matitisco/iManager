import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveAppUser } from '../../middleware/resolve-app-user.js';
import { requireMember, requireSectionAccess } from '../../middleware/section-access.js';
import { DomainError } from '../../lib/domain-error.js';
import { loadActor } from '../audit/audit.js';
import { canViewCash, changeCategory, countSession, createRegister, editRegister, listMovements, listRegisters, listSessions, manualMovement, reviewSession, startSession, transferFunds, voidMovement } from './service.js';

const amount = z.number().finite().max(100_000_000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001, 'Usá hasta dos decimales');
const positive = amount.refine(n => n > 0, 'El monto debe ser mayor a cero');
const note = z.string().trim().max(500);
const category = z.string().trim().min(1).max(80).nullable();
const id = (request: FastifyRequest) => z.object({ id: z.string().min(1) }).parse(request.params).id;
function owner(request: FastifyRequest) { requireMember(request); if (request.appUser.role !== 'OWNER') throw new DomainError('Solo el dueño puede administrar cajas y aprobar cierres', 403); }
function balanceAccess(request: FastifyRequest) { requireMember(request); if (!canViewCash(request.appUser)) throw new DomainError('No tenés permiso para ver saldo de cajas', 403); }
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value, 'Fecha inválida');

export async function cashRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', resolveAppUser);
  app.addHook('preHandler', requireSectionAccess('cash'));
  app.get('/', async request => { requireMember(request); return listRegisters(request.appUser.storeId, request.appUser); });
  app.post('/', async request => {
    owner(request); requireMember(request);
    const input = z.object({ name: z.string().trim().min(1).max(120), currency: z.enum(['ARS','USD']), method: z.enum(['EFECTIVO','TRANSFERENCIA']), opening: amount.refine(n => n >= 0).default(0) }).strict().parse(request.body);
    return createRegister(request.appUser.storeId, { name: input.name!, currency: input.currency!, method: input.method!, opening: input.opening! }, await loadActor(request.appUser.userId));
  });
  app.patch('/:id', async request => {
    owner(request); requireMember(request);
    const input = z.object({ name: z.string().trim().min(1).max(120).optional(), archived: z.boolean().optional(), isDefault: z.boolean().optional() }).strict().parse(request.body);
    await editRegister(request.appUser.storeId, id(request), input, await loadActor(request.appUser.userId));
    return { ok: true };
  });
  app.post('/:id/open', async request => { requireMember(request); return startSession(request.appUser.storeId, id(request), await loadActor(request.appUser.userId)); });
  app.get('/:id/movements', async request => {
    balanceAccess(request); requireMember(request);
    const input = z.object({ from: day.optional(), to: day.optional(), category: z.string().max(80).optional(), offset: z.coerce.number().int().min(0).max(1_000_000).default(0) }).parse(request.query);
    if (input.from && input.to && input.from > input.to) throw new DomainError('La fecha inicial supera la final');
    return listMovements(request.appUser.storeId, id(request), { ...input, offset: input.offset! });
  });
  app.get('/:id/sessions', async request => {
    balanceAccess(request); requireMember(request);
    return listSessions(request.appUser.storeId, id(request));
  });
  app.post('/movements', async request => {
    requireMember(request);
    const input = z.object({ registerId: z.string().min(1), kind: z.enum(['INGRESO','EGRESO','AJUSTE']), amount, category: category.optional(), note: note.optional(), requestKey: z.string().min(8).max(120) }).strict().parse(request.body);
    if (input.kind === 'AJUSTE') owner(request);
    if (input.kind !== 'AJUSTE' && input.amount <= 0 || input.kind === 'AJUSTE' && input.amount === 0) throw new DomainError('Revisá el monto del movimiento');
    if (input.amount < -100_000_000) throw new DomainError('El monto supera el máximo');
    return manualMovement(request.appUser.storeId, { ...input, registerId: input.registerId!, kind: input.kind!, amount: input.amount!, requestKey: input.requestKey! }, await loadActor(request.appUser.userId));
  });
  app.post('/transfers', async request => {
    requireMember(request);
    const input = z.object({ fromId: z.string().min(1), toId: z.string().min(1), amount: positive, exchangeRate: positive.optional(), note: note.optional(), requestKey: z.string().min(8).max(120) }).strict().parse(request.body);
    return transferFunds(request.appUser.storeId, { ...input, fromId: input.fromId!, toId: input.toId!, amount: input.amount!, requestKey: input.requestKey! }, await loadActor(request.appUser.userId));
  });
  app.post('/movements/:id/void', async request => { owner(request); requireMember(request); await voidMovement(request.appUser.storeId, id(request), await loadActor(request.appUser.userId)); return { ok: true }; });
  app.patch('/movements/:id/category', async request => { owner(request); requireMember(request); const input = z.object({ category }).strict().parse(request.body); await changeCategory(request.appUser.storeId, id(request), input.category, await loadActor(request.appUser.userId)); return { ok: true }; });
  app.post('/sessions/:id/count', async request => {
    requireMember(request);
    const input = z.object({ denominations: z.record(z.number().int().min(0).max(1_000_000)).optional(), counted: amount.refine(n => n >= 0).optional(), note: note.optional() }).strict().parse(request.body);
    return countSession(request.appUser.storeId, id(request), input, await loadActor(request.appUser.userId));
  });
  app.post('/sessions/:id/review', async request => {
    owner(request); requireMember(request);
    const input = z.object({ action: z.enum(['APPROVE','RECOUNT']), note: note.optional() }).strict().parse(request.body);
    await reviewSession(request.appUser.storeId, id(request), { ...input, action: input.action! }, await loadActor(request.appUser.userId));
    return { ok: true };
  });
}
