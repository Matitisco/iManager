export const ACCESSORY_TYPES = ['Templado', 'Funda', 'Cargador', 'Cable', 'Auriculares', 'Otro'] as const;
export type AccessoryType = typeof ACCESSORY_TYPES[number];
export type InventoryKind = 'DEVICE' | 'ACCESSORY';
export const LOW_STOCK_THRESHOLD = 5;

export function isAccessory(item: { kind?: string }) { return item.kind === 'ACCESSORY'; }
export function isDevice(item: { kind?: string }) { return !isAccessory(item); }
export function isLowStock(quantity: number) { return quantity < LOW_STOCK_THRESHOLD; }

/** Shared by the form and the service; persisted device-only fields stay empty. */
export function accessoryError(input: { accessoryType?: string | null; cantidad?: number; imei?: string | null; batteryHealth?: string; condition?: string; grade?: string; capacity?: string; color?: string }) {
  if (!ACCESSORY_TYPES.includes(input.accessoryType as AccessoryType)) return 'Elegí un tipo de accesorio';
  if (!Number.isInteger(input.cantidad) || input.cantidad! < 0 || input.cantidad! > 2147483647) return 'Ingresá una cantidad entera de 0 o más unidades';
  if (input.imei?.trim()) return 'Los accesorios no llevan IMEI';
  if ([input.batteryHealth, input.condition, input.grade, input.capacity, input.color].some(value => value?.trim())) return 'Los accesorios no llevan batería, condición, capacidad ni color';
  return null;
}
