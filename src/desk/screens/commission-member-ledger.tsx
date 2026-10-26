import { ReplayValue } from '../replay-privacy';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../context/AppContext';
import type { CommissionPayment, CommissionPerson, CommissionSale } from '../../types/commissions';
import { toActionMessage } from '../../lib/user-message';
import { commissionAmount, monthLabel } from '../commissions';
import { isVoidRow } from '../format';
import { ReasonSheet } from '../ReasonSheet';
import { canManageCommissions } from '../sections';
import { Sheet } from '../ui';

const shortDate = (value: string) => new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
function SaleRow({ sale, financials, full }: { sale: CommissionSale; financials: boolean; full: boolean }) {
  const voided = isVoidRow(sale) || sale.cancelled;
  return <article className={`phone-row comd-row${voided ? ' is-void' : ''}`}>
    <div className="comd-row-copy"><b>#V-{String(sale.saleNumber).padStart(4, '0')}</b><small title={sale.deviceLabel}>{sale.deviceLabel} · {shortDate(sale.soldAt)}</small>
      {full ? <small>{voided ? sale.voidReason === 'EDITED' ? 'Modificada · comisión reemplazada' : sale.voidReason === 'DELETED' ? 'Eliminada · no genera comisión' : 'Anulada · no genera comisión' : <>Venta {commissionAmount(sale.total, sale.currency)}{financials && sale.grossProfit !== undefined ? ` · ganancia ${commissionAmount(sale.grossProfit, sale.currency)}` : ''}</>}</small> : null}
    </div>
    <div className="comd-row-end"><b>{voided ? <s data-ph-mask>{commissionAmount(sale.originalCommission, sale.currency)}</s> : commissionAmount(sale.commission, sale.currency)}</b>{voided ? <span className="spill comd-void-pill">Anulado</span> : <small>comisión</small>}</div>
  </article>;
}

