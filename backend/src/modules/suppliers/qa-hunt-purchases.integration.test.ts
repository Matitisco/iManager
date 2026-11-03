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

// Disposable local PostgreSQL only: the integration harness truncates its tables.
describe.each(['import', 'manual'].flatMap(source => ['OWNER', 'STAFF'].map(role => ({ source, role }))))('Compras por unidades: $source / $role', ({ source, role }) => {
  let supplierId: string;
  let saleId: string;
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
    const entryHeaders = role === 'STAFF' ? staffHeaders : headers;
    if (source === 'import') {
      const imported = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers: entryHeaders, payload: {
        supplierId, purchaseName: 'Reposición ficticia', rows: [
          { model: 'iPhone 13', quantity: 10, cost: 300, price: 400, currency: 'USD' },
          { model: 'iPhone 14', quantity: 3, cost: 250000, price: 350000, currency: 'ARS' },
        ],
      } });
      expect(imported.statusCode, imported.body).toBe(200);
      expect(imported.json()).toMatchObject({ imported: 2, units: 13, errors: [] });
    } else {
      for (const [model, cantidad, cost, price, currency] of [['iPhone 13', 10, 300, 400, 'USD'], ['iPhone 14', 3, 250000, 350000, 'ARS']] as const) {
        const response = await getApp().inject({ method: 'POST', url: '/api/inventory', headers: entryHeaders, payload: {
          model, cantidad, cost, price, currency, supplierId, capacity: '128GB', color: '', condition: 'NUEVO', grade: '', batteryHealth: '', status: 'DISPONIBLE',
        } });
        expect(response.statusCode, response.body).toBe(201);
      }
    }
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: store!.id, model: 'iPhone 13' } });
    itemId = item.id;
    purchaseId = item.stockPurchaseId!;
    purchases = {};
    for (const [role, auth] of [['OWNER', headers], ['STAFF', staffHeaders]] as const) {
      const response = await getApp().inject({ method: 'GET', url: `/api/suppliers/${supplierId}/purchases/${purchaseId}`, headers: auth });
      expect(response.statusCode, response.body).toBe(200);
      const purchase: PurchaseDetailView = response.json().purchase;
      // Preserve temporary STAFF financial access from #691.
      expect(purchase.items.every(item => item.cost !== undefined)).toBe(true);
      expect(purchase.costTotals).toBeDefined();
      purchases[role] = purchase;
    }
    const sale = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers, payload: {
      productId: itemId, cantidad: 4, amount: 1600, currency: 'USD', exchangeRate: 1000, clientName: 'Comprador ficticio', paymentMethod: 'EFECTIVO', status: 'COMPLETADA',
    } });
    expect(sale.statusCode, sale.body).toBe(201);
    saleId = sale.json().sale.id;
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).cantidad).toBe(6);
    const response = await getApp().inject({ method: 'GET', url: `/api/suppliers/${supplierId}?includeItems=0`, headers });
    expect(response.statusCode, response.body).toBe(200);
    supplierAfterSale = response.json().supplier;
  });

  it.each(['OWNER', 'STAFF'])('total invertido respeta cantidades y separa USD/ARS (%s)', role => {
    expect(purchases[role]).toMatchObject(source === 'manual' ? { devices: 10, totalCost: 3000, currency: 'USD', costTotals: [{ currency: 'USD', totalCost: 3000 }] } : {
      devices: 13, totalCost: null, currency: null,
      costTotals: [{ currency: 'ARS', totalCost: 750000 }, { currency: 'USD', totalCost: 3000 }],
    });
  });

  it('el stock del proveedor suma unidades remanentes después de una venta parcial', () => {
    expect(supplierAfterSale).toMatchObject({ stockCount: 9, deviceCount: 13 });
    expect(supplierAfterSale.costTotals).toEqual([{ currency: 'ARS', totalCost: 750000 }, { currency: 'USD', totalCost: 3000 }]);
    expect(supplierAfterSale.purchases.find(purchase => purchase.id === purchaseId)?.devices).toBe(source === 'import' ? 13 : 10);
  });

  async function verify(stockCount: number) {
    for (const auth of [headers, staffHeaders]) {
      const response = await getApp().inject({ method: 'GET', url: `/api/suppliers/${supplierId}?includeItems=0`, headers: auth });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().supplier).toMatchObject({ stockCount, deviceCount: 13, costTotals: [{ currency: 'ARS', totalCost: 750000 }, { currency: 'USD', totalCost: 3000 }] });
      const list = await getApp().inject({ method: 'GET', url: '/api/suppliers', headers: auth });
      expect(list.statusCode, list.body).toBe(200);
      expect(list.json().suppliers.find((row: { id: string }) => row.id === supplierId).deviceCount).toBe(13);
      const history = await getApp().inject({ method: 'GET', url: `/api/suppliers/${supplierId}/purchases`, headers: auth });
      expect(history.statusCode, history.body).toBe(200);
      expect(history.json().purchases).toEqual(response.json().supplier.purchases);
    }
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({ acquiredQuantity: 10 });
  }

  it('anula, restaura y agota stock sin cambiar adquisición ni inversión', async () => {
    await verify(9);
    const cancelled = await getApp().inject({ method: 'POST', url: `/api/operations/sales/sales/${saleId}/void`, headers, payload: { reason: 'QA sintética' } });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    await verify(13);
    const restored = await getApp().inject({ method: 'POST', url: `/api/sales/${saleId}/restore`, headers });
    expect(restored.statusCode, restored.body).toBe(200);
    await verify(9);
    const sold = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers, payload: { productId: itemId, cantidad: 6, amount: 2400, currency: 'USD', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' } });
    expect(sold.statusCode, sold.body).toBe(201);
    await verify(3);
  });

  it('devolución parcial y reventa conservan compras y bloquean anular el reclamo compensado', async () => {
    const claim = await getApp().inject({ method: 'POST', url: '/api/returns', headers, payload: { saleId, cantidad: 2, reason: 'QA sintética', openedOn: '2026-11-02' } });
    expect(claim.statusCode, claim.body).toBe(201);
    const claimId = claim.json().return.id;
    const resolved = await getApp().inject({ method: 'POST', url: `/api/returns/${claimId}/resolve`, headers, payload: { resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount: 800, destination: 'STOCK', stockStatus: 'EN_REVISION' } });
    expect(resolved.statusCode, resolved.body).toBe(200);
    const returnedId = resolved.json().return.inventoryItemId;
    expect(returnedId).not.toBe(itemId);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: returnedId } })).toMatchObject({ cantidad: 2, acquiredQuantity: 0, stockPurchaseId: purchaseId });
    await verify(11);
    const removed = await getApp().inject({ method: 'DELETE', url: `/api/returns/${claimId}`, headers, payload: { reason: 'QA sintética' } });
    // #717 requires reversing the issued compensation before cancelling its claim.
    expect(removed.statusCode, removed.body).toBe(409);
    expect(removed.json().error).toContain('compensación emitida');
    expect((await prisma.returnCase.findUniqueOrThrow({ where: { id: claimId } })).deletedAt).toBeNull();
    await verify(11);
    // The active claim keeps its physical effect and blocks voiding the original sale.
    expect((await getApp().inject({ method: 'POST', url: `/api/operations/sales/sales/${saleId}/void`, headers, payload: { reason: 'QA sintética' } })).statusCode).toBe(409);
    const ready = await getApp().inject({ method: 'PATCH', url: `/api/inventory/${returnedId}`, headers, payload: { status: 'DISPONIBLE' } });
    expect(ready.statusCode, ready.body).toBe(200);
    const resale = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers, payload: { productId: returnedId, cantidad: 1, amount: 400, currency: 'USD', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' } });
    expect(resale.statusCode, resale.body).toBe(201);
    await verify(10);
  });

  it('editar el stock actual no reescribe la cantidad adquirida', async () => {
    const changed = await getApp().inject({ method: 'PATCH', url: `/api/inventory/${itemId}`, headers, payload: { cantidad: 20 } });
    expect(changed.statusCode, changed.body).toBe(200);
    await verify(23);
  });


  it('venta directa y devolución en ARS conservan la inversión histórica por moneda', async () => {
    const usd = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    const ars = await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: usd.storeId, currency: 'ARS' } });
    const clientId = (await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).clientId;
    const sale = await getApp().inject({ method: 'POST', url: '/api/sales', headers, payload: { clientId, productId: ars.id, cantidad: 2, amount: 700000, amountCurrency: 'ARS', date: '02/11/2026', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' } });
    expect(sale.statusCode, sale.body).toBe(201);
    await verify(7);
    const claim = await getApp().inject({ method: 'POST', url: '/api/returns', headers, payload: { saleId: sale.json().sale.id, cantidad: 1, reason: 'QA ARS', openedOn: '2026-11-02' } });
    expect(claim.statusCode, claim.body).toBe(201);
    const resolved = await getApp().inject({ method: 'POST', url: `/api/returns/${claim.json().return.id}/resolve`, headers, payload: { resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount: 350000, destination: 'STOCK', stockStatus: 'EN_REVISION' } });
    expect(resolved.statusCode, resolved.body).toBe(200);
    await verify(8);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ars.id } })).toMatchObject({ acquiredQuantity: 3 });
  });


  it('reimportar un IMEI vendido no reemplaza el snapshot ni crea otra adquisición', async () => {
    const created = await getApp().inject({ method: 'POST', url: '/api/inventory', headers, payload: { model: 'iPhone SE', imei: '490154203237518', cantidad: 1, cost: 300, price: 400, currency: 'USD', supplierId, capacity: '128GB', color: '', condition: 'NUEVO', grade: '', batteryHealth: '', status: 'DISPONIBLE' } });
    expect(created.statusCode, created.body).toBe(201);
    const id = created.json().inventoryItem.id;
    const sold = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers, payload: { productId: id, cantidad: 1, amount: 400, currency: 'USD', paymentMethod: 'EFECTIVO', status: 'COMPLETADA' } });
    expect(sold.statusCode, sold.body).toBe(201);
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id } });
    const imported = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { supplierId, rows: [{ model: 'iPhone SE', imei: '490154203237518', quantity: 1, cost: 300, price: 400, currency: 'USD' }] } });
    expect(imported.statusCode, imported.body).toBe(200);
    expect(imported.json()).toMatchObject({ imported: 0, updated: 1 });
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ cantidad: 0, acquiredQuantity: 1, stockPurchaseId: before.stockPurchaseId });
    const response = await getApp().inject({ method: 'GET', url: `/api/suppliers/${supplierId}?includeItems=0`, headers });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().supplier).toMatchObject({ stockCount: 9, deviceCount: 14, costTotals: [{ currency: 'ARS', totalCost: 750000 }, { currency: 'USD', totalCost: 3300 }] });
  });

});
