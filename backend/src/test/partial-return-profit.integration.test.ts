import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();

describe('10 unidades vendidas, devolución parcial de 2', () => {
  it.each([
    ['ARS', 'ARS', 'REINTEGRO'], ['USD', 'USD', 'REINTEGRO'],
    ['ARS', 'USD', 'NOTA_CREDITO'], ['USD', 'ARS', 'NOTA_CREDITO'],
  ] as const)('unifica Ventas, Dashboard, cliente y reportes (%s, costo %s, %s)', async (currency, costCurrency, settlement) => {
    const { store } = await seedStoreContext();
    const storeId = store!.id;
    await prisma.store.update({ where: { id: storeId }, data: { currency, exchangeMode: 'manual', manualSell: 1000 } });
    const catalog = await seedCatalogFixture(storeId);
    const factor = currency === 'ARS' ? 1000 : 1;
    const unitCost = costCurrency === 'ARS' ? 60000 : 60;
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { imei: '', cantidad: 10, cost: unitCost, currency: costCurrency } });
    const app = getApp();
    const request = async (method: 'GET' | 'POST', url: string, payload?: object) => {
      const result = await app.inject({ method, url, headers, payload });
      expect(result.statusCode, result.body).toBe(method === 'POST' && !url.endsWith('/resolve') ? 201 : 200);
      return result.json();
    };
    const sale = (await request('POST', '/api/operations/sales', {
      productId: catalog.inventoryItem.id, clientId: catalog.client.id, cantidad: 10,
      amount: 1000 * factor, currency, status: 'COMPLETADA', paymentMethod: 'EFECTIVO',
    })).sale;
    await prisma.sale.update({ where: { id: sale.id }, data: { soldAt: new Date('2026-09-10T15:00:00Z'), dateLabel: '10/09/2026' } });
    const overview = () => request('GET', '/api/reports/overview?rangeKey=all_time').then(body => body.overview);
    expect((await overview()).summary).toMatchObject({ revenue: 1000 * factor, grossProfit: 400 * factor });
    const opened = (await request('POST', '/api/returns', { saleId: sale.id, reason: 'Dos unidades devueltas', openedOn: '2026-09-12' })).return;
    expect((await overview()).summary).toMatchObject({ revenue: 1000 * factor, grossProfit: 400 * factor });
    await request('POST', `/api/returns/${opened.id}/resolve`, {
      resolution: 'REINTEGRO', settlement, amount: 200 * factor, destination: 'STOCK', stockStatus: 'EN_REVISION',
    });
    const issued = new Date('2026-09-12T15:00:00Z');
    await prisma.returnEvent.updateMany({ where: { caseId: opened.id, status: 'RESUELTO' }, data: { createdAt: issued } });
    await prisma.returnCase.update({ where: { id: opened.id }, data: { resolvedAt: issued } });
    await prisma.creditNote.updateMany({ where: { returnCaseId: opened.id }, data: { createdAt: issued } });
    const claims = (await request('GET', '/api/returns')).returns;
    expect(claims[0]).toMatchObject({ saleQuantity: 10, itemCost: unitCost, moneyAmount: 200 * factor });
    const result = await overview();
    const summary = result.summary;
    expect(summary).toMatchObject({ revenue: 800 * factor, grossProfit: 320 * factor, marginRate: 40, returnsAmount: 200 * factor });
    expect(result.salesSeries.reduce((sum: number, row: { revenue: number }) => sum + row.revenue, 0)).toBe(800 * factor);
    expect(result.topClients[0]).toMatchObject({ revenue: 800 * factor, purchases: 1 });
    const backendProfit = await request('GET', '/api/reports/net-profit?from=2026-09-01&to=2026-09-30');
    expect(backendProfit).toMatchObject({ revenue: 800 * factor, cost: 480 * factor, grossProfit: 320 * factor, netProfit: 320 * factor });
    const salePeriod = (await request('GET', '/api/reports/overview?rangeKey=custom&startDate=2026-09-01T03:00:00Z&endDate=2026-09-11T02:59:59Z')).overview;
    expect(salePeriod.summary).toMatchObject({ revenue: 1000 * factor, grossProfit: 400 * factor });
    const returnPeriod = (await request('GET', '/api/reports/overview?rangeKey=custom&startDate=2026-09-12T03:00:00Z&endDate=2026-09-13T02:59:59Z')).overview;
    expect(returnPeriod.summary).toMatchObject({ revenue: -200 * factor, grossProfit: -80 * factor });
    const clients = (await request('GET', '/api/clients')).clients;
    expect(clients.find((row: { id: string }) => row.id === catalog.client.id).totalSpent).toBe(800 * factor);
  });
});
