import type { CatalogItem } from '../types/public-catalog';
import { catalogCondition, catalogPrice, catalogBatteryLabel, catalogBatteryMinimum } from './presentation';
export function PriceList({ items }: { items: CatalogItem[] }) {
  const models = [...new Set(items.map(item => item.model))].sort((a, b) => b.localeCompare(a, 'es', { numeric: true }));
  return <div className="price-groups">{models.map(model => {
    const rows = items.filter(item => item.model === model);
    return <section className="price-group" key={model} aria-label={model}>
      <div className="price-model"><h2><span>{model}</span></h2><small>{rows.length} {rows.length === 1 ? 'equipo' : 'equipos'}</small></div>
      {rows.map((item, index) => <div className="price-row" key={index}>
        <div className="price-line"><b>{item.capacity} · {item.color}</b><span className="price-dots" /><strong data-ph-mask className={item.price == null ? "price-consult" : undefined}>{catalogPrice(item)}</strong></div>
        <small><span className={item.condition === 'NUEVO' ? 'price-new' : ''}>{catalogCondition(item)}</span> · <span style={{ color: (catalogBatteryMinimum(item.batteryHealth) ?? 0) > 85 ? 'var(--theme-ok, #25a66a)' : (catalogBatteryMinimum(item.batteryHealth) ?? 0) >= 70 ? 'var(--theme-warn, #d48a00)' : 'var(--theme-err, #dc4c4c)' }}>bat. {catalogBatteryLabel(item.batteryHealth)}</span></small>
      </div>)}
    </section>;
  })}</div>;
}
