import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import type { RecordVersion } from '../modules/section-views/service.js';

const { getApp } = useIntegrationApp();
const headersFor = (user: { firebaseUid: string; email: string | null }) => buildAuthHeaders({ uid: user.firebaseUid, email: user.email ?? undefined });
const old = new Date('2026-10-01T12:00:00.000Z');
const newer = new Date('2026-10-02T12:00:00.000Z');

describe('section visits', () => {
  it('persists whole-section visits across requests, independently per user, store and section, without notification permission', async () => {
    const app = getApp();
    const owner = await seedStoreContext();
    const staff = await seedStoreContext({ firebaseUid: 'staff', email: 'staff@test.local', createStore: false });
    await prisma.storeMember.create({ data: { userId: staff.user.id, storeId: owner.store!.id, role: 'STAFF', sections: ['clients'], isDefault: true } });
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@test.local' });
    await prisma.client.createMany({ data: Array.from({ length: 260 }, (_, i) => ({ id: `client-${i}`, storeId: owner.store!.id, name: `Client ${i}` })) });
    await prisma.client.create({ data: { storeId: other.store!.id, name: 'Other store' } });
    await prisma.tradeIn.create({ data: { storeId: owner.store!.id, tradeAt: old, dateLabel: '01/10/2026', deviceReceived: 'Old phone', deviceGiven: 'Phone', takeValue: 0, differencePaid: 0, status: 'PENDIENTE' } });
    const headers = headersFor(owner.user);
    const before = await app.inject({ method: 'GET', url: '/api/section-views', headers });
    expect(before.statusCode).toBe(200);
    const changes = before.json().sections;
    expect(changes.clients).toHaveLength(260);
    expect(changes.tradeins).toHaveLength(1);
    const saved = await app.inject({ method: 'POST', url: '/api/section-views/clients', headers, payload: { versions: changes.clients } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().viewed).toHaveLength(260);
    const after = (await app.inject({ method: 'GET', url: '/api/section-views', headers })).json().sections;
    expect(after.clients).toEqual([]);
    expect(after.tradeins).toHaveLength(1);
    const staffHeaders = headersFor(staff.user);
    const staffBefore = (await app.inject({ method: 'GET', url: '/api/section-views', headers: staffHeaders })).json().sections;
    expect(Object.keys(staffBefore)).toEqual(['clients']);
    expect(staffBefore.clients).toHaveLength(260);
    expect((await app.inject({ method: 'POST', url: '/api/section-views/clients', headers: staffHeaders, payload: { versions: staffBefore.clients } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/section-views', headers: staffHeaders })).json().sections.clients).toEqual([]);
    expect((await app.inject({ method: 'POST', url: '/api/section-views/tradeins', headers: staffHeaders, payload: { versions: changes.tradeins } })).statusCode).toBe(403);
    expect(await prisma.sectionRecordView.count({ where: { userId: staff.user.id, section: 'tradeins' } })).toBe(0);
  });

  it('keeps a concurrent edit unread, never regresses newer receipts, and rejects forged store/future versions', async () => {
    const app = getApp();
    const owner = await seedStoreContext();
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@test.local' });
    const a = await prisma.client.create({ data: { storeId: owner.store!.id, name: 'Before', updatedAt: old } });
    const foreign = await prisma.client.create({ data: { storeId: other.store!.id, name: 'Foreign', updatedAt: old } });
    const headers = headersFor(owner.user);
    const read = () => app.inject({ method: 'GET', url: '/api/section-views', headers });
    const view = (versions: RecordVersion[]) => app.inject({ method: 'POST', url: '/api/section-views/clients', headers, payload: { versions } });
    const snapshot = (await read()).json().sections.clients;
    await prisma.client.update({ where: { id: a.id }, data: { name: 'After', updatedAt: newer } });
    expect((await view(snapshot)).statusCode).toBe(200);
    expect((await read()).json().sections.clients).toEqual([{ id: a.id, updatedAt: newer.toISOString() }]);
    await view([{ id: a.id, updatedAt: newer.toISOString() }, { id: a.id, updatedAt: old.toISOString() }]);
    await view(snapshot); // A slower tab must not move the receipt backwards.
    expect((await read()).json().sections.clients).toEqual([]);
    const forged = await view([{ id: foreign.id, updatedAt: old.toISOString() }, { id: a.id, updatedAt: '2099-01-01T00:00:00.000Z' }]);
    expect(forged.json().viewed).toEqual([]);
    expect(await prisma.sectionRecordView.count({ where: { recordId: foreign.id } })).toBe(0);
    expect((await view([{ id: a.id, updatedAt: 'invalid' }])).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/section-views/service', headers, payload: { versions: [] } })).statusCode).toBe(400);
  });

  it('includes old rows edited/archived/voided after a visit in all four sections', async () => {
    const app = getApp();
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    const headers = headersFor(owner.user);
    const client = await prisma.client.create({ data: { storeId, name: 'Client', updatedAt: old } });
    const item = await prisma.inventoryItem.create({ data: { storeId, model: 'Phone', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', status: 'DISPONIBLE', price: 100, cost: 50, updatedAt: old } });
    const sale = await prisma.sale.create({ data: { storeId, soldAt: old, dateLabel: '01/10/2026', amount: 100, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', updatedAt: old } });
    const trade = await prisma.tradeIn.create({ data: { storeId, tradeAt: old, dateLabel: '01/10/2026', deviceReceived: 'Phone', deviceGiven: 'Phone 2', takeValue: 100, differencePaid: 10, status: 'LISTO', updatedAt: old } });
    const snapshot = (await app.inject({ method: 'GET', url: '/api/section-views', headers })).json().sections;
    for (const [section, versions] of Object.entries(snapshot)) {
      expect((await app.inject({ method: 'POST', url: `/api/section-views/${section}`, headers, payload: { versions } })).statusCode).toBe(200);
    }
    await prisma.client.update({ where: { id: client.id }, data: { archivedAt: newer, updatedAt: newer } });
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { archivedAt: newer, updatedAt: newer } });
    await prisma.sale.update({ where: { id: sale.id }, data: { status: 'CANCELADA', voidedAt: newer, updatedAt: newer } });
    await prisma.tradeIn.update({ where: { id: trade.id }, data: { confirmationStatus: 'CANCELLED', status: 'CANCELADO', updatedAt: newer } });
    const changed = (await app.inject({ method: 'GET', url: '/api/section-views', headers })).json().sections;
    for (const [section, id] of [['clients', client.id], ['inventory', item.id], ['sales', sale.id], ['tradeins', trade.id]]) {
      expect(changed[section]).toEqual([{ id, updatedAt: newer.toISOString() }]);
    }
  });
});
