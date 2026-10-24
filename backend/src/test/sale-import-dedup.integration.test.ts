import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import { importSales } from '../modules/sales/sales.service.js';

useIntegrationApp();

describe('sale import deduplication', () => {
  it('serializes concurrent retries without duplicating sales, balances or document numbers', async () => {
    const context = await seedStoreContext();
    const storeId = context.store!.id;
    const client = await prisma.client.create({ data: { storeId, name: 'Lucía Fernández', dni: '40000001' } });
    const stock = await prisma.inventoryItem.create({ data: {
      storeId, imei: '350000000000100', model: 'iPhone 13', capacity: '128 GB', color: 'Negro',
      condition: 'USADO', grade: 'A', batteryHealth: '89%', cost: 350, price: 420, currency: 'USD', status: 'DISPONIBLE',
    } });
    const row = { date: '22/10/2026', clientName: client.name, clientDni: '40.000.001', device: 'iPhone 13', productImei: stock.imei!, amount: '420,50', currency: 'USD', paymentMethod: 'transferencia' };
    const results = await Promise.all([importSales(storeId, [row, row]), importSales(storeId, [row])]);
    expect(results.reduce((sum, result) => sum + result.imported, 0)).toBe(1);
    expect(results.flatMap(result => result.errors)).toHaveLength(2);
    expect(results.flatMap(result => result.errors).every(error => error.message.includes('no se duplicó'))).toBe(true);
    expect(await prisma.sale.count({ where: { storeId } })).toBe(1);
    const saved = await prisma.sale.findFirstOrThrow({ where: { storeId } });
    expect(saved.inventoryItemId).toBe(stock.id);
    expect(saved.saleNumber).toBe(1);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).totalSpent)).toBe(420.5);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: stock.id } })).status).toBe('VENDIDO');
    // The same source row belongs independently to another store.
    const other = await seedStoreContext({ firebaseUid: 'other-import', email: 'other-import@example.com' });
    expect(await importSales(other.store!.id, [row])).toMatchObject({ imported: 1, errors: [] });
  });
});
