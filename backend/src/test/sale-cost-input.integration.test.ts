import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
async function setup(role: 'OWNER' | 'MANAGER' | 'STAFF' = 'OWNER') {
  const context = await seedStoreContext({ role });
  const storeId = context.store!.id;
  const fixture = await seedCatalogFixture(storeId);
  await prisma.inventoryItem.update({ where: { id: fixture.inventoryItem.id }, data: { currency: 'USD' } });
  await prisma.store.update({ where: { id: storeId }, data: { currency: 'USD' } });
  const headers = buildAuthHeaders({ uid: context.user.firebaseUid });
  const create = (payload: object = {}, legacy = false) => getApp().inject({
    method: 'POST', url: legacy ? '/api/sales' : '/api/operations/sales', headers,
    payload: { productId: fixture.inventoryItem.id, amount: 1500.31, currency: 'USD', amountCurrency: 'USD',
      date: '03/11/2026', status: 'COMPLETADA', paymentMethod: 'EFECTIVO', ...payload },
  });
  const edit = (id: string, payload: object, legacy = false) => getApp().inject({
    method: 'PATCH', url: legacy ? `/api/sales/${id}` : `/api/operations/sales/sales/${id}`, headers, payload,
  });
  const item = () => prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } });
  const overview = async () => {
    const result = await getApp().inject({ method: 'GET', url: '/api/reports/overview?rangeKey=all_time', headers });
    expect(result.statusCode, result.body).toBe(200);
    return result.json().overview.summary;
  };
  return { ...context, storeId, fixture, headers, create, edit, item, overview };
}

