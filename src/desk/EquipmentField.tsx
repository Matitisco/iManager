import { useMemo, useState } from 'react';
import type { OperationProductOption, Product } from '../types';
import { equipmentTitle, formatMoneyCompact } from './format';
import { equipmentSuggestions } from './sale-equipment';
import { Field } from './ui';

export function EquipmentField<T extends Product | OperationProductOption>({
  items,
  value,
  linked,
  error,
  onValue,
  onPick,
}: {
  items: T[];
  value: string;
  linked: boolean;
  error?: string;
  onValue: (value: string) => void;
  onPick: (item: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const suggestions = useMemo(() => equipmentSuggestions(items, value), [items, value]);
  const visible = open && suggestions.length > 0;

  function pick(item: T) {
    onPick(item);
    setOpen(false);
  }

  return (
    <div className="eqs">
      <Field label="Equipo" error={error}>
        <input
          role="combobox"
          aria-expanded={visible}
          aria-autocomplete="list"
          aria-controls="sale-equipment-list"
          value={value}
          placeholder="Escribí el modelo o elegí uno del stock"
          onChange={(event) => {
            onValue(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) {
              event.stopPropagation();
              setOpen(false);
              return;
            }
            if (!suggestions.length) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((current) => Math.min(suggestions.length - 1, (open ? current : -1) + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActive((current) => Math.max(0, current - 1));
            } else if (event.key === 'Enter' && visible) {
              event.preventDefault();
              const item = suggestions[Math.min(active, suggestions.length - 1)];
              if (item) pick(item);
            }
          }}
        />
      </Field>
      {visible ? (
        <ul id="sale-equipment-list" role="listbox" className="eqs-list">
          {suggestions.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={index === active ? 'on' : ''}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(item);
                }}
              >
                <b>{equipmentTitle(item.model, item.capacity)}</b>
                <small>{[item.color, item.imei ? `IMEI …${item.imei.slice(-4)}` : '', formatMoneyCompact(item.price)].filter(Boolean).join(' · ')}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value.trim() && !linked ? <p className="eqs-note">Se guarda como texto. Elegí una sugerencia si está en el stock.</p> : null}
    </div>
  );
}
