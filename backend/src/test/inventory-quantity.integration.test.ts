import { afterEach, expect, it, vi } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
afterEach(() => vi.unstubAllEnvs());

it('analiza y confirma 141 equipos mayoristas conservando costo, precio y capacidad', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  const { store } = await seedStoreContext();
  const sheets = [{ name: 'Stock', rows: [
    ['Modelo', 'Capacidad', 'Cantidad', 'Costo USD', 'Precio USD'],
    ['15 Pro', '128GB', '58', '450', '650'],
    ['14 Pro', '256GB', '83', '350', '500'],
  ] }];
  const analysis = await getApp().inject({ method: 'POST', url: '/api/import/analyze', headers, payload: { section: 'inventory', sheets } });
  expect(analysis.statusCode, analysis.body).toBe(200);
  expect(analysis.json().summary.rowCount).toBe(141);
  const applied = await getApp().inject({ method: 'POST', url: '/api/import/apply', headers, payload: { section: 'inventory', sheets, plan: analysis.json().plan } });
  expect(applied.statusCode, applied.body).toBe(200);
  expect(applied.json().rows).toEqual(analysis.json().rows);
  const rows = applied.json().rows.map((row: Record<string, string>) => ({ ...row, quantity: Number(row.quantity), sourceRow: Number(row._sourceRow) }));
  const saved = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows } });
  expect(saved.statusCode, saved.body).toBe(200);
  expect(saved.json()).toMatchObject({ imported: 2, updated: 0, withoutImei: 2, errors: [], diagnostics: { detectedRows: 2, acceptedRows: 2 } });
  const items = await prisma.inventoryItem.findMany({ where: { storeId: store!.id } });
  expect(items).toHaveLength(2);
  expect(items.every(item => item.imei === null && item.currency === 'USD')).toBe(true);
  for (const [model, capacity, cost, price, quantity] of [['15 Pro', '128GB', 450, 650, 58], ['14 Pro', '256GB', 350, 500, 83]] as const) {
    const group = items.filter(item => item.model === model);
    expect(group).toHaveLength(1);
    expect(group[0].cantidad).toBe(quantity);
    expect(group.every(item => item.capacity === capacity && Number(item.cost) === cost && Number(item.price) === price)).toBe(true);
  }
});

it('crea miles sin IMEI en lotes conservando proveedor, compra, personalizados y precio a definir', async () => {
  const { store } = await seedStoreContext();
  const supplier = await prisma.supplier.create({ data: { storeId: store!.id, name: 'Mayorista ficticio' } });
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: {
    supplierId: supplier.id,
    definitions: [{ entity: 'inventory', key: 'origen_qa', label: 'Origen QA', type: 'text', order: 0 }],
    rows: [{ model: '15 Pro', quantity: 1001, cost: 450, price: null, currency: 'USD', purchasedAt: '15/09/2026', purchaseName: 'Lote ficticio', customFields: { origen_qa: 'Mayorista' } }],
  } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ imported: 1, priceToDefine: 1, withoutImei: 1, errors: [] });
  const items = await prisma.inventoryItem.findMany({ where: { storeId: store!.id } });
  expect(new Set(items.map(item => item.id)).size).toBe(1);
  expect(items.every(item => item.imei === null && item.price === null && Number(item.cost) === 450 && item.supplierId === supplier.id && (item.customFields as { origen_qa: string }).origen_qa === 'Mayorista')).toBe(true);
  const purchases = await prisma.stockPurchase.findMany({ where: { storeId: store!.id }, include: { items: true } });
  expect(purchases).toHaveLength(1);
  expect(purchases[0].name).toBe('Lote ficticio');
  expect(purchases[0].purchasedAt.toISOString().slice(0, 10)).toBe('2026-09-15');
  expect(purchases[0].items).toHaveLength(1);
  expect(items[0].cantidad).toBe(1001);
});

it('importa 1001 filas sin columna de cantidad como 1001 equipos', async () => {
  const { store } = await seedStoreContext();
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows: Array.from({ length: 1001 }, (_, index) => ({ model: `Equipo ${index}`, price: 500, cost: 350 })) } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ imported: 1001, errors: [] });
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(1001);
});

it('cantidad vacía o ausente equivale a uno también en confirmación directa', async () => {
  const { store } = await seedStoreContext();
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows: [
    { model: 'Sin cantidad' }, { model: 'Cantidad vacía', quantity: '' }, { model: 'Cantidad texto', quantity: '101' },
  ] } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ imported: 3, updated: 0 });
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(3);
});

it.each([0, -1, 1.5, 'tres'])('rechaza cantidad inválida %s sin crear equipos', async quantity => {
  const { store } = await seedStoreContext();
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows: [{ model: 'Equipo', quantity }] } });
  expect(response.statusCode).toBe(400);
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(0);
});

it('rechaza cantidad mayor a uno con IMEI sin persistencia parcial', async () => {
  const { store } = await seedStoreContext();
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows: [
    { model: 'Una unidad' }, { model: 'Identificado', imei: '990000000001109', quantity: 3 },
  ] } });
  expect(response.statusCode, response.body).toBe(400);
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(0);
});

it('revierte lotes previos y proveedores si falla una actualización posterior', async () => {
  const { store } = await seedStoreContext();
  const locked = await prisma.inventoryItem.create({ data: { storeId: store!.id, imei: '990000000000038', model: 'Original', capacity: '', color: '', condition: 'USADO', grade: '', batteryHealth: '', cost: 0, price: null, status: 'DISPONIBLE', reservedDepositId: 'locked' } });
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows: [
    ...Array.from({ length: 501 }, () => ({ model: 'Nuevo', supplierName: 'Proveedor nuevo' })), { model: 'Cambiar', imei: locked.imei },
  ] } });
  expect(response.statusCode, response.body).toBe(409);
  expect(await prisma.inventoryItem.findMany({ where: { storeId: store!.id } })).toEqual([locked]);
  expect(await prisma.supplier.count({ where: { storeId: store!.id } })).toBe(0);
});

it('la ruta de carga en serie acepta más de 200 equipos', async () => {
  const { store } = await seedStoreContext();
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/batch', headers, payload: { items: Array.from({ length: 201 }, () => ({ model: '15 Pro', imei: '', capacity: '128GB', color: '', condition: 'USADO', grade: '', batteryHealth: '', cost: 450, price: 650, status: 'DISPONIBLE' })) } });
  expect(response.statusCode, response.body).toBe(201);
  expect(response.json().created).toHaveLength(201);
  expect(response.json().errors).toEqual([]);
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(201);
}, 20_000);