describe('costo del equipo desde la venta', () => {
  it.each([false, true])('crea costo con auditoría y replay sin duplicar (ruta legacy: %s)', async legacy => {
    const { create, item, storeId, user } = await setup();
    const payload = { cost: 900.12, requestKey: 'costo-venta-ficticia' };
    const created = await create(payload, legacy);
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().inventory[0].cost).toBe(900.12);
    const saved = await item();
    expect(saved.cost.toNumber()).toBe(900.12);
    expect(saved.costChangedBy).toBe(user.displayName);
    expect(saved.costChangedAt).toBeInstanceOf(Date);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { storeId, entityId: saved.id, action: 'inventory.cost' } });
    expect(audit).toMatchObject({ actorUserId: user.id, actorName: user.displayName, entityType: 'inventory', source: 'app', detail: '800 → 900.12' });
    expect(audit.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'cost', label: 'Costo' })]));
    const replay = await create({ ...payload, cost: 1100 }, legacy);
    expect(replay.statusCode, replay.body).toBe(201);
    expect(replay.json().sale.id).toBe(created.json().sale.id);
    expect((await item()).cost.toNumber()).toBe(900.12);
    expect(await prisma.auditEvent.count({ where: { storeId, action: 'inventory.cost' } })).toBe(1);
  });

  it('crea un encargue needsCompletion con costo y ganancia en Dashboard', async () => {
    const { create, overview, storeId } = await setup();
    const created = await create({ productId: null, deviceLabel: 'Equipo por encargue', unlistedEquipment: { model: 'Equipo por encargue' }, cost: 900.12 });
    expect(created.statusCode, created.body).toBe(201);
    const saved = await prisma.inventoryItem.findFirstOrThrow({ where: { id: created.json().sale.productId, storeId } });
    expect(saved).toMatchObject({ needsCompletion: true, currency: 'USD', status: 'VENDIDO', costChangedBy: 'Test Owner' });
    expect(saved.cost.toNumber()).toBe(900.12);
    expect(await overview()).toMatchObject({ salesWithoutCost: 0 });
    expect((await overview()).grossProfit).toBeCloseTo(600.19);
  });

  it('cargar costo después elimina sin costo y actualiza la ganancia por cantidad', async () => {
    const { fixture, create, edit, item, overview } = await setup();
    await prisma.inventoryItem.update({ where: { id: fixture.inventoryItem.id }, data: { cost: 0, imei: null, cantidad: 10, acquiredQuantity: 10 } });
    const created = await create({ cantidad: 3, amount: 1950 });
    expect(created.statusCode, created.body).toBe(201);
    expect(await overview()).toMatchObject({ salesWithoutCost: 1, grossProfit: 0 });
    const changed = await edit(created.json().sale.id, { cost: 450.25 });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json().inventory[0].cost).toBe(450.25);
    expect((await item()).cantidad).toBe(7);
    expect(await overview()).toMatchObject({ salesWithoutCost: 0, grossProfit: 599.25 });
  });

  it.each([undefined, '', '   ', null])('costo vacío %j no pisa costo ni autor de venta histórica', async cost => {
    const { create, edit, item, storeId } = await setup();
    const created = await create();
    expect(created.statusCode, created.body).toBe(201);
    await prisma.sale.update({ where: { id: created.json().sale.id }, data: { integratedOperation: false } });
    const changed = await edit(created.json().sale.id, { paymentMethod: 'TRANSFERENCIA', ...(cost === undefined ? {} : { cost }) }, true);
    expect(changed.statusCode, changed.body).toBe(200);
    const saved = await item();
    expect(saved.cost.toNumber()).toBe(800);
    expect(saved.costChangedAt).toBeNull();
    expect(await prisma.auditEvent.count({ where: { storeId, action: 'inventory.cost' } })).toBe(0);
  });

  it('edita costo de venta histórica por endpoint legacy y acepta cero', async () => {
    const { create, edit, item } = await setup();
    const created = await create();
    await prisma.sale.update({ where: { id: created.json().sale.id }, data: { integratedOperation: false } });
    const updated = await edit(created.json().sale.id, { cost: 950.11 }, true);
    expect(updated.statusCode, updated.body).toBe(200);
    expect((await item()).cost.toNumber()).toBe(950.11);
    expect((await edit(created.json().sale.id, { cost: 0 }, true)).statusCode).toBe(200);
    expect((await item()).cost.toNumber()).toBe(0);
  });

  it.each([-1, 1.001, 10000000000])('rechaza costo inválido %s sin cambiar stock ni ventas', async cost => {
    const { create, item, storeId } = await setup();
    const response = await create({ cost });
    expect(response.statusCode, response.body).toBe(400);
    expect((await item()).cost.toNumber()).toBe(800);
    expect((await item()).status).toBe('DISPONIBLE');
    expect(await prisma.sale.count({ where: { storeId } })).toBe(0);
  });

  it('un fallo posterior revierte costo y auditoría con la venta', async () => {
    const { create, item, storeId } = await setup();
    const result = await create({ cost: 900, sellerMemberId: 'miembro-inexistente' });
    expect([400, 404]).toContain(result.statusCode);
    expect((await item()).cost.toNumber()).toBe(800);
    expect(await prisma.sale.count({ where: { storeId } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { storeId, action: 'inventory.cost' } })).toBe(0);
  });

  it('canje usa precio completo y confirma borradores con costo', async () => {
    const { create, fixture, headers, item, overview } = await setup();
    const draft = await create({ draft: true, clientId: fixture.client.id, tradeIn: { deviceReceived: 'Recibido ficticio', takeValue: 300 } });
    expect(draft.statusCode, draft.body).toBe(201);
    const confirmed = await getApp().inject({ method: 'POST', url: `/api/operations/sales/trades/${draft.json().tradeIn.id}/confirm`, headers, payload: { cost: 900.12 } });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect((await item()).cost.toNumber()).toBe(900.12);
    expect(confirmed.json().sale.amount).toBe(1500.31);
    expect(confirmed.json().tradeIn.differencePaid).toBeCloseTo(1200.31);
    expect((await overview()).grossProfit).toBeCloseTo(600.19);
  });

  it('edición desde un canje confirmado conserva autor de la auditoría del costo', async () => {
    const { create, fixture, headers, item, storeId, user } = await setup();
    const created = await create({ clientId: fixture.client.id, tradeIn: { deviceReceived: 'Recibido ficticio', takeValue: 300 } });
    expect(created.statusCode, created.body).toBe(201);
    const changed = await getApp().inject({ method: 'PATCH', url: `/api/operations/tradeins/trades/${created.json().tradeIn.id}`, headers, payload: { cost: 950.12 } });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(await item()).toMatchObject({ costChangedBy: user.displayName });
    expect((await item()).cost.toNumber()).toBe(950.12);
    expect(await prisma.auditEvent.findFirstOrThrow({ where: { storeId, action: 'inventory.cost' } })).toMatchObject({ actorUserId: user.id, actorName: user.displayName });
  });

  it.each([false, true])('sin Reportes rechaza escrituras y no devuelve costo (legacy: %s)', async legacy => {
    const { membership, create, edit, item, headers } = await setup('MANAGER');
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { sections: ['sales'] } });
    expect((await create({ cost: 1 }, legacy)).statusCode).toBe(403);
    expect((await item()).cost.toNumber()).toBe(800);
    const options = await getApp().inject({ method: 'GET', url: '/api/operations/sales/options', headers });
    expect(options.statusCode).toBe(200);
    expect(options.json().products[0]).not.toHaveProperty('cost');
    const created = await create({}, legacy);
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().inventory[0]).not.toHaveProperty('cost');
    expect((await edit(created.json().sale.id, { cost: 2 }, legacy)).statusCode).toBe(403);
    const detail = await getApp().inject({ method: 'GET', url: `/api/operations/sales/sales/${created.json().sale.id}`, headers });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().inventory[0]).not.toHaveProperty('cost');
  });

  it('STAFF conserva acceso financiero temporal #691', async () => {
    const { membership, create, item } = await setup('STAFF');
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { sections: ['sales'] } });
    const result = await create({ cost: 850 });
    expect(result.statusCode, result.body).toBe(201);
    expect(result.json().inventory[0].cost).toBe(850);
    expect((await item()).cost.toNumber()).toBe(850);
  });

  it('precio faltante en otra moneda no cambia la moneda del costo', async () => {
    const { fixture, create, item } = await setup();
    await prisma.inventoryItem.update({ where: { id: fixture.inventoryItem.id }, data: { price: null } });
    const result = await create({ amount: 1800000, currency: 'ARS', cost: 900.12 });
    expect(result.statusCode, result.body).toBe(201);
    expect(await item()).toMatchObject({ currency: 'USD', price: null });
    expect((await item()).cost.toNumber()).toBe(900.12);
  });
});
