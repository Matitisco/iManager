import { Prisma } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';
import { DomainError } from '../../lib/domain-error.js';

/** ReadCommitted is intentional: reads AFTER a waiting row lock must see the
 * preceding member mutation, including a revoked actor's membership. */
export async function withMembershipTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        timeout: 20_000,
      });
    } catch (error) {
      const failure = error as { code?: string; meta?: { code?: string } };
      const code = failure?.code === 'P2010' ? failure.meta?.code : failure?.code;
      if (!['P2034', '40001', '40P01'].includes(code ?? '')) throw error;
      if (attempt === 2) throw new DomainError('La operación coincidió con otro cambio. Volvé a intentarlo.', 409);
      await new Promise(resolve => setTimeout(resolve, 40 * 2 ** attempt));
    }
  }
}

/** Shared by role/permission changes, removals and invitation acceptance.
 * Lock order: user membership → invitation → billing → Store row. No caller
 * holding a Store row may acquire a user membership, invitation or billing lock. */
export async function lockStoreMembers(tx: Prisma.TransactionClient, storeId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Store" WHERE id = ${storeId} FOR UPDATE`;
  if (rows.length === 0) throw new DomainError('Tienda no encontrada', 404);
}

export async function requireTeamActor(tx: Prisma.TransactionClient, storeId: string, userId: string) {
  const actor = await tx.storeMember.findUnique({ where: { storeId_userId: { storeId, userId } } });
  if (!actor || actor.removedAt || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
    throw new DomainError('No tenés permisos para gestionar el equipo', 403);
  }
  return actor;
}
