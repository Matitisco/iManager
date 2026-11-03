import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { ROLE_LABEL } from '../lib/roles';
import { toActionMessage } from '../lib/user-message';
import { DeskSelect } from './select';
import { Actions, Dialog, Field, Sheet } from './ui';
import { canOpenSection } from './sections';
import { CommissionAvatar } from './CommissionAvatar';

export function SellerField({ value, onChange, busy, directoryOnly = false }: { value: string; onChange: (value: string) => void; busy?: boolean; directoryOnly?: boolean }) {
  const { commissionSellers = [], appSession, saveReseller } = useAppContext();
  const [mode, setMode] = useState<'add' | 'all' | null>(null);
  const [editing, setEditing] = useState<string>();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [archive, setArchive] = useState<{ id: string; name: string } | null>(null);
  const canWrite = canOpenSection('sales', appSession?.membership?.sections, appSession?.membership?.role);
  const resellers = commissionSellers.filter(person => person.role === 'RESELLER');
  const active = resellers.filter(person => !person.archivedAt);
  const recent = active.slice(0, 3);
  const selected = commissionSellers.find(person => person.id === value);
  if (selected?.role === 'RESELLER' && !recent.some(person => person.id === value)) recent.push(selected);
  const openAdd = (id?: string, initialName = '') => { setEditing(id); setName(initialName); setError(''); setMode('add'); };
  const save = async () => {
    if (saving || !name.trim()) return;
    setSaving(true); setError('');
    try {
      const reseller = await saveReseller({ name: name.trim() }, editing);
      if (!editing) onChange(`reseller:${reseller.id}`);
      setMode(null);
    } catch (cause) { setError(toActionMessage(cause, 'No se pudo guardar el revendedor')); }
    finally { setSaving(false); }
  };
  const archiveReseller = async () => {
    if (!archive || saving) return;
    setSaving(true); setError('');
    try { await saveReseller({ archived: true }, archive.id); setArchive(null); }
    catch (cause) { setError(toActionMessage(cause, 'No se pudo archivar el revendedor')); }
    finally { setSaving(false); }
  };
  return <>
    {directoryOnly ? <div className="reseller-actions"><button type="button" className="wlink" disabled={busy} onClick={() => { setError(''); setMode('all'); }}>Ver todas</button>{canWrite ? <button type="button" className="wlink" disabled={busy} onClick={() => openAdd()}>+ Agregar revendedor</button> : null}</div> : <><Field label="Vendedor"><DeskSelect className="seller-select" popupClassName="seller-picker" label="Vendedor" sheetTitle="Elegir vendedor" value={value} disabled={busy}
      onChange={key => { if (key === '__add') openAdd(); else if (key === '__all') { setError(''); setMode('all'); } else onChange(key); }}
      options={[
        { value: '', label: 'Sin vendedor' },
        ...commissionSellers.filter(person => person.role !== 'RESELLER').map(person => ({ value: person.id, label: `${person.name} · ${ROLE_LABEL[person.role]}` })),
        ...recent.map(person => ({ value: person.id, label: person.name, group: 'Revendedores', disabled: Boolean(person.archivedAt), icon: <CommissionAvatar id={person.id} name={person.name} role="RESELLER" /> })),
        { value: '__all', label: 'Ver todas', group: 'Revendedores', className: 'reseller-all' },
        ...(canWrite ? [{ value: '__add', label: '+ Agregar revendedor', group: 'Revendedores', className: 'reseller-add' }] : []),
      ]} /></Field>
    <p className="eqs-note">Elegí quién hizo la venta. Sin vendedor, no suma comisión.</p></>}
    {mode ? createPortal(<Sheet title={mode === 'add' ? editing ? 'Renombrar revendedor' : 'Agregar revendedor' : 'Revendedores'} onClose={() => { if (!saving && !archive) setMode(null); }} busy={saving} className="commission-form reseller-manager"
      footer={mode === 'add' ? <Actions primary="Guardar revendedor" onPrimary={() => { void save(); }} onSecondary={() => setMode(null)} busy={saving} /> : canWrite ? <button type="button" className="btn2 p" onClick={() => openAdd()}>+ Agregar revendedor</button> : undefined}>
      {error && !archive ? <p className="ferr" role="alert">{error}</p> : null}
      {mode === 'add' ? <Field label="Nombre del revendedor"><input aria-label="Nombre del revendedor" autoFocus maxLength={80} value={name} disabled={saving} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }} /></Field> : <>
        <p className="eqs-note">Se guardan en esta tienda. Cobran comisión y no necesitan usuario.</p>
        {!resellers.length ? <p className="wempty">Todavía no agregaste revendedores.</p> : null}
        {resellers.map(person => <div className="reseller-row" key={person.id}>
          <button className="commission-name" type="button" disabled={Boolean(person.archivedAt) || saving} onClick={() => { onChange(person.id); setMode(null); }}><CommissionAvatar id={person.id} name={person.name} role="RESELLER" /><span><b>{person.name}</b><small>{person.archivedAt ? 'Archivado' : 'Revendedor'}</small></span></button>
          {canWrite ? <div className="reseller-actions"><button type="button" className="wlink" disabled={saving} onClick={() => openAdd(person.resellerId, person.name)}>Renombrar</button>{!person.archivedAt ? <button type="button" className="wlink" disabled={saving} onClick={() => { setError(''); setArchive({ id: person.resellerId!, name: person.name }); }}>Archivar</button> : null}</div> : null}
        </div>)}
      </>}
    </Sheet>, document.querySelector('.desk-app') ?? document.body) : null}
    {archive ? createPortal(<Dialog title={`Archivar a ${archive.name}`} text="Dejará de aparecer en nuevas asignaciones. Sus ventas y comisiones se conservan." ok="Archivar revendedor" busy={saving} error={error} onClose={() => { if (!saving) setArchive(null); }} onOk={() => { void archiveReseller(); }} />, document.querySelector('.desk-app') ?? document.body) : null}
  </>;
}
