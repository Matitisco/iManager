import { useEffect, useRef, useState } from 'react';
import { usePhoneLayout } from './section-notices';

export type RowSelection = {
  active: boolean;
  visible?: boolean;
  checked: boolean;
  disabled: boolean;
  label: string;
  toggle: (range?: boolean) => void;
};

export function SelectionCheckbox({ checked, mixed = false, disabled, label, onToggle }: {
  checked: boolean; mixed?: boolean; disabled?: boolean; label: string; onToggle: (range?: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed; }, [mixed]);
  return (
    <label className="bulk-check" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <input ref={ref} type="checkbox" aria-label={label} checked={checked} disabled={disabled}
        onClick={(event) => onToggle(event.shiftKey)} onChange={() => undefined} />
    </label>
  );
}

export function useBulkSelection<T extends { id: string }>(rows: T[], scope: string) {
  const phone = usePhoneLayout();
  const [state, setState] = useState({ scope, ids: new Set<string>(), anchor: '', locked: false, mode: false });
  // Prune immediately: hidden rows must never be actionable or reappear selected.
  const available = new Set(rows.map((row) => row.id));
  const ids = state.scope === scope ? new Set([...state.ids].filter((id) => available.has(id))) : new Set<string>();
  if (state.scope !== scope) {
    setState({ scope, ids, anchor: '', locked: false, mode: false });
  } else if (ids.size !== state.ids.size) {
    setState({ ...state, ids, anchor: available.has(state.anchor) ? state.anchor : '' });
  }
  const selected = rows.filter((row) => ids.has(row.id));
  const locked = state.scope === scope && state.locked;
  const toggle = (id: string, range = false) => {
    if (locked || !available.has(id)) return;
    setState((current) => {
      const next = new Set(current.ids);
      const from = rows.findIndex((row) => row.id === current.anchor);
      const to = rows.findIndex((row) => row.id === id);
      const targets = range && from >= 0 ? rows.slice(Math.min(from, to), Math.max(from, to) + 1).map((row) => row.id) : [id];
      const remove = next.has(id);
      targets.forEach((target) => remove ? next.delete(target) : next.add(target));
      return { ...current, ids: next, anchor: id };
    });
  };
  const all = rows.length > 0 && selected.length === rows.length;
  return {
    scope, selected, locked, all, mode: state.scope === scope && state.mode,
    start: (id?: string) => { if (!locked) setState({ scope, ids: new Set(id && available.has(id) ? [id] : []), anchor: id ?? '', locked: false, mode: true }); },
    clear: () => { if (!locked) setState({ scope, ids: new Set(), anchor: '', locked: false, mode: false }); },
    remove: (id: string) => setState((current) => ({ ...current, ids: new Set([...current.ids].filter((value) => value !== id)) })),
    setLocked: (value: boolean) => setState((current) => ({ ...current, locked: value })),
    toggleAll: () => { if (!locked) setState({ scope, ids: new Set(all ? [] : rows.map((row) => row.id)), anchor: '', locked: false, mode: state.mode }); },
    row: (id: string, label: string): RowSelection => ({ visible: !phone || state.mode, active: phone ? state.mode : selected.length > 0, checked: ids.has(id), disabled: locked, label: `Seleccionar ${label}`, toggle: (range) => toggle(id, range) }),
  };
}

export type BulkSelection<T extends { id: string }> = ReturnType<typeof useBulkSelection<T>>;

export function SelectFiltered<T extends { id: string }>({ selection, total }: { selection: BulkSelection<T>; total: number }) {
  return <SelectionCheckbox checked={selection.all} mixed={!selection.all && selection.selected.length > 0}
    disabled={selection.locked || total === 0} label={`Seleccionar todos los filtrados (${total})`} onToggle={selection.toggleAll} />;
}
