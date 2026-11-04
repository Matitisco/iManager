import { useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { activateStore, enableStoreGroup } from '../services/store-group-api';
import type { StoreKind } from '../types/app-session';
import { getFriendlyErrorMessage } from '../lib/utils';
import { ownedStoreGroup } from './sections';
import { DeskSelect } from './select';
import { Field, useDesk } from './ui';
import './store-group.css';

export const storeKindLabel = (kind?: StoreKind | null) => kind === 'WHOLESALE' ? 'Mayorista' : kind === 'RETAIL' ? 'Minorista' : '';

export function StoreSelector({ mobile = false }: { mobile?: boolean }) {
  const { user, appSession, applyStoreSession } = useAppContext();
  const { go, tab, toast } = useDesk();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const current = appSession?.stores?.find(store => store.id === appSession.store?.id);
  const name = appSession?.store?.name || 'Tienda';
  const kind = storeKindLabel(current?.kind);
  // Preserve the single-store header, including its mobile identifier.
  if ((appSession?.stores?.length ?? 0) < 2) return <><small data-testid={mobile ? 'mobile-store-name' : undefined} title={name}>{name}</small>{kind && <span className="store-kind">{kind}</span>}</>;
  const grouped = ownedStoreGroup(appSession).length > 0;
  return <div className="store-selector" aria-busy={busy}>
    <DeskSelect label="Cambiar tienda" sheetTitle="Tus tiendas" data-testid={mobile ? 'mobile-store-name' : 'store-selector'}
      value={grouped && tab === 'balance' ? '__all' : appSession?.store?.id ?? ''} disabled={busy}
      displayValue={<span>{busy ? 'Cambiando tienda…' : grouped && tab === 'balance' ? 'Todas las tiendas' : name}</span>}
      options={[...(appSession?.stores ?? []).map(store => ({ value: store.id, label: `${store.name}${store.kind ? ` · ${storeKindLabel(store.kind)}` : ''}` })), ...(grouped ? [{ value: '__all', label: 'Todas las tiendas' }] : [])]}
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
    {kind && !(grouped && tab === 'balance') ? <span className="store-kind">{kind}</span> : null}
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
