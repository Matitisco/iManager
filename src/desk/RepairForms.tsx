import { toUserMessage } from '../lib/user-message';
import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { ClientField } from './ClientField';
import { CatalogEditor, catalogChoices, useCatalogs } from './catalog';
import type { CatalogKind } from '../services/catalogs-api';
import { useMoney } from './exchange';
import { formatInputMoney, formatShortDate, parseMoney } from './format';
import { IMEI_FORMAT_MESSAGE, IMEI_OPTIONAL_LABEL, imeiFormatError } from '../lib/imei';
import { getFriendlyErrorMessage } from '../lib/utils';
import { archivedRepair } from './archive-cache';
import { restoreBackendRepair } from '../services/repairs-api';
import { RecordHistory } from './screens/HistoryScreen';
import { FX_WARNING } from './money';
import { ReportDatePicker } from './report-date-picker';
import { dayMonth, DEFAULT_REPAIR_STATUSES, DEPOSIT_OVER_ESTIMATE, depositExceedsEstimate, isRetiredRepairStatus, presentRepairStatusChange, REPAIR_FAULTS, REPAIR_RECEIVED, repairColumnStatus, repairFault, repairOverdue, repairPrice, repairStatusChangeNotice, repairStatusMeta } from './repairs';
import { usePhoneLayout } from './section-notices';
import { Actions, Dialog, Field, Pill, Segs, Sheet, SheetActionMenu, SheetActions, useDesk } from './ui';
import { DEFAULT_REPAIR_WARRANTY_DAYS, parseWarrantyDaysInput, repairWarrantyView } from '../lib/warranty';
import { shareOrCopy } from './overlays/shared';

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

