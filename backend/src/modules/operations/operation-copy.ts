import { formatArMoney } from "../../lib/ar-money.js";

export type NoticeAction = "created" | "confirmed" | "updated" | "cancelled" | "draft-created" | "draft-updated";

export type NoticeFacts = {
  action: NoticeAction;
  deviceLabel?: string | null;
  clientName?: string | null;
  clientCreated?: boolean;
  amount?: number | null;
  pendingBalance?: number | null;
  takeValue?: number | null;
  difference?: number | null;
  receivedDevice?: string | null;
  soldDevice?: string | null;
  releasedDevice?: string | null;
  archivedDevice?: string | null;
  refund?: number | null;
  currency?: string | null;
};

export type NoticeTarget = {
  recordId: string;
  reason: string;
};

export type SectionNotice = {
  section: string;
  title: string;
  message: string;
  recordId?: string;
  targets?: NoticeTarget[];
  kind: string;
};

/** Record opened by the inventory notice of a cancelled trade. A device created only to complete the sale must not hide the archived receipt. */
export function cancelledInventoryRecord(tradeId: string, restored?: { id: string; needsCompletion?: boolean } | null) {
  if (restored && !restored.needsCompletion) return restored.id;
  return tradeId;
}

export function noticeTargets(parts: Array<{ recordId?: string | null; reason: string }>): NoticeTarget[] {
  const seen = new Set<string>();
  const targets: NoticeTarget[] = [];
  for (const part of parts) {
    const recordId = part.recordId?.trim();
    if (!recordId || seen.has(recordId)) continue;
    seen.add(recordId);
    targets.push({ recordId, reason: part.reason });
  }
  return targets;
}

export function sectionReason(section: string, facts: NoticeFacts): string {
  if (section === "inventory") return inventoryReason(facts);
  if (section === "clients") return clientReason(facts);
  if (section === "tradeins") return tradeReason(facts);
  return saleReason(facts);
}

function saleReason(facts: NoticeFacts) {
  if (facts.action === "cancelled") return "Cancelada";
  if (facts.action === "updated") return "Actualizada";
  return "Venta registrada";
}

function tradeReason(facts: NoticeFacts) {
  if (facts.action === "draft-created") return "Borrador";
  if (facts.action === "draft-updated") return "Borrador actualizado";
  if (facts.action === "cancelled") return "Cancelado";
  if (facts.action === "updated") return "Actualizado";
  return "Confirmado";
}

function inventoryReason(facts: NoticeFacts) {
  const sold = Boolean(text(facts.soldDevice));
  const released = Boolean(text(facts.releasedDevice));
  const archived = Boolean(text(facts.archivedDevice));
  const incoming = Boolean(text(facts.receivedDevice)) && facts.action !== "cancelled";
  if (incoming && !sold && !released && !archived) return "Nuevo · entró por canje";
  if (sold && !incoming && !released && !archived) return "Vendido";
  if (released && !sold && !incoming) return "Volvió al stock";
  if (archived && !sold && !incoming && !released) return "Archivado";
  if (incoming) return "Nuevo · entró por canje";
  if (sold) return "Vendido";
  if (released) return "Volvió al stock";
  if (archived) return "Archivado";
  return "Actualizado";
}

function clientReason(facts: NoticeFacts) {
  const balance = facts.pendingBalance ?? 0;
  const debt = balance > 0 ? `Debe ${money(balance, facts.currency)}` : "";
  if (facts.clientCreated && debt) return `Nuevo cliente · debe ${money(balance, facts.currency)}`;
  if (facts.clientCreated) return "Nuevo cliente";
  if (facts.action === "cancelled" && (facts.refund ?? 0) > 0) {
    const refundText = `Devolución ${money(facts.refund ?? 0, facts.currency)}`;
    return debt ? `${refundText} · ${debt}` : refundText;
  }
  if (debt) return debt;
  if (facts.action === "cancelled" || facts.action === "updated") return "Quedó al día";
  return "Cliente";
}

function text(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || "";
}

function money(value: number, currency?: string | null) {
  return formatArMoney(value, currency);
}

export function sectionCopy(section: string, facts: NoticeFacts): { title: string; message: string } {
  if (section === "inventory") return inventoryCopy(facts);
  if (section === "clients") return clientCopy(facts);
  if (section === "tradeins") return tradeCopy(facts);
  return saleCopy(facts);
}

function saleCopy(facts: NoticeFacts): { title: string; message: string } {
  const title = facts.action === "cancelled" ? "Venta cancelada" : facts.action === "updated" ? "Venta actualizada" : "Venta registrada";
  const parts = [text(facts.deviceLabel), text(facts.clientName), facts.amount != null ? money(facts.amount, facts.currency) : ""].filter(Boolean);
  return { title, message: parts.join(" · ") || "Venta sin detalle" };
}

function tradeCopy(facts: NoticeFacts): { title: string; message: string } {
  const title = facts.action === "draft-created"
    ? "Borrador de canje"
    : facts.action === "draft-updated"
      ? "Borrador actualizado"
      : facts.action === "cancelled"
        ? "Canje cancelado"
        : facts.action === "updated"
          ? "Canje actualizado"
          : "Canje confirmado";
  const parts = [text(facts.receivedDevice) || "Equipo recibido"];
  if (facts.takeValue != null) parts.push(`toma ${money(facts.takeValue, facts.currency)}`);
  if (facts.difference != null) parts.push(`diferencia ${money(facts.difference, facts.currency)}`);
  return { title, message: parts.join(" · ") };
}

