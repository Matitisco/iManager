import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIntegrationApp } from './integration-helpers.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { prisma } from '../plugins/prisma.js';

const { getApp } = useIntegrationApp();
afterEach(() => vi.restoreAllMocks());

describe('security probes over local TCP and PostgreSQL', () => {
  it('preserves OWNER and STAFF reads while withholding CORS permissions from hostile origins', async () => {
    const app = getApp();
    const base = await app.listen({ port: 0, host: '127.0.0.1' });
    for (const [index, role] of (['OWNER', 'STAFF'] as const).entries()) {
      const email = `qa-sec-${index + 1}@example.com`;
      const uid = `qa-sec-${index + 1}`;
      const { store } = await seedStoreContext({ firebaseUid: uid, email, role });
      await prisma.client.create({ data: { storeId: store!.id, name: `QA Store ${index + 1}` } });
      const response = await fetch(`${base}/api/clients`, { headers: { ...buildAuthHeaders({ uid, email }), Origin: 'https://attacker.example' } });
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain(`QA Store ${index + 1}`);
      expect(body).not.toContain(`QA Store ${index === 0 ? 2 : 1}`);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });
  it('does not disclose persistence failures caught in invitation acceptance', async () => {
    const app = getApp();
    const base = await app.listen({ port: 0, host: '127.0.0.1' });
    vi.spyOn(prisma.storeInvitation, 'findUnique').mockRejectedValueOnce(new Error('synthetic-private-db-detail'));
    const response = await fetch(`${base}/api/invitations/accept`, { method: 'POST', headers: {
      ...buildAuthHeaders({ uid: 'qa-sec-1', email: 'qa-sec-1@example.com' }), 'content-type': 'application/json',
    }, body: JSON.stringify({ token: 'synthetic-invitation' }) });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('synthetic-private-db-detail');
  });
  it('does not disclose persistence failures caught in catalog editing', async () => {
    const app = getApp();
    const base = await app.listen({ port: 0, host: '127.0.0.1' });
    await seedStoreContext({ firebaseUid: 'qa-sec-1', email: 'qa-sec-1@example.com' });
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('synthetic-private-sql-detail'));
    const response = await fetch(`${base}/api/catalogs/INVENTORY_CAPACITY`, { method: 'PUT', headers: {
      ...buildAuthHeaders({ uid: 'qa-sec-1', email: 'qa-sec-1@example.com' }), 'content-type': 'application/json',
    }, body: JSON.stringify({ options: [{ label: '128GB' }] }) });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('synthetic-private-sql-detail');
  });
});
