import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../lib/domain-error.js';
import { prisma } from '../../plugins/prisma.js';
import { createSmtpMailer, type Mailer } from './mail.js';
import { loadMailReport } from './report-data.js';
import { renderMailReport } from './template.js';
import { asFrequency, latestDuePeriod, periodLabel, REPORT_TIME_ZONE, type ReportFrequency } from './schedule.js';

const LOCK = 'periodic-report:dispatch';
const MISSING_MAIL = 'El servidor todavía no puede enviar correos.';
const SEND_FAILURE = 'No se pudo confirmar el envío. Revisá el proveedor antes de reintentar.';
export interface PeriodicReportInput {
  enabled: boolean;
  frequency: ReportFrequency;
  recipients: string[];
  sendDay?: number;
  sendTime?: string;
}
type Log = { info: (message: string) => void; warn: (message: string) => void };
export function parseRecipients(values: readonly string[]) {
  const all = values.flatMap(v => v.split(/[\s,;]+/)).map(v => v.trim().toLowerCase()).filter(Boolean);
  return { emails: [...new Set(all.filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 255))], invalid: all.filter(v => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 255) };
}
function validate(input: PeriodicReportInput) {
  const { emails, invalid } = parseRecipients(input.recipients);
  if (invalid.length) throw new DomainError('Revisá los correos. Hay uno que no es válido.');
  if (emails.length > 10) throw new DomainError('Podés cargar hasta 10 correos.');
  if (input.enabled && !emails.length) throw new DomainError('Agregá al menos un correo.');
  const max = input.frequency === 'WEEKLY' ? 7 : input.frequency === 'BIWEEKLY' ? 15 : 28;
  if (input.sendDay != null && (!Number.isInteger(input.sendDay) || input.sendDay < 1 || input.sendDay > max)) throw new DomainError('Revisá el día de envío.');
  if (input.sendTime != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.sendTime)) throw new DomainError('Revisá la hora de envío.');
  return emails;
}
async function settingsView(storeId: string, row: Awaited<ReturnType<typeof prisma.periodicReportSettings.findUnique>>) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { timezone: true, memberships: { where: { role: 'OWNER', removedAt: null }, orderBy: { createdAt: 'asc' }, take: 1, select: { user: { select: { email: true } } } } } });
  const parts = row?.lastPeriodKey?.split(':');
  return {
    enabled: row?.enabled ?? false, frequency: asFrequency(row?.frequency ?? 'WEEKLY'),
    recipients: parseRecipients([row?.recipients || store.memberships[0]?.user.email || '']).emails,
    sendDay: row?.sendDay ?? 1, sendTime: row?.sendTime ?? '09:00', timezone: store.timezone || REPORT_TIME_ZONE,
    lastSentAt: row?.lastSentAt?.toISOString() ?? null,
    lastPeriodLabel: parts?.length === 3 ? periodLabel(parts[1], parts[2]) : null,
    lastError: row?.lastError ?? null,
  };
}
export async function getPeriodicReportSettings(storeId: string) {
  return settingsView(storeId, await prisma.periodicReportSettings.findUnique({ where: { storeId } }));
}
export async function savePeriodicReportSettings(storeId: string, input: PeriodicReportInput) {
  const emails = validate(input);
  const data = { enabled: input.enabled, frequency: input.frequency, recipients: emails.join(', '), sendDay: input.sendDay ?? 1, sendTime: input.sendTime ?? '09:00' };
  const row = await prisma.periodicReportSettings.upsert({ where: { storeId }, create: { storeId, ...data }, update: data });
  return settingsView(storeId, row);
}
function appUrl() { const url = process.env.REPORT_APP_URL || process.env.FRONTEND_URL; if (!url) throw new DomainError('Falta configurar REPORT_APP_URL.'); return url; }
export async function runDueReports(options: { now?: Date; mailer?: Mailer | null; log?: Log } = {}) {
  const now = options.now ?? new Date();
  const log = options.log ?? console;
  const mailer = options.mailer === undefined ? createSmtpMailer() : options.mailer;
  const rows = await prisma.periodicReportSettings.findMany({ where: { enabled: true }, include: { store: { select: { timezone: true } } } });
  let sent = 0;
  for (const row of rows) {
    try {
      const due = latestDuePeriod(now, row.store.timezone || REPORT_TIME_ZONE, asFrequency(row.frequency), { sendDay: row.sendDay, sendTime: row.sendTime });
      const recipients = parseRecipients([row.recipients]).emails;
      if (!recipients.length) throw new DomainError('Agregá al menos un correo.');
      if (!mailer) {
        log.warn(`Reporte automático ${row.storeId}: envío omitido, correo sin configurar.`);
        await prisma.periodicReportSettings.update({ where: { storeId: row.storeId }, data: { lastError: MISSING_MAIL } });
        continue;
      }
      // Payload remains frozen after the first preparation, including inventory/debt.
      const existing = await prisma.periodicReportDelivery.findMany({ where: { storeId: row.storeId, periodKey: due.key } });
      if (!existing.length && row.lastPeriodKey === due.key) continue; // Preserve pre-outbox delivery history.
      let payload: ReturnType<typeof renderMailReport> | undefined = existing[0];
      let complete = true;
      for (const recipient of recipients) {
        let delivery = existing.find(d => d.recipient === recipient);
        if (!delivery) {
          payload ??= renderMailReport(await loadMailReport(row.storeId, due, now), appUrl());
          delivery = await prisma.periodicReportDelivery.upsert({
            where: { storeId_periodKey_recipient: { storeId: row.storeId, periodKey: due.key, recipient } },
            create: { storeId: row.storeId, periodKey: due.key, recipient, subject: payload.subject, html: payload.html, text: payload.text }, update: {},
          });
        }
        if (delivery.status === 'SENT') continue;
        // CAS plus unique index protects even concurrent workers without advisory lock.
        const claim = await prisma.periodicReportDelivery.updateMany({ where: { id: delivery.id, status: 'PREPARED' }, data: { status: 'SENDING', attempts: { increment: 1 } } });
        if (!claim.count) { complete = false; continue; }
        const idempotencyKey = `report-${createHash('sha256').update(`${row.storeId}:${due.key}:${recipient}`).digest('hex')}`;
        try {
          const providerId = await mailer({ to: [recipient], subject: delivery.subject, html: delivery.html, text: delivery.text, idempotencyKey });
          await prisma.periodicReportDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', sentAt: now, providerId: providerId || null } });
          sent++;
        } catch {
          complete = false;
          await prisma.periodicReportDelivery.update({ where: { id: delivery.id }, data: { status: 'UNCERTAIN' } });
          await prisma.periodicReportSettings.update({ where: { storeId: row.storeId }, data: { lastError: SEND_FAILURE } });
          log.warn(`Reporte automático ${row.storeId}: resultado del envío incierto; requiere revisión.`);
        }
      }
      if (complete) await prisma.periodicReportSettings.update({ where: { storeId: row.storeId }, data: { lastPeriodKey: due.key, lastSentAt: now, lastError: null } });
    } catch {
      log.warn(`Reporte automático ${row.storeId}: no se pudo preparar o registrar el reporte.`);
      await prisma.periodicReportSettings.update({ where: { storeId: row.storeId }, data: { lastError: 'No se pudo preparar el reporte. Se reintenta en la próxima ejecución.' } });
    }
  }
  return sent;
}
export async function sendTestReport(storeId: string, input: PeriodicReportInput, options: { now?: Date; mailer?: Mailer | null; log?: Log } = {}) {
  const emails = validate({ ...input, enabled: true });
  const now = options.now ?? new Date();
  const mailer = options.mailer === undefined ? createSmtpMailer() : options.mailer;
  if (!mailer) { (options.log ?? console).warn(`Reporte de prueba ${storeId}: correo sin configurar; no se envió.`); return { sent: false, message: MISSING_MAIL }; }
  // Persistent, atomic throttle across API replicas. A test never saves the draft settings.
  await prisma.periodicReportSettings.upsert({ where: { storeId }, create: { storeId }, update: {} });
  const claim = await prisma.periodicReportSettings.updateMany({ where: { storeId, OR: [{ lastTestAt: null }, { lastTestAt: { lte: new Date(now.getTime() - 60000) } }] }, data: { lastTestAt: now } });
  if (!claim.count) throw new DomainError('Esperá un minuto antes de enviar otra prueba.', 429);
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { timezone: true } });
  const due = latestDuePeriod(now, store.timezone || REPORT_TIME_ZONE, input.frequency, { sendDay: input.sendDay, sendTime: input.sendTime });
  const payload = renderMailReport(await loadMailReport(storeId, due, now), appUrl());
  try { await mailer({ ...payload, subject: `Prueba · ${payload.subject}`, to: emails, idempotencyKey: `report-test-${randomUUID()}` }); }
  catch { throw new DomainError('No se pudo enviar el mail de prueba.', 502); }
  return { sent: true, message: 'Mail de prueba enviado' };
}
function locked(value: unknown) {
  return value === true || value === "t";
}

async function withReportLock<T>(run: () => Promise<T>) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL");
  const pinned = new URL(url);
  pinned.searchParams.set("connection_limit", "1");
  const client = new PrismaClient({ datasourceUrl: pinned.toString() });
  try {
    const rows = await client.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_lock(hashtext(${LOCK}), 374) AS locked`;
    if (!locked(rows[0]?.locked)) return null;
    try {
      return await run();
    } finally {
      await client.$queryRaw`SELECT pg_advisory_unlock(hashtext(${LOCK}), 374)`;
    }
  } finally {
    await client.$disconnect();
  }
}

export async function runDueReportsLocked(log: Log = console, now = new Date()) {
  try {
    const sent = await withReportLock(() => runDueReports({ now, log }));
    return sent ?? 0;
  } catch {
    log.warn("Reporte automático: no se pudo ejecutar o adquirir el lock.");
    return 0;
  }
}
