import { DeskSelect } from '../select';
import { ListSkeleton } from '../list-skeleton';
import { DatePicker } from '../date-picker';
import { isDateValue } from '../date-value';
import { archivedReturn } from '../archive-cache';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HistoryIconButton } from '../RecordHistoryButton';
import { usePhoneLayout } from '../section-notices';
import { useAppContext } from '../../context/AppContext';
import { saleWarrantyView } from '../../lib/warranty';
import { getFriendlyErrorMessage } from '../../lib/utils';
import type { ResolveReturnInput, ReturnDestination, ReturnResolution, ReturnSettlement, RmaStatus, ReturnCaseView } from '../../services/returns-api';
import { formatInputMoney, formatMoney, formatShortDate, parseMoney, statusLabel, isVoidRow, saleBuyer } from '../format';
import { Actions, Field, Pill, Sheet, useDesk } from '../ui';
import { ReturnDetailContent } from './return-detail';

const RESOLUTIONS: Array<{ id: ReturnResolution; label: string }> = [
  { id: 'REPARACION', label: 'Reparación' },
  { id: 'CAMBIO', label: 'Cambio' },
  { id: 'REINTEGRO', label: 'Reintegro' },
];
const SETTLEMENTS: Array<{ id: ReturnSettlement; label: string }> = [
  { id: 'REINTEGRO', label: 'Reintegro en caja' },
  { id: 'NOTA_CREDITO', label: 'Nota de crédito' },
];
const STOCK = [
  { id: 'EN_REVISION', label: 'En revisión' },
  { id: 'DEVUELTO', label: 'Devuelto' },
  { id: 'DISPONIBLE', label: 'Disponible' },
];

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function ReturnForm({ saleId, id }: { saleId?: string; id?: string }) {
  const { sales = [], clients = [], inventory = [], returns, createReturn, updateReturn } = useAppContext();
  const { close, toast } = useDesk();
  const phone = usePhoneLayout();
  const completed = sales.filter((sale) => sale.status === 'COMPLETADA' && !sale.voidedAt);
  const current = id ? returns?.find(row => row.id === id) ?? archivedReturn(id) : null;
  const [selected, setSelected] = useState(current?.saleId ?? saleId ?? '');
  const [reason, setReason] = useState(current?.reason ?? '');
  const [diagnosis, setDiagnosis] = useState(current?.diagnosis ?? '');
  const [openedOn, setOpenedOn] = useState(current?.openedOn ?? today());
  const [bad, setBad] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sale = completed.find((row) => row.id === selected);
  const item = inventory.find((row) => row.id === sale?.productId);
  const coverage = sale ? saleWarrantyView(sale) : null;

  const save = async () => {
    const next: Record<string, string> = {};
    if (!sale && !current) next.sale = 'Elegí una venta cobrada.';
    if (!reason.trim()) next.reason = 'Completá el motivo.';
    if (!isDateValue(openedOn)) next.date = 'Elegí una fecha.';
    setBad(next);
    if (Object.keys(next).length || (!sale && !current) || busy) return;
    setBusy(true);
    setError('');
    try {
      if (id && current) {
        const changed = {
          ...(reason.trim() !== current.reason ? { reason: reason.trim() } : {}),
          ...(openedOn !== current.openedOn ? { openedOn } : {}),
          ...(diagnosis.trim() !== (current.diagnosis ?? '') ? { diagnosis: diagnosis.trim() || null } : {}),
        };
        if (Object.keys(changed).length) await updateReturn(id, changed);
      } else await createReturn({
        saleId: sale!.id,
        reason: reason.trim(),
        openedOn,
        diagnosis: null,
        imei: item?.imei || null,
      });
      toast(id ? 'Reclamo guardado' : 'Reclamo abierto');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, id ? 'No se pudo guardar el reclamo.' : 'No se pudo abrir el reclamo.'));
    } finally {
      setBusy(false);
    }
  };

  if (id && !current) return <Sheet title="Editar reclamo" onClose={close}><p className="ferr" role="alert">No encontramos ese reclamo.</p></Sheet>;
  if (current && isVoidRow(current)) return <Sheet title="Editar reclamo" onClose={close}><p className="ferr" role="alert">Este reclamo está anulado.</p></Sheet>;
  return (
    <Sheet title={id ? 'Editar reclamo' : 'Nuevo reclamo'} onClose={close} busy={busy} className="return-sheet ret-new" footer={<Actions busy={busy} busyLabel={id ? 'Guardar' : 'Abrir reclamo'} primary={id ? 'Guardar' : 'Abrir reclamo'} onSecondary={close} onPrimary={() => { void save(); }} />}>
      {error ? <div className="ferr" role="alert">{error}</div> : null}
      <DatePicker label="Fecha" ariaLabel="Fecha del reclamo" value={openedOn} onChange={setOpenedOn} error={bad.date} required disabled={busy} panel={phone ? 'inline' : 'float'} />
      {current ? <ReturnSummary current={current} /> : <Field label="Venta" error={bad.sale}>
        <DeskSelect label="Venta" value={selected} disabled={Boolean(saleId) || busy} onChange={setSelected} invalid={Boolean(bad.sale)}
          options={[{ value: '', label: 'Elegí una venta' }, ...completed.map(row => ({ value: row.id, label: `${saleBuyer(row, clients)} · ${row.deviceLabel || 'Equipo'} · ${formatShortDate(row.date)}` }))]} />
      </Field>}
      {!current && sale ? (
        <div className="return-summary return-sale-summary" data-testid="return-sale">
          <b>{item?.imei ? `IMEI ${item.imei}` : 'Sin IMEI'}</b>
          <small>{[coverage?.phrase || 'Sin garantía', formatMoney(sale.amount, sale.amountCurrency === 'USD' ? 'USD' : 'ARS')].join(' · ')}</small>
        </div>
      ) : null}
      <Field label="Motivo" error={bad.reason}><textarea aria-label="Motivo" maxLength={500} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Qué pasó con el equipo" /></Field>
      {current ? <Field label="Diagnóstico"><textarea aria-label="Diagnóstico" maxLength={2000} disabled={busy} value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} placeholder="Opcional" /></Field> : null}
    </Sheet>
  );
}

