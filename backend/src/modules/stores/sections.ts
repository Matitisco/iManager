import { DomainError } from "../../lib/domain-error.js";

export const SECTION_IDS = [
  "cash",
  "cashBalances",
  "dashboard",
  "inventory",
  "sales",
  "tradeins",
  "clients",
  "service",
  "reports",
  "commissions",
  "notifications",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export function canAccessSection(section: SectionId, member: { role: string; sections?: unknown }): boolean {
  if (member.role === "OWNER") return true;
  const sections = normalizeSections(member.sections);
  if (sections == null) {
    return section !== "cashBalances" && section !== "commissions" && !(section === "reports" && member.role === "STAFF");
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
