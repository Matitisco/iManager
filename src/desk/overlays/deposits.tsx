import { ListSkeleton } from '../list-skeleton';
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { toActionMessage, toUserMessage, isNetworkErrorMessage } from '../../lib/user-message';
import type { ClientDeposit } from '../../types';
import { useMoney } from '../exchange';
import { depositAmount, depositAvailable, depositStatus } from '../deposits';
import { equipmentTitle, formatMoney, formatShortDate } from '../format';
import { DeskSelect } from '../select';
import { Actions, Field, Segs, Sheet, useDesk } from '../ui';
import { PAYMENTS } from './shared';

const EMPTY_DEPOSITS: ClientDeposit[] = [];
export function useClientDeposits(clientId: string) {
  const { clientDeposits = {}, loadClientDeposits, appSession } = useAppContext();
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!clientId || !loadClientDeposits) return;
    let active = true;
    setLoading(true);
    setUnavailable(false);
    loadClientDeposits(clientId).catch(cause => {
      if (!active) return;
      console.warn('No se pudieron cargar las señas.', cause);
      setUnavailable(true);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clientId, appSession?.store?.id]);
  return { rows: clientDeposits[clientId] ?? EMPTY_DEPOSITS, unavailable, loading };
}
export function receiptMoney(amount: number, currency: string) {
  return `${currency === 'USD' ? 'US$' : '$'} ${amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}
export function DepositReceipt({ row }: { row: ClientDeposit }) {
  // Receipt amounts always keep the original currency, independent of the toolbar projection.
  return <div className="deposit-receipt">
    <div><b>{receiptMoney(row.amount, row.currency)} {row.currency}</b><span>{depositStatus[row.status]} · {formatShortDate(row.createdAt)}</span></div>
    <small>USD {row.usdAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} fijos · cotización ARS {row.exchangeRate.toLocaleString('es-AR')}</small>
    {row.productLabel ? <small>{row.status === 'ACTIVE' ? 'Equipo reservado: ' : 'Equipo: '}{row.productLabel}</small> : null}
    {row.appliedAt ? <small>{row.saleId ? 'Venta' : 'Reparación'} · aplicada el {formatShortDate(row.appliedAt)}{row.appliedAmount != null ? ` · ${receiptMoney(row.appliedAmount, row.appliedCurrency ?? 'ARS')} ${row.appliedCurrency}` : ''}</small> : null}
  </div>;
}
export function DepositForm({ clientId }: { clientId: string }) {
  const { clients, inventory, addClientDeposit, loadOperationOptions } = useAppContext();
  const { open, toast } = useDesk();
  const money = useMoney();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(money.active);
  const [rate, setRate] = useState(money.rate == null ? '' : String(money.rate));
  const rateDirty = useRef(false);
  const requestKey = useRef(`deposit-${crypto.randomUUID()}`);
  const [method, setMethod] = useState('TRANSFERENCIA');
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState(inventory.filter(item => !item.archivedAt && !item.reservedDepositId && (!item.status || item.status === 'DISPONIBLE')));
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!rateDirty.current && money.rate) setRate(String(money.rate)); }, [money.rate]);
  useEffect(() => {
    let active = true;
    loadOperationOptions('clients').then(options => { if (active) setProducts(options.products.filter(item => !item.reservedDepositId && !item.pendingSaleRegistration).map(item => ({ ...item, imei: item.imei ?? '', condition: item.condition ?? '', grade: item.grade ?? '', batteryHealth: '', status: 'DISPONIBLE' }))); }).catch(cause => { if (active) setError(toUserMessage(cause, 'No se pudieron cargar los equipos')); });
    return () => { active = false; };
  }, []);
  const back = () => { if (!saving.current) open({ type: 'cl', id: clientId }); };
  const number = (value: string) => /^\d+(?:[.,]\d{1,2})?$/.test(value.trim()) ? Number(value.replace(',', '.')) : NaN;
  const value = number(amount);
  const exchangeRate = number(rate);
  const save = async () => {
    if (saving.current) return;
    if (!Number.isFinite(value) || value <= 0 || value > 100_000_000 || !Number.isFinite(exchangeRate) || exchangeRate <= 0 || exchangeRate > 100_000_000) { setError('Completá monto y cotización positivos, con hasta dos decimales'); return; }
    saving.current = true;
    setBusy(true); setError('');
    try {
      await addClientDeposit(clientId, { amount: value, currency, exchangeRate, method, productId: productId || null, requestKey: requestKey.current });
      toast(productId ? 'Seña registrada · equipo reservado' : 'Seña registrada');
      open({ type: 'cl', id: clientId });
    } catch (cause) { setError(toActionMessage(cause, 'No se pudo registrar la seña')); }
    finally { saving.current = false; setBusy(false); }
  };
  return <Sheet title="Agregar seña" subtitle={clients.find(client => client.id === clientId)?.name} onClose={back} className="deposit-sheet">
    {error && !isNetworkErrorMessage(error) ? <div className="ferr" role="alert">{error}</div> : null}
    <Field label="Moneda"><span /></Field><Segs options={[{ id: 'ARS', label: 'ARS' }, { id: 'USD', label: 'USD' }]} value={currency} onChange={id => setCurrency(id as 'ARS' | 'USD')} />
    <Field label="Monto de la seña" mark={currency}><input value={amount} inputMode="decimal" placeholder="0" onChange={event => setAmount(event.target.value)} /></Field>
    <Field label="Cotización guardada" mark="ARS por USD"><input value={rate} inputMode="decimal" placeholder="Cotización del día" onChange={event => { rateDirty.current = true; setRate(event.target.value); }} /></Field>
    <p className="eqs-note">{Number.isFinite(value) && exchangeRate > 0 ? `Equivalente fijo: USD ${(currency === 'USD' ? value : value / exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` : 'El equivalente en USD queda fijo al registrar la seña.'}</p>
    <Field label="Forma de pago"><span /></Field><Segs options={PAYMENTS} value={method} onChange={setMethod} />
    <Field label="Equipo a reservar (opcional)"><DeskSelect label="Equipo a reservar (opcional)" value={productId} options={[{ value: '', label: 'Sin reserva de equipo' }, ...products.map(item => ({ value: item.id, label: `${equipmentTitle(item.model, item.capacity)}${item.imei ? ` · ${item.imei}` : ''}` }))]} onChange={setProductId} disabled={busy} /></Field>
    <p className="eqs-note">La seña se registra como un cobro. Podés aplicarla en una venta o reparación de este cliente.</p>
    <Actions busy={busy} primary="Registrar seña" onPrimary={() => { void save(); }} onSecondary={back} secondary="Volver" />
  </Sheet>;
}
export function CancelDeposit({ row, onClose }: { row: ClientDeposit; onClose: () => void }) {
  const { cancelClientDeposit } = useAppContext();
  const { toast } = useDesk();
  const [mode, setMode] = useState(row.status === 'CREDIT' ? 'REFUND' : 'CREDIT');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const back = () => { if (!saving.current) onClose(); };
  const save = async () => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const saved = await cancelClientDeposit(row.clientId, row.id, mode as 'REFUND' | 'CREDIT');
      if (saved.status === row.status) {
        setError(row.status === 'CREDIT' ? 'Ese saldo ya está a favor. Elegí devolver el dinero para registrarlo.' : 'Esa seña ya estaba resuelta.');
        return;
      }
      toast(mode === 'REFUND' ? 'Seña devuelta · equipo liberado' : 'Saldo a favor guardado · equipo liberado');
      onClose();
    }
    catch (cause) { setError(toActionMessage(cause, 'No se pudo cancelar la seña')); }
    finally { saving.current = false; setBusy(false); }
  };
  return <Sheet title="Cancelar seña" subtitle="Elegí qué hacer con el pago" className="deposit-sheet" onClose={back}>
    {error && !isNetworkErrorMessage(error) ? <div className="ferr" role="alert">{error}</div> : null}<DepositReceipt row={row} />
    <Segs options={[{ id: 'CREDIT', label: 'Dejar saldo a favor' }, { id: 'REFUND', label: 'Devolver dinero' }]} value={mode} onChange={setMode} />
    <p className="eqs-note">{mode === 'CREDIT' ? 'El crédito quedará disponible para una venta o reparación. No se devuelve dinero.' : `Se registra una devolución de ${receiptMoney(row.amount, row.currency)} ${row.currency} por ${row.method.toLocaleLowerCase('es')}.`}{row.status === 'ACTIVE' && row.productId ? ' El equipo vuelve a estar disponible.' : ''}</p>
    <Actions busy={busy} primary={mode === 'CREDIT' ? 'Confirmar saldo a favor' : 'Confirmar devolución'} onPrimary={() => { void save(); }} onSecondary={back} secondary="Volver" />
  </Sheet>;
}
export function DepositChoices({ receipts, clientId, productId, selected, onChange, currency, rate, maximum, busy }: { receipts: ReturnType<typeof useClientDeposits>; clientId: string; productId: string; selected: string[]; onChange: (ids: string[]) => void; currency: string; rate: number | null; maximum: number; busy: boolean }) {
  const { rows, loading } = receipts;
  const active = rows.filter(depositAvailable);
  if (!clientId || (!loading && !active.length)) return null;
  return <section className="deposit-list" aria-label="Señas disponibles">
    {loading ? <ListSkeleton variant="lines" rows={2} /> : null}
    {active.length ? <h4>Señas disponibles</h4> : null}
    {active.map(row => {
      const value = depositAmount(row, currency, rate);
      const applied = selected.includes(row.id);
      const reservedElsewhere = row.status === 'ACTIVE' && row.productId && row.productId !== productId;
      const total = active.filter(item => selected.includes(item.id) && item.id !== row.id).reduce((sum, item) => sum + (depositAmount(item, currency, rate) ?? 0), 0);
      return <div className="deposit-card" key={row.id}>
        <DepositReceipt row={row} />
        {reservedElsewhere ? <p className="eqs-note">Elegí el equipo reservado o pasá la seña a saldo a favor desde la ficha.</p> : null}
        <button className="btn2 s" type="button" aria-pressed={applied} disabled={busy || loading || (!applied && (Boolean(reservedElsewhere) || value == null || value + total > maximum))} onClick={() => onChange(applied ? selected.filter(id => id !== row.id) : [...selected, row.id])}>{applied ? 'Quitar seña' : 'Aplicar'}</button>
        {value != null && !applied && value + total > maximum ? <small>La seña supera lo que falta pagar.</small> : null}
      </div>;
    })}
  </section>;
}
export function RepairDepositSheet({ repairId }: { repairId: string }) {
  const { repairOrders, applyClientDepositToRepair } = useAppContext();
  const order = repairOrders.find(item => item.id === repairId);
  const { rows, loading } = useClientDeposits(order?.clientId ?? '');
  const money = useMoney();
  const { open, toast } = useDesk();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  if (!order) return null;
  const currency = order.currency ?? money.active;
  const maximum = (order.estimate ?? 0) - order.deposit;
  const back = () => { if (!saving.current) open({ type: 'ot', id: repairId }); };
  const apply = async () => {
    if (saving.current || !selected || !order.clientId) return;
    saving.current = true; setBusy(true); setError('');
    try { await applyClientDepositToRepair(order.clientId, selected, repairId, money.rate ?? undefined); toast('Seña aplicada como pago parcial'); open({ type: 'ot', id: repairId }); }
    catch (cause) { setError(toActionMessage(cause, 'No se pudo aplicar la seña')); }
    finally { saving.current = false; setBusy(false); }
  };
  const active = rows.filter(depositAvailable);
  return <Sheet title="Aplicar seña a reparación" subtitle={`${order.code} · ${order.clientName}`} className="deposit-sheet" onClose={back}>
    {error && !isNetworkErrorMessage(error) ? <div className="ferr" role="alert">{error}</div> : null}
    {loading ? <ListSkeleton variant="lines" rows={2} /> : null}
    {!loading && !active.length ? <p className="eqs-note">Sin señas para mostrar.</p> : null}
    <p className="eqs-note">Se agrega al anticipo existente de la orden sin registrar otro cobro. Pendiente: {formatMoney(maximum, currency === 'USD' ? 'USD' : 'ARS')} {currency}.</p>
    {active.map(row => {
      const value = depositAmount(row, currency, money.rate);
      const disabled = busy || value == null || value > maximum || order.estimate == null || row.status === 'ACTIVE' && Boolean(row.productId);
      return <div key={row.id} className="deposit-card"><DepositReceipt row={row} /><button type="button" className="btn2 s" aria-pressed={selected === row.id} disabled={disabled} onClick={() => setSelected(row.id)}>{selected === row.id ? 'Seleccionada' : 'Aplicar'}</button>{row.status === 'ACTIVE' && row.productId ? <small>Pasá la reserva a saldo a favor desde la ficha para usarla en una reparación.</small> : null}</div>;
    })}
    {selected ? <Actions busy={busy} primary="Confirmar aplicación" onPrimary={() => { void apply(); }} secondary="Volver" onSecondary={back} /> : <div className="sacts one"><button className="btn2 s" type="button" onClick={back}>Volver</button></div>}
  </Sheet>;
}
