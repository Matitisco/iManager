import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import { STAFF_DEFAULT_SECTIONS } from '../modules/stores/sections.js';

const { getApp } = useIntegrationApp();
const headers = (uid = 'test-owner') => buildAuthHeaders({ uid, name: uid === 'test-owner' ? 'Matías' : uid });
async function fixture() {
  const owner = await seedStoreContext({ displayName: 'Matías' });
  const storeId = owner.store!.id;
  await prisma.store.update({ where: { id: storeId }, data: { billingPlan: 'INTERNAL' } });
  async function member(uid: string, role: 'STAFF' | 'MANAGER', sections?: string[]) {
    const user = await prisma.user.create({ data: { firebaseUid: uid, email: `${uid}@test.com`, displayName: uid } });
    return prisma.storeMember.create({ data: { storeId, userId: user.id, role, sections, isDefault: true } });
  }
  const manager = await member('socio', 'MANAGER');
  const peer = await member('otro-socio', 'MANAGER');
  const staff = await member('empleado', 'STAFF');
  return { owner, storeId, manager, peer, staff, member };
}
async function create(role: 'STAFF' | 'MANAGER', uid = 'test-owner', email?: string) {
  return getApp().inject({ method: 'POST', url: '/api/invitations', headers: headers(uid), payload: { role, email } });
}

