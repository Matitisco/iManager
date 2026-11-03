import type { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../plugins/prisma.js';
import { lockTransactionKey } from '../../lib/advisory-lock.js';

export function newSlug(name: string) {
  const prefix = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'tienda';
  return `${prefix}-${randomBytes(12).toString('hex')}`;
}
// Also supports installations using db push rather than migrate deploy. Import once;
// after that the legacy table is never consulted for settings or public links.
export async function ensureDefaultInTransaction(tx: Prisma.TransactionClient, storeId: string, create = false) {
  await lockTransactionKey(tx, `catalog-settings:${storeId}`);
  const current = await tx.storeCatalog.findFirst({ where: { storeId, isDefault: true } });
  if (current) return current;
  const legacy = await tx.storePublicCatalog.findUnique({ where: { storeId } });
  if (legacy) return tx.storeCatalog.create({ data: { ...legacy, id: `default:${storeId}`, name: 'Clientes finales', isDefault: true } });
  if (!create) return null;
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { name: true } });
  return tx.storeCatalog.create({ data: { id: `default:${storeId}`, storeId, slug: newSlug(store.name), name: 'Clientes finales', isDefault: true } });
}
export async function getDefaultCatalog(storeId: string) {
  const current = await prisma.storeCatalog.findFirst({ where: { storeId, isDefault: true } });
  if (current) return current;
  if (!await prisma.storePublicCatalog.findUnique({ where: { storeId }, select: { storeId: true } })) return null;
  return prisma.$transaction(tx => ensureDefaultInTransaction(tx, storeId));
}
