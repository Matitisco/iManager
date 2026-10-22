import { ListSkeleton } from '../list-skeleton';
import { DatePicker } from '../date-picker';
import { isDateValue } from '../date-value';
import { CancelDeposit, DepositReceipt, useClientDeposits } from './deposits';
import { depositAvailable } from '../deposits';
import type { ClientDeposit } from '../../types';
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { INPUT_LIMITS } from '../../lib/input-limits';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchClientPayments, restoreBackendClient, type ClientPaymentRecord, type ClientPatch } from '../../services/clients-api';
import type { Client } from '../../types';
import { formatInputMoney, formatShortDate, parseMoney, paymentLabel } from '../format';
import { useMoney } from '../exchange';
import { FX_WARNING } from '../money';
import { CatalogEditor, catalogChoices, useCatalogs } from '../catalog';
import type { CatalogKind } from '../../services/catalogs-api';
import { usePhoneLayout } from '../section-notices';
import { Actions, Field, Segs, Sheet, SheetActionMenu, SheetActions, useDesk } from '../ui';
import { clearBad, PAYMENTS, BASE_TAGS, stampedCurrency, type FormProps } from './shared';
import { clientCredit, creditTotal } from '../client-balance';
import { ClientPurchases } from '../ClientPurchases';
import { useArchivedRows } from '../use-archived-rows';
import { fetchVoidedSales } from '../../services/sales-api';
import { fetchVoidedTradeIns } from '../../services/trade-ins-api';
import { fetchArchivedInventory } from '../../services/inventory-api';
import { mergeRecordRows } from '../format';
import { archivedClient } from '../archive-cache';
import { RecordHistory } from '../screens/HistoryScreen';

function paymentCaption(payment: ClientPaymentRecord) {
  const label = payment.kind === 'DEVOLUCION' ? 'Devolución'
    : payment.kind === 'SENA' ? 'Cobro de seña'
    : payment.kind === 'CREDITO' ? 'Saldo a favor (sin cobro)'
    : payment.kind === 'APLICACION' ? 'Seña aplicada (sin cobro)'
    : payment.kind === 'CARGO' ? 'Deuda'
    : payment.kind === 'DESCUENTO' ? 'Descuento de deuda'
    : payment.kind === 'NOTA_CREDITO' ? 'Nota de crédito'
    : payment.kind === 'VUELTO' ? 'Vuelto'
    : paymentLabel(payment.method);
  return payment.note && (payment.kind == null || payment.kind === 'PAGO') ? `${label} · ${payment.note}` : label;
}

