import { PrismaClient } from "@prisma/client";
import { currentBlueRate } from "../../lib/blue-rate.js";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { createSmtpMailer, type Mailer } from "./mail.js";
import { buildAuditReport, renderAuditReport, type MoneyCurrency, type ReportRefund, type ReportSale, type ReportStockItem } from "./report-math.js";
import { addCalendarDays, asFrequency, latestDuePeriod, parseIsoDay, periodLabel, REPORT_TIME_ZONE, type ReportFrequency } from "./schedule.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCK = "periodic-report:dispatch";
const SEND_FAILURE = "No se pudo enviar el reporte. Se reintenta solo.";
const MISSING_MAIL = "El servidor todavía no puede enviar correos.";

export interface PeriodicReportSettingsView {
  enabled: boolean;
  frequency: ReportFrequency;
  recipients: string[];
  lastSentAt: string | null;
  lastPeriodLabel: string | null;
  lastError: string | null;
}

export interface PeriodicReportInput {
  enabled: boolean;
  frequency: ReportFrequency;
  recipients: string[];
}

type StoreMail = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  exchangeMode: string;
  exchangeSource: string;
  manualSell: unknown;
};

type SettingsRow = {
  storeId: string;
  enabled: boolean;
  frequency: string;
  recipients: string;
  lastPeriodKey: string | null;
  lastSentAt: Date | null;
  lastError: string | null;
  store?: StoreMail;
};

export function parseRecipients(values: readonly string[]) {
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const value of values) {
    for (const part of value.split(/[\s,;]+/)) {
      const email = part.trim().toLowerCase();
      if (!email) continue;
      if (!EMAIL.test(email) || email.length > 255) invalid.push(email);
      else if (!emails.includes(email)) emails.push(email);
    }
  }
  return { emails, invalid };
}

function view(row: SettingsRow | null): PeriodicReportSettingsView {
  const parsed = parseRecipients(row?.recipients ? [row.recipients] : []);
  return {
    enabled: row?.enabled ?? false,
    frequency: asFrequency(row?.frequency),
    recipients: parsed.emails,
    lastSentAt: row?.lastSentAt?.toISOString() ?? null,
    lastPeriodLabel: labelFromKey(row?.lastPeriodKey),
    lastError: row?.lastError ?? null,
  };
}

