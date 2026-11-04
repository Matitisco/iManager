import type { StoreRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const headers = (n: number) => buildAuthHeaders({ uid: `qa-sec-${n}`, email: `qa-sec-${n}@example.com` });

async function fixture() {
  const a = await seedStoreContext({ firebaseUid: 'qa-sec-1', email: 'qa-sec-1@example.com' });
  const b = await seedStoreContext({ firebaseUid: 'qa-sec-2', email: 'qa-sec-2@example.com' });
  await prisma.store.updateMany({ data: { billingPlan: 'INTERNAL' } });
  const stock = await seedCatalogFixture(b.store!.id);
  async function member(n: number, role: StoreRole, options: { sensitiveAccess?: boolean; sections?: string[]; removed?: boolean } = {}) {
    const user = await prisma.user.create({ data: { firebaseUid: `qa-sec-${n}`, email: `qa-sec-${n}@example.com` } });
    return prisma.storeMember.create({ data: { storeId: a.store!.id, userId: user.id, role, isDefault: true,
      sensitiveAccess: options.sensitiveAccess, sections: options.sections, removedAt: options.removed ? new Date() : null } });
  }
  return { a, b, stock, member };
}

async function invite(role: 'STAFF' | 'MANAGER', access: { sensitiveAccess?: boolean; sections?: string[] } = {}) {
  const response = await getApp().inject({ method: 'POST', url: '/api/invitations', headers: headers(1), payload: { role, ...access } });
  expect(response.statusCode).toBe(201);
  return response.json() as { id: string; token: string };
}

describe('security: invitation capabilities', () => {
  it('enforces invitation boundaries over a real loopback HTTP listener', async () => {
    const f = await fixture();
    await f.member(3, 'MANAGER');
    await f.member(4, 'STAFF', { sensitiveAccess: true, removed: true });
    const address = await getApp().listen({ host: '127.0.0.1', port: 0 });
    const send = async (method: string, path: string, n: number, payload?: unknown) => {
      const response = await fetch(`${address}${path}`, { method, headers: { ...headers(n), ...(payload ? { 'content-type': 'application/json' } : {}) }, body: payload ? JSON.stringify(payload) : undefined });
      const body = await response.json();
      return { status: response.status, body };
    };
    const privileged = await send('POST', '/api/invitations', 1, { role: 'MANAGER' });
    expect(privileged.status).toBe(201);
    const staff = await send('POST', '/api/invitations', 1, { role: 'STAFF' });
    expect(staff.status).toBe(201);
    const list = await send('GET', '/api/invitations', 3);
    expect(list.status).toBe(200);
    expect(list.body.invitations.map((row: { id: string }) => row.id)).toEqual([staff.body.id]);
    const accept = await send('POST', '/api/invitations/accept', 4, { token: staff.body.token });
    expect(accept.status).toBe(200);
    expect((await send('DELETE', '/api/returns/nonexistent', 4)).status).toBe(403);
    expect((await send('GET', '/api/stores/' + f.b.store!.id + '/members', 3)).status).toBe(403);
  });

  it('does not disclose a MANAGER invitation capability to another MANAGER', async () => {
    const f = await fixture();
    await f.member(3, 'MANAGER');
    const privileged = await invite('MANAGER');
    const staff = await invite('STAFF');
    const list = await getApp().inject({ method: 'GET', url: '/api/invitations', headers: headers(3) });
    expect(list.statusCode).toBe(200);
    expect(list.json().invitations.map((row: { id: string }) => row.id)).toEqual([staff.id]);
    expect(list.body.includes(privileged.token)).toBe(false);
    const ownerList = await getApp().inject({ method: 'GET', url: '/api/invitations', headers: headers(1) });
    expect(ownerList.json().invitations).toHaveLength(2);
    // Managers cannot mint or revoke the privileged link either.
    expect((await getApp().inject({ method: 'POST', url: '/api/invitations', headers: headers(3), payload: { role: 'MANAGER' } })).statusCode).toBe(403);
    expect((await getApp().inject({ method: 'DELETE', url: `/api/invitations/${privileged.id}`, headers: headers(3) })).statusCode).toBe(403);
  });

  it.each([undefined, false, true])('rejoining STAFF uses invitation sensitiveAccess=%s, never the previous grant', async sensitiveAccess => {
    const f = await fixture();
    const removed = await f.member(3, 'STAFF', { sensitiveAccess: true, sections: ['sales', 'history'], removed: true });
    const invitation = await invite('STAFF', { sensitiveAccess, sections: ['sales'] });
    const response = await getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: headers(3), payload: { token: invitation.token } });
    expect(response.statusCode).toBe(200);
    expect(response.json().session.membership.sensitiveAccess).toBe(sensitiveAccess ?? null);
    const updated = await prisma.storeMember.findUniqueOrThrow({ where: { id: removed.id } });
    expect(updated.removedAt).toBeNull();
    expect(updated.sections).toEqual(['sales']);
    expect(updated.sensitiveAccess).toBe(sensitiveAccess ?? null);
    // Actual sensitive route: access denied before looking up the target, unless newly granted.
    const action = await getApp().inject({ method: 'DELETE', url: '/api/returns/does-not-exist', headers: headers(3) });
    expect(action.statusCode).toBe(sensitiveAccess === true ? 404 : 403);
  });

  it('rejoining MANAGER clears old custom sections and restores the new role defaults', async () => {
    const f = await fixture();
    const removed = await f.member(3, 'STAFF', { sections: ['history', 'commissions', 'cashBalances'], sensitiveAccess: true, removed: true });
    const invitation = await invite('MANAGER');
    const response = await getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: headers(3), payload: { token: invitation.token } });
    expect(response.statusCode).toBe(200);
    expect(response.json().session.membership).toMatchObject({ role: 'MANAGER', sections: null, sensitiveAccess: null });
    expect((await prisma.storeMember.findUniqueOrThrow({ where: { id: removed.id } })).sections).toBeNull();
    expect((await getApp().inject({ method: 'GET', url: '/api/history', headers: headers(3) })).statusCode).toBe(403);
  });
});