function arToIso(value: string | null | undefined) {
  const match = value?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function RepairOrderForm({ busy, error }: { busy: boolean; error: string | null }) {
  const { clients, addRepairOrder, appSession } = useAppContext();
  const money = useMoney();
  const { close, toast } = useDesk();
  const catalogs = useCatalogs();
  const isPhone = usePhoneLayout();
  const statuses = catalogChoices(catalogs?.options ?? [], 'REPAIR_STATUS', DEFAULT_REPAIR_STATUSES)
    .filter((status) => !isRetiredRepairStatus(status.id, status.label));
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
  const [warrantyDays, setWarrantyDays] = useState(String(appSession?.store?.repairWarrantyDays ?? DEFAULT_REPAIR_WARRANTY_DAYS));
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
    const typedEstimate = estimate.trim() ? parseMoney(estimate) : null;
    const typedDeposit = parseMoney(deposit);
    if (!device.trim()) next.device = 'Completá este dato';
    if (imeiFormatError(imei)) next.imei = IMEI_FORMAT_MESSAGE;
    if (!fault.trim() && tags.length === 0) next.fault = 'Contá la falla';
    if (depositExceedsEstimate(typedEstimate, typedDeposit)) next.deposit = DEPOSIT_OVER_ESTIMATE;
    const warranty = parseWarrantyDaysInput(warrantyDays);
    if (warranty.error) next.warranty = warranty.error;
    else if (warranty.days === undefined) next.warranty = 'Completá los días de garantía';
    setBad(next);
    if (Object.keys(next).length || !addRepairOrder) return;
    setSaving(true);
    try {
      await addRepairOrder({
        clientId: clientId || null,
        clientName: clientName.trim() || null,
        device: device.trim(),
        imei,
        fault: fault.trim(),
        faultTags: tags,
        estimate: typedEstimate,
        deposit: typedDeposit,
        currency: money.active,
        technician: technician.trim(),
        status: status || REPAIR_RECEIVED,
        estimatedDelivery: delivery ? isoDate(delivery) : null,
        ...(warranty.days !== undefined ? { warrantyDays: warranty.days } : {}),
      });
      close();
      toast('Orden creada');
    } catch (err) {
      setBad((current) => ({ ...current, form: toUserMessage(err, 'No se pudo crear la orden') }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet wide className="svc-sheet" title="Nueva orden de reparación" subtitle={isPhone ? 'Arranca en «Recibido».' : undefined} onClose={close} busy={busy || saving}>
      {error || bad.form ? <div className="ferr">{error || bad.form}</div> : null}
      <div className="svc-grid">
        <div>
          <div className="svc-lead">
            <div className="svc-lead-device">
              <Field label="Equipo" error={bad.device}>
                <input value={device} maxLength={120} placeholder="iPhone 13" onChange={(event) => { setDevice(event.target.value); setBad((current) => ({ ...current, device: '' })); }} />
              </Field>
            </div>
            <ClientField
              className="svc-lead-client"
              label="Cliente (opcional)"
              clients={clients}
              value={clientName}
              linked={Boolean(clientId)}
              onValue={(value) => { setClientName(value); setClientId(''); }}
              onPick={(client) => { setClientName(client.name); setClientId(client.id); }}
            />
            <div className="svc-lead-imei">
              <Field label={IMEI_OPTIONAL_LABEL} error={bad.imei}>
                <input value={imei} inputMode="numeric" maxLength={15} placeholder="15 dígitos" onChange={(event) => { setImei(event.target.value.replace(/\D/g, '').slice(0, 15)); setBad((current) => ({ ...current, imei: '' })); }} />
              </Field>
            </div>
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
            <Field label="Presupuesto estimado" mark={money.active} error={bad.estimate}>
              <input id="repair-new-estimate" data-testid="repair-new-estimate" value={estimate} inputMode="numeric" placeholder="Opcional" onChange={(event) => { setEstimate(moneyInput(event.target.value)); setBad((current) => ({ ...current, estimate: '', deposit: '' })); }} />
            </Field>
            <Field label="Seña" mark={money.active} error={bad.deposit}>
              <input id="repair-new-deposit" data-testid="repair-new-deposit" value={deposit} inputMode="numeric" placeholder="$ 0" onChange={(event) => { setDeposit(moneyInput(event.target.value)); setBad((current) => ({ ...current, deposit: '' })); }} />
            </Field>
          </div>
          <div className="frow">
            <ReportDatePicker label="Entrega estimada" value={delivery} onChange={setDelivery} />
            <Field label="Técnico">
              <input value={technician} maxLength={120} placeholder="Técnico Ejemplo" onChange={(event) => setTechnician(event.target.value)} />
            </Field>
          </div>
          <Field label="Garantía (días)" error={bad.warranty}>
            <input data-testid="repair-warranty-days" inputMode="numeric" value={warrantyDays} placeholder="0" onChange={(event) => { setWarrantyDays(event.target.value.replace(/\D/g, '').slice(0, 4)); setBad((current) => ({ ...current, warranty: '' })); }} />
          </Field>
          <p className="eqs-note">La garantía empieza cuando la orden pasa a Entregado.</p>
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
  const { repairOrders = [], changeRepairStatus, user, restoreRepairOrder } = useAppContext();
  const money = useMoney();
  const { close, open, toast } = useDesk();
  const catalogs = useCatalogs();
  const phone = usePhoneLayout();
  const order = repairOrders.find((item) => item.id === id) ?? archivedRepair(id);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const statuses = catalogChoices(catalogs?.options ?? [], 'REPAIR_STATUS', DEFAULT_REPAIR_STATUSES)
    .filter((status) => !isRetiredRepairStatus(status.id, status.label));
  if (!order) {
    return (
      <Sheet className="svc-sheet" title="Orden" onClose={close}>
        <p className="sub">No encontré esta orden.</p>
        <Actions busy={busy} primary="Cerrar" secondary="Volver" onSecondary={close} onPrimary={close} />
      </Sheet>
    );
  }
  const shownStatus = repairColumnStatus(order.status);
  const index = statuses.findIndex((status) => status.id === shownStatus);
  const next = index >= 0 ? statuses[index + 1] : undefined;
  const show = (value: number) => money.show(value, order.currency);
  const advance = async () => {
    if (!next || !changeRepairStatus) return;
    setError('');
    setSaving(true);
    try {
      const saved = await changeRepairStatus(order.id, next.id);
      presentRepairStatusChange(repairStatusChangeNotice(order.status, saved, statuses), toast);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo cambiar el estado'));
    } finally {
      setSaving(false);
    }
  };

  const clientRow = order.clientName ? <div className="kv" data-testid="repair-client"><span>Cliente</span><b>{order.clientName}</b></div> : null;
  const received = dayMonth(order.receivedAt) || formatShortDate(order.receivedAt);
  const coverage = repairWarrantyView(order);
  const shareReceipt = () => {
    const text = [
      `#${order.code}`,
      order.device,
      order.imei ? `IMEI ${order.imei}` : null,
      repairFault(order),
      `Salió ${repairPrice(order.estimate, 'dash', show)}`,
      `Pagó ${repairPrice(order.deposit, 'dash', show)}`,
      coverage.phrase,
    ].filter(Boolean).join(' · ');
    const copy = () => navigator.clipboard.writeText(text).then(() => toast('Comprobante copiado'));
    shareOrCopy({ title: `#${order.code}`, text }, copy);
  };
  const warrantyRow = <div className="kv" data-testid="repair-warranty"><span>Garantía</span><b>{coverage.phrase}</b></div>;
  const footer = (
    <SheetActions>
      <SheetActionMenu>
        <button type="button" className="btn2 s" disabled={busy || saving} onClick={close}>Cerrar</button>
        {next ? <button type="button" className="btn2 s" onClick={shareReceipt}>Compartir comprobante</button> : null}
        {order.clientId ? <button type="button" className="btn2 s" disabled={busy || saving} onClick={() => open({ type: 'repair-deposit', id: order.id })}>Aplicar seña</button> : null}
        <button type="button" className="btn2 s" data-testid="repair-open-edit" disabled={busy || saving} onClick={() => open({ type: 'edit-ot', id: order.id })}>Editar</button>
      </SheetActionMenu>
      {next
        ? <button type="button" className="btn2 p sheet-primary" disabled={busy || saving} onClick={() => { void advance(); }}>{saving ? 'Guardando…' : `Pasar a ${next.label}`}</button>
        : <button type="button" className="btn2 p sheet-primary" onClick={shareReceipt}>Compartir comprobante</button>}
    </SheetActions>
  );

  if (!phone) return (
    <Sheet className="svc-sheet" title={`#${order.code} · ${order.device}`} subtitle={`Ingresó el ${received}${order.estimatedDelivery ? ` · entrega estimada ${dayMonth(order.estimatedDelivery)}` : ''}`} onClose={close} busy={busy || saving} footer={footer}>
      <div className="svc-steps" aria-hidden="true">
        {statuses.map((status, step) => <i key={status.id} className={index >= 0 && step <= index ? 'on' : ''} />)}
      </div>
      <div className="svc-now">
        <Pill status={shownStatus} kind="REPAIR_STATUS" />
        {next ? <span>Sigue: {next.label}</span> : null}
      </div>
      {error ? <div className="ferr">{error}</div> : null}
      {order.archivedAt ? <div className="pending-sale" data-testid="archived-banner"><div><b>Archivado</b><small>{order.archivedBy ? `por ${order.archivedBy}` : 'Esta orden está archivada'}{order.archiveReason ? ` · ${order.archiveReason}` : ''}</small></div><button type="button" disabled={busy || saving} onClick={() => { if (!user || !restoreRepairOrder) return; setSaving(true); void restoreRepairOrder(order.id).then(() => { toast('Orden restaurada'); close(); }).catch((cause) => setError(getFriendlyErrorMessage(cause, 'No se pudo restaurar.'))).finally(() => setSaving(false)); }}>Restaurar</button></div> : null}
      <RecordHistory entityType="repair" entityId={order.id} />
      {clientRow}
      <div className="kv"><span>IMEI</span><b>{order.imei || '—'}</b></div>
      <div className="kv svc-fault-row"><span>Falla</span><b className="svc-fault-full" data-testid="repair-fault">{repairFault(order)}</b></div>
      <div className="kv"><span>Presupuesto</span><b>{repairPrice(order.estimate, 'dash', show)}</b></div>
      <div className="kv"><span>Seña</span><b>{repairPrice(order.deposit, 'dash', show)}</b></div>
      {warrantyRow}
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
    </Sheet>
  );

  const late = repairOverdue(order);
  const due = order.estimatedDelivery ? dayMonth(order.estimatedDelivery) : '';
  const dueLabel = due ? (late ? `${due} · atrasada` : due) : '—';
  const step = index >= 0 ? index + 1 : 0;
  const currentEventId = [...order.events].reverse().find((event) => event.status === order.status)?.id;
  return (
    <Sheet className="svc-sheet" title={`#${order.code}`} subtitle={order.device} onClose={close} busy={busy || saving} footer={footer}>
      <div className="svc-steps" aria-hidden="true">
        {statuses.map((status, item) => <i key={status.id} className={index >= 0 && item <= index ? 'on' : ''} />)}
      </div>
      <div className="svc-now">
        <Pill status={shownStatus} kind="REPAIR_STATUS" />
      </div>
      {step > 0 ? (
        <p className="svc-step" data-testid="repair-step">
          Paso {step} de {statuses.length}
          {next ? <> · sigue <b>{next.label}</b></> : null}
        </p>
      ) : null}
      {error ? <div className="ferr">{error}</div> : null}
      {order.archivedAt ? <div className="pending-sale" data-testid="archived-banner"><div><b>Archivado</b><small>{order.archivedBy ? `por ${order.archivedBy}` : 'Esta orden está archivada'}{order.archiveReason ? ` · ${order.archiveReason}` : ''}</small></div><button type="button" disabled={busy || saving} onClick={() => { if (!user || !restoreRepairOrder) return; setSaving(true); void restoreRepairOrder(order.id).then(() => { toast('Orden restaurada'); close(); }).catch((cause) => setError(getFriendlyErrorMessage(cause, 'No se pudo restaurar.'))).finally(() => setSaving(false)); }}>Restaurar</button></div> : null}
      <RecordHistory entityType="repair" entityId={order.id} />
      {clientRow}
      <div className="kv"><span>Ingreso</span><b>{received}</b></div>
      <div className="svc-fault-card">
        <span>Falla</span>
        <b className="svc-fault-full" data-testid="repair-fault">{repairFault(order)}</b>
      </div>
      <div className="svc-pair">
        <div><span>IMEI</span><b>{order.imei || '—'}</b></div>
        <div><span>Entrega estimada</span><b className={late ? 'late' : ''}>{dueLabel}</b></div>
      </div>
      <div className="svc-pair">
        <div><span>Presupuesto</span><b>{repairPrice(order.estimate, 'dash', show)}</b></div>
        <div><span>Seña</span><b>{repairPrice(order.deposit, 'dash', show)}</b></div>
      </div>
      {warrantyRow}
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
    </Sheet>
  );
}

export function RepairOrderEditor({ id, busy }: { id: string; busy: boolean }) {
  const { repairOrders = [], clients = [], updateRepairOrder, deleteRepairOrder } = useAppContext();
  const money = useMoney();
  const { close, toast, canManageSensitive = true } = useDesk();
  const phone = usePhoneLayout();
  const order = repairOrders.find((item) => item.id === id);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [device, setDevice] = useState(order?.device ?? '');
  const [clientName, setClientName] = useState(order?.clientName ?? '');
  const [clientId, setClientId] = useState(order?.clientId ?? '');
  const [imei, setImei] = useState(order?.imei ?? '');
  const [tags, setTags] = useState<string[]>(order?.faultTags ?? []);
  const [fault, setFault] = useState(order?.fault ?? '');
  const [estimate, setEstimate] = useState(order?.estimate == null ? '' : money.inputValue(order.estimate, order.currency));
  const [deposit, setDeposit] = useState(order ? money.inputValue(order.deposit, order.currency) : '');
  const [delivery, setDelivery] = useState(arToIso(order?.estimatedDelivery));
  const [technician, setTechnician] = useState(order?.technician ?? '');
  const [warrantyDays, setWarrantyDays] = useState(order?.warrantyDays == null ? '' : String(order.warrantyDays));
  const [bad, setBad] = useState<Record<string, string>>({});

  if (!order) {
    return (
      <Sheet className="svc-sheet" title="Editar orden" onClose={close}>
        <p className="sub">No encontré esta orden.</p>
        <Actions busy={busy} primary="Cerrar" secondary="Volver" onSecondary={close} onPrimary={close} />
      </Sheet>
    );
  }

  const toggleTag = (tag: string) => {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
    setBad((current) => ({ ...current, fault: '' }));
  };
  const save = async () => {
    const nextBad: Record<string, string> = {};
    if (!device.trim()) nextBad.device = 'Completá este dato';
    if (imeiFormatError(imei)) nextBad.imei = IMEI_FORMAT_MESSAGE;
    if (!fault.trim() && tags.length === 0) nextBad.fault = 'Contá la falla';
    const warranty = parseWarrantyDaysInput(warrantyDays);
    if (warranty.error) nextBad.warranty = warranty.error;
    const typedEstimate = estimate.trim() ? parseMoney(estimate) : null;
    const typedDeposit = parseMoney(deposit);
    if (canManageSensitive) {
      if (typedEstimate != null && typedEstimate > MONEY_CAP) nextBad.estimate = 'El presupuesto es demasiado alto';
      if (typedDeposit > MONEY_CAP) nextBad.deposit = 'La seña es demasiado alta';
      else if (depositExceedsEstimate(typedEstimate, typedDeposit)) nextBad.deposit = DEPOSIT_OVER_ESTIMATE;
    }
    setBad(nextBad);
    if (Object.keys(nextBad).length || !updateRepairOrder) return;
    const group = canManageSensitive ? money.commitGroup([
      { typed: typedEstimate ?? 0, original: order.estimate ?? 0, currency: order.currency },
      { typed: typedDeposit, original: order.deposit, currency: order.currency },
    ]) : null;
    if (group?.blocked) {
      setError(FX_WARNING);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await updateRepairOrder(order.id, {
        device: device.trim(),
        clientId: clientId || null,
        clientName: clientName.trim() || null,
        imei,
        fault: fault.trim(),
        faultTags: tags,
        technician: technician.trim(),
        estimatedDelivery: delivery ? isoDate(delivery) : null,
        ...(warranty.days !== undefined ? { warrantyDays: warranty.days } : order.warrantyDays != null ? { warrantyDays: 0 } : {}),
        ...(group ? {
          estimate: typedEstimate == null ? null : group.amounts[0]?.amount ?? typedEstimate,
          deposit: group.amounts[1]?.amount ?? typedDeposit,
          currency: storedCurrency(group.amounts[0]?.currency ?? group.amounts[1]?.currency ?? order.currency),
        } : {}),
      });
      close();
      toast('Orden actualizada');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar la orden'));
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
      toast('Orden archivada');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo borrar la orden'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet wide className="svc-sheet" title="Editar orden" subtitle={phone ? `#${order.code} · ${order.device}` : `#${order.code}`} onClose={close} busy={busy || saving}>
        {error && !confirmDelete ? <div className="ferr">{error}</div> : null}
        <div className="svc-grid">
          <div>
            <div className="svc-lead">
              <div className="svc-lead-device">
                <Field label="Equipo" error={bad.device}>
                  <input id="repair-device" data-testid="repair-device-input" value={device} maxLength={120} placeholder="iPhone 13" onChange={(event) => { setDevice(event.target.value); setBad((current) => ({ ...current, device: '' })); }} />
                </Field>
              </div>
              <ClientField
                className="svc-lead-client"
                label="Cliente (opcional)"
                clients={clients}
                value={clientName}
                linked={Boolean(clientId)}
                onValue={(value) => { setClientName(value); setClientId(''); }}
                onPick={(client) => { setClientName(client.name); setClientId(client.id); }}
              />
              <div className="svc-lead-imei">
                <Field label={IMEI_OPTIONAL_LABEL} error={bad.imei}>
                  <input value={imei} inputMode="numeric" maxLength={15} placeholder="15 dígitos" onChange={(event) => { setImei(event.target.value.replace(/\D/g, '').slice(0, 15)); setBad((current) => ({ ...current, imei: '' })); }} />
                </Field>
              </div>
            </div>
            <Field label="Falla reportada" error={bad.fault}><span /></Field>
            <div className="svc-faults">
              {REPAIR_FAULTS.map((tag) => (
                <button key={tag} type="button" className={tags.includes(tag) ? 'on' : ''} aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)}>{tag}</button>
              ))}
            </div>
            <label className={`fl${bad.fault ? ' bad' : ''}`}>
              <textarea className="svc-note" value={fault} maxLength={2000} placeholder="Contá qué le pasa al equipo" onChange={(event) => { setFault(event.target.value); setBad((current) => ({ ...current, fault: '' })); }} />
            </label>
          </div>
          <div>
            <div className="frow">
              <Field label="Presupuesto" mark={money.active} error={bad.estimate}>
                <input id="repair-estimate" data-testid="repair-estimate" value={estimate} inputMode="numeric" placeholder="Opcional" disabled={!canManageSensitive} aria-describedby={canManageSensitive ? undefined : 'repair-sensitive-note'} onChange={(event) => { setEstimate(moneyInput(event.target.value)); setBad((current) => ({ ...current, estimate: '', deposit: '' })); }} />
              </Field>
              <Field label="Seña" mark={money.active} error={bad.deposit}>
                <input id="repair-deposit" data-testid="repair-deposit" value={deposit} inputMode="numeric" placeholder="$ 0" disabled={!canManageSensitive} aria-describedby={canManageSensitive ? undefined : 'repair-sensitive-note'} onChange={(event) => { setDeposit(moneyInput(event.target.value)); setBad((current) => ({ ...current, deposit: '' })); }} />
              </Field>
            </div>
            {canManageSensitive ? null : <p id="repair-sensitive-note" className="eqs-note">Solo quien tiene Acciones sensibles puede cambiar el presupuesto, la seña o archivar la orden.</p>}
            <Field label="Garantía (días)" error={bad.warranty}>
              <input data-testid="repair-edit-warranty-days" inputMode="numeric" value={warrantyDays} placeholder="Sin garantía cargada" onChange={(event) => { setWarrantyDays(event.target.value.replace(/\D/g, '').slice(0, 4)); setBad((current) => ({ ...current, warranty: '' })); }} />
            </Field>
            <p className="eqs-note">Si la orden ya está entregada, estos días corren desde esa entrega.</p>
            <div className="frow">
              <ReportDatePicker label="Entrega estimada" value={delivery} onChange={setDelivery} />
              <Field label="Técnico">
                <input value={technician} maxLength={120} placeholder="Técnico Ejemplo" onChange={(event) => setTechnician(event.target.value)} />
              </Field>
            </div>
            <div className="svc-sensitive">
              <button type="button" className="btn2 danger" data-testid="repair-delete" disabled={!canManageSensitive || busy || saving} aria-describedby={canManageSensitive ? undefined : 'repair-sensitive-note'} onClick={() => { setError(''); setConfirmDelete(true); }}>Archivar orden</button>
            </div>
          </div>
        </div>
        <Actions busy={busy || saving} primary="Guardar" onSecondary={close} onPrimary={() => { void save(); }} />
      </Sheet>
      {confirmDelete ? (
        <Dialog
          title="Archivar orden"
          text={order.deposit > 0 ? `#${order.code} · ${order.device} se va a archivar. Si tenía una seña aplicada, vuelve como saldo a favor del cliente. Podés restaurarla.` : `#${order.code} · ${order.device} se va a archivar. Podés restaurarla desde Archivados.`}
          ok="Archivar"
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
