import { calendarDay, labelToIso, periodLabel, type DuePeriod } from "./schedule.js";

export type MoneyCurrency = "ARS" | "USD";

export interface ReportSale {
  dateLabel?: string | null;
  soldAt: Date;
  status: string;
  amount: number;
  currency?: string | null;
  paymentMethod?: string | null;
}

export interface ReportRefund {
  paidAt: Date;
  amount: number;
  currency?: string | null;
  kind: string;
}

export interface ReportStockItem {
  createdAt: Date;
  status?: string | null;
}

export interface ReportMoney {
  total: number | null;
  count: number;
}

export interface AuditReport {
  periodLabel: string;
  currency: MoneyCurrency;
  sales: ReportMoney & { delta: string | null; payments: Array<{ label: string; total: number }> };
  returns: { cancelled: ReportMoney; refunds: ReportMoney; credits: ReportMoney };
  stock: { entered: number; available: number; physicalCounts: number };
}

const PAYMENT_LABELS: Record<string, string> = {
  TRANSFERENCIA: "Transferencia",
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  MIXTO: "Varios medios",
  CRIPTO: "Cripto",
  SIN_PAGO: "Sin pago",
};

const PAYMENT_ORDER = ["Transferencia", "Efectivo", "Tarjeta", "Cripto"];

export function paymentLabel(method: string | null | undefined) {
  const value = method?.trim() || "Otro";
  return PAYMENT_LABELS[value] ?? value;
}

export function isInStock(status: string | null | undefined) {
  return !status || status === "DISPONIBLE";
}

function recordCurrency(value: string | null | undefined, active: MoneyCurrency): MoneyCurrency {
  if (value == null || value === "") return active;
  return value === "USD" ? "USD" : value === "ARS" ? "ARS" : active;
}

/** Same display conversion as Reportes: sell rate, rounded, blocked without a quote. */
export function projectAmount(amount: number, storedCurrency: string | null | undefined, active: MoneyCurrency, sellRate: number | null) {
  const from = recordCurrency(storedCurrency, active);
  const value = Number.isFinite(amount) ? amount : 0;
  if (from === active) return { value, blocked: false };
  if (sellRate == null || !(sellRate > 0)) return { value, blocked: true };
  const converted = from === "USD" ? value * sellRate : value / sellRate;
  return { value: Math.round(converted), blocked: false };
}

export function combineAmounts(
  rows: Array<{ amount: number; currency?: string | null }>,
  active: MoneyCurrency,
  sellRate: number | null,
) {
  let total = 0;
  for (const row of rows) {
    const projected = projectAmount(row.amount, row.currency, active, sellRate);
    if (projected.blocked) return null;
    total += projected.value;
  }
  return Math.round(total);
}

export function deltaLabel(current: number, previous: number) {
  if (!previous) return current ? "sin base anterior" : "sin movimiento";
  const delta = Math.round(((current - previous) / previous) * 100);
  return `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs período anterior`;
}

function inWindow(day: string | null, start: string, end: string) {
  return !!day && day >= start && day < end;
}

function saleDay(sale: ReportSale, timeZone: string) {
  return labelToIso(sale.dateLabel) ?? calendarDay(sale.soldAt, timeZone);
}

function countedSales(sales: ReportSale[], start: string, end: string, timeZone: string) {
  return sales.filter((sale) => sale.status !== "CANCELADA" && inWindow(saleDay(sale, timeZone), start, end));
}

function moneyOf(rows: Array<{ amount: number; currency?: string | null }>, active: MoneyCurrency, sellRate: number | null): ReportMoney {
  return { count: rows.length, total: combineAmounts(rows, active, sellRate) };
}

function paymentParts(sales: ReportSale[], active: MoneyCurrency, sellRate: number | null) {
  const totals = new Map<string, number>();
  for (const sale of sales) {
    const projected = projectAmount(sale.amount, sale.currency, active, sellRate);
    if (projected.blocked || projected.value === 0) continue;
    const label = paymentLabel(sale.paymentMethod);
    totals.set(label, (totals.get(label) ?? 0) + projected.value);
  }
  const known = new Set(PAYMENT_ORDER);
  const ordered = PAYMENT_ORDER.filter((label) => (totals.get(label) ?? 0) > 0).map((label) => ({ label, total: totals.get(label)! }));
  const extra = [...totals.entries()]
    .filter(([label, total]) => !known.has(label) && total > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "es"))
    .map(([label, total]) => ({ label, total }));
  return [...ordered, ...extra];
}

