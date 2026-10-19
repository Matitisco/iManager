import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchSupplier, type SupplierDetail as SupplierFile } from '../../services/suppliers-api';
import { canSeeFinancials } from '../sections';
import { equipmentTitle, formatShortDate } from '../format';
import { ListSkeleton } from '../list-skeleton';
import { Actions, DeskIcon, Dialog, Field, Sheet, useDesk } from '../ui';
import { useMoney } from '../exchange';

function problemLine(problems: number, devices: number) {
  if (!problems || !devices) return '';
  const noun = devices === 1 ? 'equipo está' : 'equipos están';
  return `${problems} de ${devices} ${noun} en revisión o en servicio.`;
}

export function SupplierForm({ id }: { id?: string }) {
  const { suppliers, saveSupplier } = useAppContext();
  const { close, toast } = useDesk();
  const current = suppliers?.find((row) => row.id === id);
  const [name, setName] = useState(current?.name ?? '');
  const [phone, setPhone] = useState(current?.phone ?? '');
  const [email, setEmail] = useState(current?.email ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [bad, setBad] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) {
      setBad('Completá el nombre.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveSupplier({ name: name.trim(), phone, email, notes }, id);
      toast(id ? 'Proveedor actualizado' : 'Proveedor cargado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo guardar el proveedor.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={id ? 'Editar proveedor' : 'Nuevo proveedor'} subtitle="El nombre alcanza para empezar." onClose={close}>
      {error ? <div className="ferr">{error}</div> : null}
      <Field label="Nombre" error={bad}><input value={name} onChange={(event) => { setName(event.target.value); setBad(''); }} placeholder="Ej. Mayorista Centro" /></Field>
      <Field label="Teléfono"><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Opcional" /></Field>
      <Field label="Email"><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Opcional" /></Field>
      <Field label="Notas"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" /></Field>
      <Actions busy={busy} primary={id ? 'Guardar cambios' : 'Guardar proveedor'} onSecondary={close} onPrimary={() => { void save(); }} />
    </Sheet>
  );
}

export function SupplierDetail({ id }: { id: string }) {
  const { user, appSession, archiveSupplier, restoreSupplier } = useAppContext();
  const money = useMoney();
  const { close, open, toast } = useDesk();
  const seeCosts = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const [detail, setDetail] = useState<SupplierFile | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setDetail(null);
    setError('');
    void fetchSupplier(user, id).then((row) => {
      if (active) setDetail(row);
    }).catch((cause: unknown) => {
      if (active) setError(getFriendlyErrorMessage(cause, 'No se pudo abrir el proveedor.'));
    });
    return () => { active = false; };
  }, [user, id]);

  const archive = async () => {
    setBusy(true);
    try {
      await archiveSupplier(id);
      toast('Proveedor archivado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo archivar el proveedor.'));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await restoreSupplier(id);
      toast('Proveedor restaurado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo restaurar el proveedor.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={detail?.name ?? 'Proveedor'} subtitle={detail ? `${detail.deviceCount} ${detail.deviceCount === 1 ? 'equipo' : 'equipos'}` : 'Compras y origen'} onClose={close} className="eq-sheet">
      {error ? <div className="ferr">{error}</div> : null}
      {!detail && !error ? <ListSkeleton variant="cards" rows={3} testId="supplier-loading" /> : null}
      {detail ? (
        <div data-testid="supplier-detail">
          {detail.phone ? <div className="kv"><span>Teléfono</span><b>{detail.phone}</b></div> : null}
          {detail.email ? <div className="kv"><span>Email</span><b>{detail.email}</b></div> : null}
          {detail.notes ? <p className="eqs-note">{detail.notes}</p> : null}
          {problemLine(detail.problemCount, detail.deviceCount) ? <p className="eqs-note" data-testid="supplier-problems">{problemLine(detail.problemCount, detail.deviceCount)}</p> : null}
          {detail.deletedAt ? <p className="archive-note">Archivado. Los equipos conservan el origen.</p> : null}
          <div className="sacts">
            {detail.deletedAt ? (
              <button className="btn2 p" type="button" disabled={busy} onClick={() => { void restore(); }}>Restaurar</button>
            ) : (
              <>
                <button className="btn2 s" type="button" onClick={() => open({ type: 'new-eq', supplierId: detail.id })}>Registrar equipo</button>
                <button className="btn2 s" type="button" onClick={() => open({ type: 'import', kind: 'inv', supplierId: detail.id, supplierName: detail.name })}>Subir stock</button>
                <button className="btn2 s" type="button" onClick={() => open({ type: 'edit-supplier', id: detail.id })}>Editar</button>
                <button className="btn2 s" type="button" onClick={() => setConfirm(true)}>Archivar</button>
              </>
            )}
          </div>
          {detail.purchases.length === 0 ? <p className="eqs-note">Todavía no hay compras de este proveedor.</p> : detail.purchases.map((purchase) => (
            <section key={purchase.id} className="card ledger-list">
              <b>{purchase.id === 'sin-lote' ? 'Sin compra agrupada' : `Compra del ${formatShortDate(purchase.purchasedAt)}`}</b>
              {purchase.notes ? <p className="eqs-note">{purchase.notes}</p> : null}
              {purchase.problemCount ? <p className="eqs-note">{problemLine(purchase.problemCount, purchase.items.length)}</p> : null}
              {purchase.items.map((item) => (
                <button key={item.id} className="member" type="button" onClick={() => open({ type: 'eq', id: item.id })}>
                  <span className="ico-row"><DeskIcon name="list" size={18} /></span>
                  <span className="info">
                    <span className="name">{equipmentTitle(item.model, item.capacity)}</span>
                    <span className="role">{item.imei || 'Sin IMEI'}{item.problemLabel ? ` · ${item.problemLabel}` : ''}</span>
                  </span>
                  {seeCosts && item.cost != null ? <span className="rtxt">{money.show(item.cost, item.currency)}</span> : null}
                </button>
              ))}
            </section>
          ))}
        </div>
      ) : null}
      {confirm ? (
        <Dialog
          title="Archivar proveedor"
          text="El proveedor queda archivado. Los equipos conservan el origen y nada se borra."
          ok="Archivar"
          danger
          busy={busy}
          onOk={() => { void archive(); }}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </Sheet>
  );
}
