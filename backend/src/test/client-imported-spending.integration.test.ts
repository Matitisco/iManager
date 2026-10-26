import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import { createTestAuthToken } from '../testing/test-auth.js';
import { importClients, listClients } from '../modules/clients/clients.service.js';
import { importSales, updateSale } from '../modules/sales/sales.service.js';
const { getApp } = useIntegrationApp();
describe('imported client spending', () => {
  it('persists a snapshot through HTTP, preserves it on sale edits, and retries without accumulating', async () => {
    const { store, user } = await seedStoreContext();
    const storeId = store!.id;
    const headers = { authorization: `Bearer ${createTestAuthToken({ uid: user.firebaseUid, email: user.email ?? undefined })}` };
    const row = { name: 'Lucía Fernández', dni: '35.444.111', importedSpent: '2.400,50', importedSpentCurrency: 'USD' };
    const response = await getApp().inject({ method: 'POST', url: '/api/clients/import', headers, payload: { rows: [row] } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ imported: 1, errors: [] });
    await importSales(storeId, [{ clientName: row.name, clientDni: row.dni, device: 'iPhone 15', amount: '750', currency: 'USD' }]);
    const sale = await prisma.sale.findFirstOrThrow({ where: { storeId } });
    await updateSale(storeId, sale.id, { amount: 700 });
    expect(await importClients(storeId, [row])).toMatchObject({ updated: 1, errors: [] });
    expect((await listClients(storeId))[0]).toMatchObject({ importedSpent: 2400.5, importedSpentCurrency: 'USD', pendingBalance: 0 });
    expect(await prisma.sale.count({ where: { storeId } })).toBe(1);
    await importClients(storeId, [{ name: row.name, dni: row.dni, phone: '2615550101' }]);
    expect((await listClients(storeId))[0].importedSpent).toBe(2400.5);
    await importClients(storeId, [{ ...row, importedSpent: '0' }]);
    expect((await listClients(storeId))[0].importedSpent).toBe(0);
  });
  it('rejects invalid money and missing currency without creating contacts', async () => {
    const { store } = await seedStoreContext();
    for (const [amount, currency] of [['-1', 'USD'], ['abc', 'USD'], ['5', ''], ['10', 'EUR']]) {
      const result = await importClients(store!.id, [{ name: 'Inválido', importedSpent: amount, importedSpentCurrency: currency }]);
      expect(result.errors).toHaveLength(1); expect(result.imported).toBe(0);
    }
    expect(await prisma.client.count()).toBe(0);
  });
  it('does not leak history between stores or backfill legacy accumulators', async () => {
    const a = await seedStoreContext();
    const b = await seedStoreContext({ firebaseUid: 'other', email: 'other@example.test' });
    await prisma.client.create({ data: { storeId: a.store!.id, name: 'Ana', dni: '123', totalSpent: 8000 } });
    await importClients(b.store!.id, [{ name: 'Ana', dni: '123', importedSpent: '100', importedSpentCurrency: 'ARS' }]);
    expect((await listClients(a.store!.id))[0].importedSpent).toBeNull();
    expect((await listClients(b.store!.id))[0].importedSpent).toBe(100);
  });
});
