import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createWedgeBuffer } from '../lib/keyboard-wedge';
import type { OperationProductOption, Product } from '../types';
import { equipmentTitle } from './format';
import { useMoney } from './exchange';
import { equipmentSuggestions } from './sale-equipment';
import { ScanCameraButton } from './scan/ImeiScanField';
import { Field } from './ui';

export function EquipmentField<T extends Product | OperationProductOption>({
  items,
  value,
  linked,
  error,
  mark,
  onValue,
  onPick,
  reservedName,
  onScan,
  onCamera,
  imeiMissing,
  placeholder = 'Buscar modelo o escanear IMEI',
}: {
  items: T[];
  value: string;
  linked: boolean;
  error?: string;
  mark?: string;
  reservedName?: string | null;
  onValue: (value: string) => void;
  onPick: (item: T) => void;
  onScan?: (raw: string) => void;
  onCamera?: () => void;
  imeiMissing?: boolean;
  placeholder?: string;
}) {
  const money = useMoney();
  const wedge = useRef(createWedgeBuffer());
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
      <div className={`scan-imei${imeiMissing ? ' scan-missing' : ''}`}>
      <Field label="Equipo" mark={mark} error={error}>
        <input
          role="combobox"
          aria-expanded={visible}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-controls="sale-equipment-list"
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onValue(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            const pushed = wedge.current.push(event.key);
            if (pushed.type === 'scan') {
              event.preventDefault();
              onScan?.(pushed.value);
              setOpen(false);
              return;
            }
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
      {onCamera ? <ScanCameraButton onClick={onCamera} /> : null}
      </div>
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
                <small>{[item.color, item.imei ? `IMEI …${item.imei.slice(-4)}` : '', item.price == null ? 'A definir' : money.compact(item.price, item.currency)].filter(Boolean).join(' · ')}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {reservedName ? <p className="eqs-note" role="status">Reservado para {reservedName}</p> : value.trim() && !linked && !imeiMissing ? <p className="eqs-note">No está en stock. Se guarda para completar después.</p> : null}
    </div>
  );
}
