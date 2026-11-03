import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import * as audit from '../modules/audit/audit.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const request = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object, headers = buildAuthHeaders()) =>
  getApp().inject({ method, url, headers, ...(payload ? { payload } : {}) });

async function fixture(currency: 'USD' | 'ARS' = 'USD', sold = 10, imei = false) {
  const { store } = await seedStoreContext();
  const storeId = store!.id;
  await prisma.store.update({ where: { id: storeId }, data: { currency, exchangeMode: 'manual', manualSell: 1250, manualBuy: 1250 } });
  const catalog = await seedCatalogFixture(storeId);
  await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: {
    imei: imei ? catalog.inventoryItem.imei : null, cantidad: imei ? 1 : 20, currency, cost: 60, price: 100,
  } });
  const cash = await request('POST', '/api/cash', { name: 'Caja ficticia', currency, method: 'EFECTIVO', opening: 0 });
  expect(cash.statusCode, cash.body).toBe(200);
  expect((await request('POST', `/api/cash/${cash.json().id}/open`)).statusCode).toBe(200);
  const sale = await request('POST', '/api/operations/sales', {
    clientId: catalog.client.id, productId: catalog.inventoryItem.id, cantidad: sold,
    amount: sold * 100, currency, exchangeRate: 1250, status: 'COMPLETADA', paymentMethod: 'EFECTIVO',
  });
  expect(sale.statusCode, sale.body).toBe(201);
  return { storeId, ...catalog, saleId: sale.json().sale.id as string, sold };
}

async function open(f: Awaited<ReturnType<typeof fixture>>, cantidad = 2) {
  const response = await request('POST', '/api/returns', { saleId: f.saleId, cantidad, reason: 'Falla ficticia HVD-04', openedOn: '2026-11-02' });
  expect(response.statusCode, response.body).toBe(201);
  return response.json().return.id as string;
}

const resolve = (id: string, extra: object = {}) => request('POST', `/api/returns/${id}/resolve`, {
  resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount: 200, destination: 'STOCK', stockStatus: 'EN_REVISION', ...extra,
});

async function staff(storeId: string, sensitiveAccess = true) {
  const user = await prisma.user.create({ data: { firebaseUid: 'hvd04-staff', email: 'hvd04-staff@example.com' } });
  await prisma.storeMember.create({ data: { storeId, userId: user.id, role: 'STAFF', sections: ['sales', 'inventory', 'dashboard'], sensitiveAccess, isDefault: true } });
  return buildAuthHeaders({ uid: user.firebaseUid, email: user.email! });
}

async function snapshot(storeId: string) {
  const where = { storeId };
  const orderBy = { id: 'asc' as const };
  return Promise.all([
    prisma.returnCase.findMany({ where, orderBy }), prisma.returnEvent.findMany({ where, orderBy }),
    prisma.inventoryItem.findMany({ where, orderBy }), prisma.client.findMany({ where, orderBy }),
    prisma.sale.findMany({ where, orderBy }), prisma.clientPayment.findMany({ where, orderBy }),
    prisma.creditNote.findMany({ where, orderBy }), prisma.creditNoteApplication.findMany({ where, orderBy }),
    prisma.cashRegister.findMany({ where, orderBy }), prisma.cashMovement.findMany({ where, orderBy }),
    prisma.auditEvent.findMany({ where, orderBy }),
  ]);
}

async function figures() {
  const overview = await request('GET', '/api/reports/overview?rangeKey=all_time');
  const profit = await request('GET', '/api/reports/net-profit?from=2020-01-01&to=2099-12-31');
  expect(overview.statusCode, overview.body).toBe(200);
  expect(profit.statusCode, profit.body).toBe(200);
  return { summary: overview.json().overview.summary, profit: profit.json() };
}

