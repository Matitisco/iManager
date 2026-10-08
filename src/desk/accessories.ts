export const ACCESSORY_CATEGORIES = ['Cargadores', 'Cables', 'Fundas', 'Templados', 'Otros'];

export function needsRestock(item: { stock: number; minStock: number }) {
  return item.stock <= item.minStock;
}

export function accessoryStatus(item: { stock: number; minStock: number }) {
  if (item.stock <= 0) return 'Sin stock';
  if (needsRestock(item)) return 'Stock bajo';
  return 'En stock';
}

export function movementWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return `hoy ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}