describe('issue #71 — invitations and section permissions', () => {
  it('enforces the invitation role matrix, records creator and shares existing links', async () => {
    const f = await fixture();
    for (const [actor, role, expected] of [
      ['test-owner', 'MANAGER', 201], ['test-owner', 'STAFF', 201],
      ['socio', 'STAFF', 201], ['socio', 'MANAGER', 403],
      ['empleado', 'STAFF', 403], ['empleado', 'MANAGER', 403],
    ] as const) {
      const response = await create(role, actor);
      expect(response.statusCode, `${actor} → ${role}`).toBe(expected);
      if (expected === 201) {
        const row = await prisma.storeInvitation.findUniqueOrThrow({ where: { id: response.json().id } });
        expect(row.invitedById).toBe(actor === 'socio' ? f.manager.userId : f.owner.user.id);
        const preview = await getApp().inject({ method: 'GET', url: `/api/invitations/preview/${row.token}` });
        expect(preview.json()).toMatchObject({ status: 'valid', inviterName: actor === 'socio' ? 'socio' : 'Matías', role, expiresAt: row.expiresAt.toISOString(), storeName: 'Test Store' });
      }
    }
    const list = await getApp().inject({ method: 'GET', url: '/api/invitations', headers: headers('socio') });
    expect(list.json().invitations).toHaveLength(3);
    expect(list.json().invitations.every((invite: { inviteUrl: string }) => invite.inviteUrl.includes('/invite/'))).toBe(true);
  });

  it('allows owners to revoke any pending invite and managers only STAFF invites, isolated by store', async () => {
    await fixture();
    const staff = (await create('STAFF')).json();
    const manager = (await create('MANAGER')).json();
    const remove = (id: string, uid: string) => getApp().inject({ method: 'DELETE', url: `/api/invitations/${id}`, headers: headers(uid) });
    expect((await remove(manager.id, 'socio')).statusCode).toBe(403);
    expect((await remove(staff.id, 'empleado')).statusCode).toBe(403);
    const outsider = await seedStoreContext({ firebaseUid: 'outsider' });
    expect((await remove(staff.id, outsider.user.firebaseUid)).statusCode).toBe(404);
    expect((await remove(staff.id, 'socio')).statusCode).toBe(200);
    expect((await remove(manager.id, 'test-owner')).statusCode).toBe(200);
    const accepted = (await create('STAFF')).json();
    await prisma.storeInvitation.update({ where: { id: accepted.id }, data: { status: 'ACCEPTED' } });
    expect((await remove(accepted.id, 'test-owner')).statusCode).toBe(400);
  });

  it('compares actor and target on role, sections, sensitive access and removal', async () => {
    const f = await fixture();
    const app = getApp();
    const url = (id: string) => `/api/stores/${f.storeId}/members/${id}`;
    for (const target of [f.owner.membership!, f.manager, f.peer]) {
      expect((await app.inject({ method: 'PATCH', url: url(target.id), headers: headers('socio'), payload: { role: 'STAFF' } })).statusCode).toBe(403);
      expect((await app.inject({ method: 'PATCH', url: `${url(target.id)}/sections`, headers: headers('socio'), payload: { sections: ['reports'], sensitiveAccess: true } })).statusCode).toBe(403);
      expect((await app.inject({ method: 'DELETE', url: url(target.id), headers: headers('socio') })).statusCode).toBe(403);
    }
    expect((await app.inject({ method: 'PATCH', url: url(f.staff.id), headers: headers('socio'), payload: { role: 'MANAGER' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `${url(f.staff.id)}/sections`, headers: headers('socio'), payload: { sections: ['sales'], sensitiveAccess: true } })).json()).toMatchObject({ member: { sections: ['sales'], sensitiveAccess: true } });
    expect((await app.inject({ method: 'PATCH', url: `${url(f.peer.id)}/sections`, headers: headers(), payload: { sections: ['service'] } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: url(f.staff.id), headers: headers(), payload: { role: 'MANAGER' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: `${url(f.owner.membership!.id)}/sections`, headers: headers(), payload: { sections: [] } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: url(f.owner.membership!.id), headers: headers(), payload: { role: 'STAFF' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: url(f.owner.membership!.id), headers: headers() })).statusCode).toBe(400);
    const removable = await f.member('remove-me', 'STAFF');
    expect((await app.inject({ method: 'DELETE', url: url(removable.id), headers: headers('socio') })).statusCode).toBe(200);
  });

  it('accepts with a different email, persists STAFF defaults and remains single-use under concurrency', async () => {
    const f = await fixture();
    const invitation = (await create('STAFF', 'test-owner', 'etiqueta@test.com')).json();
    const accept = (uid: string) => getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: buildAuthHeaders({ uid, email: `${uid}@different.com` }), payload: { token: invitation.token } });
    const responses = await Promise.all([accept('new-a'), accept('new-b')]);
    expect(responses.map(r => r.statusCode).sort()).toEqual([200, 410]);
    expect(responses.find(r => r.statusCode === 200)!.json()).toMatchObject({ session: { membership: { role: 'STAFF', sections: STAFF_DEFAULT_SECTIONS } } });
    expect(await prisma.storeMember.count({ where: { storeId: f.storeId } })).toBe(5);
    expect((await prisma.storeInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status).toBe('ACCEPTED');
    expect((await accept('new-c')).statusCode).toBe(410);
  });

  it('distinguishes unavailable links and falls back to the owner for legacy invitations', async () => {
    const f = await fixture();
    const app = getApp();
    const preview = async (token: string) => (await app.inject({ method: 'GET', url: `/api/invitations/preview/${token}` })).json();
    expect(await preview('does-not-exist')).toEqual({ status: 'not_found' });
    for (const [status, expiresAt, reason] of [
      ['PENDING', new Date(Date.now() - 1), 'expired'], ['ACCEPTED', new Date(Date.now() + 60_000), 'used'], ['REVOKED', new Date(Date.now() + 60_000), 'revoked'],
    ] as const) {
      const invite = await prisma.storeInvitation.create({ data: { storeId: f.storeId, role: 'STAFF', status, expiresAt } });
      expect(await preview(invite.token)).toEqual({ status: reason });
      expect((await app.inject({ method: 'POST', url: '/api/invitations/accept', headers: headers('new-user'), payload: { token: invite.token } })).statusCode).toBe(410);
    }
    const legacy = await prisma.storeInvitation.create({ data: { storeId: f.storeId, role: 'STAFF', expiresAt: new Date(Date.now() + 60_000) } });
    expect(await preview(legacy.token)).toMatchObject({ status: 'valid', inviterName: 'Matías' });
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: headers('empleado') });
    expect(me.json().store.ownerDisplayName).toBe('Matías');
  });

  it('blocks reports-only access to module lists/categories and restricts legacy STAFF defaults', async () => {
    const f = await fixture();
    await prisma.storeMember.update({ where: { id: f.manager.id }, data: { sections: ['reports'] } });
    for (const path of ['/api/inventory', '/api/sales', '/api/trade-ins', '/api/clients', '/api/inventory/categories', '/api/sales/categories', '/api/trade-ins/categories', '/api/clients/categories']) {
      expect((await getApp().inject({ method: 'GET', url: path, headers: headers('socio') })).statusCode, path).toBe(403);
    }
    for (const path of ['/api/inventory', '/api/sales', '/api/trade-ins', '/api/clients', '/api/repairs']) {
      expect((await getApp().inject({ method: 'GET', url: path, headers: headers('empleado') })).statusCode, path).toBe(200);
    }
    expect((await getApp().inject({ method: 'GET', url: '/api/cash', headers: headers('empleado') })).statusCode).toBe(403);
    expect((await getApp().inject({ method: 'GET', url: '/api/reports/overview', headers: headers('empleado') })).statusCode).toBe(403);
  });

  it('filters catalog kinds on GET and PUT responses and requires both role and section to edit', async () => {
    const f = await fixture();
    await prisma.storeMember.update({ where: { id: f.manager.id }, data: { sections: ['sales'] } });
    const app = getApp();
    const allowed = await app.inject({ method: 'GET', url: '/api/catalogs', headers: headers('socio') });
    expect(Object.keys(allowed.json().meta)).toEqual(['SALE_STATUS']);
    expect(allowed.json().options.length).toBeGreaterThan(0);
    expect(allowed.json().options.every((o: { kind: string }) => o.kind === 'SALE_STATUS')).toBe(true);
    for (const kind of ['INVENTORY_STATUS', 'INVENTORY_CAPACITY', 'INVENTORY_CONDITION', 'TRADE_IN_STATUS', 'CLIENT_TAG', 'REPAIR_STATUS']) {
      expect((await app.inject({ method: 'PUT', url: `/api/catalogs/${kind}`, headers: headers('socio'), payload: { options: [{ label: 'Prueba' }] } })).statusCode, kind).toBe(403);
    }
    expect((await app.inject({ method: 'PUT', url: '/api/catalogs/SALE_STATUS', headers: headers('empleado'), payload: { options: [{ label: 'Prueba' }] } })).statusCode).toBe(403);
    const payload = allowed.json().options.map((o: { value: string; label: string; color: string | null }) => ({ value: o.value, label: o.label, color: o.color }));
    const saved = await app.inject({ method: 'PUT', url: '/api/catalogs/SALE_STATUS', headers: headers('socio'), payload: { options: payload } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().options.every((o: { kind: string }) => o.kind === 'SALE_STATUS')).toBe(true);
    await prisma.storeMember.update({ where: { id: f.manager.id }, data: { sections: ['reports'] } });
    expect((await app.inject({ method: 'GET', url: '/api/catalogs', headers: headers('socio') })).json()).toMatchObject({ meta: {}, options: [] });
  });
});
