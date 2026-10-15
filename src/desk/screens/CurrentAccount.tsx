import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { whatsappLink } from '../../catalog/presentation';
import { toUserMessage } from '../../lib/user-message';
import { collectAccount, createAccountMovement, fetchDebtors, fetchFollowUps, fetchSaleAccount, saveFollowUpSettings, type Debtor, type FollowUpCard, type FollowUpSettings, type SaleAccount } from '../../services/accounts-api';
import { useMoney } from '../exchange';
import { formatInputMoney, parseMoney, paymentLabel } from '../format';
import { Actions, Field, Segs, Sheet, useDesk } from '../ui';
import { PAYMENTS } from '../overlays/shared';

const TONE_LABEL = { verde: 'Menos de 7 días', amarillo: '7 a 30 días', rojo: 'Más de 30 días' };
const STATE_LABEL = { ABIERTA: 'Abierta', NOTA_CREDITO: 'Nota de crédito' };
const INSTALLMENT_LABEL: Record<string, string> = { PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', PAGADA: 'Pagada', VENCIDA: 'Vencida' };
const FOLLOW_MESSAGE: Record<FollowUpCard['kind'], (card: FollowUpCard) => string> = {
  CUMPLEANOS: (card) => `Hola ${card.name}, ¡feliz cumpleaños!`,
  GARANTIA: (card) => `Hola ${card.name}, te escribo porque se acerca el vencimiento de la garantía. ${card.detail}`,
  DEUDA: (card) => `Hola ${card.name}, te escribo por el saldo pendiente.`,
  INACTIVO: (card) => `Hola ${card.name}, hace un tiempo que no nos vemos. ¿Te ayudo con algo?`,
};

function useReload() {
  const { reloadClients, reloadSales } = useAppContext();
  return async () => {
    await reloadClients?.();
    await reloadSales?.();
  };
}

export function SaleAccountPanel({ saleId, revision = '', onDue }: { saleId: string; revision?: string; onDue?: (due: number) => void }) {
  const { user } = useAppContext();
  const money = useMoney();
  const [account, setAccount] = useState<SaleAccount | null>(null);
  const [refresh, setRefresh] = useState(0);
  const onDueRef = useRef(onDue);
  onDueRef.current = onDue;
  useEffect(() => {
    const refreshDue = () => { if (document.visibilityState === 'visible') setRefresh((value) => value + 1); };
    document.addEventListener('visibilitychange', refreshDue);
    return () => document.removeEventListener('visibilitychange', refreshDue);
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchSaleAccount(user, saleId).then((data) => {
      if (!active) return;
      if (typeof data?.due === 'number') onDueRef.current?.(data.due);
      if (Array.isArray(data?.installments) && Array.isArray(data?.tenders)) setAccount(data);
    }).catch(() => { if (active) setAccount(null); });
    return () => { active = false; };
  }, [user, saleId, revision, refresh]);
  if (!account || (!account.installments.length && !account.tenders.length)) return null;
  return (
    <section className="acct-plan" aria-label="Cuotas y pagos">
      {account.tenders.length ? account.tenders.map((tender) => <div className="kv" key={tender.id}><span>{tender.role === 'VUELTO' ? 'Vuelto' : 'Pago'} · {paymentLabel(tender.method)}</span><b>{money.show(tender.amount, tender.currency)}</b></div>) : null}
      {account.plan ? <p className="eqs-note">{account.plan.count} cuotas {account.plan.frequency.toLowerCase()} · primer vencimiento {account.plan.firstDueDate.split('-').reverse().join('/')}{account.plan.surcharge ? ` · recargo ${money.show(account.plan.surcharge, null)}` : ''}</p> : null}
      {account.installments.map((item) => <div className="kv" key={item.sequence}><span>Cuota {item.sequence} · {(item.dueDate || '').split('-').reverse().join('/')} · {INSTALLMENT_LABEL[item.status] ?? item.status}</span><b>{money.show(Math.max(0, item.amount - item.paidAmount), null)}</b></div>)}
      <p className="eqs-note">El pago se aplica primero a la cuota impaga más antigua.</p>
    </section>
  );
}

export function AccountCurrent({ query }: { query: string }) {
  const { user } = useAppContext();
  const { canManageSensitive = true, toast } = useDesk();
  const money = useMoney();
  const reload = useReload();
  const [rows, setRows] = useState<Debtor[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Debtor | null>(null);
  const [mode, setMode] = useState<'pago' | 'deuda' | 'descuento' | null>(null);

  const load = () => {
    if (!user) return;
    setLoading(true);
    fetchDebtors(user).then((data) => { setRows(data.debtors); setError(''); }).catch((cause: unknown) => setError(toUserMessage(cause, 'No se pudo cargar la cuenta corriente'))).finally(() => setLoading(false));
  };
  useEffect(load, [user]);

  const q = query.trim().toLowerCase();
  const visible = rows.filter((row) => !q || row.name.toLowerCase().includes(q) || row.phone.includes(q));
  return (
    <section className="acct-screen" aria-label="Cuenta corriente" data-testid="account-current">
      <p className="eqs-note">Ventas abiertas, reparaciones con saldo y deudas manuales. El semáforo mira la deuda más antigua: verde menos de 7 días, amarillo de 7 a 30, rojo después.</p>
      {error ? <div className="ferr" role="alert">{error}<button className="wlink" type="button" onClick={load}>Reintentar</button></div> : null}
      {loading ? <p className="eqs-note" role="status">Cargando cuenta corriente…</p> : null}
      {!loading && !visible.length ? <div className="wempty">Nadie tiene saldo pendiente.</div> : null}
      <div className="acct-list">
        {visible.map((row) => {
          const link = whatsappLink(row.phone, row.statement);
          return (
            <article className="acct-card" key={row.clientId} data-testid={`debtor-${row.clientId}`}>
              <div className="acct-head">
                <span className={`acct-tone ${row.tone}`}>{TONE_LABEL[row.tone]}</span>
                <div>
                  <b>{row.name}</b>
                  <small>{row.days} días</small>
                </div>
                <strong data-testid={`account-balance-${row.clientId}`}>{accountHeadline(row.pendingBalance - (row.creditBalance ?? 0), row.currency, money.show)}</strong>
              </div>
              {row.repairBalance > 0 ? <p className="eqs-note">Reparaciones {money.show(row.repairBalance, row.currency)}. Ese saldo no se suma al de la cuenta.</p> : null}
              {row.creditBalance > 0 ? <p className="eqs-note">Saldo a favor {money.show(row.creditBalance, row.currency)}</p> : null}
              <div className="acct-lines">
                {row.lines.map((line) => (
                  <div className="acct-line" key={line.id}>
                    <span><b>{line.label}</b> · {STATE_LABEL[line.state]} · {line.days} días</span>
                    <span>{money.show(line.amount, line.currency)}</span>
                    {line.installments.length ? <ul className="acct-installments">{line.installments.map((item) => <li key={item.sequence}>Cuota {item.sequence} · {item.dueDate.split('-').reverse().join('/')} · {INSTALLMENT_LABEL[item.status] ?? item.status} · {money.show(item.amount - item.paidAmount, line.currency)}</li>)}</ul> : null}
                  </div>
                ))}
              </div>
              <p className="eqs-note">El pago se aplica primero a la cuota impaga más antigua.</p>
              <div className="acct-actions">
                {canManageSensitive ? <button className="btn2 s" type="button" onClick={() => { setTarget(row); setMode('pago'); }}>Registrar pago</button> : null}
                {canManageSensitive ? <button className="btn2 s" type="button" onClick={() => { setTarget(row); setMode('deuda'); }}>Agregar deuda</button> : null}
                {canManageSensitive ? <button className="btn2 s" type="button" onClick={() => { setTarget(row); setMode('descuento'); }}>Descontar deuda</button> : null}
                {link ? <a className="btn2 p" href={link} target="_blank" rel="noopener noreferrer">Enviar estado de cuenta</a> : <span className="eqs-note">Sin WhatsApp</span>}
              </div>
            </article>
          );
        })}
      </div>
      {target && mode ? <MovementSheet row={target} mode={mode} onClose={() => setMode(null)} onSaved={(message) => { setMode(null); toast(message); load(); void reload(); }} /> : null}
    </section>
  );
}

function accountHeadline(net: number, currency: string | null, show: (amount: number, currency?: string | null) => string) {
  if (net < 0) return `A favor ${show(Math.abs(net), currency)}`;
  return show(net, currency);
}

function MovementSheet({ row, mode, onClose, onSaved }: { row: Debtor; mode: 'pago' | 'deuda' | 'descuento'; onClose: () => void; onSaved: (message: string) => void }) {
  const { user } = useAppContext();
  const payable = row.lines.filter((line) => line.saleId || line.repairId);
  const sales = payable.filter((line) => line.saleId);
  const [choice, setChoice] = useState(sales[0]?.id ?? payable[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('EFECTIVO');
  const [credit, setCredit] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = mode === 'pago' ? 'Registrar pago' : mode === 'deuda' ? 'Agregar deuda' : 'Descontar deuda';
  const selected = payable.find((line) => line.id === choice);
  const save = async () => {
    if (!user) return;
    const value = parseMoney(amount);
    if (!(value > 0)) { setError('El monto tiene que ser mayor a cero'); return; }
    setBusy(true);
    setError('');
    try {
      if (mode === 'pago') {
        if (!selected) throw new Error('Elegí la venta o la reparación');
        await collectAccount(user, { clientId: row.clientId, saleId: selected.saleId, repairId: selected.repairId, amount: value, method, currency: (selected.currency === 'USD' || selected.currency === 'ARS' ? selected.currency : row.currency) as 'ARS' | 'USD' | null });
        onSaved('Pago registrado');
      } else if (mode === 'deuda') {
        await createAccountMovement(user, row.clientId, { kind: 'CARGO', amount: value, note, currency: row.currency });
        onSaved('Deuda agregada');
      } else {
        await createAccountMovement(user, row.clientId, { kind: credit && selected?.saleId ? 'NOTA_CREDITO' : 'DESCUENTO', amount: value, note, saleId: credit ? selected?.saleId : null, currency: row.currency });
        onSaved(credit ? 'Nota de crédito registrada' : 'Deuda descontada');
      }
    } catch (cause) {
      setError(toUserMessage(cause, 'No se pudo guardar'));
      setBusy(false);
    }
  };
  return (
    <Sheet title={title} subtitle={row.name} onClose={() => { if (!busy) onClose(); }}>
      {error ? <div className="ferr" role="alert">{error}</div> : null}
      {mode === 'pago' ? (
        payable.length ? payable.map((line) => (
          <label className="op-check" key={line.id}><input type="radio" name="account-target" checked={choice === line.id} onChange={() => setChoice(line.id)} />{line.label} · {STATE_LABEL[line.state]}</label>
        )) : <p className="eqs-note">No hay una venta ni una reparación abierta. Agregá o descontá el saldo manual.</p>
      ) : null}
      <Field label="Monto"><input aria-label="Monto" inputMode="numeric" value={amount} placeholder="$ 0" onChange={(event) => setAmount(formatInputMoney(parseMoney(event.target.value)))} /></Field>
      {mode === 'pago' ? <><Field label="Medio de pago"><span /></Field><Segs options={PAYMENTS} value={method} onChange={setMethod} /><p className="eqs-note">Medio {paymentLabel(method)}. El pago entra a la cuota impaga más antigua.</p></> : <Field label="Nota"><input aria-label="Nota" value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} /></Field>}
      {mode === 'descuento' && sales.length ? (
        <>
          {sales.map((line) => (
            <label className="op-check" key={line.id}><input type="radio" name="credit-sale" checked={choice === line.id} onChange={() => setChoice(line.id)} />{line.label}</label>
          ))}
          <label className="op-check"><input type="checkbox" checked={credit} onChange={(event) => setCredit(event.target.checked)} />Nota de crédito de la venta elegida. No mueve el stock.</label>
        </>
      ) : null}
      <Actions busy={busy} primary={title} onPrimary={() => { void save(); }} onSecondary={onClose} secondary="Cerrar" />
    </Sheet>
  );
}

export function FollowUps() {
  const { user } = useAppContext();
  const { toast } = useDesk();
  const [cards, setCards] = useState<FollowUpCard[]>([]);
  const [settings, setSettings] = useState<FollowUpSettings | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const load = () => {
    if (!user) return;
    setLoading(true);
    fetchFollowUps(user).then((data) => { setCards(data.cards); setSettings(data.settings); setError(''); }).catch((cause: unknown) => setError(toUserMessage(cause, 'No se pudieron cargar los seguimientos'))).finally(() => setLoading(false));
  };
  useEffect(load, [user]);
  return (
    <section className="acct-screen" aria-label="Seguimientos" data-testid="follow-ups">
      <div className="acct-head">
        <div><b>A quién escribir hoy</b><small>Cumpleaños, garantías, deudas y clientes que hace tiempo no compran.</small></div>
        <button className="btn2 s" type="button" onClick={() => setEditing(true)}>Reglas</button>
      </div>
      {error ? <div className="ferr" role="alert">{error}<button className="wlink" type="button" onClick={load}>Reintentar</button></div> : null}
      {loading ? <p className="eqs-note" role="status">Cargando seguimientos…</p> : null}
      {!loading && !cards.length ? <div className="wempty">Hoy no hay a quién escribir.</div> : null}
      <div className="acct-list">
        {cards.map((card) => {
          const link = whatsappLink(card.phone, FOLLOW_MESSAGE[card.kind](card));
          return (
            <article className="acct-card" key={card.id} data-testid={`follow-${card.kind}`}>
              <div className="acct-head"><div><b>{card.title}</b><small>{card.detail}</small></div></div>
              {link ? <a className="btn2 p" href={link} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a> : <p className="eqs-note">Sin WhatsApp</p>}
            </article>
          );
        })}
      </div>
      {editing && settings ? <FollowSettings initial={settings} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast('Reglas guardadas'); load(); }} /> : null}
    </section>
  );
}

function FollowSettings({ initial, onClose, onSaved }: { initial: FollowUpSettings; onClose: () => void; onSaved: () => void }) {
  const { user } = useAppContext();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<FollowUpSettings>) => setForm((current) => ({ ...current, ...patch }));
  const save = async () => {
    if (!user) return;
    setBusy(true);
    setError('');
    try { await saveFollowUpSettings(user, form); onSaved(); }
    catch (cause) { setError(toUserMessage(cause, 'No se pudieron guardar las reglas')); setBusy(false); }
  };
  return (
    <Sheet title="Reglas de seguimiento" onClose={() => { if (!busy) onClose(); }}>
      {error ? <div className="ferr" role="alert">{error}</div> : null}
      <Field label="Días de anticipación del cumpleaños"><input aria-label="Anticipación del cumpleaños" inputMode="numeric" value={String(form.birthdayLeadDays)} onChange={(event) => set({ birthdayLeadDays: Number(event.target.value.replace(/\D/g, '') || 0) })} /></Field>
      <Field label="Días de anticipación de la garantía"><input aria-label="Anticipación de la garantía" inputMode="numeric" value={String(form.warrantyLeadDays)} onChange={(event) => set({ warrantyLeadDays: Number(event.target.value.replace(/\D/g, '') || 0) })} /></Field>
      <Field label="Días sin comprar"><input aria-label="Días sin comprar" inputMode="numeric" value={String(form.inactiveDays)} onChange={(event) => set({ inactiveDays: Number(event.target.value.replace(/\D/g, '') || 0) })} /></Field>
      <label className="op-check"><input type="checkbox" checked={form.includeDebts} onChange={(event) => set({ includeDebts: event.target.checked })} />Incluir deudas pendientes</label>
      <p className="eqs-note">El cumpleaños se carga en la ficha del cliente. La garantía es la de cada venta. El recordatorio automático queda para más adelante: acá solo se abre WhatsApp.</p>
      <Actions busy={busy} primary="Guardar reglas" onPrimary={() => { void save(); }} onSecondary={onClose} secondary="Cerrar" />
    </Sheet>
  );
}
