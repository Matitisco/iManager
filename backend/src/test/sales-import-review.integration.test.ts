import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { seedStoreContext } from './db.js';
import { createTestAuthToken } from '../testing/test-auth.js';
import { useIntegrationApp } from './integration-helpers.js';
import { inventedSalesWorkbook } from '../../test/fixtures/invented-sales.js';
import { historicalSaleRates } from '../modules/import/sale-import-quotes.js';

vi.mock('../modules/import/sale-import-quotes.js', () => ({ historicalSaleRates: vi.fn(async () => new Map([['2024-01-10', 1000]])) }));
const app = useIntegrationApp();

async function seed() {
  const ctx = await seedStoreContext();
  await prisma.store.update({ where: { id: ctx.store!.id }, data: { currency: 'USD' } });
  const stock = await prisma.inventoryItem.create({ data: {
    storeId: ctx.store!.id, imei: '990000000000101', model: 'Equipo de prueba', capacity: '128 GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 300, price: 500, currency: 'USD', status: 'DISPONIBLE',
  } });
  const headers = { authorization: `Bearer ${createTestAuthToken({ uid: ctx.user.firebaseUid, email: ctx.user.email ?? undefined })}` };
  return { ...ctx, stock, headers };
}

describe('sales Excel review and atomic persistence', () => {
  it('roundtrips every invented Excel row, flags problems before save and recognizes the entire retry', async () => {
    const ctx = await seed();
    const sheets = await inventedSalesWorkbook();
    const preview = await app.getApp().inject({ method: 'POST', url: '/api/import/analyze', headers: ctx.headers, payload: { section: 'sales', sheets } });
    expect(preview.statusCode, preview.body).toBe(200);
    const analysis = preview.json();
    expect(analysis.rows).toHaveLength(6);
    expect(analysis.rows[0]._review).toContain('duplicada');
    expect(analysis.rows[1]._review).toContain('IMEI repetido');
    expect(analysis.rows[2]._review).toContain('IMEI no encontrado en stock');
    expect(analysis.rows[2]._review).toContain('Medio de pago por revisar');
    expect(analysis.rows[2]._review).toContain('Sin cotización histórica');
    expect(analysis.rows[0]).toMatchObject({ _amountUsd: '500.00', _rateSource: 'historical', _rateDate: '10/01/2024' });
    expect(analysis.rows[3]._review).toContain('fila de total');
    expect(await prisma.sale.count({ where: { storeId: ctx.store!.id } })).toBe(0);
    // The reviewed rate is frozen even if the provider changes before confirmation.
    vi.mocked(historicalSaleRates).mockResolvedValueOnce(new Map([['2024-01-10', 2000]]));
    const commit = await app.getApp().inject({ method: 'POST', url: '/api/sales/import', headers: ctx.headers, payload: { rows: analysis.rows } });
    expect(commit.statusCode, commit.body).toBe(200);
    expect(commit.json()).toMatchObject({ imported: 6, updated: 0, errors: [], diagnostics: { acceptedRows: 6, discardedRows: 0 } });
    const saved = await prisma.sale.findMany({ where: { storeId: ctx.store!.id }, orderBy: { saleNumber: 'asc' } });
    expect(saved).toHaveLength(6);
    expect(saved.filter(sale => sale.inventoryItemId === ctx.stock.id)).toHaveLength(1);
    expect(Number(saved[0].amount)).toBe(500);
    expect(saved[0].amountCurrency).toBe('USD');
    expect(Number(saved[0].exchangeRate)).toBe(1000);
    const metadata = saved[0].customFields as Record<string, string>;
    expect(metadata.notas).toContain('Con funda');
    expect(metadata.notas).toContain('Referencia de caja (origen): CAJA-QA-1');
    expect(metadata.notas).toContain('Columna J (origen): valor sin título');
    expect(metadata.importSourceRow).toBe('2');
    expect(saved[2].paymentMethod).toBe('POR REVISAR');
    expect((saved[2].customFields as Record<string, string>).importReview).toContain('Sin cotización histórica');
    expect(saved[2].status).toBe('COMPLETADA');
    expect(Number(saved[3].amount)).toBe(0);
    expect((saved[3].customFields as Record<string, string>).notas).toContain('1900000');
    const balances = await prisma.client.findMany({ where: { storeId: ctx.store!.id }, select: { id: true, totalSpent: true } });
    const retryPreview = await app.getApp().inject({ method: 'POST', url: '/api/import/apply', headers: ctx.headers, payload: { section: 'sales', sheets, plan: analysis.plan } });
    expect(retryPreview.statusCode).toBe(200);
    expect(retryPreview.json().rows.every((row: Record<string, string>) => row._alreadyImported === 'true')).toBe(true);
    const retry = await app.getApp().inject({ method: 'POST', url: '/api/sales/import', headers: ctx.headers, payload: { rows: analysis.rows } });
    expect(retry.json()).toMatchObject({ imported: 0, updated: 6, errors: [] });
    expect(await prisma.sale.count({ where: { storeId: ctx.store!.id } })).toBe(6);
    expect(await prisma.client.findMany({ where: { storeId: ctx.store!.id }, select: { id: true, totalSpent: true } })).toEqual(balances);
    const other = await seedStoreContext({ firebaseUid: 'qa-other-store', email: 'qa-other@example.com' });
    const otherHeaders = { authorization: `Bearer ${createTestAuthToken({ uid: other.user.firebaseUid, email: other.user.email ?? undefined })}` };
    const otherPreview = await app.getApp().inject({ method: 'POST', url: '/api/import/analyze', headers: otherHeaders, payload: { section: 'sales', sheets } });
    expect(otherPreview.json().rows[0]._alreadyImported).toBeUndefined();
    expect(otherPreview.json().rows[0]._review).toContain('IMEI no encontrado en stock');
  });

  it('rolls back every sale, stock mutation and client when a later row fails', async () => {
    const ctx = await seed();
    const response = await app.getApp().inject({ method: 'POST', url: '/api/sales/import', headers: ctx.headers, payload: { rows: [
      { date: '10/01/2024', clientName: 'Primera ficticia', device: 'Equipo QA', productImei: ctx.stock.imei, amount: '500', currency: 'USD', paymentMethod: 'transferencia' },
      { date: '10/01/2024', clientName: 'Segunda ficticia', device: 'Equipo QA', amount: '600', currency: 'USD', sellerMemberId: 'miembro-inexistente' },
    ] } });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(await prisma.sale.count({ where: { storeId: ctx.store!.id } })).toBe(0);
    expect(await prisma.client.count({ where: { storeId: ctx.store!.id } })).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ctx.stock.id } })).status).toBe('DISPONIBLE');
  });
});
