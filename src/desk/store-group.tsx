import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronsUpDown,
  Plus,
  Store as ShopIcon,
  Warehouse,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { activateStore, enableStoreGroup } from '../services/store-group-api';
import type { AppSession, StoreKind } from '../types/app-session';
import { getFriendlyErrorMessage } from '../lib/utils';
import { ownedStoreGroup } from './sections';
import { DeskSelect } from './select';
import { Field, Sheet, useDesk } from './ui';
import './store-group.css';

export const storeKindLabel = (kind?: StoreKind | null) => kind === 'WHOLESALE' ? 'Mayorista' : kind === 'RETAIL' ? 'Minorista' : '';

const storeBlurb = (kind?: StoreKind | null) => kind === 'WHOLESALE' ? 'Venta por mayor' : kind === 'RETAIL' ? 'Venta al público' : '';
const KindTile = ({ kind }: { kind?: StoreKind | null }) => <span className={`store-tile ${kind === 'RETAIL' ? 'retail' : kind === 'WHOLESALE' ? 'wholesale' : 'generic'}`} aria-hidden="true">{kind === 'WHOLESALE' ? <Warehouse size={16} /> : <ShopIcon size={16} />}</span>;
const KindStack = () => <span className="store-stack" aria-hidden="true"><KindTile kind="WHOLESALE" /><KindTile kind="RETAIL" /></span>;