function inventoryCopy(facts: NoticeFacts): { title: string; message: string } {
  const sold = text(facts.soldDevice);
  const released = text(facts.releasedDevice);
  const archived = text(facts.archivedDevice);
  const received = text(facts.receivedDevice);
  const incoming = Boolean(received) && facts.action !== "cancelled";
  const bits: string[] = [];
  if (sold) bits.push(`${sold} vendido`);
  if (released) bits.push(`${released} volvió al stock`);
  if (archived) bits.push(`${archived} archivado`);
  if (incoming) {
    bits.push(facts.action === "created" || facts.action === "confirmed"
      ? `Entró un ${received} por canje, en revisión`
      : `${received} recibido por canje, en revisión`);
  }
  const title = incoming && sold
    ? "Stock actualizado"
    : incoming
      ? "Equipo recibido"
      : released && archived
        ? "Stock actualizado"
        : released
          ? "Stock restaurado"
          : sold
            ? "Equipo vendido"
            : archived
              ? "Equipo archivado"
              : "Inventario actualizado";
  return { title, message: bits.join(". ") || "Se actualizó el inventario" };
}

function clientCopy(facts: NoticeFacts): { title: string; message: string } {
  const name = text(facts.clientName) || "Cliente";
  const balance = facts.pendingBalance ?? 0;
  if (facts.clientCreated && balance > 0) return { title: "Nuevo cliente", message: `Nuevo cliente: ${name}. Debe ${money(balance, facts.currency)}` };
  if (facts.clientCreated) return { title: "Nuevo cliente", message: `Nuevo cliente: ${name}` };
  if (facts.action === "cancelled" && (facts.refund ?? 0) > 0) {
    const refundText = `Devolución ${money(facts.refund ?? 0, facts.currency)}`;
    if (balance > 0) return { title: "Devolución registrada", message: `${name} debe ${money(balance, facts.currency)}. ${refundText}` };
    return { title: "Devolución registrada", message: `${name} quedó al día. ${refundText}` };
  }
  if (balance > 0) return { title: "Saldo pendiente", message: `${name} debe ${money(balance, facts.currency)}` };
  if (facts.action === "cancelled" || facts.action === "updated") return { title: "Cliente actualizado", message: `${name} quedó al día` };
  if (facts.amount != null) return { title: "Cliente", message: `${name} compró por ${money(facts.amount, facts.currency)}` };
  return { title: "Cliente", message: name };
}

function mergedTargets(recordId: string | undefined, fallback: string, extra?: NoticeTarget[]) {
  const targets = noticeTargets(extra ?? []);
  if (recordId && !targets.some((target) => target.recordId === recordId)) {
    targets.unshift({ recordId, reason: fallback });
  }
  return targets.length ? targets : undefined;
}

export function sectionRecords(
  sections: string[],
  facts: NoticeFacts,
  recordIds: Record<string, string>,
  options?: { archiveReceived?: boolean; targets?: Record<string, NoticeTarget[]> },
): SectionNotice[] {
  return [...new Set(sections)].map((section) => ({
    section,
    ...sectionCopy(section, facts),
    recordId: recordIds[section],
    targets: mergedTargets(recordIds[section], sectionReason(section, facts), options?.targets?.[section]),
    kind: section === "inventory" && options?.archiveReceived && recordIds.inventory === recordIds.tradeins
      ? "ARCHIVED_TRADE_IN_RECEIVED"
      : "INTEGRATED_OPERATION",
  }));
}

export function operationSummary(input: { trade: boolean; amount: number; takeValue?: number; depositApplied?: number; status: string; hasInventory: boolean; received?: boolean; receivedStatus?: string; currency?: string | null; unpaid?: number }) {
  const format = (value: number) => money(value, input.currency);
  const amount = format(input.amount);
  const applied = Math.max(0, input.depositApplied ?? 0);
  const debtOf = (base: number) => input.unpaid != null ? Math.max(0, input.unpaid) : input.status === "PENDIENTE" ? Math.max(0, base - applied) : 0;
  if (!input.trade) {
    const debtValue = debtOf(input.amount);
    return `Venta ${amount} · deuda ${format(debtValue)}${input.hasInventory ? " · stock vendido" : " · equipo libre"}`;
  }
  const difference = Math.max(0, input.amount - (input.takeValue ?? 0));
  const debtValue = debtOf(difference);
  const settlement = debtValue > 0 ? `debe ${format(debtValue)}` : "pagada";
  const technicalStatus = input.receivedStatus ?? "PENDIENTE";
  const technicalLabel = ({
    PENDIENTE: "Pendiente", "PERITAJE TÉC.": "Peritaje téc.", "EN REVISIÓN": "En revisión",
    APROBADO: "Aprobado", LISTO: "Completado", RECHAZADO: "Rechazado", CANCELADO: "Cancelado",
  } as Record<string, string>)[technicalStatus] ?? technicalStatus;
  return `Canje · total ${amount} · toma ${format(input.takeValue ?? 0)} · diferencia ${format(difference)} · ${settlement}${input.received ? ` · estado técnico del recibido: ${technicalLabel}` : ""}`;
}
