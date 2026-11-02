import { expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
const request = (method: 'POST' | 'GET', url: string, payload?: object) => getApp().inject({ method, url, headers, payload });
async function fixture() {
  const { store } = await seedStoreContext();
  await prisma.store.update({ where: { id: store!.id }, data: { currency: 'USD', exchangeMode: 'manual', manualSell: 1000 } });
  const catalog = await seedCatalogFixture(store!.id);
  await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { imei: null, cantidad: 100, currency: 'USD', cost: 450, price: 650 } });
  return catalog;
}
const ranges = [
  ['7d', '2026-10-27', '2026-11-02', 5], ['hoy', '2026-11-02', '2026-11-02', 3],
  ['mes', '2026-11-01', '2026-11-02', 3], ['mes anterior', '2026-10-01', '2026-10-31', 6],
  ['personalizado', '2026-10-31', '2026-11-02', 5], ['total', '', '', 9],
] as const;
const overviewUrl = (start: string, end: string) => start ? `/api/reports/overview?${new URLSearchParams({ rangeKey: 'custom', startDate: `${start}T00:00:00-03:00`, endDate: `${end}T23:59:59.999-03:00` })}` : '/api/reports/overview?rangeKey=all_time';
it.each(['COMPLETADA', 'PENDIENTE'])('Dashboard mayorista USD en todos los períodos (%s)', async status => {
  const { client, inventoryItem } = await fixture();
  for (const [date, cantidad] of [['2026-10-10', 4], ['2026-10-31', 2], ['2026-11-02', 3]] as const) {
    const sale = await request('POST', '/api/operations/sales', { productId: inventoryItem.id, clientId: client.id, amount: cantidad * 650, cantidad, currency: 'USD', status, date, paymentMethod: 'EFECTIVO' });
    expect(sale.statusCode, sale.body).toBe(201);
  }
  for (const [name, start, end, units] of ranges) {
    const response = await request('GET', overviewUrl(start, end));
    expect(response.statusCode, response.body).toBe(200);
    const data = response.json().overview;
    expect(data.summary, name).toMatchObject({ revenue: units * 650, grossProfit: units * 200, unitsSold: units });
    expect(data.salesSeries.reduce((n: number, p: { revenue: number }) => n + p.revenue, 0), name).toBe(units * 650);
    expect(data.paymentMethods.reduce((n: number, p: { revenue: number }) => n + p.revenue, 0), name).toBe(units * 650);
  }
});
it('API conserva siete operaciones iguales del mismo día sin límite ni dedupe', async () => {
  const { client, inventoryItem } = await fixture();
  for (const cantidad of [1, 1, 1, 1, 2, 2, 3]) {
    const sale = await request('POST', '/api/operations/sales', { productId: inventoryItem.id, clientId: client.id, amount: cantidad * 650, cantidad, currency: 'USD', warrantyDays: 90, date: '2026-11-02' });
    expect(sale.statusCode, sale.body).toBe(201);
  }
  const response = await request('GET', '/api/sales');
  expect(response.statusCode, response.body).toBe(200);
  const rows = response.json().sales;
  expect(rows).toHaveLength(7);
  expect(new Set(rows.map((row: { id: string }) => row.id)).size).toBe(7);
  expect(rows.reduce((sum: number, row: { cantidad: number }) => sum + row.cantidad, 0)).toBe(11);
});
it.each(['REINTEGRO', 'NOTA_CREDITO'])('diez unidades menos dos: facturación y ganancia netas (%s)', async settlement => {
  const { client, inventoryItem } = await fixture();
  const sold = await request('POST', '/api/operations/sales', { productId: inventoryItem.id, clientId: client.id, amount: 6500, cantidad: 10, currency: 'USD', status: 'COMPLETADA', date: '2026-11-02', paymentMethod: 'EFECTIVO' });
  expect(sold.statusCode, sold.body).toBe(201);
  const saleId = sold.json().sale.id;
  const opened = await request('POST', '/api/returns', { saleId, reason: 'Devuelve dos unidades', openedOn: '2026-11-02' });
  expect(opened.statusCode, opened.body).toBe(201);
  const id = opened.json().return.id;
  const resolved = await request('POST', `/api/returns/${id}/resolve`, { resolution: 'REINTEGRO', settlement, amount: 1300, destination: 'STOCK', stockStatus: 'EN_REVISION' });
  expect(resolved.statusCode, resolved.body).toBe(200);
  const issuedAt = new Date('2026-11-02T15:00:00Z');
  await prisma.returnCase.update({ where: { id }, data: { resolvedAt: issuedAt } });
  await prisma.returnEvent.updateMany({ where: { caseId: id, status: 'RESUELTO' }, data: { createdAt: issuedAt } });
  await prisma.creditNote.updateMany({ where: { returnCaseId: id }, data: { createdAt: issuedAt } });
  const claims = (await request('GET', '/api/returns')).json().returns;
  expect(claims[0]).toMatchObject({ moneyAmount: 1300, saleAmount: 6500, itemCost: 450, saleQuantity: 10 });
  for (const [, start, end] of ranges.filter(r => r[0] !== 'mes anterior')) {
    const response = await request('GET', overviewUrl(start, end));
    expect(response.statusCode, response.body).toBe(200);
    const data = response.json().overview;
    expect(data.summary).toMatchObject({ revenue: 5200, grossProfit: 1600, returnsAmount: 1300 });
    expect(data.salesSeries.reduce((n: number, row: { revenue: number }) => n + row.revenue, 0)).toBe(5200);
    expect(data.paymentMethods.reduce((n: number, row: { revenue: number }) => n + row.revenue, 0)).toBe(5200);
  }
  const net = await request('GET', '/api/reports/net-profit?from=2026-11-02&to=2026-11-02');
  expect(net.statusCode, net.body).toBe(200);
  expect(net.json()).toMatchObject({ revenue: 5200, grossProfit: 1600, netProfit: 1600 });
  expect(Number((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).amount)).toBe(6500);
  // Later compensation affects its own period and the comparative window exactly once.
  const later = new Date('2026-11-03T15:00:00Z');
  await prisma.returnCase.update({ where: { id }, data: { resolvedAt: later } });
  await prisma.returnEvent.updateMany({ where: { caseId: id, status: 'RESUELTO' }, data: { createdAt: later } });
  await prisma.creditNote.updateMany({ where: { returnCaseId: id }, data: { createdAt: later } });
  const nextDay = (await request('GET', overviewUrl('2026-11-03', '2026-11-03'))).json().overview;
  expect(nextDay.summary).toMatchObject({ revenue: -1300, grossProfit: -400 });
  expect(nextDay.comparison).toMatchObject({ revenue: 6500, grossProfit: 2000 });
});
