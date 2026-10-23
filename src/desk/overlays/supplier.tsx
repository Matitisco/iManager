import { toUserMessage, isNetworkErrorMessage } from '../../lib/user-message';
import { ReasonSheet } from '../ReasonSheet';
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchSupplier, type SupplierDetail as SupplierFile } from '../../services/suppliers-api';
import { canSeeFinancials } from '../sections';
import { Mail, Phone, Plus, FileText } from 'lucide-react';
import { SupplierPurchases, SupplierPurchaseSheet, SupplierPurchaseDetail } from './supplier-purchases';
import { DeskOverlays } from '../DeskOverlays';
import type { Overlay } from '../types';
import { ListSkeleton } from '../list-skeleton';
import { Skeleton } from '../../components/Skeleton';
import { Actions, DeskProvider, Field, Sheet, SheetActionMenu, SheetActions, useDesk } from '../ui';
import './supplier.css';

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
  const { user, appSession, suppliers, archiveSupplier, restoreSupplier } = useAppContext();
  const desk = useDesk();
  const { close, open, toast } = desk;
  const seeCosts = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const [detail, setDetail] = useState<SupplierFile | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secondary, setSecondary] = useState<'purchases' | 'stock' | null>(null);
  const [purchase, setPurchase] = useState<SupplierFile['purchases'][number] | null>(null);
  const [stockOverlay, setStockOverlay] = useState<Overlay | null>(null);
  const storeId = appSession?.store?.id;
  const heading = detail ?? suppliers?.find(row => row.id === id);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setDetail(null);
    setError('');
    void fetchSupplier(user, id).then((row) => {
      if (active) setDetail(row);
    }).catch((cause: unknown) => {
      if (active) setError(toUserMessage(cause, 'No se pudo abrir el proveedor.'));
    });
    return () => { active = false; };
  }, [user, id, storeId]);

  const refresh = async () => {
    if (!user) return;
    try { setDetail(await fetchSupplier(user, id)); }
    catch { /* Secondary refresh: keep the last complete supplier file. */ }
  };

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

  if (confirm) return (
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
  );

  return (
    <>
    <Sheet title={heading?.name ?? 'Proveedor'} subtitle={heading ? `${heading.deviceCount} ${heading.deviceCount === 1 ? 'equipo' : 'equipos'}` : undefined} onClose={close} busy={busy} className="supplier-sheet"
      footer={detail ? <SheetActions>
        {detail.deletedAt ? <button className="btn2 p" type="button" disabled={busy} onClick={() => { void restore(); }}>Restaurar</button> : <>
          <SheetActionMenu>
            <button className="btn2 s" type="button" onClick={() => open({ type: 'edit-supplier', id: detail.id })}>Editar</button>
            <button className="btn2 s supplier-archive" type="button" onClick={() => setConfirm(true)}>Archivar</button>
          </SheetActionMenu>
          <button className="btn2 p sheet-primary" type="button" onClick={() => setSecondary('stock')}>Cargar stock</button>
        </>}
      </SheetActions> : !error ? <div className="supplier-loading-footer"><Skeleton className="skeleton-field" /><Skeleton className="skeleton-field" /></div> : null}>
      {error && !isNetworkErrorMessage(error) ? <div className="supplier-load-error" role="alert">{error}</div> : null}
      {!detail && !error ? <ListSkeleton variant="cards" rows={3} testId="supplier-loading" /> : null}
      {detail ? (
        <div className="supplier-file" data-testid="supplier-detail">
          {detail.phone || detail.email ? <dl className="supplier-contact icons">
            {detail.phone ? <div><dt><Phone size={18} aria-label="Teléfono" /></dt><dd title={detail.phone}>{detail.phone}</dd></div> : null}
            {detail.email ? <div><dt><Mail size={18} aria-label="Email" /></dt><dd title={detail.email}>{detail.email}</dd></div> : null}
          </dl> : null}
          {detail.notes ? <p className="supplier-note">{detail.notes}</p> : null}
          {detail.problemCount > 0 ? <p className="sup-status" data-testid="supplier-problems">{detail.problemCount} de {detail.deviceCount} {detail.deviceCount === 1 ? 'equipo con problemas' : 'equipos con problemas'}</p> : null}
          {detail.deletedAt ? <p className="supplier-note">Archivado. Los equipos conservan el origen.</p> : null}
          {detail.purchases.length > 0 ? <section className="supplier-purchases" aria-label="Compras">
            <div className="sup-sec"><h4>Compras</h4>{detail.purchases.length > 3 ? <button className="wlink" type="button" onClick={() => setSecondary('purchases')}>Ver todas ({detail.purchases.length})</button> : null}</div>
            <SupplierPurchases purchases={detail.purchases.slice(0, 3)} seeCosts={seeCosts} onSelect={setPurchase} />
          </section> : null}
        </div>
      ) : null}
    </Sheet>
    {detail && secondary === 'purchases' && !purchase ? <SupplierPurchaseSheet title="Compras" subtitle={detail.name} mobileSubtitle onClose={() => setSecondary(null)}>
      <SupplierPurchases purchases={detail.purchases} seeCosts={seeCosts} onSelect={setPurchase} />
    </SupplierPurchaseSheet> : null}
    {detail && purchase ? <SupplierPurchaseDetail supplierId={detail.id} purchase={purchase} seeCosts={seeCosts} onClose={() => setPurchase(null)} /> : null}
    {detail && secondary === 'stock' && !stockOverlay ? <Sheet title="Cargar stock" subtitle={detail.name} className="sup-choose" overlayClassName="center subov sup-top" onClose={() => setSecondary(null)}>
      <div className="card ledger-list">
        <button className="member" type="button" onClick={() => setStockOverlay({ type: 'new-eq', supplierId: detail.id })}>
          <span className="ico-row"><Plus size={18} /></span><span className="info"><span className="name">Registrar equipo</span><span className="role">Uno por uno</span></span><span className="chev" aria-hidden="true">›</span>
        </button>
        <button className="member" type="button" onClick={() => setStockOverlay({ type: 'import', kind: 'inv', supplierId: detail.id, supplierName: detail.name })}>
          <span className="ico-row"><FileText size={18} /></span><span className="info"><span className="name">Subir listado</span><span className="role">CSV, TXT o pegado</span></span><span className="chev" aria-hidden="true">›</span>
        </button>
      </div>
    </Sheet> : null}
    {stockOverlay ? <div className="supplier-stock-layer"><DeskProvider value={{ ...desk, close: () => { setStockOverlay(null); setSecondary(null); }, open: (next) => setStockOverlay(next) }}>
      <DeskOverlays overlay={stockOverlay} onSaved={refresh} />
    </DeskProvider></div> : null}
    </>
  );
}
