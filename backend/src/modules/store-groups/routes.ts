import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveAppUser } from '../../middleware/resolve-app-user.js';
import { requireMember } from '../../middleware/section-access.js';
import { actorFor } from '../audit/audit.js';
import { buildAppSessionForUser } from '../auth/session.service.js';
import {
  balanceQuery,
  enableSchema,
  transferSchema,
  transfersQuery,
} from './schema.js';
import {
  enableStoreGroup,
  getStoreGroup,
  getStoreGroupBalance,
  listStockTransfers,
  transferStock,
} from './service.js';

export async function storeGroupRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', resolveAppUser);
  app.get('/', async (request) => {
    requireMember(request);
    return getStoreGroup(request.appUser.storeId, request.appUser.userId);
  });
  app.post('/enable', async (request) => {
    requireMember(request);
    await enableStoreGroup(
      request.appUser.storeId,
      await actorFor(request.appUser),
      enableSchema.parse(request.body),
    );
    return { session: await buildAppSessionForUser(request.auth!) };
  });
  app.get('/balance', async (request) => {
    requireMember(request);
    return getStoreGroupBalance(
      request.appUser.storeId,
      request.appUser.userId,
      balanceQuery.parse(request.query).months,
    );
  });
  app.get('/transfers', async (request) => {
    requireMember(request);
    return listStockTransfers(
      request.appUser.storeId,
      request.appUser.userId,
      transfersQuery.parse(request.query).limit,
    );
  });
  app.post('/transfers', async (request) => {
    requireMember(request);
    return transferStock(
      request.appUser.storeId,
      await actorFor(request.appUser),
      transferSchema.parse(request.body),
    );
  });
}
