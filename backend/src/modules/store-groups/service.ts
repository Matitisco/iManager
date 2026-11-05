import { createStoreWithOwner } from '../stores/store-creation.js';
import { blankToNull, requireInstagram } from '../stores/store-contact.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';
import { DomainError } from '../../lib/domain-error.js';
import {
  lockTransactionKey,
  userMembershipLockKey,
} from '../../lib/advisory-lock.js';
import { withSerializableRetry } from '../../lib/with-serializable-retry.js';
import {
  lockStoreMembers,
  withMembershipTransaction,
} from './membership-tx.js';
import { canSeeFinancials } from '../stores/sections.js';
import {
  lockInventory,
  clearReservation,
} from '../deposits/deposits.service.js';
import { writeAudit, type Actor } from '../audit/audit.js';
import { loadNetProfit } from '../reports/net-profit.service.js';
import type { NetProfitFigures } from '../reports/net-profit.js';
import { monthPeriods, monthRange, sumFigures } from './balance.js';
import { assertTransferAvailable } from './availability.js';
import {
  enableSchema,
  transferSchema,
  type EnableInput,
  type TransferInput,
} from './schema.js';

type Db = Prisma.TransactionClient;
async function owner(db: Db, storeId: string, userId: string) {
  const member = await db.storeMember.findFirst({
    where: { storeId, userId, role: 'OWNER', removedAt: null },
  });
  if (!member)
    throw new DomainError(
      'Solo el propietario puede administrar multitienda.',
      403,
    );
  return member;
}
async function ownedGroup(db: Db, storeId: string, userId: string) {
  const member = await owner(db, storeId, userId);
  const store = await db.store.findUniqueOrThrow({
    where: { id: storeId },
    include: {
      group: { include: { stores: { orderBy: { groupKind: 'desc' } } } },
    },
  });
  if (!store.group)
    throw new DomainError('Activá multitienda para usar esta función.', 404);
  for (const peer of store.group.stores) await owner(db, peer.id, userId);
  return { group: store.group, member };
}
export async function getStoreGroup(storeId: string, userId: string) {
  const membership = await prisma.storeMember.findFirst({
    where: { storeId, userId, removedAt: null },
  });
  if (!membership) throw new DomainError('Tienda no encontrada.', 404);
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    include: { group: true },
  });
  if (!store.group) return { group: null };
  const stores = await prisma.store.findMany({
    where: {
      groupId: store.groupId,
      ...(membership.role === 'OWNER'
        ? { memberships: { some: { userId, role: 'OWNER', removedAt: null } } }
        : { id: storeId }),
    },
    orderBy: { groupKind: 'desc' },
  });
  // The group name follows the original store; never expose it to another store's employee.
  return {
    group: {
      id: store.group.id,
      name: membership.role === 'OWNER' ? store.group.name : store.name,
      stores: stores.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.groupKind,
        isCurrent: row.id === storeId,
      })),
    },
  };
}
export async function enableStoreGroup(
  storeId: string,
  actor: Actor,
  raw: EnableInput,
) {
  const input = enableSchema.parse(raw);
  const address = blankToNull(input.otherAddress);
  const instagram = blankToNull(input.otherInstagram)
    ? requireInstagram(input.otherInstagram)
    : null;
  return withMembershipTransaction(async (tx) => {
    await lockTransactionKey(tx, userMembershipLockKey(actor.userId));
    await lockStoreMembers(tx, storeId);
    await owner(tx, storeId, actor.userId);
    const current = await tx.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    if (current.groupId)
      throw new DomainError('Esta tienda ya tiene multitienda activado.', 409);
    const group = await tx.storeGroup.create({
      data: {
        name: current.name,
        primaryStoreId: storeId,
        createdByUserId: actor.userId,
      },
    });
    await tx.store.update({
      where: { id: storeId },
      data: { groupId: group.id, groupKind: input.currentKind },
    });
    // Same initialization as createStoreForUser/onboarding: operational catalogs,
    // cash registers and document counters are created lazily by their modules.
    // No trialData here: billing is always resolved through primaryStoreId.
    const { store: other } = await createStoreWithOwner(
      tx,
      actor.userId,
      {
        name: input.otherStoreName,
        address,
        instagram,
        groupId: group.id,
        groupKind: input.currentKind === 'WHOLESALE' ? 'RETAIL' : 'WHOLESALE',
        currency: current.currency,
        exchangeMode: current.exchangeMode,
        exchangeSource: current.exchangeSource,
        manualBuy: current.manualBuy,
        manualSell: current.manualSell,
        timezone: current.timezone,
        usedWarrantyDays: current.usedWarrantyDays,
        sealedWarrantyDays: current.sealedWarrantyDays,
        repairWarrantyDays: current.repairWarrantyDays,
      },
      false,
    );
    for (const id of [storeId, other.id])
      await writeAudit(tx, {
        storeId: id,
        actor,
        action: 'store-group.enabled',
        entityType: 'store-group',
        entityId: group.id,
        detail:
          'Multitienda activado: mayorista y minorista con stock separado.',
      });
    return group;
  });
}
export async function getStoreGroupBalance(
  storeId: string,
  userId: string,
  count: 3 | 6 | 12,
  now = new Date(),
) {
  const { group, member } = await ownedGroup(prisma, storeId, userId);
  if (!canSeeFinancials(member))
    throw new DomainError('No tenés permisos para ver el balance.', 403);
  const primary = group.stores.find(
    (store) => store.id === group.primaryStoreId,
  )!;
  const periods = monthPeriods(count, primary.timezone, now);
  const rates = new Map<string, Promise<number | null>>();
  const stores: {
    storeId: string;
    name: string;
    kind: string | null;
    totals: NetProfitFigures;
    monthly: (NetProfitFigures & { month: string })[];
  }[] = [];
  for (const store of group.stores) {
    const report = await loadNetProfit(store.id, rates);
    const monthly = periods.map((period) => {
      const range = monthRange(period.month, report.zone, now);
      const value = report.calculate(range.from, range.to);
      if (value.blocked)
        throw new DomainError(
          'No pudimos obtener la cotización para calcular el balance. Revisá la cotización e intentá de nuevo.',
          409,
        );
      return {
        month: period.month,
        revenue: value.revenue!,
        cost: value.cost!,
        grossProfit: value.grossProfit!,
        expenses: value.expenses!,
        netProfit: value.netProfit!,
      };
    });
    stores.push({
      storeId: store.id,
      name: store.name,
      kind: store.groupKind,
      totals: sumFigures(monthly),
      monthly,
    });
  }
  const mixedCurrency =
    new Set(group.stores.map((store) => store.currency)).size > 1;
  return {
    currency: primary.currency,
    mixedCurrency,
    months: periods.map((period) => period.month),
    stores,
    combined: mixedCurrency
      ? null
      : {
          totals: sumFigures(stores.map((store) => store.totals)),
          monthly: periods.map((period, index) => ({
            month: period.month,
            ...sumFigures(stores.map((store) => store.monthly[index])),
          })),
        },
  };
}
const transferInclude = {
  items: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.StockTransferInclude;
type Transfer = Prisma.StockTransferGetPayload<{
  include: typeof transferInclude;
}>;
function serializeTransfer(
  row: Transfer,
  stores: { id: string; name: string }[],
) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    from: {
      id: row.fromStoreId,
      name:
        stores.find((store) => store.id === row.fromStoreId)?.name ??
        'Tienda eliminada',
    },
    to: {
      id: row.toStoreId,
      name:
        stores.find((store) => store.id === row.toStoreId)?.name ??
        'Tienda eliminada',
    },
    items: row.items.map((item) => ({
      label: item.label,
      quantity: item.quantity,
    })),
  };
}
export async function listStockTransfers(
  storeId: string,
  userId: string,
  limit = 20,
) {
  const { group } = await ownedGroup(prisma, storeId, userId);
  const rows = await prisma.stockTransfer.findMany({
    where: { groupId: group.id },
    include: transferInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return { transfers: rows.map((row) => serializeTransfer(row, group.stores)) };
}
export async function transferStock(
  storeId: string,
  actor: Actor,
  raw: TransferInput,
) {
  const input = transferSchema.parse(raw);
  try {
    return await withSerializableRetry(async (tx) => {
      await lockTransactionKey(tx, userMembershipLockKey(actor.userId));
      const { group } = await ownedGroup(tx, storeId, actor.userId);
      const destination = group.stores.find(
        (store) => store.id === input.toStoreId && store.id !== storeId,
      );
      if (!destination)
        throw new DomainError('Elegí otra tienda del mismo grupo.', 400);
      await lockTransactionKey(tx, `store-group:${group.id}`);
      // A conflicting transfer must retry with a fresh Serializable snapshot.
      await tx.storeGroup.update({
        where: { id: group.id },
        data: { updatedAt: new Date() },
      });
      for (const id of group.stores.map((store) => store.id).sort())
        await lockStoreMembers(tx, id);
      await ownedGroup(tx, storeId, actor.userId);
      if (input.requestKey) {
        const prior = await tx.stockTransfer.findUnique({
          where: {
            groupId_requestKey: {
              groupId: group.id,
              requestKey: input.requestKey,
            },
          },
          include: transferInclude,
        });
        if (prior) {
          if (
            prior.fromStoreId !== storeId ||
            prior.toStoreId !== input.toStoreId
          )
            throw new DomainError(
              'Esta solicitud ya corresponde a otra transferencia.',
              409,
            );
          return { transfer: serializeTransfer(prior, group.stores) };
        }
      }
      const definitions = await tx.customFieldDefinition.findMany({
        where: {
          storeId: destination.id,
          entity: 'inventory',
          archivedAt: null,
        },
      });
      const originDefinitions = await tx.customFieldDefinition.findMany({
        where: { storeId, entity: 'inventory', archivedAt: null },
      });
      const transfer = await tx.stockTransfer.create({
        data: {
          groupId: group.id,
          fromStoreId: storeId,
          toStoreId: destination.id,
          actorUserId: actor.userId,
          actorName: actor.name,
          requestKey: input.requestKey,
        },
      });
      for (const entry of [...input.items].sort((a, b) =>
        a.inventoryItemId.localeCompare(b.inventoryItemId),
      )) {
        await lockInventory(tx, storeId, entry.inventoryItemId);
        const item = await tx.inventoryItem.findFirst({
          where: { id: entry.inventoryItemId, storeId },
        });
        if (!item)
          throw new DomainError('No encontramos ese equipo en tu tienda.', 404);
        const pending = await tx.consignment.findFirst({
          where: { storeId, inventoryItemId: item.id, paidAt: null },
          select: { id: true },
        });
        const sale = item.imei
          ? await tx.sale.findFirst({
              where: {
                storeId,
                inventoryItemId: item.id,
                voidedAt: null,
                status: { notIn: ['CANCELADA', 'ANULADA'] },
              },
              select: { id: true },
            })
          : null;
        const quantity = entry.quantity ?? 1;
        assertTransferAvailable(item, quantity, !!pending, !!sale);
        const previous = item.imei
          ? await tx.inventoryItem.findUnique({
              where: {
                storeId_imei: { storeId: destination.id, imei: item.imei },
              },
            })
          : null;
        if (
          previous &&
          (!previous.archivedAt ||
            previous.reservedDepositId ||
            previous.status === 'EN_CONSIGNACION' ||
            previous.pendingSaleRegistration ||
            (await tx.consignment.findFirst({
              where: {
                storeId: destination.id,
                inventoryItemId: previous.id,
                paidAt: null,
              },
              select: { id: true },
            })))
        ) {
          throw new DomainError(
            'Ya hay un equipo con ese IMEI en la tienda destino.',
            409,
          );
        }
        if (previous) await lockInventory(tx, destination.id, previous.id);
        const fields =
          item.customFields &&
          typeof item.customFields === 'object' &&
          !Array.isArray(item.customFields)
            ? item.customFields
            : {};
        const customFields = Object.fromEntries(
          definitions
            .filter(
              (def) =>
                originDefinitions.some(
                  (origin) =>
                    origin.key === def.key && origin.type === def.type,
                ) && Object.hasOwn(fields, def.key),
            )
            .map((def) => [def.key, fields[def.key]]),
        ) as Prisma.InputJsonObject;
        const data = {
          model: item.model,
          capacity: item.capacity,
          color: item.color,
          condition: item.condition,
          grade: item.grade,
          batteryHealth: item.batteryHealth,
          batteryNote: item.batteryNote,
          cost: item.cost,
          price: item.price,
          currency:
            item.currency ??
            group.stores.find((store) => store.id === storeId)!.currency,
          kind: item.kind,
          accessoryType: item.accessoryType,
          compatibleWith: item.compatibleWith,
          imei: item.imei,
          cantidad: quantity,
          acquiredQuantity: 0,
          entryDate: new Date(),
          status: 'DISPONIBLE',
          customFields,
          archivedAt: null,
          archivedBy: null,
          archiveReason: null,
          categoryId: null,
          supplierId: null,
          stockPurchaseId: null,
          catalogVisible: false,
          pendingSaleRegistration: false,
          needsCompletion: false,
          sampleBatchId: null,
          ...clearReservation,
          previousSaleStatus: null,
          priceChangedAt: null,
          priceChangedBy: null,
          costChangedAt: null,
          costChangedBy: null,
        };
        const received = previous
          ? await tx.inventoryItem.update({ where: { id: previous.id }, data })
          : await tx.inventoryItem.create({
              data: { ...data, storeId: destination.id },
            });
        // Catalog list overrides on reactivated rows must not publish the transferred item.
        if (previous)
          await tx.catalogItemPrice.deleteMany({
            where: { inventoryItemId: previous.id },
          });
        const ownCatalogs = await tx.storeCatalog.findMany({
          where: { storeId: destination.id, itemVisibility: 'OWN' },
          select: { id: true },
        });
        if (ownCatalogs.length)
          await tx.catalogItemHidden.createMany({
            data: ownCatalogs.map((catalog) => ({
              catalogId: catalog.id,
              inventoryItemId: received.id,
            })),
            skipDuplicates: true,
          });
        const remaining = item.cantidad - quantity;
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            cantidad: remaining,
            ...(remaining === 0
              ? {
                  archivedAt: new Date(),
                  archivedBy: actor.name,
                  archiveReason: `Transferido a ${destination.name}`.slice(
                    0,
                    280,
                  ),
                  catalogVisible: false,
                }
              : {}),
          },
        });
        const label = [item.model, item.capacity, item.color, item.imei]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 200);
        await tx.stockTransferItem.create({
          data: {
            transferId: transfer.id,
            fromItemId: item.id,
            toItemId: received.id,
            quantity,
            label,
            cost: item.cost,
            currency: data.currency,
          },
        });
      }
      const result = await tx.stockTransfer.findUniqueOrThrow({
        where: { id: transfer.id },
        include: transferInclude,
      });
      for (const id of [storeId, destination.id])
        await writeAudit(tx, {
          storeId: id,
          actor,
          action: 'inventory.transferred',
          entityType: 'stock-transfer',
          entityId: transfer.id,
          detail: `Transferencia de stock a costo: ${group.stores.find((store) => store.id === storeId)!.name} → ${destination.name}. ${result.items.map((item) => `${item.label} × ${item.quantity}`).join('; ')}`,
        });
      return { transfer: serializeTransfer(result, group.stores) };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DomainError(
        'El stock cambió o el IMEI ya existe en destino. Revisá los equipos e intentá de nuevo.',
        409,
      );
    }
    throw error;
  }
}
