import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { createTestAuthToken, type TestAuthTokenPayload } from '../testing/test-auth.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const verifyIdToken = vi.hoisted(() => vi.fn());
vi.mock('../plugins/firebase-admin.js', () => ({ getAdminAuth: () => ({ verifyIdToken }) }));

const { getApp } = useIntegrationApp();
const denied = { error: 'No se pudo aceptar la invitación con esta cuenta.', code: 'INVITATION_EMAIL_REQUIRED' };
const invitee = { uid: 'invitee', email: 'invitee@example.com', emailVerified: true };
async function create(email: string | null = invitee.email) {
  const owner = await seedStoreContext();
  const response = await getApp().inject({ method: 'POST', url: '/api/invitations', headers: buildAuthHeaders(), payload: { role: 'STAFF', ...(email !== null ? { email } : {}) } });
  expect(response.statusCode).toBe(201);
  return { ...response.json(), storeId: owner.store!.id } as { id: string; token: string; email: string | null; storeId: string };
}
function identity(payload: TestAuthTokenPayload) {
  return { authorization: `Bearer ${createTestAuthToken(payload)}` };
}
function accept(token: string, payload: TestAuthTokenPayload = invitee, body: Record<string, unknown> = {}) {
  return getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: identity(payload), payload: { token, ...body } });
}

