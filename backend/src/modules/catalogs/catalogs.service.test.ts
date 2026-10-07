import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  storeCatalogOption: { findMany: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
  inventoryItem: { updateMany: vi.fn() },
  client: { updateMany: vi.fn() },
}));
vi.mock("../../plugins/prisma.js", () => ({ prisma: { $transaction: (run: (client: typeof tx) => unknown) => run(tx) } }));
import { saveCatalog } from "./catalogs.service.js";

describe("catalog reassignment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tx.storeCatalogOption.findMany.mockResolvedValue([
      { id: "review", value: "EN_REVISION", label: "En revisión", isSystem: false },
      { id: "available", value: "DISPONIBLE", label: "Disponible", isSystem: true },
    ]);
  });

  it("reassigns to a new status using the same canonical value as its created option", async () => {
    await saveCatalog("store", "INVENTORY_STATUS", [
      { value: "DISPONIBLE", label: "Disponible" }, { label: "En diagnóstico" },
    ], [{ value: "EN_REVISION", reassignTo: "En diagnóstico" }]);
    expect(tx.inventoryItem.updateMany).toHaveBeenCalledWith({
      where: { storeId: "store", status: "EN_REVISION" }, data: { status: "EN_DIAGNOSTICO" },
    });
    expect(tx.storeCatalogOption.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      storeId: "store", kind: "INVENTORY_STATUS", value: "EN_DIAGNOSTICO", label: "En diagnóstico",
    }) });
  });

  it("uses the final label for text-based destinations renamed in the same save", async () => {
    tx.storeCatalogOption.findMany.mockResolvedValue([
      { id: "old", value: "Frecuente", label: "Frecuente", isSystem: false },
      { id: "target", value: "Nuevo", label: "Nuevo", isSystem: false },
    ]);
    await saveCatalog("store", "CLIENT_TAG", [{ value: "Nuevo", label: "VIP" }], [
      { value: "Frecuente", reassignTo: "Nuevo" },
    ]);
    expect(tx.client.updateMany).toHaveBeenCalledWith({
      where: { storeId: "store", tag: "Frecuente" }, data: { tag: "VIP" },
    });
    expect(tx.storeCatalogOption.update).toHaveBeenCalledWith({
      where: { id: "target" }, data: expect.objectContaining({ value: "VIP", label: "VIP" }),
    });
  });

  it.each(["missing", "EN_REVISION"])("rejects an unavailable destination %s before mutating records", async (target) => {
    await expect(saveCatalog("store", "INVENTORY_STATUS", [{ value: "DISPONIBLE", label: "Disponible" }], [
      { value: "EN_REVISION", reassignTo: target },
    ])).rejects.toMatchObject({ statusCode: 400 });
    expect(tx.inventoryItem.updateMany).not.toHaveBeenCalled();
    expect(tx.storeCatalogOption.delete).not.toHaveBeenCalled();
  });
});
