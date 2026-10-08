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
};

export type SectionNotice = {
  section: string;
  title: string;
  message: string;
  recordId?: string;
  kind: string;
};

function text(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || "";
}

function money(value: number) {
  return formatArMoney(value);
}

export function sectionCopy(section: string, facts: NoticeFacts): { title: string; message: string } {
  if (section === "inventory") return inventoryCopy(facts);
  if (section === "clients") return clientCopy(facts);
  if (section === "tradeins") return tradeCopy(facts);
  return saleCopy(facts);
}

function saleCopy(facts: NoticeFacts): { title: string; message: string } {
  const title = facts.action === "cancelled" ? "Venta cancelada" : facts.action === "updated" ? "Venta actualizada" : "Venta registrada";
  const parts = [text(facts.deviceLabel), text(facts.clientName), facts.amount != null ? money(facts.amount) : ""].filter(Boolean);
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
  if (facts.takeValue != null) parts.push(`toma ${money(facts.takeValue)}`);
  if (facts.difference != null) parts.push(`diferencia ${money(facts.difference)}`);
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
  if (facts.clientCreated && balance > 0) return { title: "Nuevo cliente", message: `Nuevo cliente: ${name}. Debe ${money(balance)}` };
  if (facts.clientCreated) return { title: "Nuevo cliente", message: `Nuevo cliente: ${name}` };
  if (balance > 0) return { title: "Saldo pendiente", message: `${name} debe ${money(balance)}` };
  if (facts.action === "cancelled" || facts.action === "updated") return { title: "Cliente actualizado", message: `${name} quedó al día` };
  if (facts.amount != null) return { title: "Cliente", message: `${name} compró por ${money(facts.amount)}` };
  return { title: "Cliente", message: name };
}

export function sectionRecords(
  sections: string[],
  facts: NoticeFacts,
  recordIds: Record<string, string>,
  options?: { archiveReceived?: boolean },
): SectionNotice[] {
  return [...new Set(sections)].map((section) => ({
    section,
    ...sectionCopy(section, facts),
    recordId: recordIds[section],
    kind: section === "inventory" && options?.archiveReceived && recordIds.inventory === recordIds.tradeins
      ? "ARCHIVED_TRADE_IN_RECEIVED"
      : "INTEGRATED_OPERATION",
  }));
}

export function operationSummary(input: { trade: boolean; amount: number; takeValue?: number; status: string; hasInventory: boolean; received?: boolean }) {
  const amount = money(input.amount);
  const debtValue = input.status === "PENDIENTE"
    ? (input.trade ? Math.max(0, input.amount - (input.takeValue ?? 0)) : input.amount)
    : 0;
  return input.trade
    ? `Canje · total ${amount} · toma ${money(input.takeValue ?? 0)} · diferencia/deuda ${money(debtValue)}${input.received ? " · recibido en revisión" : ""}`
    : `Venta ${amount} · deuda ${money(debtValue)}${input.hasInventory ? " · stock vendido" : " · equipo libre"}`;
}
