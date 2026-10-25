import { usePhoneLayout } from '../section-notices';
import { DatePicker } from '../date-picker';
import { isDateValue } from '../date-value';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { OperationInput } from '../../services/operations-api';
import { formatInputMoney, parseMoney } from '../format';
import { Field, Segs } from '../ui';
import { PAYMENTS } from './shared';
import { ImanagerIcon } from '../icons';

function moneyInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return formatInputMoney(Number(digits)) || '0';
}

export type SettlementState = {
  active: boolean;
  error: string | null;
  payload: Pick<OperationInput, 'tenders' | 'excess' | 'changeMethod' | 'installments' | 'exchangeRate'> | null;
};

const EMPTY: SettlementState = { active: false, error: null, payload: null };
const FREQUENCIES = [
  { id: 'SEMANAL', label: 'Semanal' },
  { id: 'QUINCENAL', label: 'Quincenal' },
  { id: 'MENSUAL', label: 'Mensual' },
];
const EXCESS = [
  { id: 'OMIT', label: 'No registrarlo' },
  { id: 'CREDIT', label: 'Saldo a favor' },
  { id: 'CHANGE', label: 'Vuelto' },
];

type TenderRow = { id: number; amount: string; currency: 'ARS' | 'USD'; method: string };

export function SalePaymentsFields({
  clientId,
  due,
  currency,
  suggestedRate,
  onChange,
}: {
  clientId: string;
  due: number;
  currency: 'ARS' | 'USD';
  suggestedRate: number | null;
  onChange: (value: SettlementState) => void;
}) {
  const phone = usePhoneLayout();
  const [mixed, setMixed] = useState(false);
  const [finance, setFinance] = useState(false);
  const [rows, setRows] = useState<TenderRow[]>([{ id: 0, amount: '', currency, method: 'EFECTIVO' }]);
  const paymentsId = useId();
  const nextRowId = useRef(1);
  const amountInputs = useRef(new Map<number, HTMLInputElement>());
  const addPaymentButton = useRef<HTMLButtonElement>(null);
  const focusAfterRemoval = useRef<number | null>(null);
  const [rate, setRate] = useState(suggestedRate ? String(suggestedRate) : '');
  const [excess, setExcess] = useState<'OMIT' | 'CREDIT' | 'CHANGE'>('OMIT');
  const [changeMethod, setChangeMethod] = useState('EFECTIVO');
  const [count, setCount] = useState('3');
  const [frequency, setFrequency] = useState<'SEMANAL' | 'QUINCENAL' | 'MENSUAL'>('MENSUAL');
  const [firstDue, setFirstDue] = useState('');
  const [surcharge, setSurcharge] = useState('');
  const [collectFirst, setCollectFirst] = useState(false);
  const [firstMethod, setFirstMethod] = useState('EFECTIVO');

  useLayoutEffect(() => {
    if (focusAfterRemoval.current == null) return;
    const target = amountInputs.current.get(focusAfterRemoval.current) ?? addPaymentButton.current;
    focusAfterRemoval.current = null;
    target?.focus();
  }, [rows]);

  function removePayment(id: number) {
    const index = rows.findIndex((row) => row.id === id);
    if (index <= 0) return;
    focusAfterRemoval.current = rows[index - 1].id;
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function addPayment() {
    const id = nextRowId.current++;
    setRows((current) => [...current, { id, amount: '', currency, method: 'EFECTIVO' }]);
  }

  const state = useMemo(() => {
    if (!mixed && !finance) return EMPTY;
    const parsedRate = Number(rate.replace(',', '.'));
    const rateOk = Number.isFinite(parsedRate) && parsedRate > 0;
    const tenders = mixed ? rows.flatMap((row) => {
      const amount = parseMoney(row.amount);
      if (!(amount > 0)) return [];
      return [{ amount, currency: row.currency, method: row.method, ...(row.currency !== currency ? { exchangeRate: parsedRate } : {}) }];
    }) : [];
    const needsRate = tenders.some((tender) => tender.currency !== currency) || (excess === 'CREDIT' && tenders.length > 0);
    let covered = 0;
    for (const tender of tenders) {
      if (tender.currency === currency) covered += tender.amount;
      else if (!rateOk) return { active: true, error: 'Revisá la cotización antes de confirmar', payload: null };
      else covered += tender.currency === 'USD' ? tender.amount * parsedRate : tender.amount / parsedRate;
    }
    const over = covered > due + 0.009;
    if (over && excess === 'CHANGE' && !changeMethod) return { active: true, error: 'Indicá de qué medio sale el vuelto', payload: null };
    if (needsRate && excess === 'CREDIT' && !rateOk) return { active: true, error: 'Revisá la cotización antes de dejar el saldo a favor', payload: null };
    const remainder = over ? 0 : Math.max(0, due - covered);
    let installments: OperationInput['installments'] = null;
    if (finance) {
      if (!clientId) return { active: true, error: 'Elegí un cliente de la lista para financiar en cuotas', payload: null };
      const installmentsCount = Number(count);
      if (!Number.isInteger(installmentsCount) || installmentsCount < 2 || installmentsCount > 36) return { active: true, error: 'La cantidad de cuotas tiene que estar entre 2 y 36', payload: null };
      if (!isDateValue(firstDue)) return { active: true, error: 'Indicá el primer vencimiento', payload: null };
      if (!(remainder > 0)) return { active: true, error: 'No queda saldo para financiar', payload: null };
      if (collectFirst && !firstMethod) return { active: true, error: 'Elegí el medio para cobrar la primera cuota', payload: null };
      installments = {
        count: installmentsCount,
        frequency,
        firstDueDate: firstDue,
        surcharge: parseMoney(surcharge),
        collectFirstNow: collectFirst,
        ...(collectFirst ? { firstMethod } : {}),
      };
    }
    if (!tenders.length && !installments) return { active: true, error: 'Completá un pago o las cuotas', payload: null };
    return {
      active: true,
      error: null,
      payload: {
        ...(tenders.length ? { tenders, excess, ...(excess === 'CHANGE' ? { changeMethod } : {}) } : {}),
        ...(installments ? { installments } : {}),
        ...(rateOk ? { exchangeRate: parsedRate } : {}),
      },
    };
  }, [mixed, finance, rows, rate, excess, changeMethod, count, frequency, firstDue, surcharge, collectFirst, firstMethod, clientId, due, currency]);

  const snapshot = JSON.stringify(state);
  useEffect(() => { onChange(state); }, [snapshot]);

  const previewRate = Number(rate.replace(',', '.'));
  const coveredPreview = rows.reduce<number | null>((sum, row) => {
    if (sum == null) return null;
    const amount = parseMoney(row.amount);
    if (!(amount > 0)) return sum;
    if (row.currency === currency) return sum + amount;
    if (!Number.isFinite(previewRate) || previewRate <= 0) return null;
    return sum + (row.currency === 'USD' ? amount * previewRate : amount / previewRate);
  }, 0);
  const previewExceedsDue = coveredPreview != null && coveredPreview > due + 0.009;
  return (
    <section className="acct-payments" aria-label="Pagos y cuotas">
      <label className="op-check"><input type="checkbox" checked={mixed} onChange={(event) => setMixed(event.target.checked)} />Combinar pagos</label>
      <label className="op-check"><input type="checkbox" checked={finance} disabled={!clientId} onChange={(event) => setFinance(event.target.checked)} />Financiar en cuotas</label>
      {!clientId ? <p className="eqs-note">Elegí un cliente de la lista para financiar en cuotas.</p> : null}
      {mixed ? (
        <div className="acct-tenders">
          {rows.map((row, index) => (
            <div className={`acct-tender${index > 0 ? ' acct-tender-removable' : ''}`} key={row.id}>
              {index > 0 ? (
                <button className="acct-tender-remove" type="button" aria-label={`Quitar pago ${index + 1}`} title={`Quitar pago ${index + 1}`} onClick={() => removePayment(row.id)}>
                  <ImanagerIcon name="cerrar" size={16} />
                </button>
              ) : null}
              <Field label={`Pago ${index + 1}`} mark={row.currency}>
                <input id={`${paymentsId}-payment-${row.id}`} ref={(input) => { if (input) amountInputs.current.set(row.id, input); else amountInputs.current.delete(row.id); }} aria-label={`Importe del pago ${index + 1}`} inputMode="numeric" value={row.amount} placeholder="$ 0" onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, amount: moneyInput(event.target.value) } : item))} />
              </Field>
              <Segs options={[{ id: 'ARS', label: 'ARS' }, { id: 'USD', label: 'USD' }]} value={row.currency} onChange={(value) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, currency: value as 'ARS' | 'USD' } : item))} />
              <Segs options={PAYMENTS} value={row.method} onChange={(value) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, method: value } : item))} />
            </div>
          ))}
          {rows.length < 4 ? <button ref={addPaymentButton} className="btn2 s" type="button" onClick={addPayment}>Agregar pago</button> : null}
          {rows.some((row) => row.currency !== currency) || excess === 'CREDIT' ? (
            <Field label="Cotización" error={state.error && state.error.includes('cotización') ? state.error : undefined}>
              <input aria-label="Cotización" inputMode="decimal" value={rate} placeholder={suggestedRate ? String(suggestedRate) : 'Ej. 1300'} onChange={(event) => setRate(event.target.value)} />
            </Field>
          ) : null}
          {previewExceedsDue ? <p className="eqs-note">El pago supera el saldo.</p> : null}
          {previewExceedsDue ? (
            <>
              <Field label="Excedente"><span /></Field>
              <Segs options={EXCESS} value={excess} onChange={(value) => setExcess(value as typeof excess)} />
              {excess === 'CHANGE' ? <><Field label="Medio del vuelto"><span /></Field><Segs options={PAYMENTS} value={changeMethod} onChange={setChangeMethod} /></> : null}
            </>
          ) : null}
        </div>
      ) : null}
      {finance && clientId ? (
        <div className="acct-plan">
          <div className="acct-stack">
            <Field label="Cantidad de cuotas"><input aria-label="Cantidad de cuotas" inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value.replace(/\D/g, '').slice(0, 2))} /></Field>
            <DatePicker label="Primer vencimiento" value={firstDue} onChange={setFirstDue} required boundary="sheet" panel={phone ? 'inline' : 'float'} />
          </div>
          <Field label="Frecuencia"><span /></Field>
          <Segs options={FREQUENCIES} value={frequency} onChange={(value) => setFrequency(value as typeof frequency)} />
          <Field label="Recargo opcional" mark={currency}><input aria-label="Recargo" inputMode="numeric" value={surcharge} placeholder="$ 0" onChange={(event) => setSurcharge(moneyInput(event.target.value))} /></Field>
          <label className="op-check"><input type="checkbox" checked={collectFirst} onChange={(event) => setCollectFirst(event.target.checked)} />Cobrar la primera cuota ahora</label>
          {collectFirst ? <><Field label="Medio de la primera cuota"><span /></Field><Segs options={PAYMENTS} value={firstMethod} onChange={setFirstMethod} /></> : null}
          <p className="eqs-note">Se financia el saldo que queda después de los pagos iniciales{surcharge ? `. Recargo ${formatInputMoney(parseMoney(surcharge)) || surcharge}` : ''}.</p>
        </div>
      ) : null}
      {state.error && !state.error.includes('cotización') ? <div className="ferr" role="alert">{state.error}</div> : null}
    </section>
  );
}
