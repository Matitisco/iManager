import type { Product } from '../types';
import { formatBatteryDisplay } from '../utils/inventory';
import { conditionLabel, equipmentTitle, formatMoney } from './format';
import { qualityPhrase } from './quality';

function detail(item: Product): string {
  const condition = conditionLabel(item.condition);
  const battery = item.batteryHealth?.trim();
  const parts = [
    item.color?.trim(),
    condition === '—' ? '' : condition,
    qualityPhrase(item.condition, item.grade),
    battery && item.condition !== 'NUEVO' ? `Batería ${formatBatteryDisplay(battery)}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

export function priceListMessage(items: Product[], storeName?: string, formatPrice: (item: Product) => string = (item) => formatMoney(item.price)): string {
  const store = storeName?.trim();
  const title = store ? `Lista de precios — ${store}` : 'Lista de precios';
  if (items.length === 0) return `${title}\n\nNo hay equipos para mostrar.`;
  const lines = items.map((item) => {
    const extra = detail(item);
    const specs = extra ? ` — ${extra}` : '';
    return `• ${equipmentTitle(item.model, item.capacity)}${specs} — ${formatPrice(item)}`;
  });
  return `${title}\n\n${lines.join('\n')}`;
}
