import { DomainError } from "../../lib/domain-error.js";
import type { AuditChange } from "./diff-fields.js";
import type { AuditSource } from "./audit.js";

export type ArchiveMeta = {
  reason?: string | null;
  source?: AuditSource;
  batchId?: string | null;
  batchSize?: number | null;
};

export function archivedMatch(message: string, archivedMatchId: string, entity: "inventory" | "client" | "category") {
  const error = new DomainError(message, 409);
  error.extras = { code: "ARCHIVED_MATCH", archivedMatchId, entity };
  return error;
}

export function cleanReason(reason?: string | null) {
  const text = reason?.trim() ?? "";
  return text ? text.slice(0, 280) : null;
}

export function readReason(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const reason = (body as { reason?: unknown }).reason;
  return typeof reason === "string" ? cleanReason(reason) : null;
}

export function batchChanges(meta?: ArchiveMeta | null): AuditChange[] {
  if (!meta?.batchId) return [];
  return [
    { field: "_batchId", label: "Lote", before: null, after: meta.batchId },
    { field: "_batchSize", label: "Cantidad", before: null, after: String(meta.batchSize ?? 1) },
  ];
}

export function deviceLabel(item: { model?: string | null; capacity?: string | null; imei?: string | null }) {
  const title = [item.model, item.capacity].filter(Boolean).join(" ").trim() || "Equipo";
  const imei = item.imei?.replace(/\D/g, "") ?? "";
  if (imei.length < 4) return title.slice(0, 160);
  return `${title} · IMEI …${imei.slice(-4)}`.slice(0, 160);
}

export function saleCode(saleNumber?: number | null) {
  if (saleNumber == null) return "Venta";
  return `V-${String(saleNumber).padStart(4, "0")}`;
}
