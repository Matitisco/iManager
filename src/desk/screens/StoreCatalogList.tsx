import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../context/AppContext';
import type { CatalogEdit, NamedCatalog, PublicCatalog } from '../../types/public-catalog';
import { toActionMessage } from '../../lib/user-message';
import { PriceList } from '../../catalog/PriceList';
import { canSeeFinancials } from '../sections';
import { DeskSelect } from '../select';
import { Actions, Dialog, PageHead, Sheet, useDesk } from '../ui';
import { TablePager, usePagedRows } from '../pager';
import { ListSkeleton } from '../list-skeleton';
import { CatalogEquipmentScreen, CatalogToggle } from './PublicCatalogScreen';
import './public-catalog.css';

const defaults = { active: true, hideWithoutStock: true, hideReserved: true, minBattery: null, showPrice: true, priceCurrency: 'ORIGINAL', logoUrl: null, hours: null, priceRuleMode: 'LIST_PERCENT', priceAdjustPercent: 0 } as const;
function settings(catalog: NamedCatalog | null, financials: boolean): CatalogEdit {
  if (!catalog) return { ...defaults, name: '' };
  return { name: catalog.name, active: catalog.active, hideWithoutStock: catalog.hideWithoutStock, hideReserved: catalog.hideReserved, minBattery: catalog.minBattery, showPrice: catalog.showPrice, priceCurrency: catalog.priceCurrency, logoUrl: catalog.logoUrl, hours: catalog.hours, ...(catalog.priceRuleMode && (financials || catalog.priceRuleMode !== 'COST_PERCENT') ? { priceRuleMode: catalog.priceRuleMode, priceAdjustPercent: catalog.priceAdjustPercent ?? 0 } : {}) };
}
export function catalogSummary(catalog: NamedCatalog, financials = true) {
  const parts = [catalog.hideWithoutStock ? 'Oculta sin stock' : 'Muestra sin stock', catalog.hideReserved ? 'Oculta reservados' : 'Muestra reservados'];
  if (catalog.minBattery != null) parts.push(`Batería ≥ ${catalog.minBattery} %`);
  parts.push(!catalog.showPrice ? 'Precio oculto' : catalog.priceCurrency === 'ORIGINAL' ? 'Precio como está cargado' : `Precio en ${catalog.priceCurrency}`);
  if (catalog.priceRuleMode === 'MANUAL') parts.push('Precio por equipo');
  else if (financials && catalog.priceRuleMode === 'COST_PERCENT') parts.push(`${catalog.priceAdjustPercent} % sobre costo`);
  else if (catalog.priceRuleMode === 'LIST_PERCENT' && catalog.priceAdjustPercent) parts.push(`${catalog.priceAdjustPercent > 0 ? '+' : ''}${catalog.priceAdjustPercent} % sobre lista`);
  return parts.join(' · ');
}
export function StoreCatalogList() {
  const { storeCatalogs, loadStoreCatalogs, saveNamedCatalog, appSession } = useAppContext();
  const { back, toast } = useDesk();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const owner = appSession?.membership?.role === 'OWNER';
  const financials = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void loadStoreCatalogs().catch(cause => { if (active) setError(toActionMessage(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadStoreCatalogs]);
  const toggle = async (catalog: NamedCatalog) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await saveNamedCatalog(catalog.id, { active: !catalog.active }); }
    catch (cause) { setError(toActionMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  };
  const copy = async (slug: string) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/c/${slug}`); toast('Link copiado'); }
    catch { setError('No se pudo copiar el link. Podés abrirlo y copiar la dirección.'); }
  };
  const current = storeCatalogs.find(row => row.id === editing) ?? null;
  return <div className="dscreen catalog-screen" data-testid="catalog-screen" aria-busy={loading}>
    <PageHead title="Catálogos" back={back} action={<button className="cat-button dark" disabled={loading || busy || storeCatalogs.length >= 10} onClick={() => setEditing('new')}>Nuevo catálogo</button>} />
    {error && <div className="ferr" role="alert">{error}</div>}
    {loading && !storeCatalogs.length ? <ListSkeleton variant="rows" rows={3} testId="catalog-loading" /> : <div className="cat-catalog-list">
      {storeCatalogs.map(catalog => <article className="cat-catalog-row" key={catalog.id} aria-label={catalog.name}>
        <div className="cat-catalog-identity"><h2>{catalog.name}</h2><a href={`/c/${catalog.slug}`} target="_blank" rel="noreferrer">/c/{catalog.slug}</a></div>
        <p>{catalogSummary(catalog, financials)}</p>
        <div className="cat-catalog-count"><b>{catalog.counts.visible}</b><small>en la lista</small></div>
        <div className="cat-catalog-actions"><button className="cat-button" onClick={() => void copy(catalog.slug)}>Copiar link</button>{owner && <CatalogToggle label={`Catálogo activo: ${catalog.name}`} checked={catalog.active} disabled={busy} onChange={() => void toggle(catalog)} />}<button className="cat-edit" onClick={() => setEditing(catalog.id)}>Editar ›</button></div>
      </article>)}
    </div>}
    {storeCatalogs.length >= 10 && <p className="cat-empty">Llegaste al límite de 10 catálogos.</p>}
    {(editing === 'new' || current) && createPortal(<StoreCatalogEditor key={editing} catalog={current} copy={copy} onClose={() => setEditing(null)} />, document.querySelector('.desk-app') ?? document.body)}
  </div>;
}

function StoreCatalogEditor({ catalog, copy, onClose }: { catalog: NamedCatalog | null; copy: (slug: string) => Promise<void>; onClose: () => void }) {
  const { regenerateNamedCatalog, saveNamedCatalog, deleteNamedCatalog, previewNamedCatalog, appSession } = useAppContext();
  const owner = appSession?.membership?.role === 'OWNER';
  const financials = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const [draft, setDraft] = useState<CatalogEdit>(() => settings(catalog, financials));
  const [adjustment, setAdjustment] = useState(() => String(catalog?.priceAdjustPercent ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [preview, setPreview] = useState<PublicCatalog | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const pending = useRef(false);
  // Keep the request independent of context function identities; abort stale drafts.
  const previewRequest = useRef(previewNamedCatalog); previewRequest.current = previewNamedCatalog;
  const visibleDraft = JSON.stringify(draft);
  useEffect(() => {
    if (!showPreview) return;
    const controller = new AbortController();
    setPreview(null); setPreviewError('');
    const timer = window.setTimeout(() => {
      void previewRequest.current(catalog?.id ?? null, JSON.parse(visibleDraft) as CatalogEdit, controller.signal).then(data => { if (!controller.signal.aborted) setPreview(data); }).catch(cause => { if (!controller.signal.aborted) setPreviewError(toActionMessage(cause)); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [visibleDraft, catalog?.id, showPreview]);
  const save = async (remove = false, regenerate = false) => {
    if (pending.current) return;
    if (!remove && !regenerate && !draft.name?.trim()) { setError('Poné un nombre para el catálogo.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      if (regenerate && catalog) await regenerateNamedCatalog(catalog.id);
      else if (remove && catalog) await deleteNamedCatalog(catalog.id);
      else {
        const { active, ...input } = draft;
        await saveNamedCatalog(catalog?.id ?? null, owner || !catalog ? { ...input, active } : input);
      }
      onClose();
    } catch (cause) { setError(toActionMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  };
  const rule = (key: 'hideWithoutStock' | 'hideReserved' | 'showPrice', label: string) => <div className="cat-rule-row"><b>{label}</b><CatalogToggle label={label} checked={!!draft[key]} disabled={busy} onChange={() => setDraft(current => ({ ...current, [key]: !current[key] }))} /></div>;
  const itemsPage = usePagedRows(catalog?.items ?? [], catalog?.id, 16);
  const manual = draft.priceRuleMode === 'MANUAL';
  const manualEdit = (inventoryItemId: string, price: number | null, currency: 'ARS' | 'USD') => setDraft(current => ({ ...current, manualPrices: [...(current.manualPrices ?? []).filter(row => row.inventoryItemId !== inventoryItemId), { inventoryItemId, price, currency }] }));
  return <><Sheet title={catalog?.name ?? 'Nuevo catálogo'} onClose={() => { if (!busy) onClose(); }} busy={busy} mobileBack className="cat-rules-sheet cat-multiple-editor" overlayClassName="cat-editor-overlay" footer={<Actions primary="Guardar" onPrimary={() => void save()} onSecondary={onClose} busy={busy} />}>
    {!confirmDelete && !confirmRegenerate && error && <div className="ferr" role="alert">{error}</div>}
    <div className="cat-rule-box cat-catalog-fields">
      <label className="cat-rule-row"><b>Nombre</b><input aria-label="Nombre" maxLength={100} value={draft.name ?? ''} disabled={busy} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></label>
      <div className="cat-rule-row"><b>Link</b>{catalog ? <><a className="cat-editor-link" href={`/c/${catalog.slug}`} target="_blank" rel="noreferrer">/c/{catalog.slug}</a><button className="cat-button dark" onClick={() => void copy(catalog.slug)}>Copiar</button></> : <small>Se crea al guardar.</small>}</div>
    </div>
    <div className="cat-label">Qué equipos se muestran <span>{catalog?.counts.visible ?? 0} visibles</span></div>
    <div className="cat-rule-box">{rule('hideWithoutStock', 'Ocultar sin stock y vendidos')}{rule('hideReserved', 'Ocultar reservados')}
      <div className="cat-rule-row"><b>Ocultar batería menor a</b><input type="number" aria-label="Batería mínima" min="0" max="100" value={draft.minBattery ?? 80} disabled={busy || draft.minBattery == null} onChange={event => setDraft(current => ({ ...current, minBattery: Number(event.target.value) }))} /><CatalogToggle label="Ocultar batería menor a" checked={draft.minBattery != null} disabled={busy} onChange={() => setDraft(current => ({ ...current, minBattery: current.minBattery == null ? 80 : null }))} /></div>
    </div>
    <div className="cat-label">Precio</div>
    <div className="cat-rule-box">{rule('showPrice', 'Mostrar precio')}
      <div className="cat-rule-row cat-price-mode"><b>Regla de precio</b><DeskSelect label="Regla de precio" value={draft.priceRuleMode ?? 'PRIVATE'} disabled={busy} onChange={value => setDraft(current => ({ ...current, priceRuleMode: value as CatalogEdit['priceRuleMode'], priceAdjustPercent: current.priceAdjustPercent ?? 0 }))} options={[
        ...(!draft.priceRuleMode ? [{ value: 'PRIVATE', label: 'Precio configurado', disabled: true }] : []),
        { value: 'LIST_PERCENT', label: '% sobre el precio de lista' },
        ...(financials ? [{ value: 'COST_PERCENT', label: '% sobre el costo' }] : []),
        { value: 'MANUAL', label: 'Precio por equipo' },
      ]} /></div>
      {draft.priceRuleMode && !manual && <label className="cat-rule-row"><b>Ajuste sobre el precio</b><input aria-label="Ajuste sobre el precio" type="number" min="-100" max="10000" step="0.01" disabled={busy} value={adjustment} onChange={event => { setAdjustment(event.target.value); setDraft(current => ({ ...current, priceAdjustPercent: Number(event.target.value) })); }} /><span>%</span></label>}
      <div className="cat-currency"><b>Moneda</b><div>{(['USD', 'ARS', 'ORIGINAL'] as const).map(currency => <button key={currency} className={draft.priceCurrency === currency ? 'on' : ''} disabled={busy} onClick={() => setDraft(current => ({ ...current, priceCurrency: currency }))}>{currency === 'ORIGINAL' ? 'Como está cargado' : currency}</button>)}</div><small>Los precios se convierten con la cotización de venta de la tienda.</small></div>
    </div>
    <p className="cat-editor-note">Todos los catálogos comparten los equipos marcados como visibles. Cada uno tiene sus propias reglas y precios.</p>
    {manual && <div className="cat-manual-prices"><div className="cat-label">Precio por equipo</div><p className="cat-editor-note">Si dejás un precio vacío, se usa el precio de lista. La moneda se convierte según la opción de arriba.</p>{!catalog && <p>Guardá el catálogo para cargar precios por equipo.</p>}{itemsPage.visible.map(item => {
      const changed = draft.manualPrices?.find(row => row.inventoryItemId === item.id);
      const value = changed ? changed.price : item.manualPrice;
      const currency = changed?.currency ?? (item.manualCurrency === 'USD' ? 'USD' : 'ARS');
      return <div className="cat-manual-row" key={item.id}><div><b>{item.model} · {item.capacity}</b><small>{item.color}{item.reason ? ` · ${item.reason}` : ''}</small></div><input aria-label={`Precio manual de ${item.model} ${item.capacity} ${item.color}`} type="number" min="0" max="9999999999.99" step="0.01" disabled={busy} value={value ?? ''} placeholder="Lista" onChange={event => manualEdit(item.id, event.target.value === '' ? null : Number(event.target.value), currency)} /><DeskSelect label={`Moneda de ${item.model} ${item.capacity} ${item.color}`} value={currency} disabled={busy} options={[{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]} onChange={next => manualEdit(item.id, value ?? null, next as 'ARS' | 'USD')} /></div>;
    })}<TablePager page={itemsPage.page} pages={itemsPage.pages} total={itemsPage.total} from={itemsPage.from} to={itemsPage.to} onPage={itemsPage.setPage} pageSize={16} /></div>}
    {catalog && <details className="cat-editor-equipment"><summary>Equipos y visibilidad compartida</summary><CatalogEquipmentScreen catalogOverride={catalog} embedded /></details>}
    <details className="cat-brand-details"><summary>Logo y horario</summary><div className="cat-brand-fields"><label>Logo de la tienda (URL https)<input type="url" value={draft.logoUrl ?? ''} disabled={busy} onChange={event => setDraft(current => ({ ...current, logoUrl: event.target.value || null }))} /></label><label>Horario de atención<input maxLength={120} value={draft.hours ?? ''} disabled={busy} onChange={event => setDraft(current => ({ ...current, hours: event.target.value || null }))} /></label></div></details>
    <details className="cat-editor-preview" onToggle={event => setShowPreview(event.currentTarget.open)}><summary>Vista previa</summary>{showPreview && (previewError ? <div role="alert" className="ferr">{previewError}</div> : preview ? <div className="cat-preview public-price-page"><PriceList items={preview.items.slice(0, 6)} /></div> : <ListSkeleton variant="lines" rows={3} />)}</details>
    {catalog && owner && <button className="cat-button" disabled={busy} onClick={() => setConfirmRegenerate(true)}>Regenerar link</button>}
    {catalog && owner && !catalog.isDefault && <button className="cat-button danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Borrar catálogo</button>}
  </Sheet>{confirmRegenerate && <Dialog title="¿Regenerar el link?" text="El link anterior deja de funcionar. Las reglas y los equipos se conservan. Guardá tus cambios antes de regenerar." ok="Regenerar link" busy={busy} error={error} onClose={() => { if (!busy) setConfirmRegenerate(false); }} onOk={() => void save(false, true)} />}{confirmDelete && <Dialog title="¿Borrar el catálogo?" text="El link deja de funcionar y se borran los precios de este catálogo. Los equipos quedan en Stock." ok="Borrar catálogo" danger busy={busy} error={error} onClose={() => { if (!busy) setConfirmDelete(false); }} onOk={() => void save(true)} />}</>;
}