export function ClientDetail({ id }: { id: string }) {
  const { clients, user, registerClientPayment, sales = [], repairOrders = [], tradeIns = [], inventory = [], commissionSellers = [], loadCommissionSellers, appSession, reloadClients, creditNotes = [] } = useAppContext();
  const voidedSales = useArchivedRows(sales, fetchVoidedSales);
  const voidedTrades = useArchivedRows(tradeIns, fetchVoidedTradeIns);
  const archivedInventory = useArchivedRows(inventory, fetchArchivedInventory);
  const money = useMoney();
  const { close, open, toast, canManageSensitive } = useDesk();
  const phone = usePhoneLayout();
  const deposits = useClientDeposits(id);
  const [cancelTarget, setCancelTarget] = useState<ClientDeposit | null>(null);
  const client = clients.find((item) => item.id === id) ?? archivedClient(id);
  const [method, setMethod] = useState('TRANSFERENCIA');
  const [amount, setAmount] = useState('');
  const [payments, setPayments] = useState<ClientPaymentRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const amountDirty = useRef(false);

  useEffect(() => {
    if (!user || !loadCommissionSellers) return;
    let current = true;
    void loadCommissionSellers().catch((cause: unknown) => {
      if (current) setError(getFriendlyErrorMessage(cause, 'No se pudieron cargar los vendedores'));
    });
    return () => { current = false; };
  }, [user, appSession?.store?.id]);

  const quoteRate = money.rate;
  const activeCurrency = money.active;
  useEffect(() => {
    if (!client || amountDirty.current) return;
    setAmount(money.inputValue(client.pendingBalance, client.balanceCurrency));
  }, [client?.id, client?.pendingBalance, client?.balanceCurrency, quoteRate, activeCurrency]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchClientPayments(user, id)
      .then((rows) => { if (!cancelled) setPayments(rows); })
      .catch(cause => { if (!cancelled) setError(getFriendlyErrorMessage(cause, 'No se pudo cargar el historial de pagos')); });
    return () => { cancelled = true; };
  }, [user, id, client?.pendingBalance, deposits.rows]);

  if (!client) return null;
  if (cancelTarget) return <CancelDeposit row={cancelTarget} onClose={() => setCancelTarget(null)} />;
  const pay = async () => {
    const value = parseMoney(amount);
    const projected = money.number(client.pendingBalance, client.balanceCurrency);
    const stored = projected != null && projected > 0 ? Math.round(value * client.pendingBalance / projected) : value;
    if (amount.includes('-') || value < 0) {
      setError('El pago no puede ser negativo');
      return;
    }
    if (!value) {
      setError('Completá el monto');
      return;
    }
    if (stored > client.pendingBalance) {
      setError('El monto supera el saldo');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await registerClientPayment(client.id, { amount: stored, method, currency: stampedCurrency(client.balanceCurrency) });
      toast('Pago registrado');
      amountDirty.current = false;
      setPaying(false);
      setAmount(money.inputValue(updated.pendingBalance, updated.balanceCurrency));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo registrar el pago.'));
    } finally {
      setBusy(false);
    }
  };
  if (paying) {
    return (
      <Sheet title="Registrar pago" subtitle={client.name} onClose={() => { if (!busy) setPaying(false); }} busy={busy} className="cl-sheet" footer={<Actions busy={busy} primary="Confirmar pago" secondary="Volver" onSecondary={() => { if (!busy) setPaying(false); }} onPrimary={() => { void pay(); }} />}>
        {error && <div className="ferr">{error}</div>}
        <Field label="Monto" mark={money.active}><input aria-label="Monto" value={amount} inputMode="decimal" placeholder="$ 0" onChange={(event) => {
          amountDirty.current = true;
          const raw = event.target.value;
          if (raw.includes('-')) {
            setAmount(raw);
            setError('El pago no puede ser negativo');
            return;
          }
          setAmount(formatInputMoney(parseMoney(raw)));
          setError(null);
        }} /></Field>
        <Field label="Forma de pago"><span /></Field>
        <Segs options={PAYMENTS} value={method} onChange={setMethod} />
      </Sheet>
    );
  }
  const bought = client.lastPurchaseDate && client.lastPurchaseDate !== 'N/A';
  const dniNote = client.dni ? ` · DNI ${client.dni}` : '';
  const credit = !deposits.loading && !deposits.error ? creditTotal(deposits.rows, client.balanceCurrency ?? null) : clientCredit(client);
  const net = client.pendingBalance - credit;
  return (
    <Sheet title={client.name} subtitle={bought ? `Última compra ${formatShortDate(client.lastPurchaseDate)}${dniNote}` : `Sin compras todavía${dniNote}`} onClose={close} busy={busy} className="cl-sheet" footer={<SheetActions>
      <button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button>
      <SheetActionMenu>
        <button className="btn2 s" type="button" disabled={busy} onClick={() => open({ type: 'new-deposit', id: client.id })}>Agregar seña</button>
        {phone ? <button className="btn2 s" type="button" disabled={busy} onClick={() => open({ type: 'edit-cl', id: client.id })}>Editar</button> : null}
        {client.pendingBalance > 0 ? <button className="btn2 s" type="button" disabled={busy} onClick={() => open({ type: 'new-sale', clientName: client.name, clientId: client.id, source: 'clients' })}>Nueva venta</button> : null}
        {canManageSensitive && !client.archivedAt ? <button className="btn2 danger" type="button" disabled={busy} onClick={() => open({ type: 'del', kind: 'cl', id: client.id, label: client.name })}>Archivar</button> : null}
      </SheetActionMenu>
      {client.pendingBalance > 0
        ? <button className="btn2 p sheet-primary" type="button" disabled={busy} onClick={() => setPaying(true)}>{busy ? 'Guardando…' : 'Registrar pago'}</button>
        : <button className="btn2 p sheet-primary" type="button" disabled={busy} onClick={() => open({ type: 'new-sale', clientName: client.name, clientId: client.id, source: 'clients' })}>Nueva venta</button>}
    </SheetActions>}>
      {error && <div className="ferr">{error}</div>}
      {client.archivedAt ? <div className="pending-sale" data-testid="archived-banner"><div><b>Archivado</b><small>{client.archivedBy ? `por ${client.archivedBy}` : 'Este cliente está archivado'}</small></div><button type="button" disabled={busy} onClick={async () => { if (!user) return; setBusy(true); try { await restoreBackendClient(user, client.id); await reloadClients(); toast('Cliente restaurado'); close(); } catch (cause) { setError(getFriendlyErrorMessage(cause, 'No se pudo restaurar.')); } finally { setBusy(false); } }}>Restaurar</button></div> : null}
      <RecordHistory entityType="client" entityId={client.id} />
      <div className="dhero"><div className="eb">{net < 0 ? 'Saldo a favor' : 'Saldo pendiente'}</div><div className="big">{money.show(Math.abs(net), client.balanceCurrency)}</div></div>
      {credit > 0 ? (
        <>
          <div className="kv"><span>Deuda</span><b>{money.show(client.pendingBalance, client.balanceCurrency)}</b></div>
          <div className="kv"><span>Saldo a favor</span><b>{money.show(credit, client.balanceCurrency)}</b></div>
        </>
      ) : null}
      <div className="kv"><span>Teléfono</span><b>{client.phone || '-'}</b></div>
      <div className="kv"><span>Instagram</span><b>{client.instagram ? `@${client.instagram.replace(/^@/, '')}` : '-'}</b></div>
      <div className="kv"><span>Email</span><b>{client.email || '-'}</b></div>
      {(creditNotes ?? []).filter((note) => note.clientId === client.id && note.remaining > 0 && !note.deletedAt).map((note) => (
        <div className="kv" key={note.id} data-testid="client-credit-note"><span>Nota de crédito {note.code}</span><b>{money.show(note.remaining, note.currency)}</b></div>
      ))}
      {voidedSales.error || voidedTrades.error || archivedInventory.error ? <div className="ferr" role="alert">{voidedSales.error || voidedTrades.error || archivedInventory.error}</div> : null}
      {voidedSales.loading || voidedTrades.loading || archivedInventory.loading ? <ListSkeleton variant="lines" rows={3} /> : null}
      <ClientPurchases key={client.id} clientId={client.id} clientName={client.name} sales={mergeRecordRows(sales, voidedSales.rows)} tradeIns={mergeRecordRows(tradeIns, voidedTrades.rows)} repairs={repairOrders} inventory={mergeRecordRows(inventory, archivedInventory.rows)} sellers={commissionSellers} />
      <section className="deposit-list" aria-label="Historial de señas">
        <h4>Señas y saldo a favor</h4>
        {deposits.loading ? <ListSkeleton variant="lines" rows={2} /> : null}
        {deposits.error ? <div className="ferr" role="alert">{deposits.error}<button type="button" className="wlink" onClick={deposits.retry}>Reintentar señas</button></div> : null}
        {!deposits.loading && !deposits.error && !deposits.rows.length ? <p className="eqs-note">Todavía no tiene señas.</p> : null}
        {deposits.rows.map(row => <div className="deposit-card" key={row.id}><DepositReceipt row={row} />{canManageSensitive && depositAvailable(row) ? <button className="btn2 s" type="button" onClick={() => setCancelTarget(row)}>{row.status === 'CREDIT' ? 'Devolver saldo a favor' : 'Cancelar seña'}</button> : null}</div>)}
      </section>
      {payments.length > 0 ? (
        <>
          <Field label="Pagos"><span /></Field>
          {payments.map((payment) => (
            <div className="kv" key={payment.id}><span>{formatShortDate(payment.paidAt)} · {paymentCaption(payment)}</span><b>{money.show(payment.amount, payment.currency ?? client.balanceCurrency)}</b></div>
          ))}
        </>
      ) : null}
    </Sheet>
  );
}

