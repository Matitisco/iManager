import { ReasonSheet } from '../ReasonSheet';
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchSupplier, type SupplierDetail as SupplierFile } from '../../services/suppliers-api';
import { canSeeFinancials } from '../sections';
import { equipmentTitle, formatShortDate } from '../format';
import { ListSkeleton } from '../list-skeleton';
import { Actions, DeskIcon, Field, Sheet, SheetActionMenu, SheetActions, useDesk } from '../ui';
import { useMoney } from '../exchange';
import './supplier.css';

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
  const form = useRef<HTMLFormElement>(null);
  const saving = useRef(false);

  const save = async () => {
    if (saving.current) return;
    if (!name.trim()) {
      setBad('Completá el nombre.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await saveSupplier({ name: name.trim(), phone, email, notes }, id);
      toast(id ? 'Proveedor actualizado' : 'Proveedor cargado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo guardar el proveedor.'));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <Sheet title={id ? 'Editar proveedor' : 'Nuevo proveedor'} className="supplier-sheet" onClose={close} busy={busy}
      footer={<Actions busy={busy} primary={id ? 'Guardar cambios' : 'Guardar proveedor'} onSecondary={close} onPrimary={() => form.current?.requestSubmit()} />}>
      {error ? <div className="ferr" role="alert">{error}</div> : null}
      <form ref={form} noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset className="supplier-fields" disabled={busy}>
          <Field label="Nombre" error={bad}><input autoComplete="organization" maxLength={120} value={name} aria-required="true" aria-invalid={!!bad} onChange={(event) => { setName(event.target.value); setBad(''); }} placeholder="Ej. Mayorista Centro" /></Field>
          <Field label="Teléfono"><input type="tel" autoComplete="tel" maxLength={50} value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
          <Field label="Email"><input type="email" autoComplete="email" maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field label="Notas"><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        </fieldset>
        <button className="supplier-submit" type="submit" tabIndex={-1} aria-hidden="true" disabled={busy} />
      </form>
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
  const [retry, setRetry] = useState(0);
  const storeId = appSession?.store?.id;

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
  }, [user, id, storeId, retry]);

  const archive = async (reason: string) => {
    setBusy(true);
    try {
      await archiveSupplier(id, reason);
      toast('Proveedor archivado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo archivar el proveedor.'));
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
    <Sheet title={detail?.name ?? 'Proveedor'} subtitle={detail ? `${detail.deviceCount} ${detail.deviceCount === 1 ? 'equipo' : 'equipos'}` : undefined} onClose={close} busy={busy} className="supplier-sheet"
      footer={detail ? <SheetActions>
        {detail.deletedAt ? <button className="btn2 p" type="button" disabled={busy} onClick={() => { void restore(); }}>Restaurar</button> : <>
          <SheetActionMenu>
            <button className="btn2 s" type="button" onClick={() => open({ type: 'import', kind: 'inv', supplierId: detail.id, supplierName: detail.name })}>Subir stock</button>
            <button className="btn2 s" type="button" onClick={() => open({ type: 'edit-supplier', id: detail.id })}>Editar</button>
            <button className="btn2 s supplier-archive" type="button" onClick={() => setConfirm(true)}>Archivar</button>
          </SheetActionMenu>
          <button className="btn2 p sheet-primary" type="button" onClick={() => open({ type: 'new-eq', supplierId: detail.id })}>Registrar equipo</button>
        </>}
      </SheetActions> : null}>
      {error && !confirm ? <div className="ferr" role="alert">{error}{!detail ? <button className="wlink" type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button> : null}</div> : null}
      {!detail && !error ? <ListSkeleton variant="cards" rows={3} testId="supplier-loading" /> : null}
      {detail ? (
        <div className="supplier-file" data-testid="supplier-detail">
          {detail.phone || detail.email ? <dl className="supplier-contact">
            {detail.phone ? <div><dt>Teléfono</dt><dd>{detail.phone}</dd></div> : null}
            {detail.email ? <div><dt>Email</dt><dd>{detail.email}</dd></div> : null}
          </dl> : null}
          {detail.notes ? <p className="supplier-note">{detail.notes}</p> : null}
          {problemLine(detail.problemCount, detail.deviceCount) ? <p className="supplier-status" data-testid="supplier-problems">{problemLine(detail.problemCount, detail.deviceCount)}</p> : null}
          {detail.deletedAt ? <p className="supplier-note">Archivado. Los equipos conservan el origen.</p> : null}
          <section className="supplier-purchases" aria-label="Compras">
            <h4>Compras</h4>
            {detail.purchases.length === 0 ? <p className="supplier-empty">Todavía no hay compras.</p> : detail.purchases.map((purchase) => (
              <section key={purchase.id} className="supplier-purchase" aria-label={purchase.id === 'sin-lote' ? 'Sin compra agrupada' : `Compra del ${formatShortDate(purchase.purchasedAt)}`}>
                <header>
                  <h5>{purchase.id === 'sin-lote' ? 'Sin compra agrupada' : `Compra del ${formatShortDate(purchase.purchasedAt)}`}</h5>
                  {purchase.notes && purchase.id !== 'sin-lote' ? <p>{purchase.notes}</p> : null}
                </header>
                {purchase.items.length === 0 ? <p className="supplier-empty">Sin equipos.</p> : purchase.items.map((item) => (
                  <button key={item.id} className="supplier-item" type="button" onClick={() => open({ type: 'eq', id: item.id })}>
                    <span className="supplier-item-icon" aria-hidden="true"><DeskIcon name="list" size={16} /></span>
                    <span className="supplier-item-name">{equipmentTitle(item.model, item.capacity)}</span>
                    {seeCosts && item.cost != null ? <span className="supplier-item-cost">{money.show(item.cost, item.currency)}</span> : null}
                    <span className="supplier-item-imei">{item.imei || 'Sin IMEI'}</span>
                    {item.problemLabel ? <span className="supplier-item-status">{item.problemLabel}</span> : null}
                  </button>
                ))}
              </section>
            ))}
          </section>
        </div>
      ) : null}
      {confirm ? (
        <ReasonSheet
          title="Archivar proveedor"
          note="El proveedor queda archivado. Los equipos conservan el origen y nada se borra."
          ok="Archivar"
          danger
          busy={busy}
          error={error}
          onOk={(reason) => { void archive(reason); }}
          onClose={() => { if (!busy) setConfirm(false); }}
        />
      ) : null}
    </Sheet>
  );
}
