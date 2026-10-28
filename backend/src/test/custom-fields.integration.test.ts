import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
async function context() {
  const context = await seedStoreContext();
  return { ...context, headers: buildAuthHeaders({ uid: context.user.firebaseUid, email: context.user.email! }) };
}
const row = { imei: '', model: 'iPhone ficticio', price: null };
const definitions = [{ entity: 'inventory', key: 'reparaciones', label: 'Reparaciones', type: 'number', order: 0 }, { entity: 'inventory', key: 'garantia', label: 'Garantía hasta', type: 'date', order: 1 }];
describe('custom equipment fields and import', () => {
  it('persists repair status and original value alongside typed fields and entry date', async () => {
    const { headers, store } = await context();
    const result = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: {
      definitions, rows: [{ ...row, sourceRow: 7, status: 'SERVICIO TECNICO', entryDate: '2026-10-15',
        batteryHealth: '85%', batteryNote: 'Batería cambiada', supplierName: 'Proveedor ficticio',
        customFields: { serial: 'SERIE-FICTICIA', reparaciones: '2', garantia: '2026-12-31' } }],
    } });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ imported: 1, errors: [] });
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: store!.id } });
    expect(item).toMatchObject({ status: 'EN_REVISION', entryDate: expect.any(Date), batteryHealth: '85%',
      batteryNote: 'Batería cambiada', supplierId: expect.any(String), customFields: {
        serial: 'SERIE-FICTICIA', originalStatus: 'SERVICIO TECNICO', reparaciones: 2, garantia: '2026-12-31',
      } });
    expect(item.entryDate!.toISOString().slice(0, 10)).toBe('2026-10-15');
  });
  it('commits definitions and valid typed rows; errors identify original Excel rows', async () => {
    const { headers, store } = await context();
    const result = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { definitions, rows: [
      { ...row, sourceRow: 1, entryDate: '14/10/2026', batteryNote: 'Batería cambiada', supplierName: 'Proveedor ficticio', customFields: { reparaciones: '1.250,5', garantia: '31/12/2026' } },
      { ...row, sourceRow: 7, customFields: { reparaciones: 'texto' } },
      { ...row, sourceRow: 9, entryDate: '31/02/2026' },
    ] } });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ imported: 1, errors: [{ row: 7, message: expect.stringContaining('número inválido') }, { row: 9, message: expect.stringContaining('Fecha de ingreso inválida') }] });
    expect(await prisma.customFieldDefinition.count({ where: { storeId: store!.id } })).toBe(2);
    const list = await getApp().inject({ method: 'GET', url: '/api/inventory?skip=0&take=30', headers });
    expect(list.json().items[0]).toMatchObject({ entryDate: expect.stringContaining('2026-10-14'), batteryNote: 'Batería cambiada', supplierName: 'Proveedor ficticio', customFields: { reparaciones: 1250.5, garantia: '2026-12-31' } });
  });
  it('scopes CRUD to the store, keeps types immutable, archives without deleting values', async () => {
    const { headers, store } = await context();
    const create = await getApp().inject({ method: 'POST', url: '/api/custom-field-definitions', headers, payload: definitions[0] });
    expect(create.statusCode).toBe(201);
    const id = create.json().definition.id;
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@example.com' });
    const otherHeaders = buildAuthHeaders({ uid: other.user.firebaseUid, email: other.user.email! });
    const denied = await getApp().inject({ method: 'PATCH', url: `/api/custom-field-definitions/${id}`, headers: otherHeaders, payload: { label: 'Robado' } });
    expect(denied.statusCode).toBe(404);
    const immutable = await getApp().inject({ method: 'PATCH', url: `/api/custom-field-definitions/${id}`, headers, payload: { type: 'text' } });
    expect(immutable.statusCode).toBe(400);
    const update = await getApp().inject({ method: 'PATCH', url: `/api/custom-field-definitions/${id}`, headers, payload: { label: 'Arreglos', order: 2 } });
    expect(update.statusCode).toBe(200);
    await prisma.inventoryItem.create({ data: { storeId: store!.id, model: 'Ficticio', capacity: '', color: '', condition: 'USADO', grade: '', batteryHealth: '90%', cost: 0, price: null, status: 'DISPONIBLE', customFields: { reparaciones: 2 } } });
    expect((await getApp().inject({ method: 'DELETE', url: `/api/custom-field-definitions/${id}`, headers })).statusCode).toBe(204);
    expect((await getApp().inject({ method: 'GET', url: '/api/custom-field-definitions', headers })).json().definitions).toEqual([]);
    expect((await prisma.inventoryItem.findFirst({ where: { storeId: store!.id } }))!.customFields).toEqual({ reparaciones: 2 });
  });
  it('validates typed values and allows clearing nullable fields on normal create/update', async () => {
    const { headers } = await context();
    await getApp().inject({ method: 'POST', url: '/api/custom-field-definitions', headers, payload: definitions[0] });
    const body = { ...row, capacity: '', color: '', condition: 'USADO', grade: '', batteryHealth: '90%', cost: 0, status: 'DISPONIBLE', entryDate: '2026-10-14', batteryNote: 'Original', customFields: { reparaciones: '2' } };
    const created = await getApp().inject({ method: 'POST', url: '/api/inventory', headers, payload: body });
    expect(created.statusCode).toBe(201);
    const id = created.json().inventoryItem.id;
    expect(created.json().inventoryItem.customFields.reparaciones).toBe(2);
    expect((await getApp().inject({ method: 'PATCH', url: `/api/inventory/${id}`, headers, payload: { customFields: { reparaciones: 'nan' } } })).statusCode).toBe(400);
    const cleared = await getApp().inject({ method: 'PATCH', url: `/api/inventory/${id}`, headers, payload: { entryDate: null, batteryNote: null } });
    expect(cleared.json().inventoryItem).toMatchObject({ entryDate: null, batteryNote: null, customFields: { reparaciones: 2 } });
  });
  it('rolls back newly defined fields when another definition conflicts', async () => {
    const { headers, store } = await context();
    await getApp().inject({ method: 'POST', url: '/api/custom-field-definitions', headers, payload: definitions[0] });
    const result = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { definitions: [definitions[1], { ...definitions[0], type: 'text' }], rows: [row] } });
    expect(result.statusCode).toBe(409);
    expect(await prisma.customFieldDefinition.count({ where: { storeId: store!.id } })).toBe(1);
    expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(0);
  });
  it('links a fixed supplier in the same confirmation transaction', async () => {
    const { headers, store } = await context();
    const supplier = await prisma.supplier.create({ data: { storeId: store!.id, name: 'Proveedor ficticio' } });
    const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { supplierId: supplier.id, definitions, rows: [{ ...row, customFields: { reparaciones: '0' } }] } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ imported: 1, errors: [] });
    const item = await prisma.inventoryItem.findFirst({ where: { storeId: store!.id } });
    expect(item).toMatchObject({ supplierId: supplier.id, stockPurchaseId: expect.any(String), customFields: { reparaciones: 0 } });
  });
  it('rolls back a failed row and continues saving other rows with the new definitions', async () => {
    const { headers, store } = await context();
    await prisma.inventoryItem.create({ data: { storeId: store!.id, imei: '350000000000014', model: 'Reservado', capacity: '', color: '', condition: 'USADO', grade: '', batteryHealth: '90%', cost: 0, price: null, status: 'RESERVADO', reservedDepositId: 'deposito-ficticio' } });
    const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { definitions, rows: [
      { ...row, sourceRow: 3, imei: '350000000000014', supplierName: 'Origen fallido', customFields: { reparaciones: '1' } },
      { ...row, sourceRow: 4, customFields: { reparaciones: '2' } },
    ] } });
    expect(response.json()).toMatchObject({ imported: 1, updated: 0, errors: [{ row: 3, message: 'Error al guardar' }] });
    expect(await prisma.supplier.count({ where: { storeId: store!.id } })).toBe(0);
    expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(2);
  });

});


