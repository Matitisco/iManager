import { afterEach, expect, it, vi } from 'vitest';
import { autoMap } from './column-mapping.js';
import { IMPORT_CATALOGS } from './import-catalog.js';
import { analyzeImport, applyImportPlan } from './analyze-import.service.js';
import { heuristicPlan } from './sheet-plan.js';
const catalog = IMPORT_CATALOGS.inventory;
afterEach(() => vi.unstubAllEnvs());
const aliases: Record<string, string[]> = {
  model: ['Producto', 'Dispositivo', 'Descripción', 'Detalle', 'iPhone', 'Celular', 'Artículo', 'Device'],
  imei: ['Serie', 'S/N', 'Serial'], capacity: ['Memoria', 'Storage', 'Cap.', 'Almac.'], price: ['P. Venta', 'u$s venta'],
  batteryHealth: ['Bat', 'Bat.', 'Battery', 'BH', 'Batt'],
  cost: ['Precio de compra', 'Compra', 'P. compra', 'Precio compra USD', 'Inversión'],
  status: ['Disponibilidad', 'Situación'], quantity: ['Cantidad', 'Cant', 'Qty', 'Unidades', 'Stock'], condition: ['Tipo', 'Nuevo/Usado', 'Estado físico'],
  grade: ['Categoría', 'Cat.'], supplierName: ['Comprado a', 'Supplier', 'Vendedor origen'],
  entryDate: ['Fecha', 'F. ingreso', 'Date', 'Fecha compra'], batteryNote: ['Observaciones', 'Notas', 'Reparaciones', 'Arreglos'],
};
it.each(Object.entries(aliases).flatMap(([field, aliases]) => aliases.map(alias => ({ field, alias }))))('$alias → $field con puntuación, tildes y mayúsculas', ({ field, alias }) => {
  for (const header of [alias, `  ${alias.toUpperCase()} .  `]) {
    expect(autoMap(['Modelo', 'IMEI', 'Capacidad', 'Color'].filter(h => !autoMap([h], catalog.fields, catalog.hints)[field]).concat(header), catalog.fields, catalog.hints)[field]).toBe(header);
  }
});
it('completa por contenido al 80%, exige Luhn y nunca pisa encabezados', () => {
  const sheets = [{ name: 'Stock', rows: [
    ['Modelo', 'Otro', 'Desconocido', 'Otra', 'Salud desconocida', 'Sin título', 'Color'],
    ...Array.from({ length: 10 }, (_, i) => ['iPhone 13', 'iPhone 14', i < 8 ? '359890930782405' : 'raro', '128 GB', '85%', 'USD 420', 'Negro']),
  ] }];
  const mapping = heuristicPlan(sheets, 'inventory', 'ARS')[0].mapping;
  expect(mapping.map(c => c.field)).toEqual(['model', '', 'imei', 'capacity', 'batteryHealth', 'cost', 'color']);
  sheets[0].rows[7][2] = '359890930782406';
  expect(heuristicPlan(sheets, 'inventory', 'ARS')[0].mapping[2].field).toBe('');
});
it.each([false, true])('normaliza batería mezclada con encabezado=%s sin rechazar por 8*%%', header => {
  const rows = ['85', '85%', '0.85', '8*%', '100', 'N/A'].map(battery => ['iPhone 13', battery, 'USD 450']);
  if (header) rows.unshift(['Modelo', 'Batería', 'Costo USD']);
  const sheets = [{ name: 'Stock', rows }];
  const result = applyImportPlan({ section: 'inventory', currency: 'ARS', sheets, plan: heuristicPlan(sheets, 'inventory', 'ARS') });
  expect(result.rows.map(row => row.batteryHealth)).toEqual(['85%', '85%', '85%', '', '100%', 'N/A']);
  expect(result.diagnostics?.warnings).toContainEqual({ row: header ? 5 : 4, message: expect.stringContaining('sin batería') });
});
it('preserva varias notas y la moneda explícita del costo, y respeta elección manual', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  const input = { section: 'inventory' as const, currency: 'ARS' as const, sheets: [{ name: 'Stock', rows: [
    ['Modelo', 'Costo USD', 'Notas', 'Arreglos'], ['iPhone 13', '420', 'Original', 'Pantalla cambiada'],
  ] }] };
  const result = await analyzeImport(input);
  expect(result.rows[0]).toMatchObject({ cost: '420', currency: 'USD', batteryNote: 'Original; Pantalla cambiada' });
  expect(result.warnings).toEqual([]);
  result.plan[0].priceCurrency = 'ARS';
  expect(applyImportPlan({ ...input, plan: result.plan }).rows[0].currency).toBe('ARS');
});
it.each(['texto', '-1', '=A1', '#N/A', '-', 'sin dato'])('conserva costo/precio inválido %s en notas; vacío permite precio a definir', async amount => {
  vi.stubEnv('OPENAI_API_KEY', '');
  for (const field of ['Costo', 'Precio']) {
    const result = await analyzeImport({ section: 'inventory', currency: 'ARS', sheets: [{ name: 'Stock', rows: [['Modelo', field], ['iPhone 13', amount], ['iPhone 14', '']] }] });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1].model).toBe('iPhone 14');
    expect(result.rows[0].batteryNote).toContain(amount);
    expect(result.diagnostics?.discardedRows).toBe(0);
  }
});
it.each(['=A1', '#REF!', '#N/A', '#VALUE!'])('conserva el modelo %s en notas ante un error de Excel', async model => {
  vi.stubEnv('OPENAI_API_KEY', '');
  const result = await analyzeImport({ section: 'inventory', currency: 'ARS', sheets: [{ name: 'Stock', rows: [['Modelo', 'Costo'], [model, '450']] }] });
  expect(result.rows[0]).toMatchObject({ model: 'Equipo sin modelo', batteryNote: expect.stringContaining(model) });
  expect(result.diagnostics?.discardedRows).toBe(0);
});
it('consulta Decisions aun con heurística confiable y conserva una decisión válida distinta', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test-only');
  const sheets = [{ name: 'Stock', rows: [
    ['Modelo', 'Otro modelo', 'Costo USD'], ['iPhone 13', 'iPhone 14', '420'],
  ] }];
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return Response.json({ answers: body.questions.map((q: { name: string; type: string }) => ({ name: q.name, type: q.type,
      ...(q.type === 'predicate' ? { probability: .99 } : { choice: q.name.endsWith('_hdr') ? '1' : q.name.endsWith('_c1') ? 'model' : q.name.endsWith('_c2') ? 'cost' : 'ignore', confidence: .99 }),
    })) });
  });
  const result = await analyzeImport({ section: 'inventory', currency: 'ARS', sheets }, { fetchImpl });
  expect(fetchImpl).toHaveBeenCalledOnce(); expect(result.source).toBe('model');
  expect(result.rows[0]).toMatchObject({ model: 'iPhone 14', cost: '420' });
});
it('reconoce una columna de enteros 60–100 como batería y conserva notas ante celdas vacías', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  const sheets = [{ name: 'Stock', rows: [['iPhone 13', '85', 'USD 450'], ['iPhone 14', '100', 'USD 600']] }];
  expect((await analyzeImport({ section: 'inventory', currency: 'ARS', sheets })).rows.map(row => row.batteryHealth)).toEqual(['85%', '100%']);
  const notes = [{ name: 'Stock', rows: [['Modelo', 'Notas', 'Arreglos'], ['iPhone 13', 'Original', '']] }];
  expect((await analyzeImport({ section: 'inventory', currency: 'ARS', sheets: notes })).rows[0].batteryNote).toBe('Original');
});