export function ClientForm({ id, run, busy, error }: FormProps & { id?: string }) {
  const { clients, addClient, updateClient } = useAppContext();
  const money = useMoney();
  const { close } = useDesk();
  const catalogs = useCatalogs();
  const [editor, setEditor] = useState<CatalogKind | null>(null);
  const current = clients.find((item) => item.id === id);
  const tags = catalogChoices(catalogs?.options ?? [], 'CLIENT_TAG', BASE_TAGS);
  const [name, setName] = useState(current?.name ?? '');
  const [dni, setDni] = useState(current?.dni ?? '');
  const [phone, setPhone] = useState(current?.phone ?? '');
  const [instagram, setInstagram] = useState(current?.instagram ?? '');
  const [email, setEmail] = useState(current?.email ?? '');
  const [balance, setBalance] = useState(current ? money.inputValue(current.pendingBalance, current.balanceCurrency) : '');
  const [initial] = useState(current);
  const [initialBalance] = useState(balance);
  const balanceEdited = balance !== initialBalance;
  const [tag, setTag] = useState(current?.tag ?? '');
  const [birthday, setBirthday] = useState(current?.birthday ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});

  return (
    <Sheet title={current ? 'Editar cliente' : 'Nuevo cliente'} onClose={close} busy={busy} className="cl-sheet">
      {error && <div className="ferr">{error}</div>}
      <Field label="Nombre y apellido" error={bad.name}><input value={name} placeholder="Ej. Ana Gómez" onChange={(event) => { setName(event.target.value); clearBad(setBad, 'name'); }} /></Field>
      {current ? (
        <Field label="Teléfono"><input value={phone} placeholder="Ej. 11 5555 5555" onChange={(event) => setPhone(event.target.value)} /></Field>
      ) : (
        <div className="frow">
          <Field label="DNI" error={bad.dni}><input value={dni} placeholder="Sin puntos" onChange={(event) => { setDni(event.target.value); clearBad(setBad, 'dni'); }} /></Field>
          <Field label="Teléfono"><input value={phone} placeholder="Ej. 11 5555 5555" onChange={(event) => setPhone(event.target.value)} /></Field>
        </div>
      )}
      <Field label="Email"><input value={email} placeholder="ana@correo.com" onChange={(event) => setEmail(event.target.value)} /></Field>
      <DatePicker label="Cumpleaños" value={birthday} onChange={(value) => { setBirthday(value); clearBad(setBad, 'birthday'); }} error={bad.birthday} disabled={busy} />
      <Field label="Instagram"><input value={instagram} placeholder="@usuario" onChange={(event) => setInstagram(event.target.value)} /></Field>
      {current ? <Field label="Saldo pendiente" mark={money.active} error={bad.balance}><input value={balance} inputMode="numeric" placeholder="$ 0" onChange={(event) => { setBalance(formatInputMoney(parseMoney(event.target.value))); clearBad(setBad, 'balance'); }} /></Field> : null}
      <Field label="Etiqueta"><span /></Field>
      <Segs options={tags} value={tag} onChange={setTag} allowClear onEdit={catalogs?.canEdit ? () => setEditor('CLIENT_TAG') : undefined} />
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
      <Actions busy={busy} primary={current ? 'Guardar cambios' : 'Guardar cliente'} onSecondary={close} onPrimary={() => {
        const next: Record<string, string> = {};
        if (birthday && !isDateValue(birthday)) next.birthday = 'Ingresá una fecha válida.';
        if (!name.trim()) next.name = 'Completá este dato';
        else if (name.trim().length > INPUT_LIMITS.clientName) next.name = `El nombre puede tener hasta ${INPUT_LIMITS.clientName} caracteres`;
        const priced = current && balanceEdited
          ? money.commitGroup([{ typed: parseMoney(balance), original: (initial ?? current).pendingBalance, currency: (initial ?? current).balanceCurrency }])
          : { blocked: false, amounts: [{ amount: 0, currency: null as string | null }] };
        if (priced.blocked) next.balance = FX_WARNING;
        setBad(next);
        if (Object.keys(next).length) return;
        void run(async () => {
        const payload: Omit<Client, 'id'> = {
          name: name.trim(),
          dni: dni.trim(),
          phone: phone.trim(),
          instagram: instagram.trim(),
          email: email.trim(),
          lastPurchaseDate: current?.lastPurchaseDate || 'N/A',
          totalSpent: current?.totalSpent ?? 0,
          pendingBalance: priced.amounts[0]?.amount ?? 0,
          balanceCurrency: priced.amounts[0]?.currency ?? null,
          tag: tag || null,
          birthday: birthday || null,
          categoryId: current?.categoryId,
          customFields: current?.customFields,
        };
        if (current) {
          const patch: ClientPatch = { id: current.id };
          const original = initial ?? current;
          for (const field of ['name', 'dni', 'phone', 'instagram', 'email', 'tag', 'birthday'] as const) {
            if ((payload[field] ?? '') !== (original[field] ?? '')) Object.assign(patch, { [field]: payload[field] });
          }
          if (balanceEdited && (priced.amounts[0]?.amount !== original.pendingBalance || (priced.amounts[0]?.currency ?? null) !== (original.balanceCurrency ?? null))) {
            patch.pendingBalance = priced.amounts[0]?.amount ?? 0;
            patch.balanceCurrency = priced.amounts[0]?.currency ?? null;
          }
          await updateClient(patch);
        } else await addClient(payload);
      }, current ? 'Cliente actualizado' : 'Cliente guardado');
      }} />
    </Sheet>
  );
}
