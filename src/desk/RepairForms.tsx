import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { ClientField } from './ClientField';
import { CatalogEditor, catalogChoices, useCatalogs } from './catalog';
import type { CatalogKind } from '../services/catalogs-api';
import { useMoney } from './exchange';
import { formatInputMoney, formatShortDate, parseMoney } from './format';
import { IMEI_FORMAT_MESSAGE, IMEI_OPTIONAL_LABEL, imeiFormatError } from '../lib/imei';
import { getFriendlyErrorMessage } from '../lib/utils';
import { FX_WARNING } from './money';
import { ReportDatePicker } from './report-date-picker';
import { dayMonth, DEFAULT_REPAIR_STATUSES, REPAIR_FAULTS, REPAIR_READY, REPAIR_RECEIVED, repairFault, repairOverdue, repairPrice, repairStatusMeta } from './repairs';
import { usePhoneLayout } from './section-notices';
import { Actions, Dialog, Field, Pill, Segs, Sheet, useDesk } from './ui';

function moneyInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return formatInputMoney(Number(digits)) || '0';
}

function isoDate(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value.trim();
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function RepairOrderForm({ busy, error }: { busy: boolean; error: string | null }) {
  const { clients, addRepairOrder } = useAppContext();
  const money = useMoney();
  const { close, toast } = useDesk();
  const catalogs = useCatalogs();
  const isPhone = usePhoneLayout();
  const statuses = catalogChoices(catalogs?.options ?? [], 'REPAIR_STATUS', DEFAULT_REPAIR_STATUSES);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [device, setDevice] = useState('');
  const [imei, setImei] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [fault, setFault] = useState('');
  const [estimate, setEstimate] = useState('');
  const [deposit, setDeposit] = useState('0');
  const [delivery, setDelivery] = useState('');
  const [technician, setTechnician] = useState('');
  const [status, setStatus] = useState(REPAIR_RECEIVED);
  const [bad, setBad] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<CatalogKind | null>(null);

  const toggleTag = (tag: string) => {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
    setBad((current) => ({ ...current, fault: '' }));
  };

  const save = async () => {
    const next: Record<string, string> = {};
    if (!clientName.trim()) next.client = 'Completá este dato';
    if (!device.trim()) next.device = 'Completá este dato';
    if (imeiFormatError(imei)) next.imei = IMEI_FORMAT_MESSAGE;
    if (!fault.trim() && tags.length === 0) next.fault = 'Contá la falla';
    setBad(next);
    if (Object.keys(next).length || !addRepairOrder) return;
    setSaving(true);
    try {
      await addRepairOrder({
        clientId: clientId || null,
        clientName: clientName.trim(),
        device: device.trim(),
        imei,
        fault: fault.trim(),
        faultTags: tags,
        estimate: estimate.trim() ? parseMoney(estimate) : null,
        deposit: parseMoney(deposit),
        currency: money.active,
        technician: technician.trim(),
        status: status || REPAIR_RECEIVED,
        estimatedDelivery: delivery ? isoDate(delivery) : null,
      });
      close();
      toast('Orden creada');
    } catch (err) {
      setBad((current) => ({ ...current, form: err instanceof Error ? err.message : 'No se pudo crear la orden' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet wide className="svc-sheet" title="Nueva orden de reparación" subtitle={isPhone ? 'Arranca en «Recibido».' : undefined} onClose={close}>
      {error || bad.form ? <div className="ferr">{error || bad.form}</div> : null}
      <div className="svc-grid">
        <div>
          <ClientField
            clients={clients}
            value={clientName}
            linked={Boolean(clientId)}
            error={bad.client}
            onValue={(value) => { setClientName(value); setClientId(''); setBad((current) => ({ ...current, client: '' })); }}
            onPick={(client) => { setClientName(client.name); setClientId(client.id); setBad((current) => ({ ...current, client: '' })); }}
          />
          <div className="frow">
            <Field label="Equipo" error={bad.device}>
              <input value={device} maxLength={120} placeholder="iPhone 13" onChange={(event) => { setDevice(event.target.value); setBad((current) => ({ ...current, device: '' })); }} />
            </Field>
            <Field label={IMEI_OPTIONAL_LABEL} error={bad.imei}>
              <input value={imei} inputMode="numeric" maxLength={15} placeholder="15 dígitos" onChange={(event) => { setImei(event.target.value.replace(/\D/g, '').slice(0, 15)); setBad((current) => ({ ...current, imei: '' })); }} />
            </Field>
          </div>
          <Field label="Falla reportada" error={bad.fault}><span /></Field>
          <div className="svc-faults">
            {REPAIR_FAULTS.map((tag) => (
              <button key={tag} type="button" className={tags.includes(tag) ? 'on' : ''} aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)}>{tag}</button>
            ))}
          </div>
          <label className={`fl${bad.fault ? ' bad' : ''}`}>
            <textarea className="svc-note" value={fault} maxLength={2000} placeholder="Contá qué le pasa al equipo, cómo llegó, si tiene clave, accesorios que deja, etc." onChange={(event) => { setFault(event.target.value); setBad((current) => ({ ...current, fault: '' })); }} />
          </label>
        </div>
        <div>
          <div className="frow">
            <Field label="Presupuesto estimado" mark={money.active}>
              <input value={estimate} inputMode="numeric" placeholder="Opcional" onChange={(event) => setEstimate(moneyInput(event.target.value))} />
            </Field>
            <Field label="Seña" mark={money.active}>
              <input value={deposit} inputMode="numeric" placeholder="$ 0" onChange={(event) => setDeposit(moneyInput(event.target.value))} />
            </Field>
          </div>
          <div className="frow">
            <ReportDatePicker label="Entrega estimada" value={delivery} onChange={setDelivery} />
            <Field label="Técnico">
              <input value={technician} maxLength={120} placeholder="Técnico Ejemplo" onChange={(event) => setTechnician(event.target.value)} />
            </Field>
          </div>
          <Field label="Estado"><span /></Field>
          <Segs options={statuses} value={status} onChange={setStatus} onEdit={catalogs?.canEdit ? () => setEditor('REPAIR_STATUS') : undefined} />
        </div>
      </div>
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
      <Actions busy={busy || saving} primary="Crear orden" onSecondary={close} onPrimary={() => { void save(); }} />
    </Sheet>
  );
}

const MONEY_CAP = 100_000_000;

function storedCurrency(value: string | null | undefined): 'ARS' | 'USD' | null {
  if (value === 'ARS' || value === 'USD') return value;
  return null;
}

export function RepairOrderDetail({ id, busy }: { id: string; busy: boolean }) {
  const { repairOrders = [], changeRepairStatus, updateRepairOrder, deleteRepairOrder } = useAppContext();
  const money = useMoney();
  const { close, toast, canManageSensitive = true } = useDesk();
  const catalogs = useCatalogs();
  const phone = usePhoneLayout();
  const order = repairOrders.find((item) => item.id === id);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [estimate, setEstimate] = useState('');
  const [deposit, setDeposit] = useState('');
  const [bad, setBad] = useState<Record<string, string>>({});
  const statuses = catalogChoices(catalogs?.options ?? [], 'REPAIR_STATUS', DEFAULT_REPAIR_STATUSES);
  if (!order) {
    return (
      <Sheet className="svc-sheet" title="Orden" onClose={close}>
        <p className="sub">No encontré esta orden.</p>
        <Actions busy={busy} primary="Cerrar" secondary="Volver" onSecondary={close} onPrimary={close} />
      </Sheet>
    );
  }
  const index = statuses.findIndex((status) => status.id === order.status);
  const next = index >= 0 ? statuses[index + 1] : undefined;
  const show = (value: number) => money.show(value, order.currency);
  const startEdit = () => {
    setEstimate(order.estimate == null ? '' : money.inputValue(order.estimate, order.currency));
    setDeposit(money.inputValue(order.deposit, order.currency));
    setBad({});
    setError('');
    setEditing(true);
  };
  const advance = async () => {
    if (!next || !changeRepairStatus) return;
    setError('');
    setSaving(true);
    try {
      const saved = await changeRepairStatus(order.id, next.id);
      if (order.status !== REPAIR_READY && saved.status === REPAIR_READY) {
        if (saved.whatsappUrl) window.open(saved.whatsappUrl, '_blank', 'noopener,noreferrer');
        else if (saved.notifyWhatsapp) toast('La orden está lista, pero el cliente no tiene teléfono para WhatsApp.');
      }
      toast(`Pasó a ${repairStatusMeta(saved.status, statuses).label}`);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo cambiar el estado'));
    } finally {
      setSaving(false);
    }
  };
  const saveBudget = async () => {
    const typedEstimate = estimate.trim() ? parseMoney(estimate) : null;
    const typedDeposit = parseMoney(deposit);
    const nextBad: Record<string, string> = {};
    if (typedEstimate != null && typedEstimate > MONEY_CAP) nextBad.estimate = 'El presupuesto es demasiado alto';
    if (typedDeposit > MONEY_CAP) nextBad.deposit = 'La seña es demasiado alta';
    setBad(nextBad);
    if (Object.keys(nextBad).length || !updateRepairOrder) return;
    const group = money.commitGroup([
      { typed: typedEstimate ?? 0, original: order.estimate ?? 0, currency: order.currency },
      { typed: typedDeposit, original: order.deposit, currency: order.currency },
    ]);
    if (group.blocked) {
      setError(FX_WARNING);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await updateRepairOrder(order.id, {
        estimate: typedEstimate == null ? null : group.amounts[0]?.amount ?? typedEstimate,
        deposit: group.amounts[1]?.amount ?? typedDeposit,
        currency: storedCurrency(group.amounts[0]?.currency ?? group.amounts[1]?.currency ?? order.currency),
      });
      setEditing(false);
      toast('Presupuesto actualizado');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar el presupuesto'));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!deleteRepairOrder) return;
    setError('');
    setSaving(true);
    try {
      await deleteRepairOrder(order.id);
      setConfirmDelete(false);
      close();
      toast('Orden eliminada');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo borrar la orden'));
    } finally {
      setSaving(false);
    }
  };

  if (!phone) return (
    <>
      <Sheet className="svc-sheet" title={`#${order.code} · ${order.device}`} subtitle={`Ingresó el ${dayMonth(order.receivedAt) || formatShortDate(order.receivedAt)}${order.estimatedDelivery ? ` · entrega estimada ${dayMonth(order.estimatedDelivery)}` : ''}`} onClose={close}>
        <div className="svc-steps" aria-hidden="true">
          {statuses.map((status, step) => <i key={status.id} className={index >= 0 && step <= index ? 'on' : ''} />)}
        </div>
        <div className="svc-now">
          <Pill status={order.status} kind="REPAIR_STATUS" />
          {next ? <span>Sigue: {next.label}</span> : null}
        </div>
        {error && !confirmDelete ? <div className="ferr">{error}</div> : null}
        <div className="kv"><span>Cliente</span><b>{order.clientName}</b></div>
        <div className="kv"><span>IMEI</span><b>{order.imei || '—'}</b></div>
        <div className="kv"><span>Falla</span><b>{repairFault(order)}</b></div>
        {editing ? (
          <div className="svc-edit">
            <div className="frow">
              <Field label="Presupuesto" mark={money.active} error={bad.estimate}>
                <input id="repair-estimate" data-testid="repair-estimate" value={estimate} inputMode="numeric" placeholder="Opcional" onChange={(event) => { setEstimate(moneyInput(event.target.value)); setBad((current) => ({ ...current, estimate: '' })); }} />
              </Field>
              <Field label="Seña" mark={money.active} error={bad.deposit}>
                <input id="repair-deposit" data-testid="repair-deposit" value={deposit} inputMode="numeric" placeholder="$ 0" onChange={(event) => { setDeposit(moneyInput(event.target.value)); setBad((current) => ({ ...current, deposit: '' })); }} />
              </Field>
            </div>
            <div className="sacts">
              <button type="button" className="btn2 s" disabled={saving} onClick={() => { setEditing(false); setError(''); }}>Cancelar</button>
              <button type="button" className="btn2 p" data-testid="repair-save-budget" disabled={busy || saving} onClick={() => { void saveBudget(); }}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="kv"><span>Presupuesto</span><b>{repairPrice(order.estimate, 'dash', show)}</b></div>
            <div className="kv"><span>Seña</span><b>{repairPrice(order.deposit, 'dash', show)}</b></div>
            <div className="svc-sensitive">
              <button type="button" className="btn2 s" data-testid="repair-edit-budget" disabled={!canManageSensitive || busy || saving} aria-describedby={canManageSensitive ? undefined : 'repair-sensitive-note'} onClick={startEdit}>Editar presupuesto</button>
              <button type="button" className="btn2 danger" data-testid="repair-delete" disabled={!canManageSensitive || busy || saving} aria-describedby={canManageSensitive ? undefined : 'repair-sensitive-note'} onClick={() => { setError(''); setConfirmDelete(true); }}>Eliminar orden</button>
              {canManageSensitive ? null : <p id="repair-sensitive-note" className="eqs-note">Solo quien tiene Acciones sensibles puede cambiar el presupuesto, la seña o borrar la orden.</p>}
            </div>
          </>
        )}
        <div className="kv"><span>Técnico</span><b>{order.technician || '—'}</b></div>
        <div className="svc-log">
          <span>Historial</span>
          <ol>
            {order.events.map((event) => {
              const meta = repairStatusMeta(event.status, statuses);
              return (
                <li key={event.id}>
                  <i style={{ background: meta.color }} />
                  <b>{meta.label}</b>
                  <small>{event.createdAt}</small>
                </li>
              );
            })}
          </ol>
        </div>
        {order.whatsappUrl ? (
          <div className="svc-wa">
            <span>Listo para avisar al cliente</span>
            <a href={order.whatsappUrl} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
          </div>
        ) : null}
        {next ? (
          <Actions busy={busy || saving} secondary="Cerrar" primary={`Pasar a ${next.label}`} onSecondary={close} onPrimary={() => { void advance(); }} />
        ) : (
          <div className="sacts one"><button type="button" className="btn2 s" onClick={close}>Cerrar</button></div>
        )}
      </Sheet>
      {confirmDelete ? (
        <Dialog
          title="Eliminar orden"
          text={`#${order.code} · ${order.device} se va a borrar y no se puede deshacer.`}
          ok="Eliminar"
          danger
          busy={saving}
          error={error}
          onClose={() => { if (!saving) { setConfirmDelete(false); setError(''); } }}
          onOk={() => { void remove(); }}
        />
      ) : null}
    </>
  );

  const late = repairOverdue(order);
  const due = order.estimatedDelivery ? dayMonth(order.estimatedDelivery) : '';
  const dueLabel = due ? (late ? `${due} · atrasada` : due) : '—';
  const step = index >= 0 ? index + 1 : 0;
  const currentEventId = [...order.events].reverse().find((event) => event.status === order.status)?.id;
  const budgetFields = (
    <div className="svc-edit">
      <div className="frow">
        <Field label="Presupuesto" mark={money.active} error={bad.estimate}>
          <input id="repair-estimate" data-testid="repair-estimate" value={estimate} inputMode="numeric" placeholder="Opcional" onChange={(event) => { setEstimate(moneyInput(event.target.value)); setBad((current) => ({ ...current, estimate: '' })); }} />
        </Field>
        <Field label="Seña" mark={money.active} error={bad.deposit}>
          <input id="repair-deposit" data-testid="repair-deposit" value={deposit} inputMode="numeric" placeholder="$ 0" onChange={(event) => { setDeposit(moneyInput(event.target.value)); setBad((current) => ({ ...current, deposit: '' })); }} />
        </Field>
      </div>
      <div className="sacts">
        <button type="button" className="btn2 s" disabled={saving} onClick={() => { setEditing(false); setError(''); }}>Cancelar</button>
        <button type="button" className="btn2 p" data-testid="repair-save-budget" disabled={busy || saving} onClick={() => { void saveBudget(); }}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  );
  const sensitive = (
    <div className="svc-sensitive">
      <button type="button" className="btn2 s" data-testid="repair-edit-budget" disabled={!canManageSensitive || busy || saving} aria-describedby={canManageSensitive ? undefined : 'repair-sensitive-note'} onClick={startEdit}>Editar presupuesto</button>
      <button type="button" className="btn2 danger" data-testid="repair-delete" disabled={!canManageSensitive || busy || saving} aria-describedby={canManageSensitive ? undefined : 'repair-sensitive-note'} onClick={() => { setError(''); setConfirmDelete(true); }}>Eliminar orden</button>
      {canManageSensitive ? null : <p id="repair-sensitive-note" className="eqs-note">Solo quien tiene Acciones sensibles puede cambiar el presupuesto, la seña o borrar la orden.</p>}
    </div>
  );

  return (
    <>
      <Sheet className="svc-sheet" title={`#${order.code}`} subtitle={`${order.device} · ${order.clientName}`} onClose={close}>
        <div className="svc-steps" aria-hidden="true">
          {statuses.map((status, item) => <i key={status.id} className={index >= 0 && item <= index ? 'on' : ''} />)}
        </div>
        <div className="svc-now">
          <Pill status={order.status} kind="REPAIR_STATUS" />
        </div>
        {step > 0 ? (
          <p className="svc-step" data-testid="repair-step">
            Paso {step} de {statuses.length}
            {next ? <> · sigue <b>{next.label}</b></> : null}
          </p>
        ) : null}
        {error && !confirmDelete ? <div className="ferr">{error}</div> : null}
        <div className="svc-fault-card">
          <span>Falla</span>
          <b>{repairFault(order)}</b>
        </div>
        <div className="svc-pair">
          <div><span>IMEI</span><b>{order.imei || '—'}</b></div>
          <div><span>Entrega estimada</span><b className={late ? 'late' : ''}>{dueLabel}</b></div>
        </div>
        {editing ? budgetFields : (
          <>
            <div className="svc-pair">
              <div><span>Presupuesto</span><b>{repairPrice(order.estimate, 'dash', show)}</b></div>
              <div><span>Seña</span><b>{repairPrice(order.deposit, 'dash', show)}</b></div>
            </div>
            {sensitive}
          </>
        )}
        <div className="kv"><span>Técnico</span><b>{order.technician || '—'}</b></div>
        <div className="svc-log">
          <span>Historial</span>
          <ol>
            {order.events.map((event) => {
              const meta = repairStatusMeta(event.status, statuses);
              const current = event.id === currentEventId;
              return (
                <li key={event.id} className={current ? 'now' : undefined}>
                  <i className={current ? 'now' : undefined} style={current ? undefined : { background: meta.color }} />
                  <b>{meta.label}</b>
                  <small>{event.createdAt}</small>
                </li>
              );
            })}
          </ol>
        </div>
        {order.whatsappUrl ? (
          <div className="svc-wa">
            <span>Listo para avisar al cliente</span>
            <a className="svc-wa-icon" href={order.whatsappUrl} target="_blank" rel="noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 19l1.2-3.4A8 8 0 1 1 8.6 19.2L5 19z" />
                <path d="M9 10.2c.2 1.6 1.8 3.2 3.4 3.6.4.1.8 0 1.1-.3l.8-.8c.2-.2.2-.5 0-.7l-1.2-1.2c-.2-.2-.5-.2-.7 0l-.4.4" />
              </svg>
              Abrir WhatsApp
            </a>
          </div>
        ) : null}
        {next ? (
          <Actions busy={busy || saving} secondary="Cerrar" primary={`Pasar a ${next.label}`} onSecondary={close} onPrimary={() => { void advance(); }} />
        ) : (
          <div className="sacts one"><button type="button" className="btn2 s" onClick={close}>Cerrar</button></div>
        )}
      </Sheet>
      {confirmDelete ? (
        <Dialog
          title="Eliminar orden"
          text={`#${order.code} · ${order.device} se va a borrar y no se puede deshacer.`}
          ok="Eliminar"
          danger
          busy={saving}
          error={error}
          onClose={() => { if (!saving) { setConfirmDelete(false); setError(''); } }}
          onOk={() => { void remove(); }}
        />
      ) : null}
    </>
  );
}