// Only synthetic tokens and the exclusive local disposable database are used.
describe('invitation email policy', () => {
  it.each([
    ['invitee@example.com', true, 200],
    ['other@example.com', true, 403],
    ['invitee@example.com', false, 403],
    ['invitee@example.com', undefined, 403],
  ] as const)('uses verified Firebase claims for Google (%s, verified=%s)', async (email, emailVerified, status) => {
    const invitation = await create();
    verifyIdToken.mockResolvedValue({ uid: invitee.uid, email, email_verified: emailVerified, firebase: { sign_in_provider: 'google.com' } });
    const response = await getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: { authorization: 'Bearer synthetic-firebase-token' }, payload: { token: invitation.token } });
    expect(response.statusCode).toBe(status);
    expect(verifyIdToken).toHaveBeenLastCalledWith('synthetic-firebase-token', true);
    if (status === 403) {
      expect(response.json()).toEqual(denied);
      expect(await prisma.user.count({ where: { firebaseUid: invitee.uid } })).toBe(0);
      expect((await prisma.storeInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status).toBe('PENDING');
    }
  });

  it('creates, previews and accepts for the matching verified email, then resolves /api/me by UID', async () => {
    const invitation = await create('  InViTeE@EXAMPLE.com  ');
    expect(invitation.email).toBe(invitee.email);
    const preview = await getApp().inject({ url: `/api/invitations/preview/${invitation.token}` });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ status: 'valid', storeName: 'Test Store' });
    expect(JSON.stringify(preview.json())).not.toContain(invitee.email);
    expect(preview.json()).not.toHaveProperty('email');
    const before = await getApp().inject({ url: '/api/me', headers: identity(invitee) });
    expect(before.json()).toMatchObject({ onboardingRequired: true, membership: null, store: null });
    expect((await prisma.storeInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status).toBe('PENDING');
    const response = await accept(invitation.token);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ session: { store: { id: invitation.storeId }, membership: { role: 'STAFF' }, onboardingRequired: false } });
    const me = await getApp().inject({ url: '/api/me', headers: identity(invitee) });
    expect(me.json()).toMatchObject({ store: { id: invitation.storeId }, membership: { role: 'STAFF' } });
  });

  it.each([
    { ...invitee, email: 'other@example.com' },
    { ...invitee, emailVerified: false },
    { uid: invitee.uid, emailVerified: true },
    { ...invitee, email: 'invitee+tag@example.com' },
    { ...invitee, email: 'in.vitee@example.com' },
    { ...invitee, email: 'invitee@other.example' },
  ])('rejects ineligible identity %j uniformly without consuming or writing a user/membership', async payload => {
    const invitation = await create();
    const response = await accept(invitation.token, payload, { email: invitee.email, emailVerified: true });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(denied);
    expect(await prisma.user.count({ where: { firebaseUid: invitee.uid } })).toBe(0);
    expect(await prisma.storeMember.count({ where: { storeId: invitation.storeId } })).toBe(1);
    expect((await prisma.storeInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status).toBe('PENDING');
    expect((await accept(invitation.token)).statusCode).toBe(200);
  });

  it('compares legacy invitation casing/whitespace and keeps a matching +tag intact', async () => {
    const invitation = await create();
    await prisma.storeInvitation.update({ where: { id: invitation.id }, data: { email: '  InViTeE+StAfF@EXAMPLE.com  ' } });
    expect((await accept(invitation.token)).statusCode).toBe(403);
    expect((await accept(invitation.token, { ...invitee, email: '  INVITEE+staff@example.COM  ' })).statusCode).toBe(200);
  });

  it('uses the current token even if /api/me exposes an older PG profile email', async () => {
    const invitation = await create();
    await prisma.user.create({ data: { firebaseUid: invitee.uid, email: invitee.email } });
    const otherIdentity = { ...invitee, email: 'other@example.com' };
    const me = await getApp().inject({ url: '/api/me', headers: identity(otherIdentity) });
    expect(me.json().user.email).toBe(invitee.email);
    expect(me.json().onboardingRequired).toBe(true);
    expect((await accept(invitation.token, otherIdentity)).json()).toEqual(denied);
    await prisma.user.update({ where: { firebaseUid: invitee.uid }, data: { email: 'old@example.com' } });
    expect((await accept(invitation.token)).statusCode).toBe(200);
  });

  it('does not disclose whether a mismatching email has a PG account', async () => {
    const invitation = await create();
    const payload = { uid: 'other', email: 'other@example.com', emailVerified: true };
    expect((await accept(invitation.token, payload)).json()).toEqual(denied);
    await prisma.user.create({ data: { firebaseUid: payload.uid, email: payload.email } });
    expect((await accept(invitation.token, payload)).json()).toEqual(denied);
    expect(await prisma.storeMember.count({ where: { storeId: invitation.storeId } })).toBe(1);
  });

  it('remains single-use under concurrent eligible requests and rejects reuse', async () => {
    const invitation = await create();
    const responses = await Promise.all([accept(invitation.token), accept(invitation.token)]);
    expect(responses.filter(r => r.statusCode === 200)).toHaveLength(1);
    expect(responses.every(r => [200, 409, 410].includes(r.statusCode))).toBe(true);
    expect((await accept(invitation.token)).statusCode).toBe(410);
    expect(await prisma.storeMember.count({ where: { storeId: invitation.storeId } })).toBe(2);
    expect((await prisma.storeInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status).toBe('ACCEPTED');
  });

  it.each(['expired', 'revoked'] as const)('rejects a %s invitation even with the matching verified email', async reason => {
    const invitation = await create();
    await prisma.storeInvitation.update({ where: { id: invitation.id }, data: reason === 'expired' ? { expiresAt: new Date(Date.now() - 1000) } : { status: 'REVOKED' } });
    const response = await accept(invitation.token);
    expect(response.statusCode).toBe(410);
    expect(response.json()).toEqual({ error: 'La invitación expiró o ya fue utilizada' });
    expect(await prisma.user.count({ where: { firebaseUid: invitee.uid } })).toBe(0);
    expect(await prisma.storeMember.count({ where: { storeId: invitation.storeId } })).toBe(1);
  });

  it('preserves existing no-email links, including unverified accounts, pending product approval', async () => {
    const invitation = await create(null);
    expect((await accept(invitation.token, { uid: invitee.uid, email: 'any@example.com', emailVerified: false })).statusCode).toBe(200);
    expect((await accept(invitation.token)).statusCode).toBe(410);
  });

  it('rejects malformed blank legacy email rather than treating it as an unrestricted link', async () => {
    const invitation = await create();
    await prisma.storeInvitation.update({ where: { id: invitation.id }, data: { email: '  ' } });
    expect((await accept(invitation.token)).json()).toEqual(denied);
  });
});
