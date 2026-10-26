import { ReplayValue } from '../replay-privacy';
import { ListSkeleton } from '../list-skeleton';
import { ReasonSheet } from '../ReasonSheet';
import { isVoidRow } from '../format';
import { toActionMessage, toUserMessage, isNetworkErrorMessage } from '../../lib/user-message';
import { useOfflineRecovery } from '../../lib/offline-recovery';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { CommissionPayment, CommissionPerson, CommissionRule, CommissionTotals } from '../../types/commissions';
import { ROLE_LABEL } from '../../lib/roles';
import { usePhoneLayout } from '../section-notices';
import { canManageCommissions, canSeeFinancials } from '../sections';
import { commissionAmount, commissionTotal, effectiveRule, hasDeduction, monthKey, monthLabel, ruleLabel, saleCount } from '../commissions';
import { ImanagerIcon } from '../icons';
import { CommissionAvatar } from '../CommissionAvatar';
import { CommissionMonthPicker } from '../CommissionMonthPicker';
import { Actions, DeskCta, DeskIcon, IconButton, MenuButton, MobileDock, ScreenTitle, Sheet, useDesk } from '../ui';
import { CommissionPaymentSheet, CommissionRuleSheet } from './commission-sheets';
import { CommissionMemberLedger } from './commission-member-ledger';
import './commission-member-detail.css';

