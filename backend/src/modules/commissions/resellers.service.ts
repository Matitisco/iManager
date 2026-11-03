import { isUniqueConstraintError } from '../../lib/unique-constraint.js';
import { prisma } from '../../plugins/prisma.js';
import { withSerializableRetry } from '../../lib/with-serializable-retry.js';
import { DomainError } from '../../lib/domain-error.js';
import { writeAudit, type Actor } from '../audit/audit.js';

export function resellerName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80) throw new DomainError('Ingresá un nombre de hasta 80 caracteres');
  return name;
}

/** Never delete a directory entry: sales, payments and historical rules keep their beneficiary. */
export async function saveReseller(storeId: string, actor: Actor, input: { name?: string; archived?: boolean }, id?: string) {
  return withSerializableRetry(async tx => {
    const existing = id ? await tx.storeReseller.findFirst({ where: { id, storeId } }) : null;
    if (id && !existing) throw new DomainError('Revendedor no encontrado', 404);
    const name = input.name === undefined ? existing?.name : resellerName(input.name);
    if (!name) throw new DomainError('Ingresá el nombre del revendedor');
    const duplicate = await tx.storeReseller.findFirst({ where: { storeId, name: { equals: name, mode: 'insensitive' }, ...(id ? { id: { not: id } } : {}) } });
    if (duplicate) throw new DomainError('Ya existe un revendedor con ese nombre en esta tienda', 409);
    const data = { name, archivedAt: input.archived === undefined ? existing?.archivedAt ?? null : input.archived ? existing?.archivedAt ?? new Date() : null };
    const reseller = existing ? await tx.storeReseller.update({ where: { id: existing.id }, data }) : await tx.storeReseller.create({ data: { storeId, ...data } });
    await writeAudit(tx, { storeId, actor, action: !existing ? 'reseller.created' : input.archived ? 'reseller.archived' : 'reseller.updated', entityType: 'storeReseller', entityId: reseller.id, entityLabel: reseller.name });
    return { ...reseller, archivedAt: reseller.archivedAt?.toISOString() ?? null, createdAt: reseller.createdAt.toISOString(), updatedAt: reseller.updatedAt.toISOString() };
  }).catch(error => {
    if (isUniqueConstraintError(error)) throw new DomainError('Ya existe un revendedor con ese nombre en esta tienda', 409);
    throw error;
  });
}

export async function listResellers(storeId: string) {
  return prisma.storeReseller.findMany({ where: { storeId }, orderBy: [{ sales: { _count: 'desc' } }, { name: 'asc' }] });
}
