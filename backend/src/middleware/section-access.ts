import type { FastifyReply, FastifyRequest } from "fastify";
import { DomainError } from "../lib/domain-error.js";
import { canAccessSection, type SectionId } from "../modules/stores/sections.js";
import type { AppUserContext } from "../types/auth.js";

const LABELS: Record<SectionId, string> = { cash: "Cajas", cashBalances: "Saldo de cajas", dashboard: "Dashboard", inventory: "Inventario", publicCatalog: "Catálogo", sales: "Ventas", tradeins: "Canjes", clients: "Clientes", service: "Servicio técnico", reports: "Reportes", commissions: "Comisiones", notifications: "Notificaciones", history: "Historial" };

export function requireSectionAccess(section: SectionId) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const member = request.appUser;
    if (!member) return reply.code(403).send({ error: "Store membership required" });
    if (canAccessSection(section, member)) return;
    return reply.code(403).send({ error: `No tenés acceso a ${LABELS[section]}` });
  };
}

export function requireMember<T extends FastifyRequest>(request: T): asserts request is T & { appUser: AppUserContext } {
  if (!request.appUser) throw new DomainError("Store membership required", 403);
}
