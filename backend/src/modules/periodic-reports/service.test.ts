import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  periodicReportSettings: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  periodicReportDelivery: { findMany: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  store: { findUniqueOrThrow: vi.fn() },
}));
const load = vi.hoisted(() => vi.fn());
vi.mock('../../plugins/prisma.js', () => ({ prisma: mock }));
vi.mock('./report-data.js', () => ({ loadMailReport: load }));
import { getPeriodicReportSettings, runDueReports, savePeriodicReportSettings, sendTestReport } from './service.js';
import type { MailReport } from './report-data.js';
import type { MailMessage } from './mail.js';
import { latestDuePeriod } from './schedule.js';
const now = new Date('2026-10-26T12:00:00Z');
const zone = 'America/Argentina/Buenos_Aires';
const row = { storeId: 's1', enabled: true, frequency: 'WEEKLY', sendDay: 1, sendTime: '09:00', recipients: 'a@example.test, b@example.test', lastPeriodKey: null, store: { timezone: zone } };
export const report: MailReport = { storeName: 'Casa <script>', timezone: zone, currency: 'ARS', period: latestDuePeriod(now, zone, 'WEEKLY'), periodLabel: '19/10/2026 al 25/10/2026', capturedAt: now.toISOString(), sales: 1000, sold: 2, profit: 300, stock: 4, trades: 1, claims: 1, pendingClaims: 1, refunds: 0, debt: 10, debtors: 1, differences: 1, counts: 1, countDay: '2026-10-23' };
type Delivery = { id: string; recipient: string; status: string; subject: string; html: string; text: string };
let deliveries: Delivery[];
beforeEach(() => {
  vi.resetAllMocks(); deliveries = [];
  mock.periodicReportSettings.findMany.mockResolvedValue([row]);
  mock.periodicReportSettings.update.mockResolvedValue({});
  mock.periodicReportSettings.updateMany.mockResolvedValue({ count: 1 });
  mock.periodicReportSettings.upsert.mockImplementation(async ({ create }) => create);
  mock.periodicReportDelivery.findMany.mockImplementation(async () => deliveries.map(d => ({ ...d })));
  mock.periodicReportDelivery.upsert.mockImplementation(async ({ create }) => {
    const found = deliveries.find(d => d.recipient === create.recipient);
    if (found) return { ...found };
    const d = { ...create, id: `d${deliveries.length}`, status: 'PREPARED' }; deliveries.push(d); return { ...d };
  });
  mock.periodicReportDelivery.updateMany.mockImplementation(async ({ where, data }) => {
    const d = deliveries.find(d => d.id === where.id && d.status === where.status);
    if (!d) return { count: 0 }; Object.assign(d, data); return { count: 1 };
  });
  mock.periodicReportDelivery.update.mockImplementation(async ({ where, data }) => Object.assign(deliveries.find(d => d.id === where.id)!, data));
  mock.store.findUniqueOrThrow.mockResolvedValue({ timezone: zone, memberships: [{ user: { email: 'owner@test.local' } }] });
  load.mockResolvedValue(report);
});
describe('settings and delivery', () => {
  it('defaults to the active owner email and weekly, never the store contact email', async () => {
    mock.periodicReportSettings.findUnique.mockResolvedValue(null);
    expect(await getPeriodicReportSettings('s1')).toMatchObject({ enabled: false, frequency: 'WEEKLY', recipients: ['owner@test.local'], sendDay: 1, sendTime: '09:00', timezone: zone });
  });
  it('validates recipients, time and frequency-dependent day and normalizes duplicates', async () => {
    await expect(savePeriodicReportSettings('s1', { enabled: true, frequency: 'WEEKLY', recipients: [] })).rejects.toThrow('correo');
    await expect(savePeriodicReportSettings('s1', { enabled: true, frequency: 'WEEKLY', recipients: ['bad'] })).rejects.toThrow('válido');
    await expect(savePeriodicReportSettings('s1', { enabled: false, frequency: 'WEEKLY', recipients: [], sendDay: 8 })).rejects.toThrow('día');
    await expect(savePeriodicReportSettings('s1', { enabled: false, frequency: 'MONTHLY', recipients: [], sendTime: '24:00' })).rejects.toThrow('hora');
    expect((await savePeriodicReportSettings('s1', { enabled: true, frequency: 'WEEKLY', recipients: [' A@Test.local ', 'a@test.local'] })).recipients).toEqual(['a@test.local']);
  });
  it('repeated and concurrent workers send each recipient once, with frozen HTML/text and stable keys', async () => {
    const mailer = vi.fn(async (_message: MailMessage) => 'smtp-id');
    await Promise.all([runDueReports({ now, mailer }), runDueReports({ now, mailer })]);
    await runDueReports({ now, mailer });
    expect(mailer).toHaveBeenCalledTimes(2);
    expect(deliveries.every(d => d.status === 'SENT')).toBe(true);
    expect(mailer.mock.calls[0][0]).toMatchObject({ subject: expect.stringContaining('19/10/2026'), html: expect.stringContaining('Tu semana en números'), text: expect.stringContaining('Ventas: $ 1.000'), idempotencyKey: expect.stringMatching(/^report-[a-f0-9]{64}$/) });
  });
  it('a new recipient receives the same frozen report without resending previous recipients', async () => {
    const mailer = vi.fn(async (_message: MailMessage) => undefined);
    await runDueReports({ now, mailer });
    mock.periodicReportSettings.findMany.mockResolvedValue([{ ...row, lastPeriodKey: report.period.key, recipients: row.recipients + ', c@test.local' }]);
    load.mockRejectedValue(new Error('must not reload snapshot'));
    await runDueReports({ now, mailer });
    expect(mailer).toHaveBeenCalledTimes(3);
    expect(mailer.mock.calls[2][0]).toMatchObject({ to: ['c@test.local'], html: deliveries[0].html });
  });
  it('ambiguous failure or crash after claim never triggers an automatic duplicate', async () => {
    const mailer = vi.fn(async (_message: MailMessage) => { throw new Error('timeout after SMTP accepted'); });
    await runDueReports({ now, mailer, log: { info: vi.fn(), warn: vi.fn() } });
    expect(deliveries.every(d => d.status === 'UNCERTAIN')).toBe(true);
    deliveries[0].status = 'SENDING';
    await runDueReports({ now: new Date('2026-10-27T15:00:00Z'), mailer });
    expect(mailer).toHaveBeenCalledTimes(2);
    expect(mock.periodicReportSettings.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastPeriodKey: expect.anything() }) }));
  });
  it('missing SMTP logs and never claims or marks a period sent', async () => {
    const warn = vi.fn();
    expect(await runDueReports({ now, mailer: null, log: { info: vi.fn(), warn } })).toBe(0);
    expect(warn).toHaveBeenCalled(); expect(load).not.toHaveBeenCalled();
    expect(mock.periodicReportDelivery.updateMany).not.toHaveBeenCalled();
  });
  it('a test is throttled persistently and never advances or enables scheduled delivery', async () => {
    const mailer = vi.fn(async (_message: MailMessage) => undefined);
    const input = { enabled: false, frequency: 'WEEKLY' as const, recipients: ['a@test.local'] };
    await expect(sendTestReport('s1', input, { now, mailer })).resolves.toMatchObject({ sent: true });
    expect(mailer.mock.calls[0][0]).toMatchObject({ subject: expect.stringContaining('Prueba ·') });
    expect(mock.periodicReportDelivery.upsert).not.toHaveBeenCalled(); expect(mock.periodicReportSettings.update).not.toHaveBeenCalled();
    mock.periodicReportSettings.updateMany.mockResolvedValue({ count: 0 });
    await expect(sendTestReport('s1', input, { now, mailer })).rejects.toMatchObject({ statusCode: 429 });
  });
});
