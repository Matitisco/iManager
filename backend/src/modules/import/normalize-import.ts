import { formatArDate, parseArDate } from "../../lib/ar-date.js";
import { normalizeInventoryImportStatus } from "./inventory-status.js";
import { normalizeInstagram } from "../stores/store-contact.js";
import { normalizeHeader } from "./column-mapping.js";
import type { ImportSection } from "./import-catalog.js";

const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;
const JUNK_LABEL = /^(total|subtotal|suma|notas?|observaciones?)$/;
const HEADER_NAME = /^(nombre|cliente|comprador|telefono|whatsapp|celular|mail|email|dni|documento)$/;

const PAYMENTS = ["TRANSFERENCIA", "EFECTIVO", "TARJETA", "CANJE / PAGO", "T. Crédito"] as const;

export function normalizeImportDate(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";
  const parsed = parseArDate(trimmed);
  return parsed ? formatArDate(parsed) : trimmed;
}

/** Argentine mobiles converge on +549 plus the 10-digit national number. */
export function normalizeImportedPhone(raw: string | undefined): string {
  const original = raw?.trim() ?? "";
  if (!original) return "";
  let digits = original.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("9") && digits.length >= 11) digits = digits.slice(1);
  digits = digits.replace(/^(11|2\d{2}|3\d{2,3})15(\d{6,8})$/, "$1$2");
  if (/^15(11|2\d{2}|3\d{2,3})\d{6,8}$/.test(digits)) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return original;
  return `+549${digits}`;
}

export function normalizeImportedEmail(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed.includes("@")) return trimmed;
  return trimmed.toLowerCase();
}

export function normalizeImportedDni(raw: string | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function normalizeImportedInstagram(raw: string | undefined): string {
  const handle = normalizeInstagram(raw);
  if (!handle || !INSTAGRAM.test(handle)) return "";
  return handle;
}

export function normalizeCurrencyToken(raw: string | undefined): "" | "ARS" | "USD" {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return "";
  if (/usd|u\$s|u\$d|us\$|dolar|dólar|dls/.test(value)) return "USD";
  if (/ar\$|ars|peso/.test(value) || value === "$") return "ARS";
  return "";
}

export function normalizePayment(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if ((PAYMENTS as readonly string[]).includes(trimmed)) return trimmed;
  const value = normalizeHeader(trimmed);
  if (!value) return "EFECTIVO";
  if (/canje|permuta/.test(value)) return "CANJE / PAGO";
  if (/transfer|transf|mercadopago|^mp$|banco/.test(value)) return "TRANSFERENCIA";
  if (/tcredito|tarjetacredito/.test(value)) return "T. Crédito";
  if (/tarjeta|debito|credito|visa|master/.test(value)) return "TARJETA";
  if (/efectivo|cash|contado/.test(value)) return "EFECTIVO";
  return "EFECTIVO";
}

export function normalizeImei(raw: string | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length === 15 ? digits : "";
}

export function normalizeTradeIn(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";
  if (/^(-|—|no|sin canje|sin permuta|ninguno|n\/a)$/i.test(trimmed)) return "";
  return trimmed;
}

export function isJunkLabel(raw: string | undefined): boolean {
  const value = normalizeHeader(raw ?? "");
  return JUNK_LABEL.test(value);
}

export function normalizeSectionRow(
  section: ImportSection,
  record: Record<string, string>,
  columnCurrency: "" | "ARS" | "USD",
  rawAmount = record.amount ?? "",
  storeCurrency: "ARS" | "USD" = "ARS",
): Record<string, string> | null {
  if (section === "inventory") {
    const next = { ...record };
    if (next.status?.trim()) Object.assign(next, normalizeInventoryImportStatus(next.status));
    // IMEIs are validated/canonicalized as strings by the shared import validator.
    // Number() would invent padded digits for abbreviated scientific notation.
    // Entry dates keep incomplete dates visible for validation, without inventing a year.
    if (next.entryDate && /^\d{5}(?:\.\d+)?$/.test(next.entryDate)
      && Number(next.entryDate) >= 20000 && Number(next.entryDate) <= 80000) {
      next.entryDate = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(next.entryDate)) * 86400000).toISOString().slice(0, 10);
    }
    if (next.purchasedAt) {
      let date = next.purchasedAt;
      if (/^\d{1,2}[/.-]\d{1,2}$/.test(date)) date += `/${new Date().getFullYear()}`;
      if (/^\d{5}(?:\.\d+)?$/.test(date) && Number(date) >= 20000 && Number(date) <= 80000) {
        date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(date)) * 86400000).toISOString().slice(0, 10);
      }
      next.purchasedAt = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : normalizeImportDate(date);
    }
    return next;
  }
  if (section === "sales") return normalizeSaleRow(record, columnCurrency, rawAmount, storeCurrency);
  if (section === "clients") return normalizeClientRow(record);
  return record;
}

