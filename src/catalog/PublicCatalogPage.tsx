import { ListSkeleton } from '../desk/list-skeleton';
import { useEffect, useRef, useState } from 'react';
import { MapPin, MessageCircle, Search, SlidersHorizontal } from 'lucide-react';
import { fetchPublicCatalog } from '../services/public-catalog-api';
import { ApiError } from '../services/api-client';
import type { PublicCatalog } from '../types/public-catalog';
import { NETWORK_ERROR_MESSAGE, toUserMessage } from '../lib/user-message';
import { useOfflineRecovery } from '../lib/offline-recovery';
import { activeCatalogFilters, catalogMoneyPrefix, catalogPriceCaption, EMPTY_FILTERS, filterCatalog, shortCatalogModel, whatsappLink, type CatalogFilters } from './presentation';
import { DesktopFilters, SheetFilters } from './filters';
import { PriceList } from './PriceList';
import { Actions, Sheet } from '../desk/ui';
import './catalog.css';
import '../desk/desk.css';

export function PublicCatalogPage({ slug }: { slug: string }) {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const reloadRef = useRef<() => void>(() => {});
  useEffect(() => {
    let alive = true; let controller: AbortController | null = null;
    const load = async () => {
      controller?.abort(); const requestController = new AbortController(); controller = requestController;
      try {
        const next = await fetchPublicCatalog(slug, requestController.signal);
        if (alive && !requestController.signal.aborted) { setCatalog(next); setUnavailable(false); setError(''); }
      } catch (cause) {
        if (!alive || requestController.signal.aborted) return;
        // Clear stale products on failure, particularly after deactivation/regeneration.
        setCatalog(null);
        if (cause instanceof ApiError && cause.status === 404) { setUnavailable(true); setError(''); }
        else setError(toUserMessage(cause, 'No se pudo cargar la lista. Volvé a intentar.'));
      } finally { if (alive && controller === requestController) setLoading(false); }
    };
    reloadRef.current = () => { setError(''); setLoading(true); void load(); };
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { alive = false; reloadRef.current = () => {}; controller?.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [slug]);
  useOfflineRecovery(error, () => reloadRef.current());
  useEffect(() => {
    const old = document.title;
    document.title = catalog ? `${catalog.store.name} · Lista de precios` : 'Catálogo · iManager';
    return () => { document.title = old; };
  }, [catalog?.store.name]);
  const items = catalog?.items ?? [];
  const visible = filterCatalog(items, filters, catalog?.showPrice ?? false);
  const models = [...new Set(items.map(item => item.model))];
  const field = (key: keyof CatalogFilters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const prices = (min: string, max: string) => setFilters(current => ({ ...current, min, max }));
  const active = activeCatalogFilters(filters);
  const showPrice = catalog?.showPrice ?? false;
  const storePhone = catalog?.store.phone?.trim() || null;
  const contact = catalog ? whatsappLink(storePhone, `Hola ${catalog.store.name} \u{1F44B} Vi la lista de precios y quería consultar por un equipo. ${window.location.origin}/c/${slug}`) : null;
  const storeLine = catalog ? [catalog.store.address, catalog.store.hours, storePhone].filter(Boolean).join(' · ') : '';
  const offline = error === NETWORK_ERROR_MESSAGE;
  return <main className="public-price-page" data-testid="public-catalog">
    <header className="price-header"><div className="price-container"><div className="price-store">
      {catalog?.store.logoUrl ? <img className="price-logo" src={catalog.store.logoUrl} alt={`Logo de ${catalog.store.name}`} /> : <div className="price-logo">{catalog?.store.name.split(' ').map(word => word[0]).slice(0, 2).join('') || 'iM'}</div>}
      <div><h1>{catalog?.store.name || 'Lista de precios'}</h1>{storeLine ? <p data-testid="catalog-store-phone"><MapPin size={13} />{storeLine}</p> : null}</div>
    </div>{catalog?.active && <div className="price-header-meta"><b>LISTA DE PRECIOS</b><small>{catalogPriceCaption({ showPrice: catalog.showPrice, priceCurrency: catalog.priceCurrency, currency: catalog.store.currency })}</small></div>}</div></header>
    {loading ? <div className="price-container price-list"><ListSkeleton variant="rows" rows={6} testId="public-catalog-loading" /></div> : error ? <div className={`price-message${offline ? ' offline' : ''}`} role="alert" data-testid={offline ? 'offline-banner' : undefined}>{error}<button onClick={() => window.location.reload()}>Reintentar</button></div> : unavailable || !catalog?.active ? <div className="price-message"><small>LISTA PAUSADA</small><h2>Esta lista de precios no está disponible</h2><p>La tienda la pausó o cambió el link. Escribile para que te pase la lista actualizada.</p></div> : <>
      <div className="price-search-area"><div className="price-container"><div className="price-search"><label><Search size={18} /><input aria-label="Buscar modelo o color" placeholder="Buscar modelo o color" value={filters.query} onChange={e => field('query', e.target.value)} /></label><button className="price-filter-button" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={17} />Filtros{active ? ` · ${active}` : ''}</button></div>
      <div className="price-desktop-filters"><DesktopFilters items={items} filters={filters} showPrice={showPrice} onChange={field} onPrices={prices} /><small>{visible.length} {visible.length === 1 ? 'equipo' : 'equipos'} · ordenados por modelo</small></div>
      <div className="price-model-chips"><button aria-pressed={!filters.model} onClick={() => field('model', '')}>Todos</button>{models.map(model => <button key={model} aria-pressed={filters.model === model} onClick={() => field('model', filters.model === model ? '' : model)}>{shortCatalogModel(model)}</button>)}</div></div></div>
      <div className="price-container price-list"><PriceList items={visible} />{!visible.length && <div className="price-message"><h2>{items.length ? 'No hay equipos con estos filtros' : 'Estamos actualizando la lista'}</h2><p>{items.length ? 'Probá con otro modelo o limpiá los filtros.' : 'Pronto vas a encontrar equipos disponibles. Escribinos para consultar.'}</p>{items.length > 0 && <button onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar filtros</button>}</div>}</div>
    </>}
    <footer className="price-footer">Lista hecha con iManager</footer>
    {contact && !error && !loading && <a className="price-whatsapp" href={contact} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} />Escribinos por WhatsApp</a>}
    {filterOpen && <div className="desk-app price-filter-shell"><Sheet title="Filtrar lista" subtitle="Solo se ve lo que la tienda publicó." onClose={() => setFilterOpen(false)} footer={<Actions primary={`Ver ${visible.length} ${visible.length === 1 ? 'equipo' : 'equipos'}`} secondary="Limpiar" onPrimary={() => setFilterOpen(false)} onSecondary={() => setFilters(EMPTY_FILTERS)} />}><SheetFilters items={items} filters={filters} showPrice={showPrice} moneyPrefix={catalogMoneyPrefix({ priceCurrency: catalog?.priceCurrency ?? 'USD', currency: catalog?.store.currency })} originalPrices={catalog?.priceCurrency === 'ORIGINAL'} onChange={field} /></Sheet></div>}
  </main>;
}
