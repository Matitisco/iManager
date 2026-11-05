import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import {
  seedStoreContext,
  seedCatalogFixture,
  buildAuthHeaders,
} from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import { getNetProfit } from '../modules/reports/net-profit.service.js';
import { getStoreGroupBalance } from '../modules/store-groups/service.js';
import {
  billingStoreId,
  getBillingSummary,
  assertBillingWrite,
} from '../modules/billing/service.js';
import { billingSummary } from '../modules/billing/domain.js';
import * as blue from '../lib/blue-rate.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
const enable = (
  h = headers,
  currentKind: 'WHOLESALE' | 'RETAIL' = 'WHOLESALE',
) =>
  getApp().inject({
    method: 'POST',
    url: '/api/store-group/enable',
    headers: h,
    payload: { currentKind, otherStoreName: 'Minorista ficticia' },
  });
const get = (path: string, h = headers) =>
  getApp().inject({ url: path, headers: h });
async function setup() {
  const context = await seedStoreContext();
  const response = await enable();
  expect(response.statusCode, response.body).toBe(200);
  const stores = response.json().session.stores as {
    id: string;
    kind: string;
    groupId: string;
  }[];
  return {
    ...context,
    from: context.store!.id,
    to: stores.find((store) => store.id !== context.store!.id)!.id,
    groupId: stores[0].groupId,
  };
}
async function equipment(
  storeId: string,
  patch: Partial<Prisma.InventoryItemUncheckedCreateInput> = {},
) {
  return prisma.inventoryItem.create({
    data: {
      storeId,
      model: 'Equipo ficticio',
      capacity: '128GB',
      color: 'Negro',
      condition: 'USADO',
      grade: 'A',
      batteryHealth: '90%',
      cost: 60,
      price: 100,
      currency: 'ARS',
      status: 'DISPONIBLE',
      ...patch,
    },
  });
}
const send = (
  toStoreId: string,
  inventoryItemId: string,
  options: { quantity?: number; requestKey?: string; h?: typeof headers } = {},
) =>
  getApp().inject({
    method: 'POST',
    url: '/api/store-group/transfers',
    headers: options.h ?? headers,
    payload: {
      toStoreId,
      items: [
        {
          inventoryItemId,
          ...(options.quantity ? { quantity: options.quantity } : {}),
        },
      ],
      ...(options.requestKey ? { requestKey: options.requestKey } : {}),
    },
  });
async function activate(storeId: string) {
  const res = await getApp().inject({
    method: 'POST',
    url: '/api/stores/active',
    headers,
    payload: { storeId },
  });
  expect(res.statusCode, res.body).toBe(200);
}
async function otherMember(
  storeId: string,
  role: 'OWNER' | 'STAFF' | 'MANAGER' = 'STAFF',
) {
  const uid = `ficticio-${role}`;
  const { user } = await seedStoreContext({
    firebaseUid: uid,
    email: `${uid}@example.com`,
    createStore: false,
  });
  await prisma.storeMember.create({
    data: { storeId, userId: user.id, role, isDefault: true },
  });
  return { user, h: buildAuthHeaders({ uid, email: `${uid}@example.com` }) };
}

