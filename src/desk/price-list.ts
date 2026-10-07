import type { Product } from '../types';
import { formatBatteryDisplay } from '../utils/inventory';
import { conditionLabel, equipmentTitle, formatMoney } from './format';

function detail(item: Product): string {
  const condition = conditionLabel(item.condition, item.grade);
  const battery = item.batteryHealth?.trim();
  const parts = [
    item.color?.trim(),
    condition === '—' ? '' : condition,
    battery && item.condition !== 'NUEVO' ? `Batería ${formatBatteryDisplay(battery)}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

export function priceListMessage(items: Product[], storeName?: string): string {
  const store = storeName?.trim();
  const title = store ? `Lista de precios — ${store}` : 'Lista de precios';
  if (items.length === 0) return `${title}\n\nNo hay equipos para mostrar.`;
  const lines = items.map((item) => {
    const extra = detail(item);
    const specs = extra ? ` — ${extra}` : '';
    return `• ${equipmentTitle(item.model, item.capacity)}${specs} — ${formatMoney(item.price)}`;
  });
  return `${title}\n\n${lines.join('\n')}`;
}