describe('security: tenant and role boundaries', () => {
  it('cannot spend a credit note from another store or another client', async () => {
    const f = await fixture();
    const own = await seedCatalogFixture(f.a.store!.id);
    const otherClient = await prisma.client.create({ data: { storeId: f.a.store!.id, name: 'synthetic other client' } });
    const notes = [];
    for (const [storeId, clientId] of [[f.b.store!.id, f.stock.client.id], [f.a.store!.id, otherClient.id]]) {
      const claim = await prisma.returnCase.create({ data: { storeId, clientId, caseNumber: 1, reason: 'synthetic credit', openedAt: new Date() } });
      notes.push(await prisma.creditNote.create({ data: { storeId, clientId, returnCaseId: claim.id, amount: 100, remaining: 100, currency: 'ARS' } }));
    }
    for (const [index, note] of notes.entries()) {
      const result = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: headers(1), payload: {
        clientId: own.client.id, productId: own.inventoryItem.id, amount: 1200, status: 'COMPLETADA', creditNoteIds: [note.id],
      } });
      expect(result.statusCode).toBe(index === 0 ? 404 : 400);
      expect(Number((await prisma.creditNote.findUniqueOrThrow({ where: { id: note.id } })).remaining)).toBe(100);
    }
    const visible = await getApp().inject({ method: 'GET', url: '/api/returns/credit-notes', headers: headers(1) });
    expect(visible.statusCode).toBe(200);
    expect(visible.json().creditNotes.map((row: { id: string }) => row.id)).toEqual([notes[1].id]);
    expect(await prisma.creditNoteApplication.count()).toBe(0);
    expect(await prisma.sale.count()).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: own.inventoryItem.id } })).status).toBe('DISPONIBLE');
  });

  it('rejects foreign client reads, mutations and category links without side effects', async () => {
    const { stock, a } = await fixture();
    const app = getApp();
    const before = await prisma.client.findUniqueOrThrow({ where: { id: stock.client.id } });
    for (const [method, path, payload] of [
      ['GET', `/${stock.client.id}/sales`, undefined], ['GET', `/${stock.client.id}/payments`, undefined],
      ['PATCH', `/${stock.client.id}`, { name: 'attack', storeId: a.store!.id }],
      ['DELETE', `/${stock.client.id}`, undefined], ['POST', `/${stock.client.id}/restore`, {}],
      ['POST', `/${stock.client.id}/payments`, { amount: 1, method: 'Efectivo', currency: 'ARS' }],
      ['PATCH', `/categories/${stock.clientCategory.id}`, { name: 'attack' }],
      ['DELETE', `/categories/${stock.clientCategory.id}`, undefined],
    ] as const) {
      const response = await app.inject({ method, url: `/api/clients${path}`, headers: headers(1), payload });
      expect(response.statusCode, `${method} ${path}`).toBe(404);
    }
    expect((await app.inject({ method: 'POST', url: '/api/clients', headers: headers(1), payload: { name: 'synthetic', categoryId: stock.clientCategory.id } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: '/api/clients/categories/reorder', headers: headers(1), payload: { categoryIds: [stock.clientCategory.id] } })).statusCode).toBe(204);
    const list = await app.inject({ method: 'GET', url: `/api/clients?storeId=${before.storeId}`, headers: headers(1) });
    expect(list.json().clients).toEqual([]);
    expect(await prisma.client.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
    expect((await prisma.clientCategory.findUniqueOrThrow({ where: { id: stock.clientCategory.id } })).sortOrder).toBe(0);
    expect(await prisma.clientPayment.count()).toBe(0);
  });

  it('rejects foreign claims, RMA and credit notes and keeps reports/history/notifications scoped', async () => {
    const f = await fixture();
    const storeId = f.b.store!.id;
    const sale = await prisma.sale.create({ data: { storeId, clientId: f.stock.client.id, inventoryItemId: f.stock.inventoryItem.id, dateLabel: '01/11/2026', soldAt: new Date('2026-11-01'), amount: 100, amountCurrency: 'USD', paymentMethod: 'Efectivo', status: 'COMPLETADA' } });
    const claimResponse = await getApp().inject({ method: 'POST', url: '/api/returns', headers: headers(2), payload: { saleId: sale.id, reason: 'synthetic', openedOn: '2026-11-02' } });
    expect(claimResponse.statusCode).toBe(201);
    const claim = claimResponse.json().return;
    const notification = await prisma.storeNotification.create({ data: { storeId, section: 'sales', kind: 'security.synthetic', title: 'synthetic', message: 'synthetic' } });
    for (const [method, path, payload] of [
      ['POST', '', { saleId: sale.id, reason: 'attack', openedOn: '2026-11-02' }],
      ['PATCH', `/${claim.id}`, { reason: 'attack' }], ['DELETE', `/${claim.id}`, undefined],
      ['POST', `/${claim.id}/restore`, {}], ['POST', `/${claim.id}/rma`, { status: 'ENVIADO' }],
      ['POST', `/${claim.id}/resolve`, { resolution: 'REINTEGRO', settlement: 'NOTA_CREDITO', amount: 100, destination: 'STOCK', stockStatus: 'DISPONIBLE' }],
    ] as const) {
      const response = await getApp().inject({ method, url: `/api/returns${path}`, headers: headers(1), payload });
      expect(response.statusCode, `${method} /returns${path}`).toBe(404);
    }
    for (const path of ['/api/returns', '/api/returns?archived=1', '/api/returns/eligible-sales', `/api/returns/credit-notes?clientId=${f.stock.client.id}`, '/api/returns/patterns', '/api/reports/overview?rangeKey=all_time', `/api/history?entityId=${claim.id}`, '/api/notifications']) {
      const response = await getApp().inject({ method: 'GET', url: path, headers: headers(1) });
      expect(response.statusCode, path).toBe(200);
      expect(response.body.includes(claim.id), path).toBe(false);
      expect(response.body.includes(sale.id), path).toBe(false);
      expect(response.body.includes(f.stock.client.id), path).toBe(false);
    }
    expect((await getApp().inject({ method: 'POST', url: `/api/notifications/${notification.id}/read`, headers: headers(1) })).statusCode).toBe(404);
    expect(await prisma.notificationRead.count({ where: { notificationId: notification.id } })).toBe(0);
    expect(await prisma.returnCase.count()).toBe(1);
    expect((await prisma.returnCase.findUniqueOrThrow({ where: { id: claim.id } })).reason).toBe('synthetic');
    expect(await prisma.creditNote.count()).toBe(0);
  });

  it('prevents STAFF promotion, self-grants, foreign member access and store/billing writes', async () => {
    const f = await fixture();
    const staff = await f.member(3, 'STAFF', { sensitiveAccess: false, sections: ['sales', 'clients', 'notifications'] });
    const app = getApp();
    for (const [method, path, payload] of [
      ['GET', `/api/stores/${f.b.store!.id}/members`, undefined],
      ['PATCH', `/api/stores/${f.a.store!.id}/members/${staff.id}`, { role: 'OWNER' }],
      ['PATCH', `/api/stores/${f.a.store!.id}/members/${staff.id}/sections`, { sections: ['history'], sensitiveAccess: true }],
      ['PATCH', '/api/stores/current', { name: 'attack' }], ['GET', '/api/billing', undefined],
      ['POST', '/api/billing/checkout', { quoteId: 'foreign' }], ['POST', '/api/billing/cancel', {}],
      ['GET', '/api/stores/current/periodic-report', undefined], ['GET', '/api/history', undefined],
      ['GET', '/api/reports/periodic-summary', undefined], ['POST', '/api/invitations', { role: 'STAFF' }],
    ] as const) {
      expect((await app.inject({ method, url: path, headers: headers(3), payload })).statusCode, path).toBe(403);
    }
    expect((await app.inject({ method: 'GET', url: `/api/stores/${f.b.store!.id}/members`, headers: headers(1) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `/api/stores/${f.a.store!.id}/members/${f.b.membership!.id}`, headers: headers(1), payload: { role: 'OWNER' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/stores/active', headers: headers(1), payload: { storeId: f.b.store!.id } })).statusCode).toBe(404);
    expect((await prisma.storeMember.findUniqueOrThrow({ where: { id: staff.id } })).role).toBe('STAFF');
    // #691 remains intact: STAFF still sees costs/profit through the existing financial gate.
    expect((await app.inject({ method: 'GET', url: '/api/reports/overview', headers: headers(3) })).statusCode).toBe(200);
  });

  it('keeps onboarding from granting OWNER in an existing store and blocks removed members', async () => {
    const f = await fixture();
    await f.member(3, 'STAFF');
    await f.member(4, 'STAFF', { removed: true });
    const result = await getApp().inject({ method: 'POST', url: '/api/onboarding', headers: headers(3), payload: { storeName: 'attack', storeId: f.b.store!.id, role: 'OWNER' } });
    expect(result.statusCode).toBe(200);
    expect(result.json().session.membership.role).toBe('STAFF');
    expect(result.json().session.store.id).toBe(f.a.store!.id);
    expect((await getApp().inject({ method: 'GET', url: '/api/clients', headers: headers(4) })).statusCode).toBe(403);
    expect((await getApp().inject({ method: 'GET', url: '/api/me', headers: headers(4) })).json().onboardingRequired).toBe(true);
    expect(await prisma.store.count()).toBe(2);
  });
});