export function amountCellCurrency(raw: string): "" | "ARS" | "USD" {
  const value = raw.toLowerCase();
  if (/u\$s|us\$|u\$d|usd|dls|d[oó]lar/.test(value)) return "USD";
  if (/\$|ars|peso/.test(value)) return "ARS";
  return "";
}

function normalizeSaleRow(
  record: Record<string, string>,
  columnCurrency: "" | "ARS" | "USD",
  rawAmount: string,
  storeCurrency: "ARS" | "USD",
): Record<string, string> | null {
  const next = { ...record };
  if ("date" in next) next.date = normalizeImportDate(next.date);
  if ("clientName" in next) next.clientName = next.clientName.trim().replace(/\s+/g, " ");
  if ("device" in next) next.device = next.device.trim().replace(/\s+/g, " ");
  if ("productImei" in next) next.productImei = normalizeImei(next.productImei);
  if ("paymentMethod" in next) next.paymentMethod = normalizePayment(next.paymentMethod);
  if ("tradeIn" in next) next.tradeIn = normalizeTradeIn(next.tradeIn);
  if ("seller" in next) next.seller = next.seller.trim().replace(/\s+/g, " ");
  if ("clientDni" in next) next.clientDni = normalizeImportedDni(next.clientDni);
  if ("clientPhone" in next) next.clientPhone = normalizeImportedPhone(next.clientPhone);
  const fromColumn = normalizeCurrencyToken(next.currency);
  const fromCell = amountCellCurrency(rawAmount);
  next.currency = fromColumn || fromCell || columnCurrency || storeCurrency;
  const who = next.clientName?.trim() || next.device?.trim() || next.productImei?.trim();
  if (!who || isJunkLabel(next.clientName) || HEADER_NAME.test(normalizeHeader(next.clientName ?? ""))) return null;
  // Keep recognizable sales with bad prices for review and per-row errors;
  // free-form notes without a device/date still stay out of the import.
  if (!/^-?\d+(\.\d+)?$/.test(next.amount ?? "") && !next.device && !next.productImei && !parseArDate(next.date)) return null;
  return next;
}

function normalizeClientRow(record: Record<string, string>): Record<string, string> | null {
  const next = { ...record };
  if ("name" in next) next.name = next.name.trim().replace(/\s+/g, " ");
  if ("phone" in next) next.phone = normalizeImportedPhone(next.phone);
  if ("instagram" in next) next.instagram = normalizeImportedInstagram(next.instagram);
  if ("email" in next) next.email = normalizeImportedEmail(next.email);
  if ("dni" in next) next.dni = normalizeImportedDni(next.dni);
  if (!next.name?.trim() || isJunkLabel(next.name) || HEADER_NAME.test(normalizeHeader(next.name))) return null;
  return next;
}

export function preferWhatsappPhone<T extends { header: string; field: string; columnIndex?: number }>(headers: string[], mapping: T[]): T[] {
  const whatsapp = headers.find((header) => /whatsapp|wsp|celular|celu/.test(normalizeHeader(header)));
  if (!whatsapp) return mapping;
  const rest = mapping.filter((column) => column.field !== "phone");
  const template = mapping.find((column) => column.columnIndex === headers.indexOf(whatsapp))
    ?? mapping.find((column) => column.header === whatsapp) ?? mapping[0];
  const phone = template
    ? { ...template, header: whatsapp, ...(template.columnIndex != null ? { columnIndex: headers.indexOf(whatsapp) } : {}), field: "phone" }
    : ({ header: whatsapp, field: "phone" } as T);
  return [...rest, phone];
}

export function phonesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeImportedPhone(left ?? "");
  const b = normalizeImportedPhone(right ?? "");
  return Boolean(a && b && a === b);
}