describe('multitienda: alta, sesión y aislamiento', () => {
  it('crea y activa la nueva tienda con contacto propio sin modificar el de la actual', async () => {
    const { store } = await seedStoreContext();
    await prisma.store.update({ where: { id: store!.id }, data: { instagram: 'central.ficticia' } });
    const res = await getApp().inject({
      method: 'POST', url: '/api/store-group/enable', headers,
      payload: {
        currentKind: 'RETAIL', otherStoreName: ' Sucursal Norte ficticia ',
        otherAddress: ' Calle Ficticia 123 ',
        otherInstagram: ' https://www.instagram.com/sucursal.ficticia/?hl=es ',
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    const other = res.json().session.stores.find((row: { id: string }) => row.id !== store!.id);
    expect(other).toMatchObject({ name: 'Sucursal Norte ficticia', kind: 'WHOLESALE' });
    await activate(other.id);
    expect((await get('/api/me')).json().store).toMatchObject({
      id: other.id, name: 'Sucursal Norte ficticia', address: 'Calle Ficticia 123', instagram: 'sucursal.ficticia',
    });
    expect(await prisma.store.findUniqueOrThrow({ where: { id: store!.id } })).toMatchObject({
      address: store!.address, instagram: 'central.ficticia', groupKind: 'RETAIL',
    });
  });
  it.each([{}, { otherAddress: '   ', otherInstagram: '   ' }])('permite contacto omitido o vacío: %j', async contact => {
    const { store } = await seedStoreContext();
    const res = await getApp().inject({
      method: 'POST', url: '/api/store-group/enable', headers,
      payload: { currentKind: 'WHOLESALE', otherStoreName: 'Sucursal Norte ficticia', ...contact },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(await prisma.store.findFirstOrThrow({ where: { id: { not: store!.id } } })).toMatchObject({ address: null, instagram: null });
  });
  it.each(['mi tienda', '@', 'https://example.test/ficticia'])('Instagram inválido %s no crea grupo ni tienda', async otherInstagram => {
    const { store } = await seedStoreContext();
    const res = await getApp().inject({
      method: 'POST', url: '/api/store-group/enable', headers,
      payload: { currentKind: 'WHOLESALE', otherStoreName: 'Sucursal Norte ficticia', otherInstagram },
    });
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().error).toMatch(/Instagram|perfil/);
    expect(await prisma.storeGroup.count()).toBe(0);
    expect(await prisma.store.count()).toBe(1);
    expect(await prisma.auditEvent.count({ where: { action: 'store-group.enabled' } })).toBe(0);
    expect(await prisma.store.findUniqueOrThrow({ where: { id: store!.id } })).toMatchObject({ groupId: null, groupKind: null });
  });
  it('crea otra tienda OWNER, copia configuración, conserva la activa y audita ambas', async () => {
    const { store, user } = await seedStoreContext();
    const settings = {
      currency: 'USD',
      exchangeMode: 'manual',
      exchangeSource: 'mep',
      manualBuy: 1100,
      manualSell: 1200,
      timezone: 'America/New_York',
      usedWarrantyDays: 45,
      sealedWarrantyDays: 100,
      repairWarrantyDays: 60,
    };
    await prisma.store.update({ where: { id: store!.id }, data: settings });
    const res = await enable();
    expect(res.statusCode, res.body).toBe(200);
    const session = res.json().session;
    expect(session.store.id).toBe(store!.id);
    expect(session.stores).toHaveLength(2);
    expect(session.stores.map((s: { kind: string }) => s.kind).sort()).toEqual([
      'RETAIL',
      'WHOLESALE',
    ]);
    const other = session.stores.find(
      (s: { id: string }) => s.id !== store!.id,
    );
    const row = await prisma.store.findUniqueOrThrow({
      where: { id: other.id },
    });
    expect({
      ...row,
      manualBuy: Number(row.manualBuy),
      manualSell: Number(row.manualSell),
    }).toMatchObject(settings);
    expect(row.trialEndsAt).toBeNull();
    expect(
      await prisma.storeMember.findUniqueOrThrow({
        where: { storeId_userId: { storeId: other.id, userId: user.id } },
      }),
    ).toMatchObject({ role: 'OWNER', isDefault: false });
    expect((await get('/api/me')).json().stores).toEqual(session.stores);
    expect((await get('/api/store-group')).json().group.stores).toHaveLength(2);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'store-group.enabled' },
      }),
    ).toBe(2);
    const twice = await enable();
    expect(twice.statusCode).toBe(409);
    expect(await prisma.storeGroup.count()).toBe(1);
  });
  it('doble clic crea exactamente un grupo y una tienda secundaria', async () => {
    await seedStoreContext();
    const replies = await Promise.all([enable(), enable()]);
    expect(replies.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await prisma.store.count()).toBe(2);
  });
  it.each(['STAFF', 'MANAGER'] as const)(
    'solo OWNER puede activar (%s)',
    async (role) => {
      await seedStoreContext({ role });
      expect((await enable()).statusCode).toBe(403);
      expect(await prisma.storeGroup.count()).toBe(0);
    },
  );
  it('tienda suelta conserva sesión y facturación, sin modificar sus filas', async () => {
    const { store } = await seedStoreContext();
    const before = await prisma.store.findUniqueOrThrow({
      where: { id: store!.id },
    });
    expect((await get('/api/store-group')).json()).toEqual({ group: null });
    expect((await get('/api/me')).json().stores).toEqual([
      {
        id: store!.id,
        name: store!.name,
        role: 'OWNER',
        isDefault: true,
        kind: null,
        groupId: null,
      },
    ]);
    expect(await billingStoreId(store!.id)).toBe(store!.id);
    expect(await getBillingSummary(store!.id)).toEqual(
      billingSummary(before, 1),
    );
    await expect(assertBillingWrite(store!.id)).resolves.toBeUndefined();
    expect(
      await prisma.store.findUniqueOrThrow({ where: { id: store!.id } }),
    ).toEqual(before);
  });
  it('empleado solo ve su tienda y no puede activar ni leer datos de la otra', async () => {
    const { from, to } = await setup();
    const staff = await otherMember(from);
    const group = (await get('/api/store-group', staff.h)).json().group;
    expect(group.stores.map((s: { id: string }) => s.id)).toEqual([from]);
    expect(
      (await get('/api/me', staff.h))
        .json()
        .stores.map((s: { id: string }) => s.id),
    ).toEqual([from]);
    const res = await getApp().inject({
      method: 'POST',
      url: '/api/stores/active',
      headers: staff.h,
      payload: { storeId: to },
    });
    expect(res.statusCode).toBe(404);
    expect((await get('/api/store-group/balance', staff.h)).statusCode).toBe(
      403,
    );
    expect((await get('/api/store-group/transfers', staff.h)).statusCode).toBe(
      403,
    );
    expect(
      (await get(`/api/store-group/balance?months=6&storeId=${to}`, staff.h))
        .statusCode,
    ).toBe(400);
  });
  it('secundaria sigue el plan y bloqueo de primaria, sin trial independiente', async () => {
    const { from, to } = await setup();
    await prisma.store.update({
      where: { id: from },
      data: {
        billingPlan: 'TRIAL',
        billingStatus: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 86400000),
      },
    });
    expect(await billingStoreId(to)).toBe(from);
    expect(await getBillingSummary(to)).toEqual(await getBillingSummary(from));
    await activate(to);
    expect((await get('/api/me')).json().billing).toEqual(
      await getBillingSummary(from),
    );
    expect((await get('/api/billing')).json()).toMatchObject({
      plan: 'TRIAL',
      readOnly: false,
    });
    await prisma.store.update({
      where: { id: from },
      data: { trialEndsAt: new Date(0) },
    });
    await expect(assertBillingWrite(to)).rejects.toMatchObject({
      statusCode: 402,
    });
    expect((await get('/api/me')).json().billing.readOnly).toBe(true);
    const blocked = await getApp().inject({
      method: 'POST',
      url: '/api/clients',
      headers,
      payload: { name: 'Ficticio' },
    });
    expect(blocked.statusCode).toBe(402);
    expect(
      (await prisma.store.findUniqueOrThrow({ where: { id: to } })).trialEndsAt,
    ).toBeNull();
  });
});

