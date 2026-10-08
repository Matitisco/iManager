import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireSectionAccess } from "../../middleware/section-access.js";
import { canAccessSection, SECTION_IDS } from "../stores/sections.js";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "./notifications.service.js";

function visibleSections(member: { role: string; sections?: unknown }) {
  return SECTION_IDS.filter((section) => section !== "notifications" && canAccessSection(section, member));
}

export async function notificationsRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, resolveAppUser, requireSectionAccess("notifications")];

  app.get("/", { preHandler }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const notifications = await listNotifications(request.appUser.storeId, request.appUser.userId, visibleSections(request.appUser));
    return { notifications };
  });

  app.post("/read-all", { preHandler }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    return markAllNotificationsRead(request.appUser.storeId, request.appUser.userId, visibleSections(request.appUser));
  });

  app.post("/:id/read", { preHandler }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { id } = z.object({ id: z.string().trim().min(1) }).parse(request.params);
    const result = await markNotificationRead(request.appUser.storeId, request.appUser.userId, id, visibleSections(request.appUser));
    if (!result) return reply.code(404).send({ error: "Notification not found" });
    return result;
  });
}
