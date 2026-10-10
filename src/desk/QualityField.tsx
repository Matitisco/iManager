import { useId, useState } from 'react';
import { DEVICE_QUALITIES } from './quality';

export function QualityField({ value, onChange, label = 'Calidad' }: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  return (
    <div className="fl qfield">
      <span className="qhead">
        <span id={labelId}>{label}</span>
        <button
          type="button"
          className="qmark"
          aria-expanded={open}
          aria-controls={`${labelId}-help`}
          aria-label="Qué significa cada calidad"
          onClick={() => setOpen((current) => !current)}
        >
          ?
        </button>
      </span>
      <div className="sgs" role="group" aria-labelledby={labelId}>
        {DEVICE_QUALITIES.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`sg${value === item.value ? ' on' : ''}`}
            title={`${item.name}: ${item.description}`}
            aria-pressed={value === item.value}
            onClick={() => onChange(value === item.value ? '' : item.value)}
          >
            {item.value}
          </button>
        ))}
      </div>
      {open ? (
        <div className="qtip" id={`${labelId}-help`}>
          {DEVICE_QUALITIES.map((item) => (
            <p key={item.value}><b>{item.value} · {item.name}.</b> {item.description}</p>
          ))}
        </div>
      ) : null}
      <p className="eqs-note">Opcional. Describe el aspecto, no el funcionamiento.</p>
    </div>
  );
}