describe('balance multitienda', () => {
  it('coincide mes a mes con getNetProfit: ventas, cantidades, gastos, devolución y accesorios', async () => {
    const { from, to, user } = await setup();
    const now = new Date('2026-11-04T15:00:00Z');
    for (const storeId of [from, to]) {
      await prisma.store.update({
        where: { id: storeId },
        data: { exchangeMode: 'manual', manualSell: 1000 },
      });
      const fixture = await seedCatalogFixture(storeId);
      await prisma.inventoryItem.update({
        where: { id: fixture.inventoryItem.id },
        data: { cost: 60, currency: 'ARS' },
      });
      const sale = await prisma.sale.create({
        data: {
          storeId,
          inventoryItemId: fixture.inventoryItem.id,
          clientId: fixture.client.id,
          amount: storeId === from ? 300 : 400,
          amountCurrency: 'ARS',
          cantidad: 2,
          dateLabel: '10/10/2026',
          soldAt: new Date('2026-10-10T15:00:00Z'),
          status: 'COMPLETADA',
          paymentMethod: 'EFECTIVO',
        },
      });
      await prisma.expense.create({
        data: {
          storeId,
          category: 'Alquiler',
          amount: 10,
          currency: 'USD',
          spentAt: new Date('2026-11-01T02:30:00Z'),
        },
      });
      await prisma.expense.create({
        data: {
          storeId,
          category: 'Borrado',
          amount: 5000,
          currency: 'ARS',
          spentAt: new Date('2026-10-10T12:00:00Z'),
          deletedAt: new Date(),
        },
      });
      await prisma.returnCase.create({
        data: {
          storeId,
          caseNumber: 1,
          saleId: sale.id,
          reason: 'Ficticia',
          openedAt: new Date('2026-10-15T12:00:00Z'),
          resolvedAt: new Date('2026-10-20T12:00:00Z'),
          status: 'RESUELTO',
          resolution: 'REINTEGRO',
          settlement: 'REINTEGRO',
          moneyAmount: Number(sale.amount) / 2,
          moneyCurrency: 'ARS',
        },
      });
      const accessory = await equipment(storeId, { kind: 'ACCESSORY' });
      await prisma.sale.create({
        data: {
          storeId,
          inventoryItemId: accessory.id,
          amount: 99999,
          amountCurrency: 'ARS',
          dateLabel: '10/10/2026',
          soldAt: new Date('2026-10-10T15:00:00Z'),
          status: 'COMPLETADA',
          paymentMethod: 'EFECTIVO',
        },
      });
      await prisma.sale.create({
        data: {
          storeId,
          amount: 99999,
          dateLabel: '10/10/2026',
          soldAt: now,
          status: 'CANCELADA',
          paymentMethod: 'EFECTIVO',
        },
      });
    }
    const balance = await getStoreGroupBalance(from, user.id, 3, now);
    expect(balance.months).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(balance.combined!.totals).toEqual({
      revenue: 350,
      cost: 120,
      grossProfit: 230,
      expenses: 20000,
      netProfit: -19770,
    });
    for (const store of balance.stores)
      for (const monthly of store.monthly) {
        const toDay =
          monthly.month === '2026-11'
            ? '2026-11-04'
            : `${monthly.month}-${monthly.month === '2026-09' ? '30' : '31'}`;
        const net = await getNetProfit(
          store.storeId,
          `${monthly.month}-01`,
          toDay,
        );
        expect(monthly).toMatchObject({
          revenue: net.revenue,
          cost: net.cost,
          expenses: net.expenses,
          netProfit: net.netProfit,
          grossProfit: net.grossProfit,
        });
      }
    expect(balance.stores.find((s) => s.storeId === from)!.totals.revenue).toBe(
      150,
    );
    expect(balance.stores.find((s) => s.storeId === to)!.totals.revenue).toBe(
      200,
    );
  });
  it('resuelve una sola cotización compartida para todos los meses', async () => {
    const { from, user } = await setup();
    const spy = vi.spyOn(blue, 'currentBlueRate');
    const result = await getStoreGroupBalance(from, user.id, 12);
    expect(result.months).toHaveLength(12);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
  it('monedas mixtas devuelve cifras separadas y combined null', async () => {
    const { to } = await setup();
    await prisma.store.update({ where: { id: to }, data: { currency: 'USD' } });
    const res = await get('/api/store-group/balance?months=3');
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({
      currency: 'ARS',
      mixedCurrency: true,
      combined: null,
    });
  });
  it('dueño de solo una tienda del grupo recibe 403', async () => {
    const { from } = await setup();
    const outsider = await otherMember(from, 'OWNER');
    expect((await get('/api/store-group/balance', outsider.h)).statusCode).toBe(
      403,
    );
    expect(
      (await get('/api/store-group/transfers', outsider.h)).statusCode,
    ).toBe(403);
  });
});

describe('transferencias de stock', () => {
  it('transfiere un equipo a costo, sin venta/ganancia, audita ambas y bloquea restaurar', async () => {
    const { from, to } = await setup();
    const original = await equipment(from, {
      imei: '123456789012345',
      currency: null,
      catalogVisible: true,
    });
    const res = await send(to, original.id);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().transfer).toMatchObject({
      from: { id: from },
      to: { id: to },
      items: [{ quantity: 1 }],
    });
    const origin = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(origin).toMatchObject({
      cantidad: 0,
      archiveReason: 'Transferido a Minorista ficticia',
    });
    expect(origin.archivedAt).not.toBeNull();
    const received = await prisma.inventoryItem.findFirstOrThrow({
      where: { storeId: to },
    });
    expect(received).toMatchObject({
      imei: original.imei,
      cantidad: 1,
      catalogVisible: false,
      supplierId: null,
      categoryId: null,
      acquiredQuantity: 0,
      currency: 'ARS',
    });
    expect(Number(received.cost)).toBe(60);
    expect(Number(received.price)).toBe(100);
    expect(await prisma.sale.count()).toBe(0);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'inventory.transferred', storeId: { in: [from, to] } },
      }),
    ).toBe(2);
    expect(
      (await get('/api/store-group/transfers')).json().transfers[0].id,
    ).toBe(res.json().transfer.id);
    const restore = await getApp().inject({
      method: 'POST',
      url: `/api/inventory/${original.id}/restore`,
      headers,
    });
    expect(restore.statusCode, restore.body).toBe(409);
    expect(restore.json().error).toContain('transferido');
    expect(
      (await get('/api/inventory')).json().items ??
        (await get('/api/inventory')).json().inventory,
    ).toBeDefined();
  });
  it('transfiere parcialmente accesorios, conserva stock origen y omite custom fields sin definición', async () => {
    const { from, to } = await setup();
    await prisma.customFieldDefinition.createMany({
      data: [
        { storeId: from, key: 'nota', label: 'Nota', type: 'text' },
        { storeId: to, key: 'nota', label: 'Nota', type: 'text' },
        { storeId: from, key: 'otra', label: 'Otra', type: 'text' },
      ],
    });
    const item = await equipment(from, {
      kind: 'ACCESSORY',
      accessoryType: 'Cargador',
      compatibleWith: 'USB C',
      cantidad: 10,
      customFields: { nota: 'Ficticia', otra: 'Privada' },
    });
    const res = await send(to, item.id, { quantity: 3 });
    expect(res.statusCode, res.body).toBe(200);
    expect(
      await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).toMatchObject({ cantidad: 7, archivedAt: null });
    expect(
      await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: to } }),
    ).toMatchObject({
      cantidad: 3,
      kind: 'ACCESSORY',
      accessoryType: 'Cargador',
      compatibleWith: 'USB C',
      customFields: { nota: 'Ficticia' },
    });
  });
  it.each([
    { status: 'VENDIDO' },
    { status: 'RESERVADO' },
    { status: 'EN_CONSIGNACION' },
    { archivedAt: new Date() },
    { reservedDepositId: 'ficticia' },
    { pendingSaleRegistration: true },
    { cantidad: 0 },
  ])('rechaza no disponible %j sin efectos', async (patch) => {
    const { from, to } = await setup();
    const item = await equipment(from, patch);
    const res = await send(to, item.id);
    expect(res.statusCode, res.body).toBe(409);
    expect(await prisma.stockTransfer.count()).toBe(0);
    expect(await prisma.inventoryItem.count({ where: { storeId: to } })).toBe(
      0,
    );
  });
  it('rechaza consignación pendiente incluso si el estado quedó disponible', async () => {
    const { from, to } = await setup();
    const fixture = await seedCatalogFixture(from);
    await prisma.consignment.create({
      data: {
        storeId: from,
        clientId: fixture.client.id,
        inventoryItemId: fixture.inventoryItem.id,
        amount: 100,
        currency: 'ARS',
      },
    });
    expect((await send(to, fixture.inventoryItem.id)).statusCode).toBe(409);
  });
  it('rechaza un IMEI con venta activa aunque su estado diga disponible', async () => {
    const { from, to } = await setup();
    const item = await equipment(from, { imei: '123456789012345' });
    await prisma.sale.create({
      data: {
        storeId: from,
        inventoryItemId: item.id,
        amount: 100,
        dateLabel: '04/11/2026',
        soldAt: new Date(),
        status: 'COMPLETADA',
        paymentMethod: 'EFECTIVO',
      },
    });
    expect((await send(to, item.id)).statusCode).toBe(409);
  });
  it('IDOR: destino externo, ítem ajeno y empleado no obtienen acceso cruzado', async () => {
    const { from, to } = await setup();
    const outsider = await seedStoreContext({
      firebaseUid: 'externo',
      email: 'externo@example.com',
    });
    const item = await equipment(from);
    const alien = await equipment(outsider.store!.id);
    expect((await send(outsider.store!.id, item.id)).statusCode).toBe(400);
    expect((await send(to, alien.id)).statusCode).toBe(404);
    expect((await send(from, item.id)).statusCode).toBe(400);
    const staff = await otherMember(from);
    expect((await send(to, item.id, { h: staff.h })).statusCode).toBe(403);
    expect(await prisma.stockTransfer.count()).toBe(0);
    expect((await get('/api/inventory', staff.h)).body).not.toContain(alien.id);
  });
  it('idempotencia requestKey incluso simultánea no duplica unidades ni auditorías', async () => {
    const { from, to } = await setup();
    const item = await equipment(from, { cantidad: 5 });
    const results = await Promise.all([
      send(to, item.id, { quantity: 2, requestKey: 'ficticia' }),
      send(to, item.id, { quantity: 2, requestKey: 'ficticia' }),
    ]);
    for (const res of results) expect(res.statusCode, res.body).toBe(200);
    expect(results[0].json()).toEqual(results[1].json());
    expect(await prisma.stockTransfer.count()).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'inventory.transferred' },
      }),
    ).toBe(2);
    expect(
      (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }))
        .cantidad,
    ).toBe(3);
  });
  it('IMEI al volver reactiva la fila archivada original sin duplicar stock', async () => {
    const { from, to } = await setup();
    const original = await equipment(from, { imei: '123456789012345' });
    expect((await send(to, original.id)).statusCode).toBe(200);
    const received = await prisma.inventoryItem.findFirstOrThrow({
      where: { storeId: to },
    });
    await activate(to);
    const back = await send(from, received.id);
    expect(back.statusCode, back.body).toBe(200);
    expect(
      await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: original.id },
      }),
    ).toMatchObject({ cantidad: 1, archivedAt: null, archiveReason: null });
    expect(await prisma.inventoryItem.count()).toBe(2);
    expect(
      (
        await prisma.inventoryItem.findUniqueOrThrow({
          where: { id: received.id },
        })
      ).cantidad,
    ).toBe(0);
  });
  it('stock, gastos y clientes quedan aislados al cambiar la tienda activa', async () => {
    const { from, to } = await setup();
    const fixture = await seedCatalogFixture(from);
    await prisma.expense.create({
      data: {
        storeId: from,
        category: 'Solo origen',
        amount: 100,
        currency: 'ARS',
        spentAt: new Date(),
      },
    });
    await activate(to);
    expect((await get('/api/inventory')).body).not.toContain(
      fixture.inventoryItem.id,
    );
    expect((await get('/api/clients')).body).not.toContain(fixture.client.id);
    expect((await get('/api/expenses')).body).not.toContain('Solo origen');
  });
});

