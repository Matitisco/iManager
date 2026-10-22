import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, Eye, EyeOff, Link, MessageCircle, RefreshCw, Search, Settings2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../context/AppContext';
import type { CatalogSettings, ManagedCatalog } from '../../types/public-catalog';
import { NETWORK_ERROR_MESSAGE, toUserMessage } from '../../lib/user-message';
import { catalogCondition, catalogPrice, whatsappLink } from '../../catalog/presentation';
import { fetchPublicCatalog } from '../../services/public-catalog-api';
import type { PublicCatalog } from '../../types/public-catalog';
import { PriceList } from '../../catalog/PriceList';
import { usePhoneLayout } from '../section-notices';
import { suppressLocalNetworkBanner, useOfflineBannerOwned } from '../offline-banner';
import { Actions, Dialog, PageHead, Sheet, useDesk } from '../ui';
import { TablePager, usePagedRows } from '../pager';
import { ListSkeleton } from '../list-skeleton';
import { Skeleton } from '../../components/Skeleton';
import '../../catalog/catalog.css';
import './public-catalog.css';

const CATALOG_PAGE_SIZE = 16;

export function CatalogToggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} className={`cat-toggle${checked ? ' on' : ''}`} onClick={onChange}><span /></button>;
}
export function PublicCatalogScreen() {
  const { publicCatalog: catalog, loadPublicCatalog, savePublicCatalog, setCatalogVisibility, appSession } = useAppContext();
  const { toast, open, back } = useDesk();
  const phone = usePhoneLayout();
  const offlineOwned = useOfflineBannerOwned();
  const [tab, setTab] = useState('summary');
  const [query, setQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rules, setRules] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const pending = useRef(false);
  const equipment = useRef<HTMLElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setUnavailable(false);
    void loadPublicCatalog().catch(cause => {
      if (!active) return;
      console.warn('No se pudo cargar el catálogo.', cause);
      setUnavailable(true);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadPublicCatalog]);
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(toUserMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  };
  const link = catalog ? `${window.location.origin}/c/${catalog.slug}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copiado'); }
    catch { setError('No se pudo copiar el link. Podés seleccionarlo y copiarlo.'); }
  };
  const share = `https://wa.me/?text=${encodeURIComponent(`Te paso nuestra lista de precios \u{1F449} ${link}`)}`;
  const storePhone = whatsappLink(appSession?.store?.phone ?? null, 'Hola');
  const available = catalog?.counts.available ?? 0;
  const counts = <div className="cat-counts">{[['En la lista', catalog?.counts.visible], ['Ocultos por reglas', catalog?.counts.rules], ['Ocultos a mano', catalog?.counts.manual]].map(([label, value]) => <div key={label}><small>{label}</small><b>{value ?? 0}</b></div>)}</div>;
  const rows = catalog?.items.filter(item => `${item.model} ${item.color} ${item.capacity}`.toLowerCase().includes(query.toLowerCase())) ?? [];
  // Item visibility changes must not reset pagination when the catalog is refreshed.
  const resetKey = JSON.stringify([query, catalog?.active, catalog?.hideWithoutStock, catalog?.hideReserved, catalog?.minBattery, catalog?.showPrice, catalog?.priceCurrency]);
  const page = usePagedRows(rows, resetKey, CATALOG_PAGE_SIZE);
  const previousPage = useRef(page.page);
  useLayoutEffect(() => {
    if (previousPage.current === page.page) return;
    previousPage.current = page.page;
    const list = equipment.current;
    if (!list) return;
    const viewport = list.closest('.stage')?.getBoundingClientRect();
    const top = list.getBoundingClientRect().top;
    if (top < (viewport?.top ?? 0) || top >= (viewport?.bottom ?? window.innerHeight)) {
      list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page.page]);
  const selectedIds = catalog?.items.filter(item => selected.has(item.id)).map(item => item.id) ?? [];
  const selectedElsewhere = selectedIds.length - page.visible.filter(item => selected.has(item.id)).length;
  const selectedFiltered = rows.filter(item => selected.has(item.id)).length;
  const allFilteredSelected = rows.length > 0 && selectedFiltered === rows.length;
  const selectAll = () => setSelected(current => {
    const next = new Set(current);
    rows.forEach(item => { if (allFilteredSelected) next.delete(item.id); else next.add(item.id); });
    return next;
  });
  return <div className="dscreen catalog-screen" data-testid="catalog-screen" aria-busy={loading}>
    <PageHead title="Catálogo" subtitle={!catalog ? 'Tu lista de precios pública' : `Tu lista de precios pública · ${catalog?.counts.visible ?? 0} ${(catalog?.counts.visible ?? 0) === 1 ? 'equipo visible' : 'equipos visibles'}`} back={back} action={catalog && !phone ? <div className="cat-header-actions"><button className="cat-button" onClick={() => setRules(true)}><Settings2 size={16} />Reglas y precio</button><a className="cat-button dark" href={share} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} />Compartir por WhatsApp</a></div> : undefined} />
    {error && !suppressLocalNetworkBanner(error, offlineOwned) ? <div className="ferr" role="alert" data-testid={error === NETWORK_ERROR_MESSAGE ? 'offline-banner' : undefined}>{error}</div> : null}
    {!storePhone && <p className="cat-phone-warn" role="status">Cargá un WhatsApp válido para que tus clientes te escriban. <button type="button" onClick={() => open({ type: 'store', focus: 'phone' })}>Configuración de la tienda</button></p>}
    {loading && !catalog ? <CatalogSkeleton /> : !catalog && unavailable ? <p className="cat-empty">Sin catálogo para mostrar.</p> : !catalog ? <div className="cat-card cat-start"><h2>Tu lista de precios pública</h2><p>Elegí los equipos que querés compartir con tus clientes.</p><button className="cat-button dark" disabled={busy} onClick={() => void run(() => savePublicCatalog({ active: true }))}>Crear catálogo</button></div> : <>
      {phone && <div className="cat-tabs"><button className={tab === 'summary' ? 'on' : ''} onClick={() => setTab('summary')}>Resumen</button><button className={tab === 'items' ? 'on' : ''} onClick={() => setTab('items')}>Equipos</button></div>}
      {!phone && counts}
      <div className="cat-layout">
        {(!phone || tab === 'items') && <section className="cat-card cat-equipment" ref={equipment}>
          <div className="cat-card-title">
            <h2>Equipos</h2>
            <small>{page.pages > 1 ? `Página ${page.page} de ${page.pages}` : `${available} ${available === 1 ? 'disponible' : 'disponibles'}`}</small>
          </div>
          <div className="cat-search">
            <label className="cat-search-field">
              <Search size={16} aria-hidden="true" />
              <input aria-label="Buscar equipo" placeholder="Buscar equipo" value={query} onChange={e => setQuery(e.target.value)} />
            </label>
            <button className="cat-button" onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}>{selecting ? 'Listo' : 'Seleccionar'}</button>
          </div>
          {query && <div className="cat-search-results">
            <span>{rows.length} {rows.length === 1 ? 'resultado' : 'resultados'}</span>
            <button type="button" onClick={() => setQuery('')}>Limpiar</button>
          </div>}
          {selecting && <>
            <div className="cat-bulk">
              <div className="cat-bulk-counts">
                <b>{selectedIds.length} {selectedIds.length === 1 ? 'seleccionado' : 'seleccionados'}</b>
                {selectedElsewhere > 0 && <small>{selectedElsewhere} en otras páginas</small>}
              </div>
              <div className="cat-bulk-actions">
                <button className="cat-button" disabled={busy || !selectedIds.length} onClick={() => void run(async () => { await setCatalogVisibility(selectedIds, true); setSelected(new Set()); })}><Eye size={16} />Mostrar</button>
                <button className="cat-button" disabled={busy || !selectedIds.length} onClick={() => void run(async () => { await setCatalogVisibility(selectedIds, false); setSelected(new Set()); })}><EyeOff size={16} />Ocultar</button>
              </div>
            </div>
            <label className="cat-select-all">
              <input type="checkbox" checked={allFilteredSelected} disabled={!rows.length} ref={input => { if (input) input.indeterminate = selectedFiltered > 0 && !allFilteredSelected; }} onChange={selectAll} />
              Seleccionar todos ({rows.length})
            </label>
          </>}
          {page.visible.map(item => <div className={`cat-equipment-row${selected.has(item.id) ? ' selected' : ''}`} key={item.id}>
            {selecting && <input type="checkbox" aria-label={`Seleccionar ${item.model} ${item.capacity}`} checked={selected.has(item.id)} onChange={() => setSelected(current => { const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })} />}
            <div className="cat-equipment-info"><b>{item.model} · {item.capacity}</b><small>{item.color} · {catalogCondition(item)} · bat. {item.batteryHealth}</small>{item.reason && <span className={`cat-reason${item.reason === 'Oculto a mano' ? ' manual' : ''}`}><EyeOff size={11} />{item.reason}</span>}</div>
            {!selecting && <><strong>{catalogPrice({ ...item, currency: item.currency ?? appSession?.store?.currency })}</strong><CatalogToggle label={`Visible en catálogo: ${item.model} ${item.capacity}`} checked={item.catalogVisible && !item.reason} disabled={busy || (!!item.reason && item.reason !== 'Oculto a mano')} onChange={() => void run(() => setCatalogVisibility([item.id], !item.catalogVisible))} /></>}
          </div>)}
          {!rows.length && <p className="cat-empty">{catalog.items.length ? 'No hay equipos con esa búsqueda.' : 'Agregá equipos en Inventario para publicarlos.'}</p>}
          <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} pageSize={CATALOG_PAGE_SIZE} />
        </section>}
        {(!phone || tab === 'summary') && <aside className="cat-summary">
          <section className="cat-card cat-link"><div className="cat-card-title"><h2>Link público</h2><span className={`cat-active${catalog.active ? ' on' : ''}`}>● {catalog.active ? 'Activo' : 'Pausado'}</span></div><div className="cat-link-box"><Link size={16} /><input aria-label="Link público" readOnly value={link} /><button className="cat-button dark" onClick={() => void copy()}>Copiar</button></div><div className="cat-share-actions"><a href={share} target="_blank" rel="noopener noreferrer"><span className="green"><MessageCircle size={20} /></span>WhatsApp</a><button onClick={() => void copy()}><span className="yellow"><Link size={20} /></span>Copiar link</button><a href={link} target="_blank" rel="noopener noreferrer"><span><ExternalLink size={20} /></span>Abrir</a></div></section>
          {phone && counts}
          <section className="cat-card"><div className="cat-card-title"><h2>Reglas y precio</h2><button className="cat-edit" onClick={() => setRules(true)}>Editar ›</button></div><div className="cat-rule-chips">{catalog.hideWithoutStock && <span>Oculta sin stock</span>}{catalog.hideReserved && <span>Oculta reservados</span>}{catalog.minBattery != null && <span>Oculta batería &lt; {catalog.minBattery} %</span>}<span>{catalog.showPrice ? `Precio visible · ${catalog.priceCurrency === 'ORIGINAL' ? 'Como está cargado' : catalog.priceCurrency}` : 'Precio oculto'}</span></div></section>
          <section className="cat-card"><div className="cat-card-title"><h2>Así lo ven tus clientes</h2><a className="cat-edit" href={link} target="_blank" rel="noopener noreferrer">Abrir ›</a></div><CatalogPreview catalog={catalog} storePhone={appSession?.store?.phone ?? null} /></section>
        </aside>}
      </div>
    </>}
    {rules && catalog && createPortal(<CatalogRules catalog={catalog} onClose={() => setRules(false)} />, document.querySelector('.desk-app') ?? document.body)}
  </div>;
}
function CatalogRules({ catalog, onClose }: { catalog: ManagedCatalog; onClose: () => void }) {
  const { savePublicCatalog, regeneratePublicCatalog, appSession } = useAppContext();
  const { toast } = useDesk();
  const owner = appSession?.membership?.role === 'OWNER';
  const [draft, setDraft] = useState<CatalogSettings>({ active: catalog.active, hideWithoutStock: catalog.hideWithoutStock, hideReserved: catalog.hideReserved, minBattery: catalog.minBattery, showPrice: catalog.showPrice, priceCurrency: catalog.priceCurrency, logoUrl: catalog.logoUrl, hours: catalog.hours });
  const [confirm, setConfirm] = useState<'regenerate' | 'deactivate' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const close = () => { if (!busy && !confirm) onClose(); };
  const save = async (action: 'save' | 'regenerate' | 'deactivate') => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (action === 'regenerate') { await regeneratePublicCatalog(); toast('Link regenerado'); }
      else {
        const { active, ...settings } = draft;
        await savePublicCatalog(action === 'deactivate' ? { active: false } : owner ? { ...settings, active } : settings);
      }
      onClose();
    } catch (cause) { setError(toUserMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  };
  const rule = (key: 'active' | 'hideWithoutStock' | 'hideReserved' | 'showPrice', label: string, hint?: string) => <div className="cat-rule-row"><div><b>{label}</b>{hint && <small>{hint}</small>}</div><CatalogToggle label={label} checked={draft[key]} disabled={busy} onChange={() => { if (key === 'active' && draft.active) setConfirm('deactivate'); else setDraft(current => ({ ...current, [key]: !current[key] })); }} /></div>;
  return <><Sheet title="Reglas y precio" subtitle="Los cambios se ven en el link al instante." onClose={close} className="cat-rules-sheet" footer={<Actions primary="Guardar" onPrimary={() => void save('save')} onSecondary={close} busy={busy} />}>
    {!confirm && error && <div className="ferr" role="alert">{error}</div>}
    {owner && <div className="cat-rule-box">{rule('active', 'Catálogo activo', 'Si lo apagás, el link muestra «Catálogo no disponible»')}</div>}
    <div className="cat-label">Qué equipos se muestran <span>{catalog.counts.visible} {catalog.counts.visible === 1 ? 'visible' : 'visibles'}</span></div>
    <div className="cat-rule-box">{rule('hideWithoutStock', 'Ocultar sin stock y vendidos', 'Salen solos cuando se venden')}{rule('hideReserved', 'Ocultar reservados')}<div className="cat-rule-row"><b>Ocultar batería menor a</b><input aria-label="Batería mínima" type="number" min="0" max="100" disabled={busy || draft.minBattery == null} value={draft.minBattery ?? 80} onChange={e => setDraft(current => ({ ...current, minBattery: Number(e.target.value) }))} /><CatalogToggle label="Ocultar batería menor a" checked={draft.minBattery != null} disabled={busy} onChange={() => setDraft(current => ({ ...current, minBattery: current.minBattery == null ? 80 : null }))} /></div></div>
    <div className="cat-label">Precio</div><div className="cat-rule-box">{rule('showPrice', 'Mostrar precio', 'Si lo apagás, cada fila dice «Consultá»')}<div className="cat-currency"><b>Moneda</b><div>{(['USD', 'ARS', 'ORIGINAL'] as const).map(currency => <button className={draft.priceCurrency === currency ? 'on' : ''} key={currency} disabled={busy} onClick={() => setDraft(current => ({ ...current, priceCurrency: currency }))}>{currency === 'ORIGINAL' ? 'Como está cargado' : currency}</button>)}</div><small>Los precios se convierten con la cotización de venta de la tienda{appSession?.store?.exchangeMode === 'manual' ? ` ($ ${appSession.store.manualSell})` : ''}.</small></div></div>
    <details className="cat-brand-details"><summary>Logo y horario</summary><div className="cat-brand-fields"><label>Logo de la tienda (URL https)<input type="url" value={draft.logoUrl ?? ''} onChange={e => setDraft(current => ({ ...current, logoUrl: e.target.value || null }))} disabled={busy} /></label><label>Horario de atención<input value={draft.hours ?? ''} maxLength={120} onChange={e => setDraft(current => ({ ...current, hours: e.target.value || null }))} disabled={busy} /></label></div></details>
    {owner && <div className="cat-danger-actions"><button className="cat-button" disabled={busy} onClick={() => setConfirm('regenerate')}><RefreshCw size={16} />Regenerar link</button><button className="cat-button danger" disabled={busy || !catalog.active} onClick={() => setConfirm('deactivate')}><EyeOff size={16} />Desactivar catálogo</button></div>}
  </Sheet>{confirm && <Dialog title={confirm === 'regenerate' ? '¿Regenerar el link?' : '¿Desactivar el catálogo?'} text={confirm === 'regenerate' ? 'El link anterior deja de funcionar. Vas a tener que compartir el nuevo con tus clientes. Los equipos y las reglas se conservan.' : 'Tus clientes van a ver «Catálogo no disponible». Podés volver a activarlo cuando quieras y conservar el mismo link.'} ok={confirm === 'regenerate' ? 'Regenerar link' : 'Desactivar catálogo'} danger={confirm === 'deactivate'} busy={busy} error={error} onClose={() => { if (!busy) { setConfirm(null); setError(''); } }} onOk={() => void save(confirm)} />}</>;
}