export function StoreSelector({ mobile = false, place }: { mobile?: boolean; place?: 'brand' | 'below' }) {
  const { user, appSession, applyStoreSession } = useAppContext();
  const { go, tab, toast } = useDesk();
  const [adding, setAdding] = useState(false);
  const selector = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const current = appSession?.stores?.find(store => store.id === appSession.store?.id);
  const name = appSession?.store?.name || 'Tienda';
  const kind = storeKindLabel(current?.kind);
  // Desktop always uses the row below the brand; mobile uses the header card.
  if (place === 'below' ? mobile : place === 'brand' && !mobile) return null;
  const stores = appSession?.stores?.length ? appSession.stores : appSession?.store ? [{ ...appSession.store, kind: null, groupId: null }] : [];
  const canAdd = appSession?.membership?.role === 'OWNER' && !current?.groupId;
  const grouped = ownedStoreGroup(appSession).length > 0;
  const all = grouped && tab === 'balance';
  const options = [
    ...[...stores].sort((a, b) => Number(b.kind === 'WHOLESALE') - Number(a.kind === 'WHOLESALE')).map(store => ({
      value: store.id, group: 'Tus tiendas', label: `${store.name}${store.kind ? ` · ${storeKindLabel(store.kind)}` : ''}`,
      content: <><KindTile kind={store.kind} /><span className="store-opt-copy"><b>{store.name}</b>{store.kind ? <small>{storeBlurb(store.kind)}</small> : null}</span>{store.kind ? <span className={`store-pill ${store.kind === 'RETAIL' ? 'retail' : 'wholesale'}`}>{storeKindLabel(store.kind)}</span> : null}</>,
    })),
    ...(grouped ? [{ value: '__all', label: 'Todas las tiendas', className: 'store-all', content: <><KindStack /><span className="store-opt-copy"><b>Todas las tiendas</b><small>Balance combinado</small></span></> }] : []),
    ...(canAdd ? [{ value: '__add', label: 'Agregar tienda', className: 'store-add', content: <><span className="store-tile generic" aria-hidden="true"><Plus size={16} /></span><span className="store-opt-copy"><b>Agregar tienda</b></span></> }] : []),
  ];
  const title = busy
    ? 'Cambiando tienda…'
    : all
      ? mobile
        ? 'Todas'
        : 'Todas las tiendas'
      : name;
  const sub = all
    ? mobile
      ? `${stores.length} tiendas`
      : 'Balance combinado'
    : kind;
  return (
    <div
      ref={selector}
      className={`store-selector multi${mobile ? ' m' : ' below'}`}
      aria-busy={busy}
    >
      <DeskSelect
        label="Cambiar tienda"
        sheetTitle="Tus tiendas"
        triggerClassName="store-trigger"
        popupClassName="store-popup"
        popupMinWidth={344}
        triggerIcon={
          <ChevronsUpDown
            size={14}
            aria-hidden="true"
            className="store-trigger-icon"
          />
        }
        data-testid={mobile ? 'mobile-store-name' : 'store-selector'}
        value={all ? '__all' : (appSession?.store?.id ?? '')}
        disabled={busy}
        displayValue={
          <span className="store-trigger-body">
            {all ? <KindStack /> : <KindTile kind={current?.kind} />}
            <span className="store-trigger-copy">
              <b title={title}>{title}</b>
              <small>
                {sub}
                {mobile ? (
                  <ChevronsUpDown
                    size={12}
                    aria-hidden="true"
                    className="store-sub-icon"
                  />
                ) : null}
              </small>
            </span>
          </span>
        }
        options={options}
        onChange={async (id) => {
          if (id === '__add') {
            if (canAdd) setAdding(true);
            return;
          }
          if (id === '__all') {
            go('balance');
            return;
          }
          if (!user || pending.current) return;
          if (id === appSession?.store?.id) {
            if (tab === 'balance') go('dashboard');
            return;
          }
          pending.current = true;
          setBusy(true);
          try {
            const { session } = await activateStore(user, id);
            applyStoreSession(session);
            go('dashboard');
            toast(`Cambiaste a ${session.store?.name || 'tu tienda'}`);
          } catch (cause) {
            toast(
              getFriendlyErrorMessage(cause, 'No se pudo cambiar de tienda.'),
            );
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}
      />
      {adding
        ? createPortal(
            <AddStoreSheet onClose={() => setAdding(false)} />,
            selector.current?.closest('.desk-app') ?? document.body,
          )
        : null}
    </div>
  );
}

function AddStoreSheet({ onClose }: { onClose: () => void }) {
  const { user, appSession, applyStoreSession } = useAppContext();
  const { go, toast } = useDesk();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<StoreKind | ''>('');
  const [address, setAddress] = useState('');
  const [instagram, setInstagram] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{
    id: string;
    name: string;
    session: AppSession;
  } | null>(null);
  const pending = useRef(false);
  const current = appSession?.stores?.find(
    (store) => store.id === appSession.store?.id,
  );
  const authorized =
    appSession?.membership?.role === 'OWNER' &&
    (!current?.groupId || !!created);
  const close = () => {
    if (!pending.current) onClose();
  };
  const submit = async () => {
    if (
      !user ||
      !appSession?.store ||
      !authorized ||
      pending.current ||
      appSession.billing?.readOnly
    )
      return;
    if (!name.trim()) {
      setError('Ingresá el nombre de la nueva tienda.');
      return;
    }
    if (!kind) {
      setError('Elegí si la nueva tienda es minorista o mayorista.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    let saved = created;
    try {
      if (!saved) {
        const currentId = appSession.store.id;
        const previousIds = new Set(
          (appSession.stores ?? []).map((store) => store.id),
        );
        const { session } = await enableStoreGroup(user, {
          currentKind: kind === 'WHOLESALE' ? 'RETAIL' : 'WHOLESALE',
          otherStoreName: name.trim(),
          ...(address.trim() ? { otherAddress: address.trim() } : {}),
          ...(instagram.trim() ? { otherInstagram: instagram.trim() } : {}),
        });
        const other = session.stores?.find(
          (store) => store.id !== currentId && !previousIds.has(store.id),
        );
        if (!other) {
          applyStoreSession(session);
          throw new Error(
            'La tienda se creó, pero no pudimos encontrarla. Actualizá la página para seleccionarla.',
          );
        }
        saved = { id: other.id, name: other.name, session };
        setCreated(saved);
      }
      const { session } = await activateStore(user, saved.id);
      applyStoreSession(session);
      toast(`Listo, estás en ${saved.name}`);
      go('dashboard');
      onClose();
    } catch (cause) {
      if (saved) applyStoreSession(saved.session);
      const message = getFriendlyErrorMessage(
        cause,
        'No se pudo crear la tienda.',
      );
      setError(
        saved
          ? `La tienda ya está creada. ${message} Reintentá seleccionarla.`
          : message,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Sheet
      title="Agregar tienda"
      subtitle="Completá los datos de tu nueva tienda."
      busy={busy}
      onClose={close}
      footer={
        <div className="sacts">
          <button
            type="button"
            className="btn2 s"
            disabled={busy}
            onClick={close}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="add-store-form"
            className="btn2 p"
            disabled={busy || !authorized || appSession?.billing?.readOnly}
          >
            {busy ? 'Procesando…' : created ? 'Seleccionar tienda' : 'Crear tienda'}
          </button>
        </div>
      }
    >
      <form
        id="add-store-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Nombre" mark="Requerido">
          <input
            autoFocus
            required
            maxLength={120}
            value={name}
            disabled={busy || !!created}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
          />
        </Field>
        <Field label="Tipo de la nueva tienda" mark="Requerido">
          <DeskSelect
            label="Tipo de la nueva tienda"
            required
            value={kind}
            disabled={busy || !!created}
            options={[
              { value: 'RETAIL', label: 'Minorista' },
              { value: 'WHOLESALE', label: 'Mayorista' },
            ]}
            onChange={(value) => {
              setKind(value as StoreKind);
              setError('');
            }}
          />
        </Field>
        {kind ? (
          <p className="sheet-note">
            Tu tienda actual «{appSession?.store?.name}» quedará como{' '}
            {kind === 'WHOLESALE' ? 'minorista' : 'mayorista'}.
          </p>
        ) : null}
        <Field label="Dirección" mark="Opcional">
          <input
            maxLength={255}
            value={address}
            disabled={busy || !!created}
            onChange={(event) => {
              setAddress(event.target.value);
              setError('');
            }}
          />
        </Field>
        <Field label="Instagram" mark="Opcional">
          <input
            maxLength={300}
            placeholder="@usuario o link del perfil"
            value={instagram}
            disabled={busy || !!created}
            onChange={(event) => {
              setInstagram(event.target.value);
              setError('');
            }}
          />
        </Field>
        {error ? (
          <p className="ferr" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

export function EnableStoreGroupCard({
  autoFocus = false,
}: {
  autoFocus?: boolean;
}) {
  const { user, appSession, applyStoreSession } = useAppContext();
  const { toast } = useDesk();
  const [kind, setKind] = useState<StoreKind>('WHOLESALE');
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const card = useRef<HTMLElement>(null);
  const current = appSession?.stores?.find(store => store.id === appSession.store?.id);
  useEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() => {
      card.current?.focus({ preventScroll: true });
      card.current?.scrollIntoView?.({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);
  if (appSession?.membership?.role !== 'OWNER' || current?.groupId) return null;
  return <section ref={card} tabIndex={-1} className="multi-enable dcard" aria-labelledby="multi-title" data-testid="enable-store-group">
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
