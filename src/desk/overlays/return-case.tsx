import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { saleWarrantyView } from '../../lib/warranty';
import { getFriendlyErrorMessage } from '../../lib/utils';
import type { ResolveReturnInput, ReturnDestination, ReturnResolution, ReturnSettlement, RmaStatus } from '../../services/returns-api';
import { formatInputMoney, formatMoney, formatShortDate, parseMoney, statusLabel } from '../format';
import { Actions, DeskIcon, Dialog, Field, Pill, Segs, Sheet, useDesk } from '../ui';

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
  return new Date().toISOString().slice(0, 10);
}

export function ReturnForm({ saleId }: { saleId?: string }) {
  const { sales = [], inventory = [], createReturn } = useAppContext();
  const { close, toast } = useDesk();
  const completed = sales.filter((sale) => sale.status === 'COMPLETADA' && !sale.voidedAt);
  const [selected, setSelected] = useState(saleId ?? '');
  const [reason, setReason] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [openedOn, setOpenedOn] = useState(today());
  const [bad, setBad] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sale = completed.find((row) => row.id === selected);
  const item = inventory.find((row) => row.id === sale?.productId);
  const coverage = sale ? saleWarrantyView(sale) : null;

  const save = async () => {
    const next: Record<string, string> = {};
    if (!sale) next.sale = 'Elegí una venta cobrada.';
    if (!reason.trim()) next.reason = 'Completá el motivo.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(openedOn)) next.date = 'Elegí una fecha.';
    setBad(next);
    if (Object.keys(next).length || !sale) return;
    setBusy(true);
    setError('');
    try {
      await createReturn({
        saleId: sale.id,
        reason: reason.trim(),
        openedOn,
        diagnosis: diagnosis.trim() || null,
        imei: item?.imei || null,
      });
      toast('Reclamo abierto');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo abrir el reclamo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Nuevo reclamo" subtitle="Sale de una venta cobrada. La plata y el equipo se mueven al resolverlo." onClose={close}>
      {error ? <div className="ferr">{error}</div> : null}
      <Field label="Venta" error={bad.sale}>
        <select aria-label="Venta" value={selected} disabled={Boolean(saleId)} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Elegí una venta</option>
          {completed.map((row) => (
            <option key={row.id} value={row.id}>
              {row.clientName || 'Sin cliente'} · {row.deviceLabel || 'Equipo'} · {formatShortDate(row.date)}
            </option>
          ))}
        </select>
      </Field>
      {sale ? (
        <div className="pending-sale" data-testid="return-sale">
          <div>
            <b>{sale.clientName || 'Sin cliente'}</b>
            <small>
              {[item?.imei ? `IMEI ${item.imei}` : 'Sin IMEI', coverage?.phrase || 'Sin garantía', formatMoney(sale.amount, sale.amountCurrency === 'USD' ? 'USD' : 'ARS')].join(' · ')}
            </small>
          </div>
        </div>
      ) : null}
      <Field label="Fecha" error={bad.date}><input type="date" aria-label="Fecha del reclamo" value={openedOn} onChange={(event) => setOpenedOn(event.target.value)} /></Field>
      <Field label="Motivo" error={bad.reason}><textarea aria-label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Qué pasó con el equipo" /></Field>
      <Field label="Diagnóstico"><textarea aria-label="Diagnóstico" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} placeholder="Opcional. Lo podés cargar después." /></Field>
      <Actions busy={busy} primary="Abrir reclamo" onSecondary={close} onPrimary={() => { void save(); }} />
    </Sheet>
  );
}

