import type { Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";

export const clientsRepository = {
  list(storeId: string, archived = false) {
    return prisma.client.findMany({
      where: { storeId, archivedAt: archived ? { not: null } : null },
      orderBy: { createdAt: "desc" },
    });
  },

  findCategory(storeId: string, categoryId: string) {
    return prisma.clientCategory.findFirst({
      where: { id: categoryId, storeId },
      select: { id: true },
    });
  },

  findIdByDni(storeId: string, dni: string) {
    return prisma.client.findFirst({
      where: { storeId, dni },
      select: { id: true, archivedAt: true },
    });
  },

  create(data: Prisma.ClientUncheckedCreateInput) {
    return prisma.client.create({ data });
  },

  findInStore(storeId: string, id: string) {
    return prisma.client.findFirst({ where: { id, storeId } });
  },

  findActiveIntegratedSale(storeId: string, clientId: string) {
    return prisma.sale.findFirst({
      where: { storeId, clientId, integratedOperation: true, status: { not: "CANCELADA" }, voidedAt: null },
      select: { id: true },
    });
  },

  findDniDuplicate(storeId: string, dni: string, exceptId: string) {
    return prisma.client.findFirst({
      where: { storeId, dni, id: { not: exceptId } },
      select: { id: true, archivedAt: true },
    });
  },

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(run);
  },

  listPayments(storeId: string, clientId: string) {
    return prisma.clientPayment.findMany({
      where: { storeId, clientId },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
  },

  findForDelete(storeId: string, id: string) {
    return prisma.client.findFirst({
      where: { id, storeId },
      select: { id: true, name: true, archivedAt: true },
    });
  },

  findActiveTrade(storeId: string, clientId: string) {
    return prisma.tradeIn.findFirst({
      where: { storeId, clientId, confirmationStatus: { not: "CANCELLED" }, voidedAt: null },
      select: { id: true },
    });
  },

  deleteById(id: string) {
    return prisma.client.delete({ where: { id } });
  },

  findByDni(storeId: string, dni: string) {
    return prisma.client.findFirst({ where: { storeId, dni } });
  },

  findByName(storeId: string, name: string) {
    return prisma.client.findFirst({
      where: { storeId, name: { equals: name, mode: "insensitive" } },
    });
  },

  update(id: string, data: Prisma.ClientUncheckedUpdateInput) {
    return prisma.client.update({ where: { id }, data });
  },

  listCategories(storeId: string) {
    return prisma.clientCategory.findMany({
      where: { storeId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, archivedAt: true },
    });
  },

  findCategoryByName(storeId: string, name: string) {
    return prisma.clientCategory.findFirst({ where: { storeId, name } });
  },

  countCategories(storeId: string) {
    return prisma.clientCategory.count({ where: { storeId } });
  },

  createCategory(storeId: string, name: string, sortOrder: number) {
    return prisma.clientCategory.create({
      data: { storeId, name, sortOrder },
      select: { id: true, name: true },
    });
  },

  findCategoryInStore(storeId: string, id: string) {
    return prisma.clientCategory.findFirst({ where: { id, storeId } });
  },

  renameCategory(id: string, name: string) {
    return prisma.clientCategory.update({
      where: { id },
      data: { name },
      select: { id: true, name: true },
    });
  },

  updateCategoryArchive(id: string, archivedAt: Date | null) {
    return prisma.clientCategory.update({
      where: { id },
      data: { archivedAt },
      select: { id: true, name: true },
    });
  },

  archiveCategory(storeId: string, id: string) {
    return prisma.clientCategory.updateMany({
      where: { id, storeId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  },

  reorderCategories(storeId: string, categoryIds: string[]) {
    return prisma.$transaction(
      categoryIds.map((id, idx) =>
        prisma.clientCategory.updateMany({ where: { id, storeId }, data: { sortOrder: idx } }),
      ),
    );
  },

  moveToCategory(storeId: string, ids: string[], categoryId: string | null) {
    return prisma.client.updateMany({ where: { storeId, id: { in: ids } }, data: { categoryId } });
  },
};