function ReturnSummary({ current, reason = false }: { current: ReturnCaseView; reason?: boolean }) {
  return <div className="return-summary" data-testid="return-detail">
    <b>{current.clientName || 'Sin cliente'}</b>
    <span>{current.deviceLabel || 'Sin equipo'}</span>
    <small>{[current.imei ? `IMEI ${current.imei}` : '', formatShortDate(current.openedOn)].filter(Boolean).join(' · ')}</small>
    {reason && current.supplierName ? <div className="kv" data-testid="return-supplier"><span>Proveedor</span><b>{current.supplierName}</b></div> : null}
    {reason ? <p className="rs-reason">{current.reason}</p> : null}
  </div>;
}

function Choices({ label, options, value, onChange, disabled }: {
  label: string; options: Array<{ id: string; label: string }>; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  return <fieldset className={`return-choices${options.length === 2 ? ' two' : ''}${label === 'Estado' ? ' return-status' : ''}`} disabled={disabled}>
    <legend>{label}</legend>
    <div className="sgs" role="group" aria-label={label}>
      {options.map(option => <button className={`sg${option.id === value ? ' on' : ''}`} type="button" key={option.id} aria-pressed={option.id === value} onClick={() => onChange(option.id)}>{option.label}</button>)}
    </div>
  </fieldset>;
}

type ReturnDetailProps = { id: string; onClose?: () => void; overlayClassName?: string };

export function ReturnDetail({ id, onClose, overlayClassName }: ReturnDetailProps) {
  const { returns } = useAppContext();
  const { close } = useDesk();
  const current = returns?.find(row => row.id === id) ?? archivedReturn(id) ?? null;
  if (returns == null) return <Sheet title="Reclamo" className="return-pending" onClose={onClose ?? close} overlayClassName={overlayClassName}><ListSkeleton variant="lines" rows={6} /></Sheet>;
  if (!current) return <Sheet title="Reclamo" onClose={onClose ?? close} overlayClassName={overlayClassName}><p className="ferr" role="alert">No encontramos ese reclamo.</p></Sheet>;
  return <LoadedReturnDetail key={id} current={current} onClose={onClose ?? close} overlayClassName={overlayClassName} />;
}

function LoadedReturnDetail({ current, onClose: close, overlayClassName }: { current: ReturnCaseView; onClose: () => void; overlayClassName?: string }) {
  const { updateReturn, resolveReturn, advanceRma, restoreReturn, reloadInventory, reloadSales, reloadClients, loadCash } = useAppContext();
  const { toast, canManageSensitive = true } = useDesk();
  const id = current.id;
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(current?.status ?? 'ABIERTO');
  const [rma, setRma] = useState(current?.rmaStatus ?? 'ENVIADO');
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyTrigger = useRef<HTMLButtonElement>(null);
  const phone = usePhoneLayout();
  const [diagnosis, setDiagnosis] = useState(current?.diagnosis ?? '');
  const [note, setNote] = useState('');
  const [resolution, setResolution] = useState<ReturnResolution>('REPARACION');
  const [settlement, setSettlement] = useState<ReturnSettlement>('REINTEGRO');
  const [amount, setAmount] = useState(current ? formatInputMoney(current.refundable || current.saleAmount) : '');
  const [destination, setDestination] = useState<ReturnDestination>('CLIENTE');
  const [stockStatus, setStockStatus] = useState('EN_REVISION');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const voided = current ? isVoidRow(current) : false;
  const unresolved = current && !voided && !['RESUELTO', 'EN_PROVEEDOR'].includes(current.status);
  const resolving = unresolved && status === 'RESUELTO' && canManageSensitive;
  const rejectedAtSupplier = current.status === 'RESUELTO' && current.destination === 'PROVEEDOR' && current.rmaStatus === 'RECHAZADO';
  const supplier = (current.status === 'EN_PROVEEDOR' || rejectedAtSupplier) && !voided;
  const destinations = resolution === 'REPARACION'
    ? [{ id: 'CLIENTE', label: 'Con el cliente' }, { id: 'PROVEEDOR', label: 'Al proveedor' }]
    : [{ id: 'STOCK', label: 'Al stock' }, { id: 'PROVEEDOR', label: 'Al proveedor' }];
  const chosenDestination = destinations.some(row => row.id === destination) ? destination : destinations[0].id as ReturnDestination;

  const save = async () => {
    if (busy || !current || voided) return;
    setBusy(true);
    setError('');
    try {
      if (resolving) {
        const input: ResolveReturnInput = {
          resolution, settlement: resolution === 'REPARACION' ? 'NINGUNO' : settlement,
          amount: resolution === 'REPARACION' ? 0 : parseMoney(amount), destination: chosenDestination,
          stockStatus: chosenDestination === 'STOCK' ? stockStatus : null,
          diagnosis: diagnosis.trim() || null, note: note.trim() || null,
        };
        await resolveReturn(id, input);
      } else if (supplier && rma !== current.rmaStatus) {
        await advanceRma(id, rma as RmaStatus, rma === 'RECIBIDO' ? stockStatus : null, note.trim() || null);
      } else {
        await updateReturn(id, {
          ...(unresolved ? { status: status as 'ABIERTO' | 'EN_DIAGNOSTICO', diagnosis: diagnosis.trim() || null } : {}),
          note: note.trim() || null,
        });
      }
      if (resolving || supplier) await Promise.all([reloadInventory?.(), reloadSales?.(), reloadClients?.(), loadCash?.()]);
      toast('Reclamo guardado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo guardar el reclamo.'));
    } finally { setBusy(false); }
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await restoreReturn(id); toast('Reclamo restaurado'); close(); }
    catch (cause) { setError(getFriendlyErrorMessage(cause, 'No se pudo restaurar el reclamo.')); }
    finally { setBusy(false); }
  };
  const legacyArchive = current.deletedAt && current.status !== 'ANULADO';
  const historyButton = <HistoryIconButton ref={historyTrigger} count={current.events.length} expanded={historyOpen} onClick={() => setHistoryOpen(true)} />;
  return <><Sheet title={`Reclamo · ${current.code}`} onClose={close} busy={busy} className={editing ? 'return-sheet ret-state' : `rcl-detail${current.status === 'RESUELTO' ? ' rcl-resolved' : ''}${voided ? ' rcl-voided' : ''}`} overlayClassName={overlayClassName}
    footer={voided ? legacyArchive && canManageSensitive
      ? <Actions busyLabel="Restaurar" primary="Restaurar" onPrimary={() => { void restore(); }} onSecondary={close} busy={busy} />
      : <div className="sacts one"><button className="btn2 s" type="button" onClick={close}>Cerrar</button></div>
      : editing ? <Actions busyLabel="Guardar" primary="Guardar" onPrimary={() => { void save(); }} onSecondary={close} busy={busy} />
        : <Actions secondary="Cerrar" primary={current.status === 'RESUELTO' && !supplier ? 'Agregar nota' : 'Cambiar estado'} onSecondary={close} onPrimary={() => setEditing(true)} />}>
    {error ? <p className="ferr" role="alert">{error}</p> : null}
    {!editing ? <ReturnDetailContent current={current} historyButton={historyButton} /> : <>
    <ReturnSummary current={current} reason />
    {voided ? <Pill status="ANULADO" /> : unresolved ? <Choices label="Estado" value={status} onChange={setStatus} disabled={busy} options={[
      { id: 'ABIERTO', label: 'Abierto' }, { id: 'EN_DIAGNOSTICO', label: 'En diagnóstico' },
      ...(canManageSensitive ? [{ id: 'RESUELTO', label: 'Resuelto' }] : []),
    ]} /> : <Pill status={current.rmaStatus || current.status} />}
    {supplier && canManageSensitive ? <Choices label="RMA con el proveedor" value={rma} onChange={setRma} disabled={busy} options={rejectedAtSupplier ? [
      { id: 'RECHAZADO', label: 'Rechazado' }, { id: 'RECIBIDO', label: 'Recibido' },
    ] : [
      { id: 'ENVIADO', label: 'Enviado' }, { id: 'EN_REVISION', label: 'En revisión' }, { id: 'APROBADO', label: 'Aprobado' },
      { id: 'RECHAZADO', label: 'Rechazado' }, { id: 'RECIBIDO', label: 'Recibido' },
    ]} /> : null}
    {unresolved && (status === 'EN_DIAGNOSTICO' || diagnosis || resolving) ? <Field label="Diagnóstico"><textarea aria-label="Diagnóstico" value={diagnosis} maxLength={2000} disabled={busy} onChange={event => setDiagnosis(event.target.value)} /></Field> : null}
    {!unresolved && current.diagnosis ? <div className="return-reason"><b>Diagnóstico</b><p>{current.diagnosis}</p></div> : null}
    {resolving ? <div className="return-resolution" data-testid="return-resolve">
      <Choices label="Resolución" options={RESOLUTIONS} value={resolution} onChange={value => setResolution(value as ReturnResolution)} disabled={busy} />
      {resolution !== 'REPARACION' ? <>
        <Choices label="Devolución" options={SETTLEMENTS} value={settlement} onChange={value => setSettlement(value as ReturnSettlement)} disabled={busy} />
        <Field label={`Importe (${current.saleCurrency === 'USD' ? 'US$' : '$'})`}><input aria-label="Importe" inputMode="decimal" value={amount} disabled={busy} onChange={event => setAmount(formatInputMoney(parseMoney(event.target.value)))} /></Field>
      </> : null}
      <Choices label="Equipo" options={destinations} value={chosenDestination} onChange={value => setDestination(value as ReturnDestination)} disabled={busy} />
      {chosenDestination === 'STOCK' ? <Choices label="Estado en stock" options={STOCK} value={stockStatus} onChange={setStockStatus} disabled={busy} /> : null}
    </div> : null}
    {supplier && rma === 'RECIBIDO' && current.resolution !== 'REPARACION' && canManageSensitive ? <Choices label="Estado al volver" options={STOCK} value={stockStatus} onChange={setStockStatus} disabled={busy} /> : null}
    {current.creditNote ? <div className="return-credit" data-testid="return-credit"><b>Nota de crédito</b><span>{formatMoney(current.creditNote.remaining, current.creditNote.currency === 'USD' ? 'USD' : 'ARS')} disponibles</span></div> : null}
    <section className="return-history" aria-label="Seguimiento">
      <div className="ret-sec">
        <h4>Seguimiento</h4>
        {historyButton}
      </div>
      {!voided ? <ol className="return-timeline" data-testid="return-next-step">
        <li className="next">
          <div><b>{statusLabel(supplier ? rma : status)}</b><span className="return-now">Ahora</span></div>
          <textarea aria-label="Nota de seguimiento" value={note} maxLength={280} disabled={busy} onChange={event => setNote(event.target.value)} />
        </li>
      </ol> : null}
    </section>
    </>}
  </Sheet>
  {historyOpen ? createPortal(<div className="record-history-layer rcl-history-layer">
    <Sheet title={`Historial · ${current.code}`} className="return-history-sheet hist-screen" mobileBack overlayClassName="subov" onClose={() => setHistoryOpen(false)}
      footer={phone ? null : <button className="btn2 s" type="button" onClick={() => setHistoryOpen(false)}>Cerrar</button>}>
      <ol className="return-timeline" data-testid="return-events">
        {[...current.events].reverse().map((event, index) => <li key={`${event.createdAt}-${index}`}>
          <div><b>{statusLabel(event.status)}</b><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/,\s*/, ' ')}</time></div>
          {event.note ? <p>{event.note}</p> : null}
        </li>)}
      </ol>
    </Sheet>
  </div>, historyTrigger.current?.closest('.desk-app') ?? document.body) : null}</>;

}

export function ReturnDelete({ id }: { id: string }) {
  const { returns, archiveReturn } = useAppContext();
  const { close, toast } = useDesk();
  const current = returns?.find(row => row.id === id) ?? archivedReturn(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (busy || !current || isVoidRow(current)) return;
    setBusy(true); setError(null);
    try { await archiveReturn(id); toast('Reclamo anulado'); close(); }
    catch (cause) { setError(getFriendlyErrorMessage(cause, 'No se pudo anular el reclamo.')); }
    finally { setBusy(false); }
  };
  return <Sheet title="¿Anular reclamo?" onClose={close} busy={busy} className="return-delete" footer={<Actions busyLabel="Anular" primary="Anular" danger busy={busy || !current || isVoidRow(current)} onSecondary={close} onPrimary={() => { void remove(); }} />}>
    <div><b className="rd-who">{current?.code ?? 'Reclamo'} · {current?.clientName || 'Sin cliente'}</b>
    <p className="rd-note">Queda anulado y fuera de los totales. Se conservan los movimientos registrados.</p></div>
    {error ? <p className="ferr" role="alert">{error}</p> : null}
  </Sheet>;
}