export function CurrencyTotals({ value }: { value: CommissionTotals }) {
  return <span className="commission-totals"><b data-ph-mask>{value.ARS === 0 && value.USD !== 0 ? commissionAmount(value.USD, 'USD') : commissionAmount(value.ARS, 'ARS')}</b>{value.USD !== 0 && value.ARS !== 0 ? <small>+ <ReplayValue>{commissionAmount(value.USD, 'USD')}</ReplayValue></small> : null}</span>;
}
function Balance({ value }: { value: CommissionTotals }) {
  return <span className={hasDeduction(value) ? 'commission-negative' : ''}>{hasDeduction(value) ? <small>A descontar</small> : null}<CurrencyTotals value={value} /></span>;
}
export function CommissionHero({ person, mine = false }: { person: Pick<CommissionPerson, 'pending' | 'earned' | 'paid'>; mine?: boolean }) {
  return <section className="commission-hero">
    <div className="eb">{hasDeduction(person.pending) ? 'A descontar' : mine ? 'Te falta cobrar' : 'Pendiente de pago'}</div>
    <div className={hasDeduction(person.pending) ? 'commission-negative' : ''}><CurrencyTotals value={person.pending} /></div>
    <div className="commission-hero-foot"><div><span>{mine ? 'Ganaste este mes' : 'Comisión del mes'}</span><CurrencyTotals value={person.earned} /></div><div><span>{mine ? 'Ya cobraste' : 'Pagado'}</span><CurrencyTotals value={person.paid} /></div></div>
  </section>;
}
export function CommissionLines({ person, financials, period, onConfirmChange }: { person: CommissionPerson; financials: boolean; period: string; onConfirmChange?: (open: boolean) => void }) {
  const { appSession, voidCommissionPayment } = useAppContext();
  const manage = canManageCommissions(appSession?.membership?.sections, appSession?.membership?.role);
  const [paymentToVoid, setPaymentToVoid] = useState<CommissionPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const voidPayment = async (reason: string) => {
    if (!paymentToVoid || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { await voidCommissionPayment(paymentToVoid.id, person.memberId, period, reason); setPaymentToVoid(null); onConfirmChange?.(false); }
    catch (cause) { setError(toActionMessage(cause, 'No se pudo anular el pago')); }
    finally { submitting.current = false; setBusy(false); }
  };
  const [all, setAll] = useState(false);
  const sales = all ? person.sales : person.sales.slice(0, 4);
  return <div className="commission-lines">
    <section><div className="sale-sec"><span>Ventas{person.adjustments.length ? ' y ajustes' : ''} de {monthLabel(period).split(' ')[0]}</span><span>{saleCount(person.salesCount)}</span></div>
      <div className="card commission-ledger">
        {sales.map(sale => <div key={sale.accrualId} className={`commission-line${isVoidRow(sale) || sale.cancelled ? ' is-void' : ''}`}>
          <div><b>#V-{String(sale.saleNumber).padStart(4, '0')} · {new Date(sale.soldAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}</b><small>{sale.deviceLabel}</small><small>{sale.cancelled ? (sale.voidReason === 'DELETED' ? 'Eliminada · no genera comisión' : sale.voidReason === 'EDITED' ? 'Modificada · comisión reemplazada' : 'Anulada · no genera comisión') : <>Venta {commissionAmount(sale.total, sale.currency)}{financials && sale.grossProfit !== undefined ? ` · ganancia ${commissionAmount(sale.grossProfit, sale.currency)}` : ''}</>}</small></div>
          <div className="commission-line-amount"><b>{sale.cancelled ? <s data-ph-mask>{commissionAmount(sale.originalCommission, sale.currency)}</s> : commissionAmount(sale.commission, sale.currency)}</b><small>{sale.cancelled ? 'anulada' : 'comisión'}</small></div>
        </div>)}
        {person.adjustments.map((adjustment, index) => <div className="commission-line commission-adjustment" key={`${adjustment.accrualId}:${index}`}><div><b>Ajuste por venta anulada</b><small>#V-{String(adjustment.saleNumber).padStart(4, '0')} · {monthLabel(adjustment.period)}</small><small>Su comisión ya se había pagado</small></div><div className="commission-line-amount"><b data-ph-mask>{commissionAmount(adjustment.amount, adjustment.currency)}</b><small>A descontar</small></div></div>)}
        {!person.sales.length && !person.adjustments.length ? <p className="wempty">No hay ventas en este período.</p> : null}
      </div>
      {person.sales.length > 4 ? <button className="wlink commission-show-all" type="button" onClick={() => setAll(!all)}>{all ? 'Ver menos' : person.sales.length === 1 ? 'Ver la venta' : `Ver las ${person.sales.length} ventas`}</button> : null}
    </section>
    <section><div className="sale-sec"><span>Pagos</span><span>{person.payments.length} {person.payments.length === 1 ? 'pago' : 'pagos'}</span></div><div className="card commission-ledger">{person.payments.map(payment => <div className={`commission-line${isVoidRow(payment) ? ' is-void' : ''}`} key={payment.id}><div><b>{new Date(payment.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} · {payment.note || 'Pago registrado'}</b><small data-ph-mask>{payment.currency !== payment.settlesCurrency ? `Salda ${commissionAmount(payment.settledAmount, payment.settlesCurrency)} · cotización ${commissionAmount(payment.exchangeRate, 'ARS')}` : 'Pago de comisión'}</small></div><div className="commission-line-amount"><b>{payment.voidedAt ? <s data-ph-mask>{commissionAmount(payment.amount, payment.currency)}</s> : commissionAmount(payment.amount, payment.currency)}</b>{payment.voidedAt ? <small>Pago anulado</small> : manage ? <button type="button" className="wlink commission-payment-void" aria-label={`Anular pago de ${commissionAmount(payment.amount, payment.currency)}`} onClick={() => { setError(''); setPaymentToVoid(payment); onConfirmChange?.(true); }}>Anular pago</button> : null}</div></div>)}{!person.payments.length ? <p className="wempty">Todavía no hay pagos registrados.</p> : null}</div></section>
    {paymentToVoid ? createPortal(<ReasonSheet title="Anular pago" note={<>Se anulará el pago de <ReplayValue>{commissionAmount(paymentToVoid.amount, paymentToVoid.currency)}</ReplayValue>. Quedará en el historial y dejará de contar en los saldos y ajustes.</>} ok="Anular pago" danger busy={busy} error={error} onClose={() => { if (!busy) { setPaymentToVoid(null); onConfirmChange?.(false); } }} onOk={reason => { void voidPayment(reason); }} />, document.querySelector('.desk-app') ?? document.body) : null}
  </div>;
}
export function CommissionMemberSheet({ person, period, rule, onClose, onRule, onPay }: { person: CommissionPerson; period: string; rule?: CommissionRule; onClose: () => void; onRule: () => void; onPay: () => void }) {
  const { appSession } = useAppContext();
  const [confirming, setConfirming] = useState(false);
  const negative = hasDeduction(person.pending);
  const payable = person.pending.ARS > 0 || person.pending.USD > 0;
  const manage = canManageCommissions(appSession?.membership?.sections, appSession?.membership?.role);
  const primary = manage && payable ? 'Registrar pago' : 'Listo';
  return <Sheet title={person.name} onClose={() => { if (!confirming) onClose(); }} className="commission-detail comd-detail" footer={<Actions secondary={manage ? 'Cambiar regla' : 'Cerrar'} onSecondary={manage ? onRule : onClose} primary={primary} onPrimary={manage && payable ? onPay : onClose} busy={confirming} busyLabel={primary} />}>
    <div className="comd-context"><span className="dsel"><DeskIcon name="cal" size={14} />{monthLabel(period).replace(' de ', ' ')}</span><span className="mut">{ROLE_LABEL[person.role]}</span></div>
    <div className="comd-rule"><span>{rule?.memberId ? 'Regla personal' : 'Regla del equipo'}</span><b>{ruleLabel(rule)}</b></div>
    <div className="commission-detail-kpis comd-account-grid">
      <div className="dstat"><span>{person.adjustments.length ? 'Comisión del mes' : 'Saldo anterior'}</span><CurrencyTotals value={person.adjustments.length ? person.earned : person.previousBalance} /></div>
      <div className={`dstat${person.adjustments.length ? ' commission-negative' : ''}`}><span>{person.adjustments.length ? 'Ajustes' : 'Comisión del mes'}</span><CurrencyTotals value={person.adjustments.length ? person.adjustmentsTotal : person.earned} /></div>
      <div className="dstat"><span>Pagado</span><CurrencyTotals value={person.paid} /></div>
      <div className={`dstat ${negative ? 'deduction' : 'pending'}`}><span>{negative ? 'A descontar' : 'Pendiente'}</span><CurrencyTotals value={person.pending} /></div>
    </div>
    {person.adjustments.length && (person.previousBalance.ARS !== 0 || person.previousBalance.USD !== 0) ? <div className="kv"><span>Saldo anterior</span><b data-ph-mask>{commissionTotal(person.previousBalance)}</b></div> : null}
    {negative ? <p className="commission-carry deduction"><DeskIcon name="cal" size={16} /><span>Se le pagó de más: <ReplayValue>{commissionTotal({ ARS: Math.max(0, -person.pending.ARS), USD: Math.max(0, -person.pending.USD) })}</ReplayValue> se descuentan de su comisión de {monthLabel(period, 1)}.</span></p> : null}
    <CommissionMemberLedger person={person} period={period} onLayerChange={setConfirming} financials={canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role)} />
  </Sheet>;
}

export function CommissionsScreen() {
  const { appSession, commissionSummaries = {}, commissionDetails = {}, commissionRules = [], loadCommissions, loadCommissionDetail, sessionConfirmed } = useAppContext();
  const { back, go } = useDesk();
  const phone = usePhoneLayout();
  const manage = canManageCommissions(appSession?.membership?.sections, appSession?.membership?.role);
  const [period, setPeriod] = useState(() => monthKey(new Date(), appSession?.store?.timezone));
  const [filter, setFilter] = useState('Todos');
  const [member, setMember] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'rule' | 'payment' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useOfflineRecovery(error, () => setRetry(value => value + 1));
  const summary = commissionSummaries[period];
  const mine = commissionDetails[`mine:${period}`];
  const detail = member ? commissionDetails[`${member}:${period}`] : undefined;
  useEffect(() => {
    if (sessionConfirmed === false) return;
    let active = true; setLoading(true); setError(''); setMember(null); setSheet(null);
    loadCommissions(period).catch((cause: unknown) => { if (active) setError(toUserMessage(cause, 'No se pudieron cargar las comisiones')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, manage, appSession?.store?.id, appSession?.user?.id, retry, sessionConfirmed]);
  const openMember = async (id: string) => {
    setError('');
    try { await loadCommissionDetail(id, period); setMember(id); } catch (cause) { setError(toUserMessage(cause, 'No se pudo cargar el detalle')); }
  };
  const periodPicker = <CommissionMonthPicker value={period} onChange={setPeriod} />;
  const payable = summary ? { ...summary.summary, pending: summary.people.reduce((sum, p) => ({ ARS: sum.ARS + Math.max(0, p.pending.ARS), USD: sum.USD + Math.max(0, p.pending.USD) }), { ARS: 0, USD: 0 }) } : null;
  const deductions = summary?.people.filter(p => hasDeduction(p.pending)) ?? [];
  const people = summary?.people.filter(person => filter === 'Todos' || (filter === 'Pendientes' ? person.pending.ARS > 0 || person.pending.USD > 0 : hasDeduction(person.pending))) ?? [];
  return <div className={`dscreen commissions-screen${phone && manage ? ' has-dock' : ''}${!manage ? ' commission-mine' : ''}`}>
    <ScreenTitle title={manage ? 'Comisiones' : 'Mis comisiones'} back={back}
      tools={manage ? <IconButton label="Reglas" name="filtrar" onClick={() => setSheet('rule')} /> : undefined}
      desktop={<div className="dright">{periodPicker}{manage ? <><button type="button" className="dbtn s" onClick={() => setSheet('rule')}><ImanagerIcon name="filtrar" size={16} />Reglas</button><DeskCta onClick={() => setSheet('payment')}>Registrar pago</DeskCta></> : null}</div>} />
    {phone ? <div className="dbar">{periodPicker}{manage ? <MenuButton label={filter} options={['Todos', 'Pendientes', 'A descontar']} value={filter} onChange={setFilter} /> : null}</div> : null}
    {error && !isNetworkErrorMessage(error) ? <div className="ferr" role="alert">{error} <button className="wlink" type="button" onClick={() => setRetry(x => x + 1)}>Reintentar</button></div> : null}
    {loading ? <ListSkeleton variant="cards" rows={3} testId="commissions-loading" /> : null}
    {!manage && mine && !loading ? <><CommissionHero person={mine.person} mine /><p className="commission-banner">Tu regla: {ruleLabel(mine.person.sales.find(sale => !sale.cancelled)?.rule)}.</p><CommissionLines person={mine.person} period={period} financials={false} /></> : null}
    {manage && summary && !loading ? <>
      {phone ? <CommissionHero person={payable!} /> : <div className="commission-kpis">{([['Comisión del mes', summary.summary.earned], ['Pagado', summary.summary.paid], ['Pendiente', payable!.pending]] as const).map(([title, value]) => <div className={`dstat${title === 'Pendiente' ? ' pending' : ''}`} key={title}><div className="eb">{title}</div><CurrencyTotals value={value} /><small data-ph-mask className="mut">{title === 'Comisión del mes' ? `${saleCount(summary.summary.salesCount)} con vendedor` : title === 'Pendiente' ? (deductions.length ? deductions.map(p => `${p.name}: a descontar ${commissionTotal({ ARS: Math.max(0, -p.pending.ARS), USD: Math.max(0, -p.pending.USD) })} en ${monthLabel(period, 1)}`).join(' · ') : `Lo pendiente pasa a ${monthLabel(period, 1)}`) : 'Pagos registrados'}</small></div>)}</div>}
      {summary.summary.unassignedSalesCount > 0 ? <div className="commission-banner dashed"><span>{saleCount(summary.summary.unassignedSalesCount)} del mes sin vendedor {summary.summary.unassignedSalesCount === 1 ? 'no suma' : 'no suman'} comisión.</span><button className="wlink" type="button" onClick={() => { sessionStorage.setItem('commission-unassigned', period); go('sales'); }}>Asignar</button></div> : null}
      {phone ? <><div className="sale-sec"><span>Vendedores</span><span>{people.length} {people.length === 1 ? 'persona' : 'personas'}</span></div><div className="commission-people">{people.map(person => <button type="button" key={person.memberId} className="commission-person" onClick={() => { void openMember(person.memberId); }}><div className="commission-person-head"><CommissionAvatar id={person.memberId} name={person.name} role={person.role} /><div><b>{person.name}</b><small>{ROLE_LABEL[person.role]} · {saleCount(person.salesCount)}</small></div><span className="chev">›</span></div><div className="commission-person-values"><div><span>Comisión</span><CurrencyTotals value={person.earned} /></div><div><span>Pagado</span><CurrencyTotals value={person.paid} /></div><div className={hasDeduction(person.pending) ? 'deduction' : 'pending'}><span>{hasDeduction(person.pending) ? 'A descontar' : 'Pendiente'}</span><CurrencyTotals value={person.pending} /></div></div></button>)}</div></> : <div className="dcard flush"><div className="dch pad"><h3>Vendedores</h3><span className="mut">{people.length} {people.length === 1 ? 'persona' : 'personas'} · lo pendiente pasa al mes siguiente</span></div><table className="dtable commission-table"><thead><tr><th>Vendedor</th><th>Regla</th><th>Ventas</th><th>Comisión del mes</th><th>Saldo ant. y ajustes</th><th>Pagado</th><th>Pendiente</th><th /></tr></thead><tbody>{people.map(person => { const rule = effectiveRule(commissionRules, person.memberId, period, appSession?.store?.timezone); return <tr key={person.memberId}><td><button type="button" className="commission-name" onClick={() => { void openMember(person.memberId); }}><CommissionAvatar id={person.memberId} name={person.name} role={person.role} /><span><b>{person.name}</b><small>{ROLE_LABEL[person.role]}</small></span></button></td><td><span className="spill commission-rule-chip">{ruleLabel(rule)} · {rule?.memberId ? 'personal' : 'equipo'}</span></td><td>{person.salesCount}</td><td><CurrencyTotals value={person.earned} /></td><td><CurrencyTotals value={{ ARS: person.previousBalance.ARS + person.adjustmentsTotal.ARS, USD: person.previousBalance.USD + person.adjustmentsTotal.USD }} /></td><td><CurrencyTotals value={person.paid} /></td><td><Balance value={person.pending} /></td><td>{person.pending.ARS > 0 || person.pending.USD > 0 ? <button type="button" className="wlink" onClick={() => { setMember(person.memberId); setSheet('payment'); }}>Pagar</button> : null}</td></tr>; })}</tbody><tfoot><tr><td colSpan={2}><b>Total</b></td><td>{summary.summary.salesCount}</td><td><CurrencyTotals value={summary.summary.earned} /></td><td><CurrencyTotals value={summary.people.reduce((sum, p) => ({ ARS: sum.ARS + p.previousBalance.ARS + p.adjustmentsTotal.ARS, USD: sum.USD + p.previousBalance.USD + p.adjustmentsTotal.USD }), { ARS: 0, USD: 0 })} /></td><td><CurrencyTotals value={summary.summary.paid} /></td><td><CurrencyTotals value={payable!.pending} />{deductions.length ? <small className="commission-negative">A descontar <ReplayValue>{commissionTotal(deductions.reduce((sum, p) => ({ ARS: sum.ARS + Math.max(0, -p.pending.ARS), USD: sum.USD + Math.max(0, -p.pending.USD) }), { ARS: 0, USD: 0 }))}</ReplayValue></small> : null}</td><td /></tr></tfoot></table></div>}
      {!people.length ? <p className="wempty">No hay vendedores para este filtro.</p> : null}
    </> : null}
    {phone && manage ? <MobileDock primary="Registrar pago" onPrimary={() => { setMember(null); setSheet('payment'); }} secondary="Reglas" onSecondary={() => { setMember(null); setSheet('rule'); }} /> : null}
    {detail && !sheet ? <CommissionMemberSheet person={detail.person} period={period} rule={effectiveRule(commissionRules, detail.person.memberId, period, appSession?.store?.timezone)} onClose={() => setMember(null)} onRule={() => setSheet('rule')} onPay={() => setSheet('payment')} /> : null}
    {sheet === 'rule' && manage ? <CommissionRuleSheet memberId={member} period={period} onClose={() => setSheet(null)} /> : null}
    {sheet === 'payment' && manage ? <CommissionPaymentSheet memberId={member} period={period} people={summary?.people ?? []} onClose={() => setSheet(null)} /> : null}
  </div>;
}