it.each([
  ['clientes únicos', Array.from({ length: 10 }, (_, i) => `Cliente ${String.fromCharCode(65 + i)}`)],
  ['notas largas', Array(10).fill('Observaciones del equipo con mucho texto que supera los cuarenta caracteres')],
  ['colores', ['Negro', 'Blanco', 'Rojo', 'Negro', 'Blanco', 'Rojo', 'Azul', 'Azul', 'Verde', 'Verde']],
  ['estado', Array(10).fill('Reservado')],
  ['condición', Array(10).fill('USADO')],
  ['calidad', ['A', 'AA', 'AB+', 'A', 'AA', 'AB+', 'canje', 'canje', 'A', 'AA']],
  ['fechas', Array(10).fill('2026-10-01')],
  ['números', Array(10).fill('450')],
])('no confunde %s con proveedor aunque esté antes de Modelo', (_name, values) => {
  const rows = values.map(value => [value, 'iPhone 13', 'USD 450']);
  const plan = heuristicPlan([{ name: 'Stock', rows }], 'inventory', 'ARS')[0];
  expect(plan.mapping.some(column => column.field === 'supplierName')).toBe(false);
});

it('infiere proveedor repetido, tolera prefijos y nunca pisa encabezados', () => {
  const values = ['Origen Norte', 'origen norte', 'Origen Norte', 'CANJE / Ana', 'REINGRESO'];
  const rows = values.map(value => [value, 'iPhone 13', 'USD 450']);
  expect(heuristicPlan([{ name: 'Stock', rows }], 'inventory', 'ARS')[0].mapping[0].field).toBe('supplierName');
  const withHeader = [['Observaciones', 'Modelo', 'Costo USD'], ...rows];
  expect(heuristicPlan([{ name: 'Stock', rows: withHeader }], 'inventory', 'ARS')[0].mapping[0].field).toBe('batteryNote');
  const explicit = [['Otro', 'Modelo', 'Costo USD', 'Proveedor'], ...rows.map(row => [...row, 'Proveedor elegido'])];
  const mapping = heuristicPlan([{ name: 'Stock', rows: explicit }], 'inventory', 'ARS')[0].mapping;
  expect(mapping[0].field).toBe('');
  expect(mapping[3].field).toBe('supplierName');
});
