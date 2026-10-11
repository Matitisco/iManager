import { normalizeHeader } from "./column-mapping.js";
import {
  normalizeImportedDni,
  normalizeImportedEmail,
  phonesMatch,
} from "./normalize-import.js";

/**
 * How an imported sale attaches to clients and stock already in the store.
 *
 * Inventory is matched only by IMEI. The item is linked and marked VENDIDO
 * only when it is still DISPONIBLE, not archived, and no active sale points
 * at it. Any other case leaves the item untouched. The sale is still stored,
 * with the sheet's device text, and no inventory row is created.
 *
 * Clients match by DNI, then phone, then email, then a unique name. A name
 * shared by two clients is not guessed. A match is linked and its existing
 * fields are not overwritten. A sale with a name and no match creates one
 * client (name only, plus phone or DNI when the sale row has them).
 *
 * A canje links only when that client already has exactly one open trade-in
 * whose received device matches the text. Import never creates a trade-in
 * and never changes stock through one. The seller is stored as text; a
 * store member is referenced only when the display name matches once.
 */

export type InventoryCandidate = {
  id: string;
  status: string;
  archivedAt?: Date | null;
};

export type InventoryLink =
  | { action: "link"; inventoryItemId: string }
  | { action: "leave" };

export function decideInventoryLink(
  item: InventoryCandidate | null,
  hasActiveSale: boolean,
): InventoryLink {
  if (!item || item.archivedAt || hasActiveSale) return { action: "leave" };
  if (item.status && item.status !== "DISPONIBLE") return { action: "leave" };
  return { action: "link", inventoryItemId: item.id };
}

export type ClientCandidate = {
  id: string;
  name: string;
  dni?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type ClientLink =
  | { action: "use"; clientId: string }
  | { action: "create" }
  | { action: "ambiguous" }
  | { action: "skip" };

export function decideClientLink(
  clients: ClientCandidate[],
  input: { name?: string; dni?: string; phone?: string; email?: string },
): ClientLink {
  const dni = normalizeImportedDni(input.dni);
  const email = normalizeImportedEmail(input.email);
  const name = input.name?.trim() ?? "";
  if (dni) {
    const byDni = clients.filter((client) => normalizeImportedDni(client.dni ?? "") === dni);
    if (byDni.length === 1) return { action: "use", clientId: byDni[0].id };
    if (byDni.length > 1) return { action: "ambiguous" };
  }
  if (input.phone?.trim()) {
    const byPhone = clients.filter((client) => phonesMatch(client.phone, input.phone));
    if (byPhone.length === 1) return { action: "use", clientId: byPhone[0].id };
    if (byPhone.length > 1) return { action: "ambiguous" };
  }
  if (email.includes("@")) {
    const byEmail = clients.filter((client) => normalizeImportedEmail(client.email ?? "") === email);
    if (byEmail.length === 1) return { action: "use", clientId: byEmail[0].id };
    if (byEmail.length > 1) return { action: "ambiguous" };
  }
  if (!name) return { action: "skip" };
  const wanted = normalizeHeader(name);
  const byName = clients.filter((client) => normalizeHeader(client.name) === wanted);
  if (byName.length === 1) return { action: "use", clientId: byName[0].id };
  if (byName.length > 1) return { action: "ambiguous" };
  return { action: "create" };
}

export function blankFieldsToFill(
  existing: { dni?: string | null; phone?: string | null; email?: string | null; instagram?: string | null },
  incoming: { dni?: string; phone?: string; email?: string; instagram?: string },
  dniTaken: boolean,
): { dni?: string; phone?: string; email?: string; instagram?: string } {
  const patch: { dni?: string; phone?: string; email?: string; instagram?: string } = {};
  if (!existing.dni?.trim() && incoming.dni && !dniTaken) patch.dni = incoming.dni;
  if (!existing.phone?.trim() && incoming.phone) patch.phone = incoming.phone;
  if (!existing.email?.trim() && incoming.email) patch.email = incoming.email;
  if (!existing.instagram?.trim() && incoming.instagram) patch.instagram = incoming.instagram;
  return patch;
}

export function matchSellerUserId(
  members: { userId: string; displayName: string | null }[],
  seller: string,
): string | null {
  const wanted = normalizeHeader(seller);
  if (!wanted) return null;
  const hits = members.filter((member) => normalizeHeader(member.displayName ?? "") === wanted);
  return hits.length === 1 ? hits[0].userId : null;
}

export function matchOpenTradeIn(
  tradeIns: { id: string; deviceReceived: string }[],
  label: string,
): string | null {
  const wanted = normalizeHeader(label);
  if (!wanted) return null;
  const hits = tradeIns.filter((trade) => normalizeHeader(trade.deviceReceived) === wanted);
  return hits.length === 1 ? hits[0].id : null;
}