export function buildAuditReport(input: {
  period: Pick<DuePeriod, "start" | "end" | "previousStart" | "previousEnd">;
  timeZone: string;
  currency: MoneyCurrency;
  sellRate: number | null;
  sales: ReportSale[];
  refunds: ReportRefund[];
  credits?: ReportRefund[];
  stock: ReportStockItem[];
  physicalCounts?: number;
}): AuditReport {
  const active = input.currency === "USD" ? "USD" : "ARS";
  const current = countedSales(input.sales, input.period.start, input.period.end, input.timeZone);
  const previous = countedSales(input.sales, input.period.previousStart, input.period.previousEnd, input.timeZone);
  const salesTotal = combineAmounts(current.map((sale) => ({ amount: sale.amount, currency: sale.currency })), active, input.sellRate);
  const previousTotal = combineAmounts(previous.map((sale) => ({ amount: sale.amount, currency: sale.currency })), active, input.sellRate);
  const cancelled = input.sales.filter((sale) => sale.status === "CANCELADA" && inWindow(saleDay(sale, input.timeZone), input.period.start, input.period.end));
  const refunds = input.refunds.filter((row) => row.kind === "DEVOLUCION" && inWindow(calendarDay(row.paidAt, input.timeZone), input.period.start, input.period.end));
  const credits = (input.credits ?? []).filter((row) => inWindow(calendarDay(row.paidAt, input.timeZone), input.period.start, input.period.end));
  const entered = input.stock.filter((item) => inWindow(calendarDay(item.createdAt, input.timeZone), input.period.start, input.period.end));
  return {
    periodLabel: periodLabel(input.period.start, input.period.end),
    currency: active,
    sales: {
      total: salesTotal,
      count: current.length,
      delta: salesTotal == null || previousTotal == null ? null : deltaLabel(salesTotal, previousTotal),
      payments: salesTotal == null ? [] : paymentParts(current, active, input.sellRate),
    },
    returns: {
      cancelled: moneyOf(cancelled.map((sale) => ({ amount: sale.amount, currency: sale.currency })), active, input.sellRate),
      refunds: moneyOf(refunds.map((row) => ({ amount: row.amount, currency: row.currency })), active, input.sellRate),
      credits: moneyOf(credits.map((row) => ({ amount: row.amount, currency: row.currency })), active, input.sellRate),
    },
    stock: {
      entered: entered.length,
      available: entered.filter((item) => isInStock(item.status)).length,
      physicalCounts: input.physicalCounts ?? 0,
    },
  };
}

export function formatReportMoney(value: number | null, currency: MoneyCurrency) {
  if (value == null) return "sin cotización";
  const formatted = new Intl.NumberFormat("es-AR").format(Math.round(value));
  return currency === "USD" ? `US$ ${formatted}` : `$ ${formatted}`;
}

export function renderAuditReport(storeName: string, report: AuditReport) {
  const money = (value: number | null) => formatReportMoney(value, report.currency);
  const pair = (row: ReportMoney) => row.total == null && row.count > 0
    ? `${row.count} · sin cotización`
    : `${row.count} · ${money(row.total)}`;
  const payments = report.sales.payments.length
    ? report.sales.payments.map((part) => `- ${part.label}: ${money(part.total)}`).join("\n")
    : "- Sin movimiento";
  const name = storeName.replace(/[\r\n]+/g, " ").trim() || "tu tienda";
  return [
    `Reporte de ${name} · ${report.periodLabel}`,
    "",
    "Hola,",
    "",
    `Te dejamos el resumen de ${name} para la auditoría del ${report.periodLabel}. Los números son los de Reportes.`,
    "",
    "Ventas",
    `Facturación: ${money(report.sales.total)}`,
    `Cantidad: ${report.sales.count}`,
    `Variación: ${report.sales.delta ?? "sin cotización"}`,
    "Por medio de pago:",
    payments,
    "",
    "RMA / devoluciones",
    `Ventas canceladas: ${pair(report.returns.cancelled)}`,
    `Reintegros: ${pair(report.returns.refunds)}`,
    `Notas de crédito: ${pair(report.returns.credits)}`,
    "",
    "Stock",
    `Equipos ingresados: ${report.stock.entered}`,
    `Disponibles en ese grupo: ${report.stock.available}`,
    report.stock.physicalCounts > 0
      ? `Diferencias de conteo físico: ${report.stock.physicalCounts}`
      : "Diferencias de conteo físico: no hay un conteo cargado en este período.",
    "",
    "Entrá a Configuración y apagalo cuando quieras.",
  ].join("\n");
}
