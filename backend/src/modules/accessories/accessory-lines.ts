import { z } from "zod";

export const accessoryLineSchema = z.object({
  accessoryId: z.string().trim().min(1).max(80),
  quantity: z.number().int().positive().max(10000),
});

export const accessoryLinesSchema = z.array(accessoryLineSchema).max(30).optional();

export type AccessoryLineInput = z.infer<typeof accessoryLineSchema>;

export function accessorySaleCode(saleNumber: number) {
  return `V-${String(saleNumber).padStart(4, "0")}`;
}

export function accessorySaleNote(saleNumber: number, deviceLabel?: string | null) {
  const code = accessorySaleCode(saleNumber);
  const device = deviceLabel?.trim();
  return device ? `Venta ${code} · con ${device}` : `Venta ${code}`;
}

export function adjustmentNote(delta: number) {
  return delta > 0 ? "Compra a proveedor" : "Ajuste de stock";
}

export function crossedLowStock(previous: number, next: number, minStock: number) {
  return next <= minStock && previous > minStock;
}
