import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveAppUser } from '../../middleware/resolve-app-user.js';
import {
  requireMember,
  requireSectionAccess,
} from '../../middleware/section-access.js';
import { loadActor } from '../audit/audit.js';
import {
  consignmentOptions,
  createConsignments,
  listConsignments,
  payConsignment,
} from './consignments.service.js';

export async function consignmentRoutes(app: FastifyInstance) {
  const guard = [authenticate, resolveAppUser, requireSectionAccess('sales')];
  app.get('/', { preHandler: guard }, async (request) => {
    requireMember(request);
    return listConsignments(request.appUser.storeId);
  });
  app.get('/options', { preHandler: guard }, async (request) => {
    requireMember(request);
    return consignmentOptions(request.appUser.storeId);
  });
  app.post('/', { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const body = z
      .object({
        clientId: z.string().min(1),
        items: z
          .array(
            z
              .object({
                productId: z.string().min(1),
                amount: z.number().positive().max(9999999999.99),
                currency: z.enum(['ARS', 'USD']),
              })
              .strict(),
          )
          .min(1)
          .max(100),
      })
      .strict()
      .parse(request.body);
    return reply
      .code(201)
      .send({ items: await createConsignments(request.appUser.storeId, body) });
  });
  app.post('/:id/pay', { preHandler: guard }, async (request) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { paymentMethod } = z
      .object({
        paymentMethod: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']),
      })
      .strict()
      .parse(request.body);
    return payConsignment(
      request.appUser.storeId,
      id,
      paymentMethod,
      await loadActor(request.appUser.userId),
    );
  });
}
