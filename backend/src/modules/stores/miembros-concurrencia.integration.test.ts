import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Prisma, StoreRole } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { activateStoreForUser, removeMember, updateMemberRole, updateMemberSections } from './stores.service.js';
import { createInvitation, revokeInvitation } from '../invitations/invitations.service.js';

const { getApp } = useIntegrationApp();
afterEach(() => vi.restoreAllMocks());

async function fixture() {
  const owner = await seedStoreContext();
  const storeId = owner.store!.id;
  await prisma.store.update({ where: { id: storeId }, data: { billingPlan: 'INTERNAL' } });
  async function member(uid: string, role: StoreRole) {
    const user = await prisma.user.create({ data: { firebaseUid: uid, email: `${uid}@example.com`, displayName: uid } });
    return prisma.storeMember.create({ data: { storeId, userId: user.id, role, isDefault: true } });
  }
  const headers = (uid = owner.user.firebaseUid) => buildAuthHeaders({ uid });
  const url = (id: string) => `/api/stores/${storeId}/members/${id}`;
  return { owner, storeId, member, headers, url };
}

// Force the vulnerable implementation's two *outside-transaction* counts to
// observe the same committed owners. Real SQL still runs. The fixed code counts
// through tx after a Store row lock, so it never uses this unsafe-read barrier.
function overlapUnsafeOwnerCounts() {
  const count = prisma.storeMember.count.bind(prisma.storeMember);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  vi.spyOn(prisma.storeMember, 'count').mockImplementation((async (args: Prisma.StoreMemberCountArgs) => {
    const result = await count(args);
    if (args.where?.role === 'OWNER') {
      if (++reads === 2) release();
      await gate;
    }
    return result;
  }) as typeof prisma.storeMember.count);
}

