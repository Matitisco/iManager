import { useMemo, useState } from 'react';
import type { Client, OperationClientOption } from '../types';
import { clientHint, clientSuggestions } from './trade-client';
import { Field } from './ui';

export function ClientField<T extends Client | OperationClientOption>({
  clients,
  value,
  linked,
  error,
  readOnly = false,
  onValue,
  onPick,
}: {
  clients: T[];
  value: string;
  linked: boolean;
  error?: string;
  readOnly?: boolean;
  onValue: (value: string) => void;
  onPick: (client: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const suggestions = useMemo(() => clientSuggestions(clients, value), [clients, value]);
  const visible = open && suggestions.length > 0;

  function pick(client: T) {
    onPick(client);
    setOpen(false);
  }

  return (
    <div className="eqs">
      <Field label="Cliente" error={error}>
        <input
          role="combobox"
          aria-expanded={visible}
          aria-autocomplete="list"
          aria-controls="trade-client-list"
          value={value}
          maxLength={120}
          readOnly={readOnly}
          placeholder="Escribí el nombre o elegí un cliente"
          onChange={(event) => {
            onValue(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => { if (!readOnly) setOpen(true); }}
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
              const client = suggestions[Math.min(active, suggestions.length - 1)];
              if (client) pick(client);
            }
          }}
        />
      </Field>
      {visible ? (
        <ul id="trade-client-list" role="listbox" className="eqs-list">
          {suggestions.map((client, index) => (
            <li key={client.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={index === active ? 'on' : ''}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(client);
                }}
              >
                <b>{client.name}</b>
                <small>{clientHint(client)}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value.trim() && !linked ? <p className="eqs-note">Se crea un cliente nuevo al guardar, aunque tenga el mismo nombre. Elegí una sugerencia para usar un cliente existente.</p> : null}
    </div>
  );
}
