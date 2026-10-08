import type { FastifyReply, FastifyRequest } from "fastify";
import { canAccessSection, type SectionId } from "../modules/stores/sections.js";
const LABELS: Record<SectionId, string> = { dashboard: "Dashboard", inventory: "Inventario", sales: "Ventas", tradeins: "Canjes", clients: "Clientes", commissions: "Comisiones", reports: "Reportes", notifications: "Notificaciones" };

export function requireSectionAccess(section: SectionId) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const member = request.appUser;
    if (!member) return reply.code(403).send({ error: "Store membership required" });
    if (canAccessSection(section, member)) return;
    const route = request.routeOptions.url ?? "";
    const reportRead = request.method === "GET" && (
      route === "/" ||
      /(?:^|\/)categories\/?$/.test(route) ||
      /^\/api\/(?:inventory|sales|trade-ins|clients)\/?$/.test(route)
    );
    if (reportRead && section !== "reports" && canAccessSection("reports", member)) return;
    return reply.code(403).send({ error: `No tenés acceso a ${LABELS[section]}` });
  };
}