describe('concurrencia de StoreMember con PostgreSQL real', () => {
  it.each([['PATCH', 'PATCH'], ['DELETE', 'DELETE'], ['PATCH', 'DELETE']] as const)(
    'preserva un OWNER con %s y %s simultáneos sobre los dos últimos', async (first, second) => {
      const f = await fixture();
      const other = await f.member('otro-owner', 'OWNER');
      overlapUnsafeOwnerCounts();
      const responses = await Promise.all([
        getApp().inject({ method: first, url: f.url(f.owner.membership!.id), headers: f.headers(), ...(first === 'PATCH' ? { payload: { role: 'STAFF' } } : {}) }),
        getApp().inject({ method: second, url: f.url(other.id), headers: f.headers('otro-owner'), ...(second === 'PATCH' ? { payload: { role: 'STAFF' } } : {}) }),
      ]);
      vi.restoreAllMocks();
      expect(await prisma.storeMember.count({ where: { storeId: f.storeId, role: 'OWNER', removedAt: null } })).toBe(1);
      expect(responses.map(r => r.statusCode).sort()).toEqual([200, 400]);
      expect(await prisma.auditEvent.count({ where: { storeId: f.storeId, action: 'member.removed' } })).toBe(responses.filter((r, i) => r.statusCode === 200 && [first, second][i] === 'DELETE').length);
    },
  );

  it('impide que dos OWNER se quiten mutuamente usando roles resueltos antes de las bajas', async () => {
    const f = await fixture(), other = await f.member('otro-owner', 'OWNER');
    overlapUnsafeOwnerCounts();
    const responses = await Promise.all([
      getApp().inject({ method: 'DELETE', url: f.url(other.id), headers: f.headers() }),
      getApp().inject({ method: 'DELETE', url: f.url(f.owner.membership!.id), headers: f.headers('otro-owner') }),
    ]);
    vi.restoreAllMocks();
    expect(await prisma.storeMember.count({ where: { storeId: f.storeId, role: 'OWNER', removedAt: null } })).toBe(1);
    expect(responses.map(r => r.statusCode).sort()).toEqual([200, 403]);
    expect(await prisma.auditEvent.count({ where: { action: 'member.removed' } })).toBe(1);
  });

  it('revalida el objetivo si OWNER lo promueve mientras MANAGER intenta darlo de baja', async () => {
    const f = await fixture();
    const manager = await f.member('manager', 'MANAGER');
    const staff = await f.member('staff', 'STAFF');
    const transaction = prisma.$transaction.bind(prisma);
    let reached!: () => void, release!: () => void;
    const paused = new Promise<void>(resolve => { reached = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (work: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: object) => {
      reached();
      await resume;
      return transaction(work, options);
    }) as typeof prisma.$transaction);
    const pending = removeMember(f.storeId, staff.id, 'MANAGER', manager.userId);
    const settled = Promise.allSettled([pending]);
    await paused;
    try {
      await updateMemberRole(f.storeId, staff.id, 'OWNER', 'OWNER', f.owner.user.id);
    } finally { release(); }
    const [result] = await settled;
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reason).toMatchObject({ statusCode: 403 });
    expect(await prisma.storeMember.findUniqueOrThrow({ where: { id: staff.id } })).toMatchObject({ role: 'OWNER', removedAt: null });
    expect(await prisma.auditEvent.count({ where: { action: 'member.removed' } })).toBe(0);
  });

  it.each(['demoted', 'removed'] as const)('rechaza un actor %s aunque el request haya resuelto OWNER antes', async state => {
    const f = await fixture();
    const actor = await f.member('actor-owner', 'OWNER');
    const target = await f.member('staff', 'STAFF');
    if (state === 'removed') await removeMember(f.storeId, actor.id, 'OWNER', f.owner.user.id);
    else await updateMemberRole(f.storeId, actor.id, 'STAFF', 'OWNER', f.owner.user.id);
    const results = await Promise.allSettled([
      updateMemberRole(f.storeId, target.id, 'OWNER', 'OWNER', actor.userId),
      updateMemberSections(f.storeId, target.id, ['history'], 'OWNER', actor.userId),
      removeMember(f.storeId, target.id, 'OWNER', actor.userId),
    ]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ statusCode: 403 });
    }
    expect(await prisma.storeMember.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({ role: 'STAFF', removedAt: null, sections: null });
  });

  it('no cambia rol, permisos ni vuelve a dar de baja un objetivo removido', async () => {
    const f = await fixture(), target = await f.member('staff', 'STAFF');
    await removeMember(f.storeId, target.id, 'OWNER', f.owner.user.id);
    const results = await Promise.allSettled([
      updateMemberRole(f.storeId, target.id, 'OWNER', 'OWNER', f.owner.user.id),
      updateMemberSections(f.storeId, target.id, ['history'], 'OWNER', f.owner.user.id),
      removeMember(f.storeId, target.id, 'OWNER', f.owner.user.id),
    ]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ statusCode: 404 });
    }
    expect(await prisma.auditEvent.count({ where: { action: 'member.removed' } })).toBe(1);
  });

  it('no usa un OWNER removido para crear o cancelar invitaciones con un contexto obsoleto', async () => {
    const f = await fixture(), actor = await f.member('actor-owner', 'OWNER');
    const invitation = await createInvitation(f.storeId, 'OWNER', undefined, 'MANAGER', undefined, f.owner.user.id);
    await removeMember(f.storeId, actor.id, 'OWNER', f.owner.user.id);
    const results = await Promise.allSettled([
      createInvitation(f.storeId, 'OWNER', undefined, 'MANAGER', undefined, actor.userId),
      revokeInvitation(f.storeId, invitation.id, 'OWNER', { userId: actor.userId, name: 'Actor', role: 'OWNER' }),
    ]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ statusCode: 403 });
    }
    expect(await prisma.storeInvitation.count({ where: { storeId: f.storeId, status: 'PENDING' } })).toBe(1);
  });

  it('revierte una baja y su auditoría antes de reintentar un serialization failure real', async () => {
    const f = await fixture(), target = await f.member('staff', 'STAFF');
    const transaction = prisma.$transaction.bind(prisma);
    let attempts = 0;
    vi.spyOn(prisma, '$transaction').mockImplementation((async (work: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: object) => {
      return transaction(async tx => {
        const result = await work(tx);
        if (++attempts === 1) {
          // Real PostgreSQL error after the mutation AND audit insert. Prisma
          // must roll back both before the service retries the entire callback.
          await tx.$executeRaw`DO $$ BEGIN RAISE EXCEPTION 'conflicto sintético' USING ERRCODE = '40001'; END $$`;
        }
        return result;
      }, options);
    }) as typeof prisma.$transaction);
    await removeMember(f.storeId, target.id, 'OWNER', f.owner.user.id);
    expect(attempts).toBe(2);
    expect(await prisma.storeMember.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({ removedAt: expect.any(Date) });
    expect(await prisma.auditEvent.count({ where: { action: 'member.removed', entityId: target.id } })).toBe(1);
  });

  it('revoca acceso con el mismo token y no permite activar una tienda removida', async () => {
    const f = await fixture(), target = await f.member('staff', 'STAFF');
    const headers = f.headers('staff');
    expect((await getApp().inject({ url: '/api/clients', headers })).statusCode).toBe(200);
    await removeMember(f.storeId, target.id, 'OWNER', f.owner.user.id);
    const responses = await Promise.all([
      getApp().inject({ url: '/api/clients', headers }),
      getApp().inject({ method: 'POST', url: '/api/stores/active', headers, payload: { storeId: f.storeId } }),
    ]);
    expect(responses.map(r => r.statusCode)).toEqual([403, 404]);
    expect((await getApp().inject({ url: '/api/me', headers })).json()).toMatchObject({ membership: null, store: null, onboardingRequired: true });
    await expect(activateStoreForUser(target.userId, f.storeId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(['same-link', 'same-user-two-links', 'rejoin-two-links'] as const)('no duplica membresías con aceptaciones simultáneas: %s', async mode => {
    const f = await fixture();
    if (mode === 'rejoin-two-links') {
      const previous = await f.member('invitee-a', 'MANAGER');
      await removeMember(f.storeId, previous.id, 'OWNER', f.owner.user.id);
    }
    const create = async () => (await getApp().inject({ method: 'POST', url: '/api/invitations', headers: f.headers(), payload: { role: 'STAFF' } })).json();
    const first = await create(), second = mode === 'same-link' ? first : await create();
    const responses = await Promise.all([
      getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: f.headers('invitee-a'), payload: { token: first.token } }),
      getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: f.headers(mode === 'same-link' ? 'invitee-b' : 'invitee-a'), payload: { token: second.token } }),
    ]);
    expect(responses.map(r => r.statusCode).sort()).toEqual([200, mode === 'same-link' ? 410 : 409]);
    expect(await prisma.storeMember.count({ where: { storeId: f.storeId } })).toBe(2);
    expect(await prisma.storeInvitation.count({ where: { storeId: f.storeId, status: 'ACCEPTED' } })).toBe(1);
    expect(await prisma.storeMember.count({ where: { storeId: f.storeId, role: 'OWNER', removedAt: null } })).toBe(1);
  });

  it('coordina baja con aceptación de una invitación sin revivir permisos anteriores', async () => {
    const f = await fixture(), target = await f.member('invitee', 'STAFF');
    await prisma.storeMember.update({ where: { id: target.id }, data: { sections: ['history'], sensitiveAccess: true } });
    const invite = await createInvitation(f.storeId, 'OWNER', undefined, 'STAFF', { sections: ['sales'] }, f.owner.user.id);
    const [removed, accepted] = await Promise.all([
      getApp().inject({ method: 'DELETE', url: f.url(target.id), headers: f.headers() }),
      getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: f.headers('invitee'), payload: { token: invite.token } }),
    ]);
    expect(removed.statusCode).toBe(200);
    expect([200, 409]).toContain(accepted.statusCode);
    const current = await prisma.storeMember.findUniqueOrThrow({ where: { id: target.id } });
    if (accepted.statusCode === 200) {
      expect(current).toMatchObject({ removedAt: null, role: 'STAFF', sections: ['sales'], sensitiveAccess: null });
    } else {
      expect(current.removedAt).toBeInstanceOf(Date);
      expect((await getApp().inject({ url: '/api/clients', headers: f.headers('invitee') })).statusCode).toBe(403);
    }
    expect(await prisma.storeMember.count({ where: { storeId: f.storeId, userId: target.userId } })).toBe(1);
    expect(await prisma.storeMember.count({ where: { storeId: f.storeId, role: 'OWNER', removedAt: null } })).toBe(1);
  });
});
