import { beforeEach, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
const { db, createSale } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    store: { findUnique: vi.fn() },
    client: { findFirst: vi.fn() },
    inventoryItem: { findFirst: vi.fn(), update: vi.fn() },
    consignment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    sale: { findFirst: vi.fn() },
  },
  createSale: vi.fn(),
}));
vi.mock('../../plugins/prisma.js', () => ({ prisma: db }));
vi.mock('../sales/sales.service.js', () => ({
  createSaleInTransaction: createSale,
}));
vi.mock('../deposits/deposits.service.js', () => ({ lockInventory: vi.fn() }));
vi.mock('../../lib/store-references.js', () => ({
  assertStoreReferences: vi.fn(),
}));
vi.mock('../../lib/accounting-states.js', () => ({
  storedStateFilter: vi.fn(async () => ({ notIn: ['CANCELADA', 'ANULADA'] })),
}));
import {
  createConsignments,
  listConsignments,
  payConsignment,
} from './consignments.service.js';
const item = {
  id: 'device',
  storeId: 'store',
  kind: 'DEVICE',
  model: 'iPhone 15',
  capacity: '128 GB',
  imei: '123456789012345',
  status: 'DISPONIBLE',
  cantidad: 1,
  archivedAt: null,
  reservedDepositId: null,
};
const client = {
  id: 'client',
  storeId: 'store',
  name: 'Diego Paz',
  phone: '1155550101',
};
const row = {
  id: 'entry',
  storeId: 'store',
  clientId: 'client',
  inventoryItemId: 'device',
  amount: new Prisma.Decimal(950000),
  currency: 'ARS',
  cantidad: 1,
  deliveredAt: new Date(Date.now() - 23 * 86400000),
  paidAt: null,
  saleId: null,
  client,
  inventoryItem: { ...item, status: 'EN_CONSIGNACION' },
};
const input = {
  clientId: client.id,
  items: [{ productId: item.id, amount: 950000, currency: 'ARS' as const }],
};
beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (callback) => callback(db));
  db.client.findFirst.mockResolvedValue(client);
  db.inventoryItem.findFirst.mockResolvedValue(item);
  db.sale.findFirst.mockResolvedValue(null);
  db.consignment.findFirst.mockResolvedValue(null);
  db.consignment.create.mockResolvedValue(row);
  db.consignment.findFirstOrThrow.mockResolvedValue(row);
});
it('crea y conserva stock, con precio acordado y scope', async () => {
  expect(await createConsignments('store', input)).toMatchObject([
    { id: 'entry', amount: 950000 },
  ]);
  expect(db.consignment.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        storeId: 'store',
        clientId: 'client',
        inventoryItemId: 'device',
        amount: 950000,
      }),
    }),
  );
  expect(db.inventoryItem.update).toHaveBeenCalledWith({
    where: { id: 'device', storeId: 'store' },
    data: { status: 'EN_CONSIGNACION' },
  });
});
it.each(['VENDIDO', 'RESERVADO', 'EN_CONSIGNACION'])(
  'rechaza equipo %s',
  async (status) => {
    db.inventoryItem.findFirst.mockResolvedValue({ ...item, status });
    await expect(createConsignments('store', input)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.consignment.create).not.toHaveBeenCalled();
  },
);
it('rechaza otra consignación pendiente aunque el marcador se haya alterado', async () => {
  db.consignment.findFirst.mockResolvedValue(row);
  await expect(createConsignments('store', input)).rejects.toMatchObject({
    statusCode: 409,
  });
});
it('rechaza equipo de otra tienda y cliente inexistente', async () => {
  db.inventoryItem.findFirst.mockResolvedValue(null);
  await expect(createConsignments('store', input)).rejects.toMatchObject({
    statusCode: 404,
  });
  db.client.findFirst.mockResolvedValue(null);
  await expect(createConsignments('store', input)).rejects.toMatchObject({
    statusCode: 404,
  });
});
it('valida precio monetario y duplicados', async () => {
  await expect(
    createConsignments('store', {
      ...input,
      items: [...input.items, ...input.items],
    }),
  ).rejects.toMatchObject({ statusCode: 400 });
  for (const amount of [0, -1, NaN, Infinity, 1.001])
    await expect(
      createConsignments('store', {
        ...input,
        items: [{ ...input.items[0], amount }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
});
it('lista con totales por moneda, unidades, personas y antigüedad', async () => {
  db.consignment.findMany.mockResolvedValue([
    row,
    {
      ...row,
      id: 'entry2',
      currency: 'USD',
      cantidad: 2,
      amount: new Prisma.Decimal(500),
    },
  ]);
  const result = await listConsignments('store');
  expect(result.totals).toEqual({
    debt: { ARS: 950000, USD: 1000 },
    equipment: 3,
    people: 1,
    oldestDays: 23,
    oldestClient: 'Diego Paz',
  });
  expect(db.consignment.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { storeId: 'store', paidAt: null } }),
  );
});
it('cobra mediante sales.service en la misma transacción y cierra', async () => {
  db.consignment.findFirst.mockResolvedValue(row);
  createSale.mockResolvedValue({ id: 'sale' });
  db.consignment.update.mockResolvedValue({
    ...row,
    paidAt: new Date(),
    saleId: 'sale',
  });
  expect(await payConsignment('store', 'entry', 'EFECTIVO')).toMatchObject({
    consignment: { saleId: 'sale' },
    sale: { id: 'sale' },
  });
  expect(createSale).toHaveBeenCalledWith(
    db,
    'store',
    expect.objectContaining({
      productId: 'device',
      clientId: 'client',
      amount: 950000,
      status: 'COMPLETADA',
      paymentMethod: 'EFECTIVO',
    }),
    undefined,
  );
});
it('propaga falla de venta y no cierra', async () => {
  db.consignment.findFirst.mockResolvedValue(row);
  createSale.mockRejectedValue(new Error('Caja cerrada'));
  await expect(payConsignment('store', 'entry', 'EFECTIVO')).rejects.toThrow(
    'Caja cerrada',
  );
  expect(db.consignment.update).not.toHaveBeenCalled();
});
it('rechaza cobro repetido y pago de otra tienda', async () => {
  db.consignment.findFirst.mockResolvedValue(row);
  db.consignment.findFirstOrThrow.mockResolvedValue({
    ...row,
    paidAt: new Date(),
    saleId: 'sale',
  });
  await expect(
    payConsignment('store', 'entry', 'EFECTIVO'),
  ).rejects.toMatchObject({ statusCode: 409 });
  db.consignment.findFirst.mockResolvedValue(null);
  await expect(
    payConsignment('other', 'entry', 'EFECTIVO'),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(createSale).not.toHaveBeenCalled();
});
