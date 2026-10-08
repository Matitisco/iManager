import { describe, expect, it } from "vitest";
import { operationSummary, sectionCopy, sectionReason, sectionRecords } from "./operation-copy.js";

describe("section operation copy", () => {
  it("describes the impact of each section with Argentine amounts", () => {
    expect(sectionCopy("inventory", { action: "confirmed", receivedDevice: "iPhone 13" }).message).toBe("Entró un iPhone 13 por canje, en revisión");
    expect(sectionCopy("inventory", { action: "created", soldDevice: "iPhone 13" })).toEqual({ title: "Equipo vendido", message: "iPhone 13 vendido" });
    expect(sectionCopy("clients", { action: "created", clientName: "Juan Pérez", clientCreated: true, pendingBalance: 0 }).message).toBe("Nuevo cliente: Juan Pérez");
    expect(sectionCopy("clients", { action: "created", clientName: "Juan Pérez", pendingBalance: 50000 }).message).toBe("Juan Pérez debe $ 50.000");
    expect(sectionCopy("sales", { action: "created", deviceLabel: "iPhone 13", clientName: "Juan Pérez", amount: 50000 }).message).toBe("iPhone 13 · Juan Pérez · $ 50.000");
    expect(sectionCopy("tradeins", { action: "confirmed", receivedDevice: "iPhone 13", takeValue: 20000, difference: 30000 }).message).toBe("iPhone 13 · toma $ 20.000 · diferencia $ 30.000");
  });

  it("keeps a distinct title and message on every section of the same operation", () => {
    const records = sectionRecords(["sales", "inventory", "tradeins", "clients"], {
      action: "confirmed",
      deviceLabel: "iPhone 14 128GB",
      soldDevice: "iPhone 14 128GB",
      receivedDevice: "iPhone 11",
      clientName: "Juan Pérez",
      clientCreated: true,
      amount: 1500,
      pendingBalance: 900,
      takeValue: 600,
      difference: 900,
    }, { sales: "sale-1", inventory: "in-1", tradeins: "tr-1", clients: "cl-1" });

    expect(records.map((record) => record.title)).toEqual(["Venta registrada", "Stock actualizado", "Canje confirmado", "Nuevo cliente"]);
    expect(new Set(records.map((record) => record.message)).size).toBe(4);
    expect(records.find((record) => record.section === "inventory")?.message).toBe("iPhone 14 128GB vendido. Entró un iPhone 11 por canje, en revisión");
    expect(records.find((record) => record.section === "inventory")?.targets).toEqual([{ recordId: "in-1", reason: "Nuevo · entró por canje" }]);
    expect(records.find((record) => record.section === "clients")?.targets).toEqual([{ recordId: "cl-1", reason: "Nuevo cliente · debe $ 900" }]);
    expect(records.find((record) => record.section === "sales")?.targets?.[0]?.reason).toBe("Venta registrada");
    expect(records.find((record) => record.section === "clients")?.message).toBe("Nuevo cliente: Juan Pérez. Debe $ 900");
    expect(records.every((record) => record.message !== "Se registró una venta.")).toBe(true);
  });

  it("shows the trade difference and the remaining debt separately", () => {
    expect(operationSummary({ trade: true, amount: 950_000, takeValue: 350_000, status: "COMPLETADA", hasInventory: true, received: true })).toBe("Canje · total $ 950.000 · toma $ 350.000 · diferencia $ 600.000 · pagada · recibido en revisión");
    expect(operationSummary({ trade: true, amount: 950_000, takeValue: 350_000, status: "PENDIENTE", hasInventory: false })).toBe("Canje · total $ 950.000 · toma $ 350.000 · diferencia $ 600.000 · debe $ 600.000");
  });

  it("formats the operation toast in es-AR and marks an archived trade receipt", () => {
    expect(operationSummary({ trade: false, amount: 1200, status: "COMPLETADA", hasInventory: true })).toBe("Venta $ 1.200 · deuda $ 0 · stock vendido");
    expect(operationSummary({ trade: true, amount: 1500, takeValue: 600, status: "PENDIENTE", hasInventory: true, received: true })).toBe("Canje · total $ 1.500 · toma $ 600 · diferencia $ 900 · debe $ 900 · recibido en revisión");
    const [notice] = sectionRecords(["inventory"], { action: "cancelled", archivedDevice: "iPhone 11" }, { inventory: "trade-1", tradeins: "trade-1" }, { archiveReceived: true });
    expect(notice).toMatchObject({ message: "iPhone 11 archivado", kind: "ARCHIVED_TRADE_IN_RECEIVED" });
  });

  it("stores a reason for every affected record, including both phones of a trade", () => {
    expect(sectionReason("inventory", { action: "created", soldDevice: "iPhone 13" })).toBe("Vendido");
    expect(sectionReason("inventory", { action: "confirmed", receivedDevice: "iPhone 11" })).toBe("Nuevo · entró por canje");
    expect(sectionReason("clients", { action: "created", clientCreated: true, pendingBalance: 0 })).toBe("Nuevo cliente");
    expect(sectionReason("clients", { action: "created", pendingBalance: 50000 })).toBe("Debe $ 50.000");
    const [notice] = sectionRecords(["inventory"], {
      action: "confirmed",
      soldDevice: "iPhone 14",
      receivedDevice: "iPhone 11",
    }, { inventory: "received" }, {
      targets: { inventory: [
        { recordId: "sold", reason: "Vendido" },
        { recordId: "received", reason: "Nuevo · entró por canje" },
      ] },
    });
    expect(notice.recordId).toBe("received");
    expect(notice.targets).toEqual([
      { recordId: "sold", reason: "Vendido" },
      { recordId: "received", reason: "Nuevo · entró por canje" },
    ]);
  });
});
