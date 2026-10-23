import { toActionMessage } from '../lib/user-message';
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { ROLE_LABEL } from '../lib/roles';
import { CommissionAvatar } from './CommissionAvatar';
import { Sheet } from './ui';

export function AssignSellerSheet({ saleIds, subtitle, onClose, onSaved }: { saleIds: string[]; subtitle: string; onClose: () => void; onSaved: () => void }) {
  const { commissionSellers = [], loadCommissionSellers, assignCommissionSeller, reloadSales } = useAppContext();
  const [member, setMember] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sellersUnavailable, setSellersUnavailable] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    let active = true;
    void loadCommissionSellers().catch(cause => {
      if (!active) return;
      console.warn('No se pudieron cargar los vendedores.', cause);
      setSellersUnavailable(true);
    });
    return () => { active = false; };
  }, []);
  const save = async () => {
    if (submitting.current || member === null) return;
    submitting.current = true; setBusy(true); setError('');
    try { await assignCommissionSeller(saleIds, member || null); await reloadSales(); onSaved(); }
    catch (cause) { setError(toActionMessage(cause, 'No se pudo asignar el vendedor')); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Sheet title="Asignar vendedor" subtitle={subtitle} onClose={() => { if (!busy) onClose(); }} className="commission-form">
    {error ? <div className="ferr" role="alert">{error}</div> : null}
    {sellersUnavailable && !commissionSellers.length ? <p className="eqs-note">Sin vendedores para mostrar.</p> : null}
    <div className="commission-seller-choices" role="radiogroup" aria-label="Vendedor a asignar">{[...commissionSellers.map(person => ({ id: person.id, name: person.name, role: person.role, sub: ROLE_LABEL[person.role] })), { id: '', name: 'Sin vendedor', role: 'NONE', sub: 'No suma comisión' }].map(person => <button key={person.id} type="button" role="radio" aria-checked={member === person.id} disabled={busy} className={`commission-seller-choice${member === person.id ? ' selected' : ''}`} onClick={() => setMember(person.id)}><CommissionAvatar id={person.id} name={person.name} role={person.role} /><span><b>{person.name}</b><small>{person.sub}</small></span><i /></button>)}</div>
    <p className="commission-info">Se recalcula la comisión con la regla vigente para cada venta. Si alguna venta ya estaba pagada a otra persona, la diferencia se descuenta de su saldo.</p>
    <div className="sacts"><button type="button" className="btn2 s" disabled={busy} onClick={onClose}>Cancelar</button><button type="button" className="btn2 p" disabled={busy || member === null} onClick={() => { void save(); }}>{busy ? 'Guardando…' : member === '' ? 'Quitar vendedor' : `Asignar${member ? ` a ${commissionSellers.find(person => person.id === member)?.name.split(' ')[0] ?? ''}` : ''}`}</button></div>
  </Sheet>;
}
