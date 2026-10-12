import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();

describe('per-item endpoints reused by bulk tables', () => {
  it('enforces sensitive permission and store isolation, audits each deletion and leaves protected records intact', async () => {
    const app = getApp();
    const owner = await seedStoreContext(); const storeId = owner.store!.id;
    const fixture = await seedCatalogFixture(storeId);
    const foreign = await seedStoreContext({ firebaseUid: 'foreign', email: 'foreign@test.dev' });
    const foreignFixture = await seedCatalogFixture(foreign.store!.id);
    const staff = await prisma.user.create({ data: { firebaseUid: 'bulk-staff', email: 'bulk-staff@test.dev' } });
    await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: 'STAFF', isDefault: true, sections: ['inventory', 'clients', 'sales', 'tradeins'], sensitiveAccess: false } });
    const ownerHeaders = buildAuthHeaders(); const staffHeaders = buildAuthHeaders({ uid: staff.firebaseUid });
    const inventory = await prisma.inventoryItem.create({ data: { storeId, imei: '', model: 'Segundo equipo', capacity: '', color: '', condition: 'USADO', grade: '', batteryHealth: '', price: 500, cost: 300, status: 'DISPONIBLE' } });
    const client = await prisma.client.create({ data: { storeId, name: 'Segundo cliente', dni: '456' } });
    const targets = [
      { url: `/api/inventory/${fixture.inventoryItem.id}`, id: fixture.inventoryItem.id, action: 'inventory.deleted' },
      { url: `/api/inventory/${inventory.id}`, id: inventory.id, action: 'inventory.deleted' },
      { url: `/api/clients/${fixture.client.id}`, id: fixture.client.id, action: 'client.deleted' },
      { url: `/api/clients/${client.id}`, id: client.id, action: 'client.deleted' },
    ];
    for (const target of targets) expect((await app.inject({ method: 'DELETE', url: target.url, headers: staffHeaders })).statusCode).toBe(403);
    expect(await prisma.auditEvent.count({ where: { storeId } })).toBe(0);
    for (const url of [`/api/inventory/${foreignFixture.inventoryItem.id}`, `/api/clients/${foreignFixture.client.id}`]) {
      expect((await app.inject({ method: 'DELETE', url, headers: ownerHeaders })).statusCode).toBe(404);
    }
    for (const target of targets) {
      expect((await app.inject({ method: 'DELETE', url: target.url, headers: ownerHeaders })).statusCode).toBe(204);
      expect(await prisma.auditEvent.findFirst({ where: { storeId, entityId: target.id, action: target.action } })).toMatchObject({ actorUserId: owner.user.id });
    }
    expect(await prisma.inventoryItem.findUnique({ where: { id: foreignFixture.inventoryItem.id } })).not.toBeNull();
    expect(await prisma.client.findUnique({ where: { id: foreignFixture.client.id } })).not.toBeNull();
  });

  it('cancels sale and trade selections with audit, stock/balance restoration and no mutation on rejected requests', async () => {
    const app = getApp(); const owner = await seedStoreContext(); const storeId = owner.store!.id;
    const fixture = await seedCatalogFixture(storeId); const headers = { ...buildAuthHeaders(), 'content-type': 'application/json' };
    const staff = await prisma.user.create({ data: { firebaseUid: 'bulk-staff', email: 'bulk-staff@test.dev' } });
    await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: 'STAFF', isDefault: true, sections: ['sales', 'tradeins'], sensitiveAccess: false } });
    const staffHeaders = { ...buildAuthHeaders({ uid: staff.firebaseUid }), 'content-type': 'application/json' };
    const foreign = await seedStoreContext({ firebaseUid: 'foreign', email: 'foreign@test.dev' });
    const foreignHeaders = { ...buildAuthHeaders({ uid: foreign.user.firebaseUid }), 'content-type': 'application/json' };
    for (const source of ['sales', 'tradeins']) {
      const created = await app.inject({ method: 'POST', url: `/api/operations/${source}`, headers, payload: {
        clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 1200, paymentMethod: 'EFECTIVO', status: 'PENDIENTE',
        ...(source === 'tradeins' ? { tradeIn: { deviceReceived: 'iPhone recibido', takeValue: 400 } } : {}),
      } });
      expect(created.statusCode).toBe(201);
      const operation = created.json(); const id = source === 'sales' ? operation.sale.id : operation.tradeIn.id;
      const url = `/api/operations/${source}/${source === 'sales' ? 'sales' : 'trades'}/${id}/cancel`;
      expect((await app.inject({ method: 'POST', url, headers: staffHeaders, payload: {} })).statusCode).toBe(403);
      expect((await app.inject({ method: 'POST', url, headers: foreignHeaders, payload: {} })).statusCode).toBe(404);
      expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).status).toBe('VENDIDO');
      for (const protectedUrl of [`/api/inventory/${fixture.inventoryItem.id}`, `/api/clients/${fixture.client.id}`]) {
        expect((await app.inject({ method: 'DELETE', url: protectedUrl, headers: buildAuthHeaders() })).statusCode).toBe(409);
      }
      expect((await app.inject({ method: 'POST', url, headers, payload: {} })).statusCode).toBe(200);
      expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).status).toBe('DISPONIBLE');
      const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
      expect(client.pendingBalance.toNumber()).toBe(0); expect(client.totalSpent.toNumber()).toBe(0);
      expect(await prisma.auditEvent.findFirst({ where: { storeId, entityId: id, action: source === 'sales' ? 'sale.cancelled' : 'trade.cancelled' } })).toMatchObject({ actorUserId: owner.user.id });
      if (source === 'tradeins') expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: operation.tradeIn.receivedInventoryItemId } })).archivedAt).not.toBeNull();
    }
  });
});
