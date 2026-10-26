import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { DeskSelect } from '../select';
import { Field, Sheet, SheetActions } from '../ui';
import { importVariant } from '../import-variant';
import './inline-supplier.css';

export function InlineSupplier({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const { suppliers, saveSupplier } = useAppContext();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null);
  const variant = importVariant();
  const save = async () => {
    if (busy) return;
    if (!name.trim()) { setError('Ingresá el nombre del proveedor.'); return; }
    setBusy(true); setError(null);
    try {
      const supplier = await saveSupplier({ name: name.trim() });
      setSaved(supplier);
      onChange(supplier.id);
      setCreating(false); setName('');
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo crear el proveedor.'));
    } finally { setBusy(false); }
  };
  const cancel = () => { if (!busy) { setCreating(false); setError(null); } };
  const actions = <SheetActions><button type="button" className="btn2 s" disabled={busy} onClick={cancel}>Cancelar</button><button type="button" className="btn2 p" disabled={busy} onClick={() => void save()}>Crear y seleccionar</button></SheetActions>;
  const editor = <><Field label="Nombre del proveedor" error={error ?? undefined}><input autoFocus aria-label="Nombre del proveedor" value={name} maxLength={120} disabled={busy} onChange={event => { setName(event.target.value); setError(null); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }} /></Field></>;
  const options: Array<{ id: string; name: string }> = [...(suppliers ?? [])];
  if (saved && !options.some(row => row.id === saved.id)) options.push(saved);
  return <div className={`eq-inline-supplier eq-inline-supplier-${variant}`}>
    <DeskSelect label="Proveedor" disabled={disabled || busy} value={value} onChange={id => {
      if (id === '__create_supplier__') { setCreating(true); setError(null); }
      else onChange(id);
    }} options={[{ value: '', label: 'Sin proveedor' }, ...options.map(row => ({ value: row.id, label: row.name })), { value: '__create_supplier__', label: '+ Crear proveedor' }]} />
    {creating && variant === 'a' && <div className="eq-supplier-editor" role="group" aria-label="Crear proveedor">{editor}{actions}</div>}
    {creating && variant === 'b' && <div className="eq-supplier-layer"><Sheet title="Crear proveedor" onClose={cancel} busy={busy} footer={actions}>{editor}</Sheet></div>}
  </div>;
}
