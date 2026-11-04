import { useRef, useState } from 'react';
import { ChevronsUpDown, Store as ShopIcon, Warehouse } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { activateStore, enableStoreGroup } from '../services/store-group-api';
import type { StoreKind } from '../types/app-session';
import { getFriendlyErrorMessage } from '../lib/utils';
import { ownedStoreGroup } from './sections';
import { DeskSelect } from './select';
import { Field, useDesk } from './ui';
import './store-group.css';

export const storeKindLabel = (kind?: StoreKind | null) => kind === 'WHOLESALE' ? 'Mayorista' : kind === 'RETAIL' ? 'Minorista' : '';

const storeBlurb = (kind?: StoreKind | null) => kind === 'WHOLESALE' ? 'Venta por mayor' : kind === 'RETAIL' ? 'Venta al público' : '';
const KindTile = ({ kind }: { kind?: StoreKind | null }) => <span className={`store-tile ${kind === 'RETAIL' ? 'retail' : 'wholesale'}`} aria-hidden="true">{kind === 'RETAIL' ? <ShopIcon size={16} /> : <Warehouse size={16} />}</span>;
const KindStack = () => <span className="store-stack" aria-hidden="true"><KindTile kind="WHOLESALE" /><KindTile kind="RETAIL" /></span>;

export function StoreSelector({ mobile = false, place }: { mobile?: boolean; place?: 'brand' | 'below' }) {
  const { user, appSession, applyStoreSession } = useAppContext();
  const { go, tab, toast } = useDesk();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const current = appSession?.stores?.find(store => store.id === appSession.store?.id);
  const name = appSession?.store?.name || 'Tienda';
  const kind = storeKindLabel(current?.kind);
  const multi = (appSession?.stores?.length ?? 0) >= 2;
  // Desktop multi-store lives in its own row under the brand; mobile keeps it in the header.
  if (place === 'below' ? !multi || mobile : place === 'brand' && multi && !mobile) return null;
  // Preserve the single-store header, including its mobile identifier.
  if (!multi) return <><small data-testid={mobile ? 'mobile-store-name' : undefined} title={name}>{name}</small>{kind && <span className="store-kind">{kind}</span>}</>;
  const stores = appSession?.stores ?? [];
  const grouped = ownedStoreGroup(appSession).length > 0;
  const all = grouped && tab === 'balance';
  const options = [
    ...[...stores].sort((a, b) => Number(b.kind === 'WHOLESALE') - Number(a.kind === 'WHOLESALE')).map(store => ({
      value: store.id, group: 'Tus tiendas', label: `${store.name}${store.kind ? ` · ${storeKindLabel(store.kind)}` : ''}`,
      content: <><KindTile kind={store.kind} /><span className="store-opt-copy"><b>{store.name}</b>{store.kind ? <small>{storeBlurb(store.kind)}</small> : null}</span>{store.kind ? <span className={`store-pill ${store.kind === 'RETAIL' ? 'retail' : 'wholesale'}`}>{storeKindLabel(store.kind)}</span> : null}</>,
    })),
    ...(grouped ? [{ value: '__all', label: 'Todas las tiendas', className: 'store-all', content: <><KindStack /><span className="store-opt-copy"><b>Todas las tiendas</b><small>Balance combinado</small></span></> }] : []),
  ];
  const title = busy ? 'Cambiando tienda…' : all ? (mobile ? 'Todas' : 'Todas las tiendas') : name;
  const sub = all ? (mobile ? `${stores.length} tiendas` : 'Balance combinado') : kind;
  return <div className={`store-selector multi${mobile ? ' m' : ' below'}`} aria-busy={busy}>
    <DeskSelect label="Cambiar tienda" sheetTitle="Tus tiendas" triggerClassName="store-trigger" popupClassName="store-popup" popupMinWidth={344}
      triggerIcon={<ChevronsUpDown size={14} aria-hidden="true" className="store-trigger-icon" />} data-testid={mobile ? 'mobile-store-name' : 'store-selector'}
      value={all ? '__all' : appSession?.store?.id ?? ''} disabled={busy}
      displayValue={<span className="store-trigger-body">{all ? <KindStack /> : <KindTile kind={current?.kind} />}<span className="store-trigger-copy"><b title={title}>{title}</b><small>{sub}{mobile ? <ChevronsUpDown size={12} aria-hidden="true" className="store-sub-icon" /> : null}</small></span></span>}
      options={options}
      onChange={async id => {
        if (id === '__all') { go('balance'); return; }
        if (!user || pending.current) return;
        if (id === appSession?.store?.id) { if (tab === 'balance') go('dashboard'); return; }
        pending.current = true; setBusy(true);
        try {
          const { session } = await activateStore(user, id);
          applyStoreSession(session);
          go('dashboard');
          toast(`Cambiaste a ${session.store?.name || 'tu tienda'}`);
        } catch (cause) { toast(getFriendlyErrorMessage(cause, 'No se pudo cambiar de tienda.')); }
        finally { pending.current = false; setBusy(false); }
      }} />
  </div>;
}

export function EnableStoreGroupCard() {
  const { user, appSession, applyStoreSession } = useAppContext();
  const { toast } = useDesk();
  const [kind, setKind] = useState<StoreKind>('WHOLESALE');
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const current = appSession?.stores?.find(store => store.id === appSession.store?.id);
  if (appSession?.membership?.role !== 'OWNER' || current?.groupId) return null;
  return <section className="multi-enable dcard" aria-labelledby="multi-title">
    <h3 id="multi-title">Multitienda</h3>
    <p>Administrá una mayorista y una minorista con stock separado.<br />Cambiá de tienda y consultá el balance de ambas.</p>
    <Field label="Esta tienda es"><DeskSelect label="Esta tienda es" value={kind} disabled={busy || confirming} options={[{ value: 'WHOLESALE', label: 'Mayorista' }, { value: 'RETAIL', label: 'Minorista' }]} onChange={value => setKind(value as StoreKind)} /></Field>
    <Field label="Nombre de la otra tienda"><input maxLength={120} value={name} disabled={busy || confirming} onChange={event => { setName(event.target.value); setError(''); }} /></Field>
    {error ? <p className="ferr" role="alert">{error}</p> : null}
    {confirming ? <div className="multi-confirm" role="group" aria-label="Confirmar multitienda">
      <p>Vas a crear «{name.trim()}» como {kind === 'WHOLESALE' ? 'minorista' : 'mayorista'} y agruparla con {appSession?.store?.name}. Seguís en tu tienda actual.</p>
      <div className="multi-actions"><button type="button" className="dbtn s" disabled={busy} onClick={() => setConfirming(false)}>Volver</button><button type="button" className="dbtn p" disabled={busy || appSession?.billing?.readOnly} onClick={async () => {
        if (!user || pending.current) return;
        pending.current = true; setBusy(true); setError('');
        try { const { session } = await enableStoreGroup(user, { currentKind: kind, otherStoreName: name.trim() }); applyStoreSession(session); toast('Multitienda activada'); }
        catch (cause) { setError(getFriendlyErrorMessage(cause, 'No se pudo activar multitienda.')); }
        finally { pending.current = false; setBusy(false); }
      }}>{busy ? 'Activando…' : 'Confirmar activación'}</button></div>
    </div> : <button type="button" className="dbtn p" disabled={appSession?.billing?.readOnly} onClick={() => { if (!name.trim()) { setError('Ingresá el nombre de la otra tienda.'); return; } setError(''); setConfirming(true); }}>Activar multitienda</button>}
  </section>;
}
