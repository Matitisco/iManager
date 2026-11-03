import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import type { PurchaseDetailView, SupplierDetailView } from './suppliers.service.js';

if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname)) {
  throw new Error('QA hunt integration tests require local PostgreSQL');
}
const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
const knownBug = process.env.QA_HUNT_STRICT === '1' ? it : it.fails;

// Disposable local PostgreSQL only: the integration harness truncates its tables.
describe('QA inventario-compras: cantidades adquiridas', () => {
  let supplierId: string;
  let purchaseId: string;
  let itemId: string;
  let staffHeaders: ReturnType<typeof buildAuthHeaders>;
  let purchases: Record<string, PurchaseDetailView>;
  let supplierAfterSale: SupplierDetailView;

  beforeEach(async () => {
    const { store } = await seedStoreContext();
    const staff = await prisma.user.create({ data: { firebaseUid: 'hunt-staff', email: 'hunt-staff@imanager.test' } });
    await prisma.storeMember.create({ data: { storeId: store!.id, userId: staff.id, role: 'STAFF', sections: ['inventory'], isDefault: true } });
    staffHeaders = buildAuthHeaders({ uid: staff.firebaseUid, email: staff.email! });
    const supplier = await getApp().inject({ method: 'POST', url: '/api/suppliers', headers, payload: { name: 'Mayorista ficticio QA' } });
    expect(supplier.statusCode, supplier.body).toBe(201);
    supplierId = supplier.json().supplier.id;
    const imported = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: {
      supplierId, purchaseName: 'Reposición ficticia', rows: [
        { model: 'iPhone 13', quantity: 10, cost: 300, price: 400, currency: 'USD' },
        { model: 'iPhone 14', quantity: 3, cost: 250000, price: 350000, currency: 'ARS' },
      ],
    } });
    expect(imported.statusCode, imported.body).toBe(200);
    expect(imported.json()).toMatchObject({ imported: 2, units: 13, errors: [] });
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: store!.id, model: 'iPhone 13' } });
    itemId = item.id;
    purchaseId = item.stockPurchaseId!;
    purchases = {};
    for (const [role, auth] of [['OWNER', headers], ['STAFF', staffHeaders]] as const) {
      const response = await getApp().inject({ method: 'GET', url: `/api/suppliers/${supplierId}/purchases/${purchaseId}`, headers: auth });
      expect(response.statusCode, response.body).toBe(200);
      const purchase: PurchaseDetailView = response.json().purchase;
      // Keep auth and #691 checks outside expected failures so regressions fail the suite.
      expect(purchase.items.every(item => item.cost !== undefined)).toBe(true);
      expect(purchase.costTotals).toBeDefined();
      purchases[role] = purchase;
    }
    const sale = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers, payload: {
      productId: itemId, cantidad: 4, amount: 1600, currency: 'USD', exchangeRate: 1000, clientName: 'Comprador ficticio', paymentMethod: 'EFECTIVO', status: 'COMPLETADA',
    } });
    expect(sale.statusCode, sale.body).toBe(201);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).cantidad).toBe(6);
    const response = await getApp().inject({ method: 'GET', url: `/api/suppliers/${supplierId}?includeItems=0`, headers });
    expect(response.statusCode, response.body).toBe(200);
    supplierAfterSale = response.json().supplier;
  });

  // Open high-severity defect, documented in docs/qa-hunt-inventario-compras.md.
  // Expected failures keep the desired contract executable without calling it fixed.
  // Once corrected, Vitest reports an unexpected pass until .fails is removed.
  knownBug.each(['OWNER', 'STAFF'])('ABIERTO: total invertido respeta cantidades y separa USD/ARS (%s)', role => {
    expect(purchases[role]).toMatchObject({
      devices: 13, totalCost: null, currency: null,
      costTotals: [{ currency: 'ARS', totalCost: 750000 }, { currency: 'USD', totalCost: 3000 }],
    });
  });

  knownBug('ABIERTO: el stock del proveedor suma unidades remanentes después de una venta parcial', () => {
    expect(supplierAfterSale).toMatchObject({ stockCount: 9, deviceCount: 13 });
    expect(supplierAfterSale.purchases[0].costTotals).toEqual([{ currency: 'ARS', totalCost: 750000 }, { currency: 'USD', totalCost: 3000 }]);
  });
});