function CatalogPreview({ catalog, storePhone }: { catalog: ManagedCatalog; storePhone: string | null }) {
  const [preview, setPreview] = useState<PublicCatalog | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setPreview(null); setUnavailable(false);
    void fetchPublicCatalog(catalog.slug, controller.signal).then(data => { if (!controller.signal.aborted) setPreview(data); }).catch(cause => {
      if (controller.signal.aborted) return;
      console.warn('No se pudo cargar la vista previa del catálogo.', cause);
      setUnavailable(true);
    });
    return () => controller.abort();
  }, [catalog.slug, storePhone]);
  const phone = preview?.store.phone?.trim() || null;
  const line = [preview?.store.address, preview?.store.hours, phone].filter(Boolean).join(' · ');
  if (unavailable && !preview) return null;
  return <div className="cat-preview public-price-page">
    {preview ? <><header className="price-header"><div className="price-store">{preview.store.logoUrl ? <img className="price-logo" src={preview.store.logoUrl} alt="" /> : <div className="price-logo">{preview.store.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</div>}<div><h1>{preview.store.name}</h1>{line ? <small data-testid="catalog-store-phone">{line}</small> : null}</div></div><div className="price-header-meta"><b>LISTA DE PRECIOS</b></div></header>{preview.active ? preview.items.length ? <PriceList items={preview.items.slice(0, 6)} /> : <p className="cat-empty">Estamos actualizando la lista</p> : <p className="cat-empty">Esta lista de precios no está disponible</p>}</> : <ListSkeleton variant="lines" rows={6} testId="catalog-preview-loading" />}
  </div>;
}

function CatalogSkeleton() {
  return <div className="cat-loading" role="status" aria-label="Cargando catálogo" aria-busy="true" data-testid="catalog-loading">
    <div className="cat-counts" aria-hidden="true">{[0, 1, 2].map(index => <div key={index}><Skeleton style={{ width: '65%' }} /><Skeleton style={{ width: 32, height: 20 }} /></div>)}</div>
    <div className="cat-layout" aria-hidden="true">
      <div className="cat-card"><Skeleton style={{ width: '40%' }} /><ListSkeleton variant="rows" rows={4} /></div>
      <div className="cat-card"><Skeleton style={{ height: 90, borderRadius: 12 }} /><ListSkeleton variant="lines" rows={3} /><Skeleton className="skeleton-field" /></div>
    </div>
  </div>;
}
