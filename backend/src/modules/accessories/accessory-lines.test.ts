import { describe, expect, it } from "vitest";
import { accessoryLineSchema, accessorySaleNote, adjustmentNote, crossedLowStock } from "./accessory-lines.js";

describe("accessory sale lines", () => {
  it("builds the movement note shown on the accessory", () => {
    expect(accessorySaleNote(4, "iPhone 13")).toBe("Venta V-0004 · con iPhone 13");
    expect(accessorySaleNote(2, "  ")).toBe("Venta V-0002");
  });

  it("labels manual stock changes", () => {
    expect(adjustmentNote(10)).toBe("Compra a proveedor");
    expect(adjustmentNote(-2)).toBe("Ajuste de stock");
  });

  it("notifies only when stock crosses the minimum", () => {
    expect(crossedLowStock(8, 3, 3)).toBe(true);
    expect(crossedLowStock(2, 1, 3)).toBe(false);
    expect(crossedLowStock(4, 4, 3)).toBe(false);
  });

  it("rejects a line without quantity", () => {
    expect(accessoryLineSchema.safeParse({ accessoryId: "acc-1", quantity: 0 }).success).toBe(false);
    expect(accessoryLineSchema.safeParse({ accessoryId: "acc-1", quantity: 2 }).success).toBe(true);
  });
});