/** Administrative detail only; the personal commissions screen keeps its own layout. */
export function CommissionMemberLedger({ person, period, financials, onLayerChange }: { person: CommissionPerson; period: string; financials: boolean; onLayerChange: (open: boolean) => void }) {
  const { appSession, voidCommissionPayment } = useAppContext();
  const manage = canManageCommissions(appSession?.membership?.sections, appSession?.membership?.role);
  const id = useId();
  const [tab, setTab] = useState<'sales' | 'payments'>('sales');
  const [all, setAll] = useState(false);
  const [paymentToVoid, setPaymentToVoid] = useState<CommissionPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const allButton = useRef<HTMLButtonElement>(null);
  const restoreListTrigger = useRef(false);
  useEffect(() => {
    if (!all && restoreListTrigger.current) {
      restoreListTrigger.current = false;
      allButton.current?.focus();
    }
  }, [all]);
  const salesTab = tab === 'sales';
  const count = salesTab ? person.sales.length + person.adjustments.length : person.payments.length;
  const title = salesTab ? `Ventas${person.adjustments.length ? ' y ajustes' : ''} de ${monthLabel(period).split(' ')[0]}` : 'Pagos';
  const closeList = () => { restoreListTrigger.current = true; setAll(false); onLayerChange(false); };
  const closeConfirmation = () => { if (!busy) { setPaymentToVoid(null); onLayerChange(all); } };
  const voidPayment = async (reason: string) => {
    if (!paymentToVoid || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { await voidCommissionPayment(paymentToVoid.id, person.memberId, period, reason); setPaymentToVoid(null); onLayerChange(all); }
    catch (cause) { setError(toActionMessage(cause, 'No se pudo anular el pago')); }
    finally { submitting.current = false; setBusy(false); }
  };
  const rows = (full: boolean) => {
    const sales = salesTab ? [...person.sales].sort((a, b) => b.soldAt.localeCompare(a.soldAt) || b.saleNumber - a.saleNumber).map(sale => <SaleRow key={sale.accrualId} sale={sale} financials={financials} full={full} />) : [];
    const adjustments = salesTab ? person.adjustments.map((adjustment, index) => <article className="phone-row comd-row comd-adjustment" key={`${adjustment.accrualId}:${index}`}><div className="comd-row-copy"><b>Ajuste por venta anulada</b><small>#V-{String(adjustment.saleNumber).padStart(4, '0')} · {monthLabel(adjustment.period)}</small><small>Su comisión ya se había pagado</small></div><div className="comd-row-end"><b data-ph-mask>{commissionAmount(adjustment.amount, adjustment.currency)}</b><small>A descontar</small></div></article>) : [];
    const payments = !salesTab ? person.payments.map(payment => <article className={`phone-row comd-row${isVoidRow(payment) ? ' is-void' : ''}`} key={payment.id}>
      <div className="comd-row-copy"><b title={payment.note || 'Pago registrado'}>{payment.note || 'Pago registrado'}</b><small>{shortDate(payment.createdAt)} · <ReplayValue>{payment.currency !== payment.settlesCurrency ? `Salda ${commissionAmount(payment.settledAmount, payment.settlesCurrency)} · cotización ${commissionAmount(payment.exchangeRate, 'ARS')}` : 'Pago de comisión'}</ReplayValue></small></div>
      <div className="comd-row-end"><b>{payment.voidedAt ? <s data-ph-mask>{commissionAmount(payment.amount, payment.currency)}</s> : commissionAmount(payment.amount, payment.currency)}</b>{payment.voidedAt ? <span className="spill comd-void-pill">Anulado</span> : manage ? <button type="button" className="wlink commission-payment-void" aria-label={`Anular pago de ${commissionAmount(payment.amount, payment.currency)}`} onClick={() => { setError(''); setPaymentToVoid(payment); onLayerChange(true); }}>Anular pago</button> : null}</div>
    </article>) : [];
    const items = [...sales, ...adjustments, ...payments];
    return <div className="comd-rows">{(full ? items : items.slice(0, 3))}{!items.length ? <p className="wempty">{salesTab ? 'No hay ventas en este período.' : 'No hay pagos registrados.'}</p> : null}</div>;
  };
  return <>
    <div className="wchips comd-tabs" role="tablist" aria-label="Detalle de comisiones">{(['sales', 'payments'] as const).map(value => <button type="button" key={value} id={`${id}-${value}`} role="tab" aria-selected={tab === value} aria-controls={`${id}-panel`} tabIndex={tab === value ? 0 : -1} className={`sg${tab === value ? ' on' : ''}`} onClick={() => setTab(value)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'sales' : event.key === 'End' ? 'payments' : tab === 'sales' ? 'payments' : 'sales'; setTab(next); document.getElementById(`${id}-${next}`)?.focus(); } }}>{value === 'sales' ? `Ventas · ${person.sales.length}` : `Pagos · ${person.payments.length}`}</button>)}</div>
    <section id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`}><div className="dch comd-section-head"><h3>{title}</h3>{count > 3 ? <button ref={allButton} type="button" className="wlink" onClick={() => { setAll(true); onLayerChange(true); }}>Ver todas ({count})</button> : null}</div>{rows(false)}</section>
    {all && !paymentToVoid ? <Sheet title={title} className="hist-screen comd-all" mobileBack overlayClassName="subov" onClose={closeList}>{rows(true)}</Sheet> : null}
    {paymentToVoid ? createPortal(<ReasonSheet title="Anular pago" note={<>Se anulará el pago de <ReplayValue>{commissionAmount(paymentToVoid.amount, paymentToVoid.currency)}</ReplayValue>. Quedará en el historial y dejará de contar en los saldos y ajustes.</>} ok="Anular pago" danger busy={busy} error={error} onClose={closeConfirmation} onOk={reason => { void voidPayment(reason); }} />, document.querySelector('.desk-app') ?? document.body) : null}
  </>;
}