function labelFromKey(key: string | null | undefined) {
  const match = key?.match(/^(?:BIWEEKLY|MONTHLY):(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
  if (!match || !parseIsoDay(match[1]) || !parseIsoDay(match[2])) return null;
  return periodLabel(match[1], match[2]);
}

function money(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currencyOf(value: string | null | undefined): MoneyCurrency {
  return value === "USD" ? "USD" : "ARS";
}

async function sellRate(store: StoreMail) {
  if (store.exchangeMode === "manual") {
    const rate = money(store.manualSell);
    return rate > 0 ? rate : null;
  }
  try {
    if (store.exchangeSource !== "oficial" && store.exchangeSource !== "mep") return await currentBlueRate();
    const source = store.exchangeSource === "mep" ? "bolsa" : "oficial";
    const response = await fetch(`https://dolarapi.com/v1/dolares/${source}`, { signal: AbortSignal.timeout(8000) });
    const body = await response.json() as { venta?: unknown };
    const rate = Number(body.venta);
    return response.ok && Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

function queryWindow(start: string, end: string) {
  const from = parseIsoDay(addCalendarDays(start, -2));
  const to = parseIsoDay(addCalendarDays(end, 2));
  if (!from || !to) throw new Error("Fecha inválida");
  return {
    gte: new Date(Date.UTC(from.year, from.month - 1, from.day)),
    lt: new Date(Date.UTC(to.year, to.month - 1, to.day)),
  };
}

export async function getPeriodicReportSettings(storeId: string) {
  const row = await prisma.periodicReportSettings.findUnique({ where: { storeId } });
  return view(row);
}

export async function savePeriodicReportSettings(storeId: string, input: PeriodicReportInput) {
  const { emails, invalid } = parseRecipients(input.recipients);
  if (invalid.length) throw new DomainError("Revisá los correos. Hay uno que no es válido.");
  if (emails.length > 10) throw new DomainError("Podés cargar hasta 10 correos.");
  if (input.enabled && emails.length === 0) throw new DomainError("Agregá al menos un correo.");
  const row = await prisma.periodicReportSettings.upsert({
    where: { storeId },
    create: { storeId, enabled: input.enabled, frequency: input.frequency, recipients: emails.join(", ") },
    update: { enabled: input.enabled, frequency: input.frequency, recipients: emails.join(", ") },
  });
  return view(row);
}

async function loadReport(store: StoreMail, period: ReturnType<typeof latestDuePeriod>) {
  const window = queryWindow(period.previousStart, period.end);
  const [sales, stock, refunds, rate] = await Promise.all([
    prisma.sale.findMany({
      where: { storeId: store.id, soldAt: { gte: window.gte, lt: window.lt } },
      select: { dateLabel: true, soldAt: true, status: true, amount: true, amountCurrency: true, paymentMethod: true },
    }),
    prisma.inventoryItem.findMany({
      where: { storeId: store.id, archivedAt: null, createdAt: { gte: window.gte, lt: window.lt } },
      select: { createdAt: true, status: true },
    }),
    prisma.clientPayment.findMany({
      where: { storeId: store.id, kind: "DEVOLUCION", paidAt: { gte: window.gte, lt: window.lt } },
      select: { paidAt: true, amount: true, currency: true, kind: true },
    }),
    sellRate(store),
  ]);
  const timeZone = store.timezone || REPORT_TIME_ZONE;
  return buildAuditReport({
    period,
    timeZone,
    currency: currencyOf(store.currency),
    sellRate: rate,
    sales: sales.map((sale): ReportSale => ({
      dateLabel: sale.dateLabel,
      soldAt: sale.soldAt,
      status: sale.status,
      amount: money(sale.amount),
      currency: sale.amountCurrency,
      paymentMethod: sale.paymentMethod,
    })),
    refunds: refunds.map((row): ReportRefund => ({
      paidAt: row.paidAt,
      amount: money(row.amount),
      currency: row.currency,
      kind: row.kind,
    })),
    stock: stock.map((item): ReportStockItem => ({ createdAt: item.createdAt, status: item.status })),
  });
}

type Log = { info: (message: string) => void; warn: (message: string) => void };

export async function runDueReports(options: { now?: Date; mailer?: Mailer | null; log?: Log } = {}) {
  const now = options.now ?? new Date();
  const log = options.log ?? console;
  const mailer = options.mailer === undefined ? createSmtpMailer() : options.mailer;
  const rows = await prisma.periodicReportSettings.findMany({
    where: { enabled: true },
    include: {
      store: {
        select: { id: true, name: true, currency: true, timezone: true, exchangeMode: true, exchangeSource: true, manualSell: true },
      },
    },
  });
  let sent = 0;
  for (const row of rows) {
    const store = row.store;
    const timeZone = store.timezone || REPORT_TIME_ZONE;
    const due = latestDuePeriod(now, timeZone, asFrequency(row.frequency));
    if (row.lastPeriodKey === due.key) continue;
    const recipients = parseRecipients([row.recipients]).emails;
    if (!recipients.length) {
      await prisma.periodicReportSettings.update({ where: { storeId: row.storeId }, data: { lastError: "Agregá al menos un correo para enviar el reporte." } });
      continue;
    }
    if (!mailer) {
      log.warn(`Reporte automático de ${store.id}: falta SMTP_HOST o SMTP_FROM.`);
      await prisma.periodicReportSettings.update({ where: { storeId: row.storeId }, data: { lastError: MISSING_MAIL } });
      continue;
    }
    try {
      const report = await loadReport(store, due);
      const text = renderAuditReport(store.name, report);
      await mailer({ to: recipients, subject: text.split("\n")[0] ?? "Reporte", text });
      await prisma.periodicReportSettings.update({
        where: { storeId: row.storeId },
        data: { lastPeriodKey: due.key, lastSentAt: now, lastError: null },
      });
      sent += 1;
    } catch (error) {
      log.warn(`Reporte automático de ${store.id}: ${error instanceof Error ? error.message : "error"}`);
      await prisma.periodicReportSettings.update({ where: { storeId: row.storeId }, data: { lastError: SEND_FAILURE } });
    }
  }
  if (sent) log.info(sent === 1 ? "Reporte automático: 1 envío." : `Reporte automático: ${sent} envíos.`);
  return sent;
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
  } catch (error) {
    log.warn(`Reporte automático: ${error instanceof Error ? error.message : "error"}`);
    return 0;
  }
}

export function startPeriodicReports(log: Log, options?: { enabled?: boolean; run?: () => Promise<void> }) {
  const enabled = options?.enabled ?? process.env.NODE_ENV === "production";
  if (!enabled) return () => undefined;
  const run = options?.run ?? (() => runDueReportsLocked(log));
  let stopped = false;
  const kick = setTimeout(() => {
    if (!stopped) void run();
  }, 15_000);
  kick.unref?.();
  const timer = setInterval(() => {
    if (!stopped) void run();
  }, 60 * 60 * 1000);
  timer.unref?.();
  log.info("Reporte automático: revisión cada hora, envío a las 08:00, hora de la tienda.");
  return () => {
    stopped = true;
    clearTimeout(kick);
    clearInterval(timer);
  };
}