describe('HVD-04: anulación consistente', () => {
  for (const currency of ['USD', 'ARS'] as const) {
    for (const cantidad of [2, 10]) {
      for (const role of ['OWNER', 'STAFF']) {
        it.each(['REINTEGRO', 'NOTA_CREDITO'])(`bloquea %s ${currency}, unidades=${cantidad}, ${role}, sin efectos`, async settlement => {
          const f = await fixture(currency);
          const id = await open(f, cantidad);
          expect((await resolve(id, { settlement, amount: cantidad * 100 })).statusCode).toBe(200);
          const auth = role === 'STAFF' ? await staff(f.storeId) : buildAuthHeaders();
          // #691: STAFF sigue viendo costos aunque no tenga sección Reportes.
          const listed = await request('GET', '/api/returns', undefined, auth);
          expect(listed.json().returns[0]).toMatchObject({ id, itemCost: 60, itemCurrency: currency });
          const before = await snapshot(f.storeId);
          const totals = await figures();
          expect(totals.summary).toMatchObject({ revenue: (10 - cantidad) * 100, grossProfit: (10 - cantidad) * 40 });
          for (let attempt = 0; attempt < 2; attempt++) {
            const cancelled = await request('DELETE', `/api/returns/${id}`, undefined, auth);
            expect(cancelled.statusCode, cancelled.body).toBe(409);
            expect(cancelled.json().error).toContain('Anulá primero el reintegro o la nota de crédito');
          }
          expect(await snapshot(f.storeId)).toEqual(before);
          expect(await figures()).toEqual(totals);
        });
      }
    }

    it.each([50, 200])(`bloquea nota ${currency} aplicada por %s, aun sin saldo`, async spent => {
      const f = await fixture(currency);
      const id = await open(f);
      const resolved = await resolve(id, { settlement: 'NOTA_CREDITO' });
      expect(resolved.statusCode, resolved.body).toBe(200);
      const noteId = resolved.json().return.creditNote.id;
      const next = await request('POST', '/api/operations/sales', {
        clientId: f.client.id, productId: f.inventoryItem.id, cantidad: 2, amount: spent,
        currency, exchangeRate: 1250, creditNoteIds: [noteId], status: 'COMPLETADA', paymentMethod: 'EFECTIVO',
      });
      expect(next.statusCode, next.body).toBe(201);
      expect(await prisma.creditNote.findUniqueOrThrow({ where: { id: noteId } })).toMatchObject({ status: spent === 200 ? 'APLICADA' : 'ABIERTA' });
      const before = await snapshot(f.storeId);
      const totals = await figures();
      expect((await request('DELETE', `/api/returns/${id}`)).statusCode).toBe(409);
      expect(await snapshot(f.storeId)).toEqual(before);
      expect(await figures()).toEqual(totals);
    });
  }

  it('no interpreta una nota borrada lógicamente como compensación revertida', async () => {
    const f = await fixture();
    const id = await open(f);
    expect((await resolve(id, { settlement: 'NOTA_CREDITO' })).statusCode).toBe(200);
    await prisma.creditNote.updateMany({ where: { returnCaseId: id }, data: { deletedAt: new Date() } });
    // Datos históricos incompletos: la nota vinculada también protege el reclamo.
    await prisma.returnCase.update({ where: { id }, data: { settlement: null } });
    const before = await snapshot(f.storeId);
    expect((await request('DELETE', `/api/returns/${id}`)).statusCode).toBe(409);
    expect(await snapshot(f.storeId)).toEqual(before);
  });

  it.each([false, true])('conserva acceso sensible de STAFF sin compensación (permiso=%s)', async allowed => {
    const f = await fixture();
    const id = await open(f);
    expect((await resolve(id, { resolution: 'REPARACION', settlement: 'NINGUNO', amount: 0, destination: 'CLIENTE' })).statusCode).toBe(200);
    const auth = await staff(f.storeId, allowed);
    const totals = await figures();
    const before = await snapshot(f.storeId);
    expect((await request('DELETE', `/api/returns/${id}`, undefined, auth)).statusCode).toBe(allowed ? 204 : 403);
    expect(await figures()).toEqual(totals);
    if (!allowed) expect(await snapshot(f.storeId)).toEqual(before);
    else {
      expect((await prisma.returnCase.findUniqueOrThrow({ where: { id } })).status).toBe('ANULADO');
      expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).toMatchObject({ cantidad: 10, status: 'DISPONIBLE' });
      expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).totalSpent)).toBe(1000);
    }
  });

  it('STAFF sin acceso sensible recibe 403 también para una compensación', async () => {
    const f = await fixture();
    const id = await open(f);
    expect((await resolve(id)).statusCode).toBe(200);
    const auth = await staff(f.storeId, false);
    const before = await snapshot(f.storeId);
    expect((await request('DELETE', `/api/returns/${id}`, undefined, auth)).statusCode).toBe(403);
    expect(await snapshot(f.storeId)).toEqual(before);
  });

  for (const imei of [false, true]) {
    it.each(['ENVIADO', 'RECHAZADO', 'RECIBIDO'])(`revierte RMA sin dinero %s, IMEI=${imei}, y libera unidades`, async status => {
      const f = await fixture('USD', imei ? 1 : 10, imei);
      const supplier = await prisma.supplier.create({ data: { storeId: f.storeId, name: 'Proveedor ficticio HVD-04' } });
      await prisma.inventoryItem.update({ where: { id: f.inventoryItem.id }, data: { supplierId: supplier.id } });
      const cantidad = imei ? 1 : 2;
      const id = await open(f, cantidad);
      const beforeItems = await prisma.inventoryItem.findMany({ where: { storeId: f.storeId }, orderBy: { id: 'asc' } });
      const client = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
      const totals = await figures();
      const resolved = await resolve(id, { resolution: 'REPARACION', settlement: 'NINGUNO', amount: 0, destination: 'PROVEEDOR' });
      expect(resolved.statusCode, resolved.body).toBe(200);
      if (status !== 'ENVIADO') expect((await request('POST', `/api/returns/${id}/rma`, { status })).statusCode).toBe(200);
      const cancelled = await request('DELETE', `/api/returns/${id}`);
      expect(cancelled.statusCode, cancelled.body).toBe(204);
      const original = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } });
      expect(original).toMatchObject({ cantidad: beforeItems[0].cantidad, status: beforeItems[0].status });
      if (!imei) expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: resolved.json().return.inventoryItemId } })).toMatchObject({ cantidad: 0, status: 'VENDIDO' });
      expect(await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).toEqual(client);
      expect(await figures()).toEqual(totals);
      expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(0);
      expect(await prisma.creditNote.count()).toBe(0);
      expect((await request('POST', '/api/returns', { saleId: f.saleId, cantidad: f.sold, reason: 'Nuevo reclamo', openedOn: '2026-11-02' })).statusCode).toBe(201);
      const after = await snapshot(f.storeId);
      expect((await request('DELETE', `/api/returns/${id}`)).statusCode).toBe(404);
      expect(await snapshot(f.storeId)).toEqual(after);
    });
  }

  it('revierte stock, estado y evento si falla la auditoría final', async () => {
    const f = await fixture();
    const supplier = await prisma.supplier.create({ data: { storeId: f.storeId, name: 'Proveedor ficticio rollback' } });
    await prisma.inventoryItem.update({ where: { id: f.inventoryItem.id }, data: { supplierId: supplier.id } });
    const id = await open(f);
    expect((await resolve(id, { resolution: 'REPARACION', settlement: 'NINGUNO', amount: 0, destination: 'PROVEEDOR' })).statusCode).toBe(200);
    const before = await snapshot(f.storeId);
    const spy = vi.spyOn(audit, 'writeAudit').mockRejectedValueOnce(new Error('Fallo ficticio de auditoría'));
    try {
      expect((await request('DELETE', `/api/returns/${id}`)).statusCode).toBe(500);
    } finally { spy.mockRestore(); }
    expect(await snapshot(f.storeId)).toEqual(before);
    expect((await request('DELETE', `/api/returns/${id}`)).statusCode).toBe(204);
  });

  it.each([1, 10])('conserva stock histórico sin descuento previo al anular RMA recibido (venta=%s)', async sold => {
    const f = await fixture('ARS', sold, sold === 1);
    const supplier = await prisma.supplier.create({ data: { storeId: f.storeId, name: 'Proveedor histórico ficticio' } });
    await prisma.sale.update({ where: { id: f.saleId }, data: { stockDeducted: false } });
    await prisma.inventoryItem.update({ where: { id: f.inventoryItem.id }, data: { supplierId: supplier.id, ...(sold === 1 ? { cantidad: 1 } : {}) } });
    const original = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } });
    const id = await open(f, sold === 1 ? 1 : 2);
    if (sold === 1) await prisma.returnCase.update({ where: { id }, data: { cantidad: null } });
    const resolved = await resolve(id, { resolution: 'REPARACION', settlement: 'NINGUNO', amount: 0, destination: 'PROVEEDOR' });
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect((await request('POST', `/api/returns/${id}/rma`, { status: 'RECIBIDO' })).statusCode).toBe(200);
    const totals = await figures();
    const cancelled = await request('DELETE', `/api/returns/${id}`);
    expect(cancelled.statusCode, cancelled.body).toBe(204);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ cantidad: original.cantidad, status: original.status });
    if (sold > 1) expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: resolved.json().return.inventoryItemId } })).toMatchObject({ cantidad: 0, status: 'VENDIDO' });
    expect(await figures()).toEqual(totals);
  });

  it('conserva el alcance de anulados históricos que aún tienen efectos', async () => {
    const f = await fixture();
    const id = await open(f);
    expect((await resolve(id)).statusCode).toBe(200);
    await prisma.returnCase.update({ where: { id }, data: { status: 'ANULADO', deletedAt: new Date() } });
    const eligible = await request('GET', '/api/returns/eligible-sales');
    expect(eligible.json().sales[0]).toMatchObject({ id: f.saleId, remainingQuantity: 8 });
    const excessive = await request('POST', '/api/returns', { saleId: f.saleId, cantidad: 9, reason: 'Exceso', openedOn: '2026-11-02' });
    expect(excessive.statusCode, excessive.body).toBe(409);
    const before = await snapshot(f.storeId);
    expect((await request('POST', `/api/operations/sales/sales/${f.saleId}/cancel`, {})).statusCode).toBe(409);
    expect(await snapshot(f.storeId)).toEqual(before);
  });

  it.each(['reserva', 'cantidad', 'reventa'])('rechaza revertir stock con %s posterior sin escrituras parciales', async changed => {
    const f = await fixture();
    const supplier = await prisma.supplier.create({ data: { storeId: f.storeId, name: 'Proveedor ficticio conflictos' } });
    await prisma.inventoryItem.update({ where: { id: f.inventoryItem.id }, data: { supplierId: supplier.id } });
    const id = await open(f);
    const resolved = await resolve(id, { resolution: 'REPARACION', settlement: 'NINGUNO', amount: 0, destination: 'PROVEEDOR' });
    expect(resolved.statusCode, resolved.body).toBe(200);
    const itemId = resolved.json().return.inventoryItemId;
    if (changed === 'reventa') {
      const original = await prisma.sale.findUniqueOrThrow({ where: { id: f.saleId } });
      const { id: _id, saleNumber: _number, customFields: _fields, cancellationSnapshot: _snapshot, ...data } = original;
      await prisma.sale.create({ data: { ...data, requestKey: null, inventoryItemId: itemId, cantidad: 1 } });
    } else await prisma.inventoryItem.update({ where: { id: itemId }, data: changed === 'reserva' ? { reservedClientId: f.client.id } : { cantidad: 1 } });
    const before = await snapshot(f.storeId);
    const cancelled = await request('DELETE', `/api/returns/${id}`);
    expect(cancelled.statusCode, cancelled.body).toBe(409);
    expect(cancelled.json().error).toContain('stock cambió');
    expect(await snapshot(f.storeId)).toEqual(before);
  });

  it('aísla la tienda incluso al bloquear una compensación', async () => {
    const f = await fixture();
    const id = await open(f);
    expect((await resolve(id)).statusCode).toBe(200);
    await seedStoreContext({ firebaseUid: 'hvd04-other', email: 'hvd04-other@example.com' });
    const before = await snapshot(f.storeId);
    expect((await request('DELETE', `/api/returns/${id}`, undefined, buildAuthHeaders({ uid: 'hvd04-other', email: 'hvd04-other@example.com' }))).statusCode).toBe(404);
    expect(await snapshot(f.storeId)).toEqual(before);
  });

  it('serializa resolver y anular sin dejar compensaciones huérfanas', async () => {
    const f = await fixture();
    const id = await open(f);
    const [resolved, cancelled] = await Promise.all([resolve(id), request('DELETE', `/api/returns/${id}`)]);
    const claim = await prisma.returnCase.findUniqueOrThrow({ where: { id } });
    if (resolved.statusCode === 200) {
      expect(cancelled.statusCode, cancelled.body).toBe(409);
      expect(claim).toMatchObject({ status: 'RESUELTO', deletedAt: null });
      expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).totalSpent)).toBe(800);
      expect((await figures()).summary).toMatchObject({ revenue: 800, grossProfit: 320 });
    } else {
      expect(resolved.statusCode, resolved.body).toBe(404);
      expect(cancelled.statusCode, cancelled.body).toBe(204);
      expect(claim.status).toBe('ANULADO');
      expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(0);
      expect((await figures()).summary).toMatchObject({ revenue: 1000, grossProfit: 400 });
    }
  });
});
