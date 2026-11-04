import { Prisma } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';
import { DomainError } from '../../lib/domain-error.js';
import { withSerializableRetry } from '../../lib/with-serializable-retry.js';
import { assertStoreReferences } from '../../lib/store-references.js';
import { storedStateFilter } from '../../lib/accounting-states.js';
import { formatArDate } from '../../lib/ar-date.js';
import { createSaleInTransaction } from '../sales/sales.service.js';
import { lockInventory } from '../deposits/deposits.service.js';
import type { Actor } from '../audit/audit.js';

export interface ConsignmentInput {
  clientId: string;
  items: { productId: string; amount: number; currency: 'ARS' | 'USD' }[];
}
const include = {
  client: true,
  inventoryItem: true,
} satisfies Prisma.ConsignmentInclude;
type Record = Prisma.ConsignmentGetPayload<{ include: typeof include }>;
function serialize(row: Record, now = new Date()) {
  if (
    row.client.storeId !== row.storeId ||
    row.inventoryItem.storeId !== row.storeId
  )
    throw new DomainError('Referencia de otra tienda', 409);
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.client.name,
    phone: row.client.phone,
    productId: row.inventoryItemId,
    deviceLabel: [row.inventoryItem.model, row.inventoryItem.capacity]
      .filter(Boolean)
      .join(' · '),
    imei: row.inventoryItem.imei,
    amount: Number(row.amount),
    currency: row.currency as 'ARS' | 'USD',
    cantidad: row.cantidad,
    deliveredAt: row.deliveredAt.toISOString(),
    daysOut: Math.max(
      0,
      Math.floor((now.getTime() - row.deliveredAt.getTime()) / 86_400_000),
    ),
    paidAt: row.paidAt?.toISOString() ?? null,
    saleId: row.saleId,
  };
}
export async function listConsignments(storeId: string) {
  const rows = await prisma.consignment.findMany({
    where: { storeId, paidAt: null },
    include,
    orderBy: [{ deliveredAt: 'asc' }, { id: 'asc' }],
  });
  const items = rows.map((row) => serialize(row));
  const debt = { ARS: new Prisma.Decimal(0), USD: new Prisma.Decimal(0) };
  for (const row of items)
    debt[row.currency] = debt[row.currency].add(
      new Prisma.Decimal(row.amount).mul(row.cantidad),
    );
  return {
    items,
    totals: {
      debt: { ARS: Number(debt.ARS), USD: Number(debt.USD) },
      equipment: items.reduce((sum, row) => sum + row.cantidad, 0),
      people: new Set(items.map((row) => row.clientId)).size,
      oldestDays: items[0]?.daysOut ?? 0,
      oldestClient: items[0]?.clientName ?? null,
    },
  };
}
export async function consignmentOptions(storeId: string) {
  const [clients, products] = await Promise.all([
    prisma.client.findMany({
      where: { storeId, archivedAt: null },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryItem.findMany({
      where: {
        storeId,
        kind: 'DEVICE',
        status: 'DISPONIBLE',
        archivedAt: null,
        reservedDepositId: null,
        cantidad: { gt: 0 },
        consignments: { none: { paidAt: null } },
      },
      select: {
        id: true,
        model: true,
        capacity: true,
        imei: true,
        price: true,
        currency: true,
        cantidad: true,
      },
      orderBy: { model: 'asc' },
    }),
  ]);
  return {
    clients,
    products: products.map((row) => ({
      ...row,
      price: row.price == null ? null : Number(row.price),
    })),
  };
}
export async function createConsignments(
  storeId: string,
  input: ConsignmentInput,
) {
  if (
    !input.items.length ||
    input.items.length > 100 ||
    new Set(input.items.map((row) => row.productId)).size !== input.items.length
  )
    throw new DomainError('Elegí entre 1 y 100 equipos sin repetir', 400);
  for (const row of input.items)
    if (
      !Number.isFinite(row.amount) ||
      row.amount <= 0 ||
      row.amount > 9999999999.99 ||
      !['ARS', 'USD'].includes(row.currency) ||
      new Prisma.Decimal(row.amount).decimalPlaces() > 2
    )
      throw new DomainError(
        'Indicá un precio positivo con hasta dos decimales y su moneda',
        400,
      );
  return withSerializableRetry(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: input.clientId, storeId, archivedAt: null },
    });
    if (!client) throw new DomainError('No encontramos ese cliente', 404);
    const result = [];
    for (const entry of [...input.items].sort((a, b) =>
      a.productId.localeCompare(b.productId),
    )) {
      await lockInventory(tx, storeId, entry.productId);
      const item = await tx.inventoryItem.findFirst({
        where: { id: entry.productId, storeId, archivedAt: null },
      });
      if (!item) throw new DomainError('No encontramos ese equipo', 404);
      await assertStoreReferences(tx, storeId, 'InventoryItem', item);
      const pending = await tx.consignment.findFirst({
        where: { storeId, inventoryItemId: item.id, paidAt: null },
      });
      const sale = await tx.sale.findFirst({
        where: {
          storeId,
          inventoryItemId: item.id,
          voidedAt: null,
          status: await storedStateFilter(
            tx,
            'Sale',
            storeId,
            ['CANCELADA', 'ANULADA'],
            true,
          ),
        },
        select: { id: true },
      });
      // Rows with remaining units can have past sales; current stock is authoritative.
      if (
        item.kind !== 'DEVICE' ||
        item.status !== 'DISPONIBLE' ||
        item.reservedDepositId ||
        item.cantidad < 1 ||
        pending ||
        (item.imei && sale)
      )
        throw new DomainError(
          'El equipo está vendido, reservado o ya está en consignación',
          409,
        );
      if (
        new Prisma.Decimal(entry.amount).mul(item.cantidad).gt('9999999999.99')
      )
        throw new DomainError(
          'El importe total supera el máximo permitido',
          400,
        );
      const row = await tx.consignment.create({
        data: {
          storeId,
          clientId: client.id,
          inventoryItemId: item.id,
          amount: entry.amount,
          currency: entry.currency,
          cantidad: item.cantidad,
        },
        include,
      });
      await tx.inventoryItem.update({
        where: { id: item.id, storeId },
        data: { status: 'EN_CONSIGNACION' },
      });
      result.push(serialize(row));
    }
    return result;
  });
}
export async function payConsignment(
  storeId: string,
  id: string,
  paymentMethod: string,
  actor?: Actor,
) {
  if (!['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'].includes(paymentMethod))
    throw new DomainError('Elegí cómo se cobró la consignación', 400);
  return withSerializableRetry(async (tx) => {
    // Lock inventory first, matching sales/deposits and batch creation lock order.
    const found = await tx.consignment.findFirst({ where: { id, storeId } });
    if (!found) throw new DomainError('No encontramos esa consignación', 404);
    await lockInventory(tx, storeId, found.inventoryItemId);
    const row = await tx.consignment.findFirstOrThrow({
      where: { id, storeId },
      include,
    });
    serialize(row); // Validate all included store references before using them.
    if (row.paidAt || row.saleId)
      throw new DomainError('Esta consignación ya está pagada', 409);
    const item = row.inventoryItem;
    if (
      item.status !== 'EN_CONSIGNACION' ||
      item.archivedAt ||
      item.reservedDepositId ||
      item.cantidad !== row.cantidad
    )
      throw new DomainError(
        'El equipo ya no está disponible para cerrar esta consignación',
        409,
      );
    const store = await tx.store.findUnique({
      where: { id: storeId },
      select: { exchangeMode: true, manualSell: true },
    });
    const exchangeRate =
      store?.exchangeMode === 'manual' && store.manualSell
        ? Number(store.manualSell)
        : undefined;
    const paidAt = new Date();
    await tx.inventoryItem.update({
      where: { id: item.id, storeId },
      data: { status: 'DISPONIBLE' },
    });
    const sale = await createSaleInTransaction(
      tx,
      storeId,
      {
        date: formatArDate(paidAt),
        exchangeRate,
        clientId: row.clientId,
        productId: item.id,
        deviceLabel: [item.model, item.capacity].filter(Boolean).join(' · '),
        cantidad: row.cantidad,
        amount: Number(row.amount.mul(row.cantidad)),
        amountCurrency: row.currency,
        paymentMethod,
        status: 'COMPLETADA',
      },
      actor,
    );
    const closed = await tx.consignment.update({
      where: { id, storeId },
      data: { paidAt, saleId: sale.id },
      include,
    });
    return { consignment: serialize(closed), sale };
  });
}
