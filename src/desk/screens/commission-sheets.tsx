import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { CommissionBasis, CommissionCurrency, CommissionSummary } from '../../types/commissions';
import { commissionAmount, commissionTotal, effectiveRule, EMPTY_TOTALS, monthLabel, ruleLabel } from '../commissions';
import { useCommissionBlue } from '../commission-blue';
import { DeskSelect } from '../select';
import { Actions, Dialog, Field, Segs, Sheet } from '../ui';

const CURRENCIES = [{ id: 'ARS', label: 'ARS' }, { id: 'USD', label: 'USD' }];
export function CommissionRuleSheet({ memberId, period, onClose }: { memberId: string | null; period: string; onClose: () => void }) {
  const { appSession, commissionSellers = [], commissionRules = [], loadCommissionSellers, saveCommissionRule, deleteCommissionRule, setCommissionRuleActive, loadCommissions } = useAppContext();
  const original = effectiveRule(commissionRules, memberId, period, appSession?.store?.timezone);
  const [scope, setScope] = useState(memberId ? 'person' : 'team');
  const [person, setPerson] = useState(memberId ?? '');
  const [basis, setBasis] = useState<CommissionBasis>(original?.basis ?? 'PROFIT_PERCENT');
  const [rate, setRate] = useState(String(original?.rate ?? 10));
  const [currency, setCurrency] = useState<CommissionCurrency>(original?.currency ?? 'ARS');
  const [effectiveFrom, setEffectiveFrom] = useState(`${period}-01`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const [ruleAction, setRuleAction] = useState<{ id: string; action: 'Eliminar' | 'Desactivar' | 'Activar' } | null>(null);
  const manageRule = async () => {
    if (!ruleAction || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      if (ruleAction.action === 'Eliminar') await deleteCommissionRule(ruleAction.id);
      else await setCommissionRuleActive(ruleAction.id, ruleAction.action === 'Activar');
      setRuleAction(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo modificar la regla'); }
    finally { submitting.current = false; setBusy(false); }
  };
  useEffect(() => { void loadCommissionSellers().catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los vendedores')); }, []);
  const save = async () => {
    if (submitting.current) return;
    if (!effectiveFrom || !Number.isFinite(Number(rate)) || Number(rate) < 0 || !rate.trim() || (scope === 'person' && !person)) { setError('Completá la persona, el valor y la fecha de vigencia.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try { await saveCommissionRule({ memberId: scope === 'team' ? null : person, basis, rate: Number(rate), currency: basis === 'FIXED_PER_UNIT' ? currency : null, effectiveFrom }); await loadCommissions(period); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la regla'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Sheet title={scope === 'team' ? 'Regla del equipo' : 'Regla personal'} subtitle={scope === 'team' ? 'Vale para todos los que no tengan una regla personal' : 'Comisión para una persona del equipo'} onClose={() => { if (!busy && !ruleAction) onClose(); }} className="commission-form">
    {error ? <div className="ferr" role="alert">{error}</div> : null}
    {commissionRules.length ? <section className="commission-saved-rules" aria-label="Reglas guardadas"><div className="sale-sec"><span>Reglas guardadas</span></div>{commissionRules.map(rule => {
      const name = rule.memberId ? commissionSellers.find(seller => seller.id === rule.memberId)?.name ?? 'Persona' : 'Todo el equipo';
      const action = rule.active === false ? 'Activar' : 'Desactivar';
      return <div className="card commission-saved-rule" key={rule.id}><b>{name}</b><small>{ruleLabel(rule)} · {rule.active === false ? 'Inactiva' : 'Activa'} · desde {new Date(rule.effectiveFrom).toLocaleDateString('es-AR')}</small><div><button type="button" className="btn2 s" disabled={busy} aria-label={`${action} regla de ${name}`} onClick={() => { setError(''); setRuleAction({ id: rule.id, action }); }}>{action}</button><button type="button" className="btn2 danger" disabled={busy} aria-label={`Eliminar regla de ${name}`} onClick={() => { setError(''); setRuleAction({ id: rule.id, action: 'Eliminar' }); }}>Eliminar</button></div></div>;
    })}</section> : null}
    <Field label="Se aplica a" /><Segs options={[{ id: 'team', label: 'Todo el equipo' }, { id: 'person', label: 'Una persona' }]} value={scope} onChange={setScope} />
    {scope === 'person' ? <Field label="Persona"><DeskSelect label="Persona" value={person} onChange={setPerson} options={commissionSellers.map(seller => ({ value: seller.id, label: seller.name }))} disabled={busy} /></Field> : null}
    <Field label="Cómo se calcula · recomendado: % sobre ganancia" /><Segs options={[{ id: 'PROFIT_PERCENT', label: '% sobre ganancia' }, { id: 'SALE_PERCENT', label: '% sobre venta' }, { id: 'FIXED_PER_UNIT', label: 'Monto fijo por equipo' }]} value={basis} onChange={value => setBasis(value as CommissionBasis)} />
    <div className="frow"><Field label={basis === 'FIXED_PER_UNIT' ? 'Monto por equipo' : 'Porcentaje'}><input type="number" min="0" step="0.01" value={rate} onChange={event => setRate(event.target.value)} disabled={busy} /></Field>{basis === 'FIXED_PER_UNIT' ? <div><Field label="Moneda" /><Segs options={CURRENCIES} value={currency} onChange={value => setCurrency(value as CommissionCurrency)} /></div> : null}</div>
    <p className="commission-info">{basis === 'PROFIT_PERCENT' ? 'Ganancia = precio − costo del equipo − valor tomado del canje. Se calcula en la moneda de cada venta.' : basis === 'SALE_PERCENT' ? 'Se calcula sobre el precio de venta, en la moneda de cada venta.' : `Por cada equipo vendido cobra ${commissionAmount(Number(rate) || 0, currency)}, sin importar el precio.`}{scope === 'person' ? ' Reemplaza la regla del equipo solo para esta persona.' : ''}</p>
    <Field label="Vigente desde"><input type="date" value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} disabled={busy} /></Field>
    <p className="eqs-note">Las ventas anteriores a esa fecha siguen con la regla que tenían. Las reglas personales ganan sobre la del equipo.</p>
    {ruleAction ? createPortal(<Dialog title={`${ruleAction.action} regla`} text={ruleAction.action === 'Activar' ? 'La regla volverá a aplicarse a nuevas ventas desde su fecha de vigencia. Los pagos y las comisiones ya registradas se conservan.' : 'La regla dejará de aplicarse a nuevas ventas. Los pagos y las comisiones ya registradas se conservan.'} ok={`${ruleAction.action} regla`} danger={ruleAction.action !== 'Activar'} busy={busy} error={error} onClose={() => { if (!busy) setRuleAction(null); }} onOk={() => { void manageRule(); }} />, document.querySelector('.desk-app') ?? document.body) : null}
    <Actions primary="Guardar regla" onPrimary={() => { void save(); }} onSecondary={onClose} busy={busy} />
  </Sheet>;
}
export function CommissionPaymentSheet({ memberId, period, people, onClose }: { memberId: string | null; period: string; people: CommissionSummary['people']; onClose: () => void }) {
  const { payCommission } = useAppContext();
  const blue = useCommissionBlue();
  const [member, setMember] = useState(memberId ?? people.find(p => p.pending.ARS > 0 || p.pending.USD > 0)?.memberId ?? '');
  const person = people.find(p => p.memberId === member);
  const [currency, setCurrency] = useState<CommissionCurrency>('ARS');
  const [settles, setSettles] = useState<CommissionCurrency>(person && person.pending.ARS <= 0 && person.pending.USD > 0 ? 'USD' : 'ARS');
  const [amount, setAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState(blue.rate ? String(blue.rate) : '');
  const dirtyRate = useRef(false);
  const [method, setMethod] = useState('Efectivo');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  useEffect(() => { if (!dirtyRate.current && blue.rate) setExchangeRate(String(blue.rate)); }, [blue.rate]);
  const rate = Number(exchangeRate);
  const converted = currency === settles ? Number(amount) : currency === 'USD' ? Number(amount) * rate : Number(amount) / rate;
  const pending = person?.pending ?? EMPTY_TOTALS;
  const remaining = { ...pending, [settles]: Math.round((pending[settles] - (Number.isFinite(converted) ? converted : 0)) * 100) / 100 };
  const save = async () => {
    if (saved) { onClose(); return; }
    if (submitting.current) return;
    if (!member || !(Number(amount) > 0) || !Number.isFinite(Number(amount)) || !(rate > 0) || !Number.isFinite(rate)) { setError('Elegí una persona e ingresá un monto y una cotización mayores a cero.'); return; }
    if (pending[settles] <= 0) { setError('No hay deuda pendiente en esa moneda.'); return; }
    if (converted > pending[settles] + .01) { setError('El pago supera la deuda en la moneda elegida.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try { const result = await payCommission({ memberId: member, period, amount: Number(amount), currency, exchangeRate: rate, settlesCurrency: settles, note: method });
      if (result?.refreshError) { setSaved(true); setError(result.refreshError); } else onClose();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo registrar el pago'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Sheet title="Registrar pago" subtitle="Podés pagar una parte; el resto queda pendiente." onClose={() => { if (!busy) onClose(); }} className="commission-form">
    {error ? <div className="ferr" role="alert">{error}</div> : null}
    <Field label="Para"><DeskSelect label="Para" value={member} onChange={id => { setMember(id); const p = people.find(row => row.memberId === id); setSettles(p && p.pending.ARS <= 0 && p.pending.USD > 0 ? 'USD' : 'ARS'); }} disabled={busy} options={people.map(p => ({ value: p.memberId, label: `${p.name} · debe ${commissionTotal(p.pending)}`, disabled: p.pending.ARS <= 0 && p.pending.USD <= 0 }))} /></Field>
    <div className="frow"><div><Field label="Pagás en" /><Segs options={CURRENCIES} value={currency} onChange={value => setCurrency(value as CommissionCurrency)} /></div><Field label={`Monto · ${currency}`}><input aria-label="Monto del pago" type="number" step="0.01" min="0.01" value={amount} onChange={event => setAmount(event.target.value)} disabled={busy} /></Field></div>
    <Field label="Salda la deuda en" /><Segs options={[{ id: 'ARS', label: `Pesos · ${commissionAmount(pending.ARS, 'ARS')}` }, { id: 'USD', label: `Dólares · ${commissionAmount(pending.USD, 'USD')}` }].filter(option => pending[option.id as CommissionCurrency] > 0)} value={settles} onChange={value => setSettles(value as CommissionCurrency)} />
    <Field label="Cotización · dólar blue venta · editable"><input aria-label="Cotización del pago" type="number" min="0.01" step="0.01" value={exchangeRate} onChange={event => { dirtyRate.current = true; setExchangeRate(event.target.value); }} disabled={busy} /></Field>
    {blue.error ? <p className="ferr" role="status">{blue.error}</p> : null}
    <p className="eqs-note">Precargada con el blue de hoy. Se guarda con el pago.</p>
    <div className="commission-info" aria-live="polite">Equivale a <b>{commissionAmount(Number.isFinite(converted) ? converted : 0, settles)}</b> · salda esa deuda.<br />Queda pendiente: <b>{commissionTotal(remaining)}</b> → si no se paga, pasa a {monthLabel(period, 1)}.</div>
    <Field label="Forma de pago" /><Segs options={[{ id: 'Efectivo', label: 'Efectivo' }, { id: 'Transferencia', label: 'Transferencia' }]} value={method} onChange={setMethod} />
    <Field label="Fecha"><input value={new Date().toLocaleDateString('es-AR')} readOnly /></Field>
    <p className="eqs-note">Se registra con la fecha del pago al confirmar.</p>
    <Actions primary={saved ? "Listo" : "Registrar pago"} onPrimary={() => { void save(); }} onSecondary={onClose} busy={busy} />
  </Sheet>;
}
