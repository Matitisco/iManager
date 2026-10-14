import { useEffect, useId, useRef, useState } from 'react';
import type { CatalogItem } from '../types/public-catalog';
import { BATTERY_FILTERS, catalogCondition, PRICE_PRESETS, pricePresetId, shortCatalogModel, type CatalogFilters } from './presentation';

type Change = (key: keyof CatalogFilters, value: string) => void;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function Chevron() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
}

function ChipMenu({ label, text, marked, options, value, onChange }: {
  label: string;
  text: string;
  marked: boolean;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className={`price-chip-menu${open ? ' open' : ''}`} ref={root}>
    <button type="button" className={`price-chip${marked ? ' on' : ''}`} aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? listId : undefined} onClick={() => setOpen(current => !current)}>{text}<Chevron /></button>
    {open && <div id={listId} role="listbox" aria-label={label} className="price-chip-list">
      {options.map(option => <button type="button" role="option" aria-selected={option.value === value} key={option.value || 'all'} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}
    </div>}
  </div>;
}

function ChipGroup({ label, value, options, onChange, anyLabel }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  anyLabel?: string;
}) {
  return <fieldset className="price-chip-group">
    <legend>{label}</legend>
    <div className="price-chip-cloud" role="group" aria-label={label}>
      {anyLabel ? <button type="button" aria-pressed={!value} onClick={() => onChange('')}>{anyLabel}</button> : null}
      {options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(value === option.value ? '' : option.value)}>{option.label}</button>)}
    </div>
  </fieldset>;
}

export function DesktopFilters({ items, filters, showPrice, onChange, onPrices }: {
  items: CatalogItem[];
  filters: CatalogFilters;
  showPrice: boolean;
  onChange: Change;
  onPrices: (min: string, max: string) => void;
}) {
  const models = unique(items.map(item => item.model));
  const preset = pricePresetId(filters);
  const customPrice = Boolean(filters.min || filters.max) && !preset;
  const priceText = customPrice ? [filters.min && `Desde ${filters.min}`, filters.max && `Hasta ${filters.max}`].filter(Boolean).join(' · ') : (PRICE_PRESETS.find(item => item.id === preset)?.label ?? 'Precio');
  return <div className="price-controls">
    <ChipMenu label="Modelo" text={filters.model ? shortCatalogModel(filters.model) : 'Modelo: todos'} marked options={[{ value: '', label: 'Modelo: todos' }, ...models.map(model => ({ value: model, label: model }))]} value={filters.model} onChange={value => onChange('model', value)} />
    <ChipMenu label="Capacidad" text={filters.capacity || 'Capacidad'} marked={Boolean(filters.capacity)} options={[{ value: '', label: 'Capacidad' }, ...unique(items.map(item => item.capacity)).map(value => ({ value, label: value }))]} value={filters.capacity} onChange={value => onChange('capacity', value)} />
    <ChipMenu label="Condición" text={filters.condition || 'Condición'} marked={Boolean(filters.condition)} options={[{ value: '', label: 'Condición' }, ...unique(items.map(catalogCondition)).map(value => ({ value, label: value }))]} value={filters.condition} onChange={value => onChange('condition', value)} />
    <ChipMenu label="Batería" text={BATTERY_FILTERS.find(item => item.value === filters.battery)?.label ?? 'Batería'} marked={Boolean(filters.battery)} options={[{ value: '', label: 'Batería' }, ...BATTERY_FILTERS.map(item => ({ value: item.value, label: item.label }))]} value={filters.battery} onChange={value => onChange('battery', value)} />
    {showPrice && <ChipMenu label="Precio" text={priceText} marked={Boolean(filters.min || filters.max)} options={PRICE_PRESETS.map(item => ({ value: item.id, label: item.id ? item.label : 'Precio' }))} value={preset} onChange={value => { const next = PRICE_PRESETS.find(item => item.id === value) ?? PRICE_PRESETS[0]; onPrices(next.min, next.max); }} />}
  </div>;
}

export function SheetFilters({ items, filters, showPrice, moneyPrefix, originalPrices, onChange }: {
  items: CatalogItem[];
  filters: CatalogFilters;
  showPrice: boolean;
  moneyPrefix: string;
  originalPrices: boolean;
  onChange: Change;
}) {
  const models = unique(items.map(item => item.model));
  return <div className="price-sheet-filters">
    <ChipGroup label="Modelo" value={filters.model} options={models.map(model => ({ value: model, label: shortCatalogModel(model) }))} onChange={value => onChange('model', value)} />
    <ChipGroup label="Capacidad" value={filters.capacity} options={unique(items.map(item => item.capacity)).map(value => ({ value, label: value }))} onChange={value => onChange('capacity', value)} />
    <ChipGroup label="Condición" value={filters.condition} options={unique(items.map(catalogCondition)).map(value => ({ value, label: value }))} onChange={value => onChange('condition', value)} />
    <ChipGroup label="Batería mínima" value={filters.battery} anyLabel="Cualquiera" options={BATTERY_FILTERS.map(item => ({ value: item.value, label: item.label }))} onChange={value => onChange('battery', value)} />
    {showPrice && <div className="price-range-row">
      <label>Precio desde<span className="price-range-box"><em>{moneyPrefix}</em><input aria-label="Precio desde" inputMode="numeric" value={filters.min} onChange={event => onChange('min', event.target.value.replace(/[^\d]/g, ''))} /></span></label>
      <label>Hasta<span className="price-range-box"><em>{moneyPrefix}</em><input aria-label="Precio hasta" inputMode="numeric" value={filters.max} onChange={event => onChange('max', event.target.value.replace(/[^\d]/g, ''))} /></span></label>
      {originalPrices && <small>Los importes se filtran en la moneda indicada en cada equipo.</small>}
    </div>}
  </div>;
}
