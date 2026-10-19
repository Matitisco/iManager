import { canAccessSection } from "../stores/sections.js";

export function canManageStockCount(member: { role: string; sections?: unknown }) {
  if (member.role === "STAFF") return false;
  if (member.role === "OWNER") return true;
  return canAccessSection("inventory", member);
}
