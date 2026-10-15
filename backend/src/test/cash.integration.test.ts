import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
const headers = () => buildAuthHeaders();
function post(path: string, payload?: object, auth = headers()) {
  return getApp().inject({ method: 'POST', url: `/api/cash${path}`, headers: auth, ...(payload ? { payload } : {}) });
}
async function box(currency = 'ARS', method = 'EFECTIVO', opening = 0) {
  const response = await post('', { name: `${currency} ${method}`, currency, method, opening });
  expect(response.statusCode, response.body).toBe(200);
  return response.json().id as string;
}
async function open(id: string) {
  const response = await post(`/${id}/open`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json().id as string;
}
async function balance(id: string) { return Number((await prisma.cashRegister.findUniqueOrThrow({ where: { id } })).balance); }
function move(registerId: string, amount: number, extras: object = {}) {
  return post('/movements', { registerId, amount, kind: 'INGRESO', requestKey: crypto.randomUUID(), ...extras });
}
async function list(auth = headers()) {
  const response = await getApp().inject({ url: '/api/cash', headers: auth });
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}

describe('caja diaria', () => {
  it('abre, cobra, cuenta y cierra cada moneda/medio sin convertir al cambiar el dólar o la moneda de tienda', async () => {
    const f = await seedStoreContext();
    const ars = await box('ARS', 'EFECTIVO', 10000), usd = await box('USD', 'EFECTIVO', 100), bank = await box('ARS', 'TRANSFERENCIA', 3000);
    const sessions = await Promise.all([open(ars), open(usd), open(bank)]);
    expect((await move(ars, 2500)).statusCode).toBe(200);
    expect((await move(usd, 25.25)).statusCode).toBe(200);
    expect((await move(bank, 500)).statusCode).toBe(200);
    await prisma.store.update({ where: { id: f.store!.id }, data: { currency: 'USD', manualSell: 9999, exchangeMode: 'manual' } });
    expect(await Promise.all([balance(ars), balance(usd), balance(bank)])).toEqual([12500, 125.25, 3500]);
    for (const [i, input] of [{ denominations: { '10000': 1, '2000': 1, '500': 1 } }, { denominations: { '100': 1, '20': 1, '5': 1, '0.25': 1 } }, { counted: 3500 }].entries()) {
      const counted = await post(`/sessions/${sessions[i]}/count`, input);
      expect(counted.statusCode, counted.body).toBe(200);
      expect(counted.json().difference).toBe(0);
      expect((await post(`/sessions/${sessions[i]}/review`, { action: 'APPROVE' })).statusCode).toBe(200);
    }
    expect(await Promise.all([balance(ars), balance(usd), balance(bank)])).toEqual([12500, 125.25, 3500]);
    const history = await getApp().inject({ url: `/api/cash/${usd}/sessions`, headers: headers() });
    expect(history.json().sessions[0].counts[0]).toMatchObject({ expected: 125.25, counted: 125.25, difference: 0 });
    expect((await post(`/${ars}/open`)).statusCode).toBe(409);
  });

  it('conserva intentos, exige nota, bloquea movimientos y aprueba la diferencia solo en esa moneda', async () => {
    await seedStoreContext();
    const ars = await box('ARS', 'EFECTIVO', 1000), usd = await box('USD', 'EFECTIVO', 50);
    const session = await open(ars); await open(usd);
    expect((await post(`/sessions/${session}/count`, { denominations: { '100': 9 } })).statusCode).toBe(400);
    expect((await post(`/sessions/${session}/count`, { denominations: { '100': 9 }, note: 'Faltante' })).json()).toMatchObject({ expected: 1000, counted: 900, difference: -100 });
    expect((await move(ars, 10)).statusCode).toBe(409);
    expect((await post(`/${ars}/open`)).statusCode).toBe(409);
    expect((await post(`/sessions/${session}/review`, { action: 'RECOUNT', note: 'Revisar billetes' })).statusCode).toBe(200);
    expect((await list()).registers.find((r: { id: string }) => r.id === ars).session).not.toHaveProperty('counts');
    expect((await move(ars, 10)).statusCode).toBe(409);
    await post(`/sessions/${session}/count`, { denominations: { '100': 9, '50': 1 }, note: 'Faltan 50' });
    await post(`/sessions/${session}/review`, { action: 'APPROVE' });
    await post(`/sessions/${session}/review`, { action: 'APPROVE' });
    expect(await balance(ars)).toBe(950); expect(await balance(usd)).toBe(50);
    expect(await prisma.cashCount.count({ where: { sessionId: session } })).toBe(2);
    expect(await prisma.cashMovement.count({ where: { sessionId: session, kind: 'ARQUEO' } })).toBe(1);
  });

  it('mantiene días locales y el fondo del próximo día; no abre con el anterior pendiente', async () => {
    await seedStoreContext(); const id = await box('USD', 'EFECTIVO', 50); const session = await open(id);
    await prisma.cashSession.update({ where: { id: session }, data: { day: '2020-01-01' } });
    expect((await post(`/${id}/open`)).statusCode).toBe(409);
    await post(`/sessions/${session}/count`, { denominations: { '50': 1 } });
    await post(`/sessions/${session}/review`, { action: 'APPROVE' });
    const next = await open(id);
    expect(next).not.toBe(session);
    expect(Number((await prisma.cashSession.findUniqueOrThrow({ where: { id: next } })).opening)).toBe(50);
  });

  it('registra egresos, cambia categoría sin mover dinero, ajusta y anula una sola vez', async () => {
    await seedStoreContext(); const id = await box('ARS', 'EFECTIVO', 1000); await open(id);
    expect((await move(id, 100, { kind: 'EGRESO' })).statusCode).toBe(400);
    const key = crypto.randomUUID();
    const expense = await move(id, 100, { kind: 'EGRESO', category: 'Proveedores', requestKey: key });
    await move(id, 100, { kind: 'EGRESO', category: 'Proveedores', requestKey: key });
    expect((await move(id, 101, { kind: 'EGRESO', category: 'Proveedores', requestKey: key })).statusCode).toBe(409);
    expect(await balance(id)).toBe(900);
    await getApp().inject({ method: 'PATCH', url: `/api/cash/movements/${expense.json().id}/category`, headers: headers(), payload: { category: 'Alquiler' } });
    expect(await balance(id)).toBe(900);
    await post(`/movements/${expense.json().id}/void`); await post(`/movements/${expense.json().id}/void`);
    expect(await balance(id)).toBe(1000);
    expect((await move(id, -50, { kind: 'AJUSTE' })).statusCode).toBe(400);
    expect((await move(id, -50, { kind: 'AJUSTE', note: 'Corrección del fondo' })).statusCode).toBe(200);
    expect(await balance(id)).toBe(950);
  });

  it('convierte solo por pedido explícito, guarda cotización y revierte ambas patas atómicamente', async () => {
    await seedStoreContext(); const usd = await box('USD', 'EFECTIVO', 100), ars = await box();
    await open(usd);
    const input = { fromId: usd, toId: ars, amount: 20, exchangeRate: 1234.5, requestKey: crypto.randomUUID() };
    expect((await post('/transfers', input)).statusCode).toBe(409);
    expect(await balance(usd)).toBe(100); expect(await balance(ars)).toBe(0);
    await open(ars);
    const transfer = await post('/transfers', input); expect(transfer.statusCode, transfer.body).toBe(200);
    await post('/transfers', input);
    expect(await balance(usd)).toBe(80); expect(await balance(ars)).toBe(24690);
    const legs = await prisma.cashMovement.findMany({ where: { kind: 'TRANSFERENCIA' } });
    expect(legs).toHaveLength(2); expect(legs.map(r => Number(r.exchangeRate))).toEqual([1234.5, 1234.5]);
    await post(`/movements/${transfer.json().id}/void`); await post(`/movements/${transfer.json().id}/void`);
    expect(await balance(usd)).toBe(100); expect(await balance(ars)).toBe(0);
    expect(await prisma.cashMovement.count({ where: { kind: 'ANULACION' } })).toBe(2);
  });

  it('separa acceso, saldo y administración; no filtra conteos al recontar ni datos de otra tienda', async () => {
    const owner = await seedStoreContext(); const id = await box('USD', 'EFECTIVO', 50); const session = await open(id);
    const staff = await prisma.user.create({ data: { firebaseUid: 'cash-staff', email: 'cash-staff@example.com' } });
    await prisma.storeMember.create({ data: { userId: staff.id, storeId: owner.store!.id, role: 'STAFF', sections: ['cash'], isDefault: true } });
    const auth = buildAuthHeaders({ uid: 'cash-staff', email: 'cash-staff@example.com' });
    expect((await list(auth)).registers[0]).not.toHaveProperty('balance');
    for (const path of [`/${id}/movements`, `/${id}/sessions`]) expect((await getApp().inject({ url: `/api/cash${path}`, headers: auth })).statusCode).toBe(403);
    expect((await post('', { name: 'Otra', currency: 'USD', method: 'EFECTIVO', opening: 0 }, auth)).statusCode).toBe(403);
    expect((await post(`/sessions/${session}/count`, { denominations: { '50': 1 } }, auth)).statusCode).toBe(200);
    expect((await post(`/sessions/${session}/review`, { action: 'APPROVE' }, auth)).statusCode).toBe(403);
    await post(`/sessions/${session}/review`, { action: 'RECOUNT', note: 'Revisar' });
    expect((await list(auth)).registers[0].session).not.toHaveProperty('counts');
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@example.com' });
    const otherAuth = buildAuthHeaders({ uid: other.user.firebaseUid, email: other.user.email! });
    expect((await post(`/${id}/open`, undefined, otherAuth)).statusCode).toBe(404);
  });

  it('cobra una venta en stock y en la caja original; el fallo de sesión revierte ambas cosas', async () => {
    const f = await seedStoreContext(); const catalog = await seedCatalogFixture(f.store!.id); const usd = await box('USD'); const ars = await box(); await open(ars);
    const payload = { clientId: catalog.client.id, productId: catalog.inventoryItem.id, amount: 100, currency: 'USD', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', exchangeRate: 1500 };
    const sale = () => getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: headers(), payload });
    expect((await sale()).statusCode).toBe(409);
    expect(await prisma.sale.count()).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).status).toBe('DISPONIBLE');
    await open(usd); const result = await sale(); expect(result.statusCode, result.body).toBe(201);
    expect(await balance(usd)).toBe(100); expect(await balance(ars)).toBe(0);
    const cancel = () => getApp().inject({ method: 'POST', url: `/api/operations/sales/sales/${result.json().sale.id}/cancel`, headers: headers() });
    expect((await cancel()).statusCode).toBe(200); await cancel();
    expect(await balance(usd)).toBe(0); expect(await prisma.cashMovement.count({ where: { kind: 'ANULACION' } })).toBe(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).status).toBe('DISPONIBLE');
  });

  it('no vuelve a cobrar una seña aplicada, y conserva moneda y medio en pagos mixtos', async () => {
    const f = await seedStoreContext(); const c = await seedCatalogFixture(f.store!.id);
    const ars = await box(), usd = await box('USD'), bank = await box('USD', 'TRANSFERENCIA'); await open(ars); await open(usd); await open(bank);
    const receipt = await getApp().inject({ method: 'POST', url: `/api/clients/${c.client.id}/deposits`, headers: headers(), payload: { amount: 30000, currency: 'ARS', exchangeRate: 1500, method: 'EFECTIVO', requestKey: crypto.randomUUID() } });
    expect(receipt.statusCode, receipt.body).toBe(201);
    const response = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: headers(), payload: { clientId: c.client.id, productId: c.inventoryItem.id, amount: 100, currency: 'USD', paymentMethod: 'EFECTIVO', exchangeRate: 1500, depositIds: [receipt.json().deposit.id], tenders: [{ amount: 30, currency: 'USD', method: 'EFECTIVO' }, { amount: 50, currency: 'USD', method: 'TRANSFERENCIA' }] } });
    expect(response.statusCode, response.body).toBe(201);
    expect(await Promise.all([balance(ars), balance(usd), balance(bank)])).toEqual([30000, 30, 50]);
    const cancel = await getApp().inject({ method: 'POST', url: `/api/operations/sales/sales/${response.json().sale.id}/cancel`, headers: headers() });
    expect(cancel.statusCode, cancel.body).toBe(200);
    expect(await Promise.all([balance(ars), balance(usd), balance(bank)])).toEqual([30000, 0, 0]);
  });

  it('archiva solo tras aprobar y desarchiva con el mismo saldo', async () => {
    await seedStoreContext(); const id = await box('USD', 'EFECTIVO', 25); const session = await open(id);
    const edit = (payload: object) => getApp().inject({ method: 'PATCH', url: `/api/cash/${id}`, headers: headers(), payload });
    expect((await edit({ archived: true })).statusCode).toBe(409);
    await post(`/sessions/${session}/count`, { denominations: { '20': 1, '5': 1 } }); await post(`/sessions/${session}/review`, { action: 'APPROVE' });
    expect((await edit({ archived: true })).statusCode).toBe(200);
    expect((await post(`/${id}/open`)).statusCode).toBe(409);
    expect((await edit({ archived: false, isDefault: true })).statusCode).toBe(200);
    expect(await balance(id)).toBe(25);
  });

  it('vincula cobros de cuotas, anticipos y cobros de reparación con su moneda y medio', async () => {
    const f = await seedStoreContext(); const c = await seedCatalogFixture(f.store!.id);
    const ars = await box(), bank = await box('ARS', 'TRANSFERENCIA'); await open(ars); await open(bank);
    const sale = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: headers(), payload: { clientId: c.client.id, deviceLabel: 'Equipo financiado', amount: 900, currency: 'ARS', paymentMethod: 'EFECTIVO', installments: { count: 3, frequency: 'MENSUAL', firstDueDate: '2026-11-14', collectFirstNow: true, firstMethod: 'EFECTIVO' } } });
    expect(sale.statusCode, sale.body).toBe(201);
    expect(await balance(ars)).toBe(300);
    const collection = await getApp().inject({ method: 'POST', url: '/api/accounts/collections', headers: headers(), payload: { clientId: c.client.id, saleId: sale.json().sale.id, amount: 200, currency: 'ARS', method: 'TRANSFERENCIA' } });
    expect(collection.statusCode, collection.body).toBe(201); expect(await balance(bank)).toBe(200);
    const repair = await getApp().inject({ method: 'POST', url: '/api/repairs', headers: headers(), payload: { clientId: c.client.id, device: 'iPhone 13', fault: 'Pantalla', estimate: 500, deposit: 50, currency: 'ARS' } });
    expect(repair.statusCode, repair.body).toBe(201); expect(await balance(ars)).toBe(350);
    const repairPaid = await getApp().inject({ method: 'POST', url: '/api/accounts/collections', headers: headers(), payload: { clientId: c.client.id, repairId: repair.json().order.id, amount: 100, currency: 'ARS', method: 'TRANSFERENCIA' } });
    expect(repairPaid.statusCode, repairPaid.body).toBe(201); expect(await balance(bank)).toBe(300);
  });

  it('filtra fechas inclusivas en horario de tienda y categoría, sin perder las otras categorías', async () => {
    const f = await seedStoreContext(); const id = await box(); await open(id);
    for (const [amount, category, createdAt] of [[10, 'Alquiler', '2026-10-14T02:59:59Z'], [20, 'Proveedores', '2026-10-14T03:00:00Z'], [30, null, '2026-10-15T02:59:59Z'], [40, 'Alquiler', '2026-10-15T03:00:00Z']] as const) {
      await prisma.cashMovement.create({ data: { storeId: f.store!.id, registerId: id, amount, category, createdAt: new Date(createdAt), kind: 'INGRESO' } });
    }
    const query = (suffix: string) => getApp().inject({ url: `/api/cash/${id}/movements?from=2026-10-14&to=2026-10-14${suffix}`, headers: headers() });
    const all = await query(''); expect(all.json().movements.map((m: { amount: number }) => m.amount)).toEqual([30, 20]);
    expect((await query('&category=__none__')).json().movements.map((m: { amount: number }) => m.amount)).toEqual([30]);
    expect((await query('&category=Proveedores')).json().categories).toEqual(['Alquiler', 'Proveedores']);
  });

  it('serializa pedidos concurrentes sin duplicar apertura ni ingreso', async () => {
    await seedStoreContext(); const id = await box('USD');
    const [first, second] = await Promise.all([open(id), open(id)]); expect(first).toBe(second);
    const key = crypto.randomUUID();
    const responses = await Promise.all([move(id, 12.34, { requestKey: key }), move(id, 12.34, { requestKey: key })]);
    expect(responses.map(r => r.statusCode)).toEqual([200, 200]);
    expect(responses[0].json().id).toBe(responses[1].json().id); expect(await balance(id)).toBe(12.34);
  });
});
