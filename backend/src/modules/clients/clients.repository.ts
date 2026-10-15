import type { Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";

const clientList = {
  where: (storeId: string) => ({ storeId }),
};

export const clientsRepository = {
  list(storeId: string) {
    return prisma.client.findMany({
      where: clientList.where(storeId),
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
      select: { id: true },
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
      where: { storeId, clientId, integratedOperation: true, status: { not: "CANCELADA" } },
      select: { id: true },
    });
  },

  findDniDuplicate(storeId: string, dni: string, exceptId: string) {
    return prisma.client.findFirst({
      where: { storeId, dni, id: { not: exceptId } },
      select: { id: true },
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
      select: { id: true, name: true },
    });
  },

  findActiveTrade(storeId: string, clientId: string) {
    return prisma.tradeIn.findFirst({
      where: { storeId, clientId, confirmationStatus: { not: "CANCELLED" } },
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
      select: { id: true, name: true },
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

  clearCategoryAndDelete(storeId: string, id: string) {
    return prisma.$transaction([
      prisma.client.updateMany({ where: { storeId, categoryId: id }, data: { categoryId: null } }),
      prisma.clientCategory.delete({ where: { id } }),
    ]);
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