describe('atomicidad y resguardos adicionales multitienda', () => {
  it('dos transferencias compiten por las mismas unidades sin stock negativo', async () => {
    const { from, to } = await setup();
    const item = await equipment(from, { cantidad: 3 });
    const results = await Promise.all([
      send(to, item.id, { quantity: 2, requestKey: 'una' }),
      send(to, item.id, { quantity: 2, requestKey: 'otra' }),
    ]);
    expect(results.map((res) => res.statusCode).sort()).toEqual([200, 409]);
    expect(
      (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }))
        .cantidad,
    ).toBe(1);
    expect(await prisma.stockTransfer.count()).toBe(1);
  });
  it('un ítem inválido revierte todos los movimientos y auditorías del lote', async () => {
    const { from, to } = await setup();
    const first = await equipment(from, { id: 'ficticio-a' });
    const last = await equipment(from, {
      id: 'ficticio-z',
      reservedDepositId: 'ficticio-deposit',
    });
    const res = await getApp().inject({
      method: 'POST',
      url: '/api/store-group/transfers',
      headers,
      payload: {
        toStoreId: to,
        items: [{ inventoryItemId: first.id }, { inventoryItemId: last.id }],
      },
    });
    expect(res.statusCode).toBe(409);
    expect(await prisma.stockTransfer.count()).toBe(0);
    expect(await prisma.stockTransferItem.count()).toBe(0);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'inventory.transferred' },
      }),
    ).toBe(0);
    expect(
      await prisma.inventoryItem.findUniqueOrThrow({ where: { id: first.id } }),
    ).toMatchObject({ cantidad: 1, archivedAt: null });
    expect(await prisma.inventoryItem.count({ where: { storeId: to } })).toBe(
      0,
    );
  });
  it('IMEI activo en destino se rechaza sin descontar origen', async () => {
    const { from, to } = await setup();
    const item = await equipment(from, { imei: '123456789012345' });
    await equipment(to, { imei: item.imei });
    const res = await send(to, item.id);
    expect(res.statusCode).toBe(409);
    expect(
      await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).toMatchObject({ cantidad: 1, archivedAt: null });
  });
  it('un propietario de una sola tienda no puede transferir al par', async () => {
    const { from, to } = await setup();
    const partial = await otherMember(from, 'OWNER');
    const item = await equipment(from);
    expect((await send(to, item.id, { h: partial.h })).statusCode).toBe(403);
  });
  it('tienda minorista original puede activar una mayorista secundaria', async () => {
    const { store } = await seedStoreContext();
    const res = await enable(headers, 'RETAIL');
    expect(res.statusCode).toBe(200);
    expect(
      res.json().session.stores.find((s: { id: string }) => s.id === store!.id)
        .kind,
    ).toBe('RETAIL');
    const group = await prisma.storeGroup.findFirstOrThrow();
    expect(group.primaryStoreId).toBe(store!.id);
  });
  it('balance sin cotización requerida falla visible; no muestra totales parciales', async () => {
    const { from } = await setup();
    await prisma.store.update({
      where: { id: from },
      data: { exchangeMode: 'manual', manualSell: null },
    });
    const item = await equipment(from);
    await prisma.sale.create({
      data: {
        storeId: from,
        inventoryItemId: item.id,
        amount: 100,
        amountCurrency: 'USD',
        dateLabel: '',
        soldAt: new Date(),
        status: 'COMPLETADA',
        paymentMethod: 'EFECTIVO',
      },
    });
    const res = await get('/api/store-group/balance');
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error).toContain('cotización');
  });
  it('reactivar un IMEI limpia proveedor, compra, categoría, reservas y precios públicos anteriores', async () => {
    const { from, to } = await setup();
    const fixture = await seedCatalogFixture(to);
    const supplier = await prisma.supplier.create({
      data: { storeId: to, name: 'Ficticio' },
    });
    const archived = await prisma.inventoryItem.update({
      where: { id: fixture.inventoryItem.id },
      data: {
        archivedAt: new Date(),
        supplierId: supplier.id,
        catalogVisible: true,
      },
    });
    const catalog = await prisma.storeCatalog.create({
      data: {
        storeId: to,
        name: 'Lista ficticia',
        slug: 'catalogo-ficticio',
        itemVisibility: 'OWN',
      },
    });
    await prisma.catalogItemPrice.create({
      data: {
        catalogId: catalog.id,
        inventoryItemId: archived.id,
        price: 999,
        currency: 'ARS',
      },
    });
    const item = await equipment(from, { imei: archived.imei });
    const res = await send(to, item.id);
    expect(res.statusCode, res.body).toBe(200);
    expect(
      await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: archived.id },
      }),
    ).toMatchObject({
      categoryId: null,
      supplierId: null,
      stockPurchaseId: null,
      catalogVisible: false,
      reservedDepositId: null,
      archivedAt: null,
      cantidad: 1,
    });
    expect(
      await prisma.catalogItemPrice.count({
        where: { inventoryItemId: archived.id },
      }),
    ).toBe(0);
    expect(
      await prisma.catalogItemHidden.count({
        where: { inventoryItemId: archived.id, catalogId: catalog.id },
      }),
    ).toBe(1);
  });
  it('REST autenticado obligatorio y límites de consulta validados', async () => {
    expect(
      (await getApp().inject({ url: '/api/store-group' })).statusCode,
    ).toBe(401);
    await setup();
    expect((await get('/api/store-group/balance?months=4')).statusCode).toBe(
      400,
    );
    expect((await get('/api/store-group/transfers?limit=101')).statusCode).toBe(
      400,
    );
  });
});

