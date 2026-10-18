import { DomainError } from "../../lib/domain-error.js";

export const SECTION_IDS = [
  "cash",
  "cashBalances",
  "dashboard",
  "inventory",
  "publicCatalog",
  "sales",
  "tradeins",
  "clients",
  "service",
  "reports",
  "commissions",
  "notifications",
] as const;

export const STAFF_DEFAULT_SECTIONS = ["dashboard", "inventory", "sales", "clients", "tradeins", "service", "notifications"];

export type SectionId = (typeof SECTION_IDS)[number];

export function canAccessSection(section: SectionId, member: { role: string; sections?: unknown }): boolean {
  if (member.role === "OWNER") return true;
  const sections = normalizeSections(member.sections);
  if (sections == null) {
    if (section === "publicCatalog") return false;
    if (member.role === "STAFF") return STAFF_DEFAULT_SECTIONS.includes(section);
    return section !== "cashBalances" && section !== "commissions";
  }
  return sections.includes(section);
}

/** Cost, margin and store billing follow the same gate as Reportes. */
export function canSeeFinancials(member: { role: string; sections?: unknown }): boolean {
  return canAccessSection("reports", member);
}

const KNOWN = new Set<string>(SECTION_IDS);

export function normalizeSections(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const sections: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !KNOWN.has(item) || seen.has(item)) continue;
    seen.add(item);
    sections.push(item);
  }
  return sections;
}

export function assertSectionList(value: string[]) {
  const unknown = value.find((item) => !KNOWN.has(item));
  if (unknown) {
    throw new DomainError("Hay una sección que no existe", 400);
  }
  return normalizeSections(value) ?? [];
}