export function ReturnDetail({ id }: { id: string }) {
  const {
    returns, updateReturnDiagnosis, resolveReturn, advanceRma, archiveReturn, reloadInventory, reloadSales, reloadClients, loadCash,
  } = useAppContext();
  const { close, toast, canManageSensitive = true } = useDesk();
  const current = returns?.find((row) => row.id === id) ?? null;
  const [diagnosis, setDiagnosis] = useState(current?.diagnosis ?? '');
  const [resolution, setResolution] = useState<ReturnResolution>('REINTEGRO');
  const [settlement, setSettlement] = useState<ReturnSettlement>('REINTEGRO');
  const [amount, setAmount] = useState(current ? formatInputMoney(current.refundable || current.saleAmount) : '');
  const [destination, setDestination] = useState<ReturnDestination>('STOCK');
  const [stockStatus, setStockStatus] = useState('EN_REVISION');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const open = current && !current.deletedAt && current.status !== 'RESUELTO' && current.status !== 'EN_PROVEEDOR';
  const destinations = useMemo(() => (
    resolution === 'REPARACION'
      ? [{ id: 'CLIENTE' as const, label: 'Sigue con el cliente' }, { id: 'PROVEEDOR' as const, label: 'Al proveedor' }]
      : [{ id: 'STOCK' as const, label: 'Vuelve al stock' }, { id: 'PROVEEDOR' as const, label: 'Al proveedor' }]
  ), [resolution]);
  const chosenDestination = destinations.some((row) => row.id === destination) ? destination : destinations[0].id;

  const refresh = async () => {
    await Promise.all([
      reloadInventory?.() ?? Promise.resolve(),
      reloadSales?.() ?? Promise.resolve(),
      reloadClients?.() ?? Promise.resolve(),
      loadCash?.() ?? Promise.resolve(),
    ]);
  };

  const saveDiagnosis = async () => {
    if (!diagnosis.trim()) {
      setError('Completá el diagnóstico.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updateReturnDiagnosis(id, diagnosis.trim());
      toast('Diagnóstico guardado');
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo guardar el diagnóstico.'));
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    const input: ResolveReturnInput = {
      resolution,
      settlement: resolution === 'REPARACION' ? 'NINGUNO' : settlement,
      amount: resolution === 'REPARACION' ? 0 : parseMoney(amount),
      destination: chosenDestination,
      stockStatus: chosenDestination === 'STOCK' ? stockStatus : null,
    };
    setBusy(true);
    setError('');
    try {
      await resolveReturn(id, input);
      await refresh();
      toast('Reclamo resuelto');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo resolver el reclamo.'));
    } finally {
      setBusy(false);
    }
  };

  const moveRma = async (status: RmaStatus) => {
    setBusy(true);
    setError('');
    try {
      await advanceRma(id, status, status === 'RECIBIDO' ? stockStatus : null);
      await refresh();
      toast('RMA actualizado');
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo actualizar el RMA.'));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    setBusy(true);
    try {
      await archiveReturn(id);
      toast('Reclamo archivado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo archivar el reclamo.'));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  if (returns == null) {
    return <Sheet title="Reclamo" onClose={close}><p className="mut">Cargando el reclamo…</p></Sheet>;
  }
  if (!current) {
    return <Sheet title="Reclamo" onClose={close}><p className="ferr">No encontramos ese reclamo.</p></Sheet>;
  }

  return (
    <Sheet title={current.code} subtitle={[current.clientName, current.deviceLabel].filter(Boolean).join(' · ') || 'Devolución'} onClose={close} className="eq-sheet">
      {error ? <div className="ferr">{error}</div> : null}
      <div className="pending-sale" data-testid="return-detail">
        <div>
          <b>{current.clientName || 'Sin cliente'}</b>
          <small>
            {[current.imei ? `IMEI ${current.imei}` : 'Sin IMEI', formatShortDate(current.openedOn), current.supplierName ? `Proveedor ${current.supplierName}` : ''].filter(Boolean).join(' · ')}
          </small>
        </div>
        <Pill status={current.rmaStatus || current.status} />
      </div>
      <div className="kv"><span>Motivo</span><b>{current.reason}</b></div>
      {current.warrantyDays != null ? <div className="kv"><span>Garantía de la venta</span><b>{current.warrantyDays} días</b></div> : null}
      <p className="kicker">Seguimiento</p>
      <div className="card ledger-list" data-testid="return-events">
        {current.events.map((event, index) => (
          <div key={`${event.createdAt}-${index}`} className="member">
            <span className="ico-row"><DeskIcon name="swap" size={18} /></span>
            <span className="info">
              <span className="name">{statusLabel(event.status)}</span>
              <span className="role">{event.note || formatShortDate(event.createdAt)}</span>
            </span>
          </div>
        ))}
      </div>
      {open ? (
        <>
          <Field label="Diagnóstico"><textarea aria-label="Diagnóstico" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></Field>
          <button className="wlink" type="button" disabled={busy} onClick={() => { void saveDiagnosis(); }}>Guardar diagnóstico</button>
          {canManageSensitive ? (
            <div data-testid="return-resolve">
              <Field label="Resolución"><span /></Field>
              <Segs options={RESOLUTIONS} value={resolution} onChange={(value) => setResolution(value as ReturnResolution)} />
              {resolution === 'REPARACION' ? <p className="eqs-note">La reparación en garantía no mueve plata ni la caja.</p> : (
                <>
                  <Field label="Plata"><span /></Field>
                  <Segs options={SETTLEMENTS} value={settlement} onChange={(value) => setSettlement(value as ReturnSettlement)} />
                  <Field label="Importe"><input aria-label="Importe" inputMode="numeric" value={amount} onChange={(event) => setAmount(formatInputMoney(parseMoney(event.target.value)))} /></Field>
                </>
              )}
              <Field label="Equipo"><span /></Field>
              <Segs options={destinations} value={chosenDestination} onChange={(value) => setDestination(value as ReturnDestination)} />
              {chosenDestination === 'STOCK' || (current.status === 'EN_PROVEEDOR' && resolution !== 'REPARACION') ? (
                <>
                  <Field label="Estado en stock"><span /></Field>
                  <Segs options={STOCK} value={stockStatus} onChange={setStockStatus} />
                  <p className="eqs-note">Tiene que ser distinto al estado anterior de la venta.</p>
                </>
              ) : null}
              <Actions busy={busy} primary="Resolver reclamo" onSecondary={close} onPrimary={() => { void resolve(); }} />
            </div>
          ) : <p className="eqs-note">Podés cargar el diagnóstico. Resolver el reclamo lo hace el propietario o quien tenga permiso.</p>}
          {canManageSensitive ? <button className="wlink" type="button" onClick={() => setConfirm(true)}>Archivar reclamo</button> : null}
        </>
      ) : null}
      {current.status === 'EN_PROVEEDOR' && canManageSensitive ? (
        <div data-testid="return-rma">
          <Field label="RMA con el proveedor"><span /></Field>
          <Segs options={[
            { id: 'EN_REVISION', label: 'En revisión' },
            { id: 'APROBADO', label: 'Aprobado' },
            { id: 'RECHAZADO', label: 'Rechazado' },
            { id: 'RECIBIDO', label: 'Recibido' },
          ]} value={current.rmaStatus || 'ENVIADO'} onChange={(value) => { void moveRma(value as RmaStatus); }} />
          {current.resolution !== 'REPARACION' ? (
            <>
              <Field label="Estado al volver"><span /></Field>
              <Segs options={STOCK} value={stockStatus} onChange={setStockStatus} />
            </>
          ) : null}
        </div>
      ) : null}
      {current.creditNote ? (
        <div className="pending-sale" data-testid="return-credit">
          <div>
            <b>Nota de crédito</b>
            <small>Quedan {formatMoney(current.creditNote.remaining, current.creditNote.currency === 'USD' ? 'USD' : 'ARS')} de {formatMoney(current.creditNote.amount, current.creditNote.currency === 'USD' ? 'USD' : 'ARS')}.</small>
          </div>
        </div>
      ) : null}
      {confirm ? (
        <Dialog title="Archivar reclamo" text="El reclamo queda archivado y no se borra. Todavía no movió plata ni stock." ok="Archivar" danger busy={busy} onOk={() => { void archive(); }} onClose={() => setConfirm(false)} />
      ) : null}
    </Sheet>
  );
}
