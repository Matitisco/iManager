import { DateRange, MoneyFilterInput, MoneyRange } from './ColumnFilter';
import { DatePicker } from './date-picker';
import type { InventoryColumnFilters, TextPresence } from './inventory-filters';
import { Field } from './ui';

export function InventoryTextFilter({ label, value, presence, onValue, onPresence, phone = false, placeholder }: {
  label: string;
  value: string;
  presence: TextPresence;
  onValue: (value: string) => void;
  onPresence: (value: TextPresence) => void;
  phone?: boolean;
  placeholder?: string;
}) {
  const options: { id: TextPresence; label: string }[] = [
    { id: '', label: 'Todos' },
    { id: 'filled', label: label === 'IMEI' ? 'Con IMEI' : 'Con valor' },
    { id: 'empty', label: label === 'IMEI' ? 'Sin IMEI' : 'Vacío' },
  ];
  const input = <input aria-label={phone ? `Buscar ${label.toLowerCase()}` : 'Contiene'} placeholder={placeholder ?? `Buscar ${label.toLowerCase()}`} value={value} onChange={event => onValue(event.target.value)} />;
  return <>
    {phone ? <Field label={label}>{input}</Field> : input}
    <div className={phone ? 'inv-opts' : 'opts'} role="group" aria-label={`Presencia de ${label.toLowerCase()}`}>
      {options.map(option => <button key={option.id} type="button" className={phone ? `wchip${presence === option.id ? ' on' : ''}` : `opt${presence === option.id ? ' on' : ''}`} aria-pressed={presence === option.id} onClick={() => onPresence(option.id)}>{option.label}</button>)}
    </div>
  </>;
}

export function InventoryEntryRange({ filters, onChange, phone = false }: {
  filters: InventoryColumnFilters;
  onChange: (patch: Partial<InventoryColumnFilters>) => void;
  phone?: boolean;
}) {
  if (!phone) return <DateRange value={{ dateFrom: filters.entryFrom, dateTo: filters.entryTo }} onChange={patch => onChange({ ...(patch.dateFrom !== undefined ? { entryFrom: patch.dateFrom } : {}), ...(patch.dateTo !== undefined ? { entryTo: patch.dateTo } : {}) })} />;
  return <div>
    <DatePicker label="Desde" ariaLabel="Ingreso desde" value={filters.entryFrom} onChange={entryFrom => onChange({ entryFrom })} panel="inline" />
    <DatePicker label="Hasta" ariaLabel="Ingreso hasta" value={filters.entryTo} onChange={entryTo => onChange({ entryTo })} panel="inline" />
  </div>;
}

export function InventoryNumberRange({ label, min, max, onMin, onMax, phone = false }: {
  label: string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  phone?: boolean;
}) {
  const labels: [string, string] = [`${label} mínimo`, `${label} máximo`];
  if (!phone) return <MoneyRange min={min} max={max} onMin={onMin} onMax={onMax} ariaLabels={labels} />;
  return <div className="inv-range">
    <Field label="Mínimo"><MoneyFilterInput label={labels[0]} value={min} onChange={onMin} /></Field>
    <Field label="Máximo"><MoneyFilterInput label={labels[1]} value={max} onChange={onMax} /></Field>
  </div>;
}

export function InventoryCatalogFilter({ value, onChange, phone = false }: { value: string[]; onChange: (value: string[]) => void; phone?: boolean }) {
  return <div className={phone ? 'inv-checks' : 'opts'}>
    {[{ id: 'included', label: 'En catálogo' }, { id: 'excluded', label: 'Fuera de catálogo' }].map(option => <label key={option.id} className="chk">
      <input type="checkbox" checked={value.includes(option.id)} onChange={event => onChange(event.target.checked ? [...value, option.id] : value.filter(id => id !== option.id))} />
      <span>{option.label}</span>
    </label>)}
  </div>;
}