describe('moneda y definiciones al transferir', () => {
  it('conserva el significado de un costo sin moneda cuando el destino usa otra moneda', async () => {
    const { from, to } = await setup();
    await prisma.store.update({ where: { id: to }, data: { currency: 'USD' } });
    const item = await equipment(from, { currency: null });
    expect((await send(to, item.id)).statusCode).toBe(200);
    const received = await prisma.inventoryItem.findFirstOrThrow({
      where: { storeId: to },
    });
    expect(received.currency).toBe('ARS');
    expect(Number(received.cost)).toBe(Number(item.cost));
    expect((await prisma.stockTransferItem.findFirstOrThrow()).currency).toBe(
      'ARS',
    );
  });
  it('omite campos con definición archivada o tipo incompatible y no crea definiciones nuevas', async () => {
    const { from, to } = await setup();
    await prisma.customFieldDefinition.createMany({
      data: [
        { storeId: from, key: 'fecha', label: 'Fecha', type: 'text' },
        { storeId: to, key: 'fecha', label: 'Fecha', type: 'date' },
        { storeId: from, key: 'nota', label: 'Nota', type: 'text' },
        {
          storeId: to,
          key: 'nota',
          label: 'Nota',
          type: 'text',
          archivedAt: new Date(),
        },
      ],
    });
    const item = await equipment(from, {
      customFields: {
        fecha: 'No es fecha',
        nota: 'Ficticia',
        desconocido: 'Omitir',
      },
    });
    expect((await send(to, item.id)).statusCode).toBe(200);
    expect(
      (await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: to } }))
        .customFields,
    ).toEqual({});
    expect(
      await prisma.customFieldDefinition.count({ where: { storeId: to } }),
    ).toBe(2);
  });
});