it('creates the suggested origin quality definition and persists every preview row in one confirmation', async () => {
  const { analyzeImport } = await import('../modules/import/analyze-import.service.js');
  const { DECISIONS_URL } = await import('../modules/import/responses-client.js');
  const { syntheticQualityStockRows } = await import('../../test/fixtures/headerless-stock.js');
  const { headers, store } = await context();
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  try {
    const grid = syntheticQualityStockRows();
    // Decisions supplies the quality field even with an ambiguous extra model.
    grid.forEach(row => { row[15] = 'iPhone 16'; });
    const analysis = await analyzeImport({ section: 'inventory', currency: 'USD', sheets: [{ name: 'stock de equipos', rows: grid }] }, {
      fetchImpl: async (url, init) => {
        expect(String(url)).toBe(DECISIONS_URL);
        const fields = ['entryDate', 'supplierName', 'model', 'capacity', 'batteryHealth', 'imei', 'grade', 'color', 'cost', 'batteryNote', 'status'];
        const body = JSON.parse(String(init?.body)) as { questions: { name: string; type: string }[] };
        return Response.json({ answers: body.questions.map(question => ({ name: question.name,
          ...(question.type === 'predicate' ? { probability: 1 } : { choice: question.name.endsWith('_hdr') ? '0' : fields[Number(/_c(\d+)/.exec(question.name)?.[1])] ?? 'ignore', confidence: 1 }),
        })) });
      },
    });
    const rows = analysis.rows.map(row => ({
      imei: row.imei, model: row.model, sourceRow: Number(row._sourceRow), entryDate: row.entryDate,
      batteryHealth: row.batteryHealth, price: null, customFields: { calidad_origen: row['custom:calidad_origen'] },
    }));
    const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers,
      payload: { rows, definitions: analysis.suggestedDefinitions } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ imported: analysis.rows.length, updated: 0, errors: [] });
    expect(analysis.rows).toHaveLength(58);
    expect(analysis.diagnostics?.discardedByReason).toEqual({ invalid_price: 1, duplicate: 1 });
    expect(await prisma.customFieldDefinition.findMany({ where: { storeId: store!.id } })).toEqual([
      expect.objectContaining({ key: 'calidad_origen', label: 'Calidad (origen)', type: 'text' }),
    ]);
    const saved = await prisma.inventoryItem.findMany({ where: { storeId: store!.id } });
    for (const row of rows) expect(saved.find(item => item.imei === row.imei)).toMatchObject({ grade: '', customFields: row.customFields });
    expect(saved.find(item => item.imei === rows[7].imei)?.batteryHealth).toBe('');
  } finally { vi.unstubAllEnvs(); }
});
