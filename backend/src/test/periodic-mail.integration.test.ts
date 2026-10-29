import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import { loadMailReport } from '../modules/periodic-reports/report-data.js';
import { latestDuePeriod } from '../modules/periodic-reports/schedule.js';
import { renderMailReport } from '../modules/periodic-reports/template.js';
import { runDueReports, runDueReportsLocked, sendTestReport } from '../modules/periodic-reports/service.js';
import { decodeQuotedPrintable, startFakeSmtp } from './fake-smtp.js';
const { getApp } = useIntegrationApp();
const now = new Date('2026-10-26T12:00:00Z');
const zone = 'America/Argentina/Buenos_Aires';
afterEach(() => vi.unstubAllEnvs());
describe('real periodic mail data and persistent idempotency', () => {
  it('scopes metrics, excludes voids, converts currencies and uses current stock and debt', async () => {
    const { store, user } = await seedStoreContext(); const storeId = store!.id;
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@test.local' });
    await prisma.store.update({ where: { id: storeId }, data: { exchangeMode: 'manual', manualSell: 1000 } });
    const inventory = await prisma.inventoryItem.create({ data: { storeId, model: 'iPhone', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 60, currency: 'USD', price: 100000, status: 'DISPONIBLE', createdAt: new Date('2020-01-01') } });
    const reviewItem = { storeId, model: 'Por revisar', capacity: '', color: '', condition: 'USADO', grade: '', batteryHealth: '', cost: 0, price: null, status: 'EN_REVISION', createdAt: new Date('2020-01-01') };
    await prisma.inventoryItem.createMany({ data: [
      { ...reviewItem, batteryNote: 'IMEI duplicado en el archivo: 990000000000038\nValor por revisar' },
      { ...reviewItem, batteryNote: 'Parece una fila de total' },
      { ...reviewItem, batteryNote: 'Valor por revisar' },
      { ...reviewItem, archivedAt: now },
      { ...reviewItem, storeId: other.store!.id },
    ] });
    const base = { storeId, soldAt: new Date('2026-10-20T15:00:00Z'), dateLabel: '20/10/2026', amount: 100000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', inventoryItemId: inventory.id };
    await prisma.sale.create({ data: base });
    await prisma.sale.create({ data: { ...base, inventoryItemId: null, amount: 900000, status: 'ANULADA' } });
    await prisma.sale.create({ data: { ...base, inventoryItemId: null, amount: 900000, cancelledAt: now } });
    await prisma.sale.create({ data: { ...base, inventoryItemId: null, dateLabel: '26/10/2026', amount: 900000 } });
    await prisma.sale.create({ data: { ...base, storeId: other.store!.id, inventoryItemId: null, amount: 999999 } });
    await prisma.expense.create({ data: { storeId, amount: 5000, currency: 'ARS', spentAt: new Date('2026-10-21T15:00:00Z'), category: 'Alquiler' } });
    await prisma.client.create({ data: { storeId, name: 'Cliente', pendingBalance: 20, balanceCurrency: 'USD' } });
    await prisma.tradeIn.create({ data: { storeId, dateLabel: '20/10/2026', tradeAt: new Date('2026-10-20T15:00:00Z'), deviceReceived: 'iPhone', takeValue: 1, differencePaid: 0, status: 'COMPLETADO', confirmationStatus: 'CONFIRMED' } });
    await prisma.stockCount.create({ data: { storeId, startedById: user.id, startedByName: 'Owner', status: 'CLOSED', closedAt: new Date('2026-10-23T15:00:00Z'), result: { missing: [{ imei: '123', model: 'iPhone' }], surplus: [], sold: [] } } });
    const report = await loadMailReport(storeId, latestDuePeriod(now, zone, 'WEEKLY'), now);
    expect(report).toMatchObject({ sales: 100000, sold: 1, profit: 35000, stock: 1, reviewCount: 3, debt: 20000, debtors: 1, trades: 1, differences: 1 });
    const mail = renderMailReport({ ...report, storeName: '<img src=x>' }, 'http://127.0.0.1:4680');
    expect(mail.html).toContain('&lt;img src=x&gt;'); expect(mail.html).not.toContain('<img src=x>');
    expect(mail.html).toContain('period=week%3A2026-10-19'); expect(mail.text).toContain('Ganancia neta: $ 35.000');
    expect(mail.html).toContain('prefers-color-scheme:dark'); expect(Buffer.byteLength(mail.html)).toBeLessThan(102000);
    expect(mail.html).toContain('Equipos por revisar');
    expect(mail.html).toContain('3 equipos');
    expect(mail.text).toContain('En revisión: 3 equipos');
    expect(mail.html).toContain('href="http://127.0.0.1:4680/#/stock/equipos?status=EN_REVISION"');
    expect(mail.text).toContain('http://127.0.0.1:4680/#/stock/equipos?status=EN_REVISION');
  });
  it('unique DB constraint and atomic claim prevent concurrent and repeated sends', async () => {
    const { store } = await seedStoreContext(); const storeId = store!.id;
    await prisma.store.update({ where: { id: storeId }, data: { exchangeMode: 'manual', manualSell: 1000 } });
    await prisma.periodicReportSettings.create({ data: { storeId, enabled: true, frequency: 'WEEKLY', recipients: 'a@test.local' } });
    const mailer = vi.fn(async () => 'fake-provider-id');
    await Promise.all([runDueReports({ now, mailer }), runDueReports({ now, mailer })]);
    await runDueReports({ now, mailer });
    expect(mailer).toHaveBeenCalledTimes(1);
    expect(await prisma.periodicReportDelivery.findMany({ where: { storeId } })).toMatchObject([{ status: 'SENT', attempts: 1, providerId: 'fake-provider-id' }]);
    await sendTestReport(storeId, { enabled: false, frequency: 'WEEKLY', recipients: ['test@test.local'] }, { now, mailer });
    await expect(sendTestReport(storeId, { enabled: false, frequency: 'WEEKLY', recipients: ['test@test.local'] }, { now, mailer })).rejects.toMatchObject({ statusCode: 429 });
    expect(await prisma.periodicReportDelivery.count({ where: { storeId } })).toBe(1);
  });
  it('denies test endpoint to staff and unauthenticated requests', async () => {
    await seedStoreContext({ role: 'STAFF' });
    const url = '/api/stores/current/periodic-report/test'; const payload = { enabled: true, frequency: 'WEEKLY', recipients: ['a@test.local'] };
    expect((await getApp().inject({ method: 'POST', url, payload })).statusCode).toBe(401);
    expect((await getApp().inject({ method: 'POST', url, payload, headers: buildAuthHeaders({ uid: 'test-owner' }) })).statusCode).toBe(403);
  });

  it('uses the PostgreSQL lock across replicas and captures scheduled and test mail through fake SMTP', async () => {
    const smtp = await startFakeSmtp();
    const lockUrl = new URL(process.env.DATABASE_URL!);
    lockUrl.searchParams.set('connection_limit', '1');
    const lockClient = new PrismaClient({ datasourceUrl: lockUrl.toString() });
    try {
      vi.stubEnv('SMTP_HOST', '127.0.0.1');
      vi.stubEnv('SMTP_PORT', String(smtp.port));
      vi.stubEnv('SMTP_FROM', 'reportes@test.local');
      vi.stubEnv('SMTP_USER', '');
      vi.stubEnv('SMTP_PASS', '');
      vi.stubEnv('REPORT_APP_URL', 'https://app.example.test/tienda');
      const { store } = await seedStoreContext();
      const storeId = store!.id;
      await prisma.store.update({ where: { id: storeId }, data: { exchangeMode: 'manual', manualSell: 1000 } });
      await prisma.periodicReportSettings.create({ data: { storeId, enabled: true, recipients: 'owner@test.local' } });
      await lockClient.$queryRaw`SELECT pg_advisory_lock(hashtext('periodic-report:dispatch'), 374)::text`;
      expect(await runDueReportsLocked(console, now)).toBe(0);
      expect(smtp.messages).toHaveLength(0);
      expect(await prisma.periodicReportDelivery.count({ where: { storeId } })).toBe(0);
      await lockClient.$queryRaw`SELECT pg_advisory_unlock(hashtext('periodic-report:dispatch'), 374)`;
      const results = await Promise.all([runDueReportsLocked(console, now), runDueReportsLocked(console, now)]);
      expect(results.reduce((a, b) => a + b)).toBe(1);
      expect(await runDueReportsLocked(console, now)).toBe(0);
      expect(smtp.messages).toHaveLength(1);
      const message = decodeQuotedPrintable(smtp.messages[0]);
      expect(message).toContain('Content-Type: text/plain');
      expect(message).toContain('Content-Type: text/html');
      expect(message.match(/Equipos por revisar/g)).toHaveLength(2);
      expect(message).toContain('En revisión: 0 equipos');
      expect(message).toContain('https://app.example.test/tienda/#/stock/equipos?status=EN_REVISION');
      expect(smtp.messages[0]).toMatch(/Resend-Idempotency-Key:\s+report-/);
      expect(await prisma.periodicReportDelivery.findMany({ where: { storeId } })).toMatchObject([{ status: 'SENT', attempts: 1 }]);
      await sendTestReport(storeId, { enabled: false, frequency: 'WEEKLY', recipients: ['test@test.local'] }, { now });
      expect(smtp.messages).toHaveLength(2);
      expect(decodeQuotedPrintable(smtp.messages[1])).toContain('Equipos por revisar');
      expect(await prisma.periodicReportDelivery.count({ where: { storeId } })).toBe(1);
    } finally {
      await lockClient.$disconnect();
      await smtp.close();
    }
  });
});
