import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
const request = (method: 'POST' | 'GET', url: string, payload?: object) => getApp().inject({ method, url, headers, payload });
const periods = [
  { label: 'Hoy', start: '2026-11-02', end: '2026-11-02', units: 3, previous: 2 },
  { label: 'Últimos 7 días', start: '2026-10-27', end: '2026-11-02', units: 9, previous: 11 },
  { label: 'Este mes', start: '2026-11-01', end: '2026-11-02', units: 5, previous: 4 },
  { label: 'Mes anterior', start: '2026-10-01', end: '2026-10-31', units: 22, previous: 8 },
  { label: 'Total', start: null, end: null, units: 44, previous: 0 },
  { label: 'Personalizado', start: '2026-10-26', end: '2026-11-01', units: 11, previous: 6 },
];

describe.each(['PENDIENTE', 'COMPLETADA'])('Dashboard mayorista con ventas %s', status => {
  describe.each(['USD', 'ARS'])('moneda de tienda %s, ventas USD', currency => {
    it.each(periods)('$label incluye importes, costos y unidades en todos los agregados', async ({ start, end, units, previous }) => {
      const { store } = await seedStoreContext();
      await prisma.store.update({ where: { id: store!.id }, data: { currency, exchangeMode: 'manual', manualSell: 1200, manualBuy: 1100 } });
      const created = await request('POST', '/api/inventory', {
        model: 'Equipo ficticio', capacity: '128GB', color: '', condition: 'NUEVO', grade: '', batteryHealth: '',
        cantidad: 100, cost: 450, price: 650, currency: 'USD', status: 'DISPONIBLE',
      });
      expect(created.statusCode, created.body).toBe(201);
      const productId = created.json().inventoryItem.id;
      for (const [day, cantidad, instant] of [
        ['2026-11-02', 3, '2026-11-03T02:59:59.999Z'],
        ['2026-11-01', 2, '2026-11-01T03:00:00Z'],
        ['2026-10-31', 4, '2026-10-31T03:00:00Z'],
        ['2026-10-26', 5, '2026-10-27T02:59:59.999Z'],
        ['2026-10-25', 6, null],
        ['2026-10-01', 7, null],
        ['2026-09-30', 8, null],
        ['2025-01-15', 9, null],
      ] as const) {
        const sold = await request('POST', '/api/operations/sales', {
          productId, cantidad, date: day, amount: cantidad * 650, currency: 'USD',
          status, paymentMethod: 'EFECTIVO', clientName: 'Mayorista ficticio',
        });
        expect(sold.statusCode, sold.body).toBe(201);
        expect(sold.json().sale).toMatchObject({ cantidad, amount: cantidad * 650, status });
        if (instant) await prisma.sale.update({ where: { id: sold.json().sale.id }, data: { soldAt: new Date(instant) } });
      }
      expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: productId } })).toMatchObject({ cantidad: 56, status: 'DISPONIBLE' });
      // Neither cancellation representation nor another store may leak into totals.
      const excluded = { storeId: store!.id, cantidad: 99, amount: 64350, amountCurrency: 'USD', paymentMethod: 'EFECTIVO', dateLabel: '02/11/2026', soldAt: new Date('2026-11-02T15:00:00Z') };
      await prisma.sale.createMany({ data: [
        { ...excluded, status: 'CANCELADA' },
        { ...excluded, status: 'ANULADA' },
        { ...excluded, status, voidedAt: new Date() },
      ] });
      const foreign = await seedStoreContext({ firebaseUid: 'other-store', email: 'other@example.com' });
      await prisma.sale.create({ data: { ...excluded, storeId: foreign.store!.id, status } });

      const query = new URLSearchParams(start && end ? {
        rangeKey: 'custom', startDate: `${start}T00:00:00.000-03:00`, endDate: `${end}T23:59:59.999-03:00`,
      } : { rangeKey: 'all_time' });
      const response = await request('GET', `/api/reports/overview?${query}`);
      expect(response.statusCode, response.body).toBe(200);
      const report = response.json().overview;
      const factor = currency === 'ARS' ? 1200 : 1;
      const revenue = units * 650 * factor;
      expect(report.currency).toBe(currency);
      expect(report.summary).toMatchObject({ revenue, grossProfit: units * 200 * factor, unitsSold: units, salesWithoutCost: 0 });
      expect(report.summary.marginRate).toBeCloseTo(200 / 650 * 100);
      expect(report.summary.pendingSales > 0).toBe(status === 'PENDIENTE');
      expect(report.comparison).toMatchObject({ available: !!start, revenue: previous * 650 * factor, grossProfit: previous * 200 * factor, unitsSold: previous });
      for (const group of ['salesSeries', 'paymentMethods', 'topProducts', 'categories', 'topClients']) {
        expect(report[group].reduce((sum: number, row: { revenue: number }) => sum + row.revenue, 0), group).toBe(revenue);
      }
      for (const group of ['salesSeries', 'topProducts', 'categories']) {
        expect(report[group].reduce((sum: number, row: { unitsSold: number }) => sum + row.unitsSold, 0), group).toBe(units);
      }
      expect(report.comparison.revenueChange).toBe(start ? (units - previous) / previous * 100 : null);
    });
  });
});

it('excluye cancelledAt en ambos períodos incluso si el estado quedó activo', async () => {
  const { store } = await seedStoreContext();
  await prisma.sale.createMany({ data: ['COMPLETADA', 'PENDIENTE'].flatMap(status => ['2026-11-01', '2026-11-02'].map(day => ({
    storeId: store!.id, status, cantidad: 3, amount: 1950, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO',
    dateLabel: day, soldAt: new Date(`${day}T15:00:00Z`), cancelledAt: new Date('2026-11-02T18:00:00Z'),
  }))) });
  const query = new URLSearchParams({ rangeKey: 'custom', startDate: '2026-11-02T00:00:00-03:00', endDate: '2026-11-02T23:59:59.999-03:00' });
  const response = await request('GET', `/api/reports/overview?${query}`);
  expect(response.statusCode, response.body).toBe(200);
  const report = response.json().overview;
  expect(report.summary).toMatchObject({ revenue: 0, grossProfit: 0, unitsSold: 0, pendingSales: 0 });
  expect(report.comparison).toMatchObject({ revenue: 0, grossProfit: 0, unitsSold: 0 });
  expect(report.paymentMethods).toEqual([]);
});
