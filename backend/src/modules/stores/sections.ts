export const SECTION_IDS = [
  "dashboard",
  "inventory",
  "sales",
  "tradeins",
  "clients",
  "reports",
  "notifications",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export function canAccessSection(section: SectionId, member: { role: string; sections?: unknown }): boolean {
  if (section === "reports" && member.role === "STAFF") return false;
  if (member.role === "OWNER" || member.sections == null) return true;
  const sections = normalizeSections(member.sections);
  return sections?.includes(section) ?? true;
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
    throw Object.assign(new Error("Hay una sección que no existe"), { statusCode: 400 });
  }
  return normalizeSections(value) ?? [];
}
