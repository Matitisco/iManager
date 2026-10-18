import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { usePhoneLayout } from '../lib/phone-layout';
import { formatArDateTime } from '../lib/ar-date';
import { ApiError } from '../services/api-client';
import { fetchStoreActivity, fetchAdminAccess } from '../services/admin-activity-api';
import {
  isTestStore,
  planLabel,
  sortStoreActivity,
  stageLabel,
  statusLabel,
  type ActivitySort,
  type StoreActivityRange,
  type StoreActivityResponse,
  type StoreActivityRow,
} from '../lib/store-activity';
import '../desk/desk.css';
import './store-activity.css';

type Load =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'missing' }
  | { status: 'error'; message: string };

const SORTS: { id: ActivitySort; label: string }[] = [
  { id: 'createdAt', label: 'Por alta' },
  { id: 'lastActivityAt', label: 'Por actividad' },
];

function countLabel(count: number) {
  return count.toLocaleString('es-AR');
}

function when(value: string | null) {
  return value ? formatArDateTime(value) : '—';
}

function ActivityStats({ store }: { store: StoreActivityRow }) {
  const items = [
    ['Miembros', store.counts.storeMembers],
    ['Equipos', store.counts.inventoryItems],
    ['Ventas', store.counts.sales],
    ['Clientes', store.counts.clients],
    ['Reparaciones', store.counts.repairOrders],
  ] as const;
  return (
    <dl className="activity-stats">
      {items.map(([label, count]) => (
        <div key={label}><dt>{label}</dt><dd>{countLabel(count)}</dd></div>
      ))}
    </dl>
  );
}

function ActivityCard({ store }: { store: StoreActivityRow }) {
  return (
    <article className="ticket activity-card" data-testid={`activity-card-${store.id}`}>
      <div className="store">{store.name}</div>
      <div className="who">{store.ownerEmail ?? 'Sin correo de dueño'}</div>
      <div className="activity-meta">
        <span>{planLabel(store.billingPlan)}</span>
        <span>{statusLabel(store.billingStatus)}</span>
        <span>Etapa {stageLabel(store.onboardingStage)}</span>
      </div>
      <ActivityStats store={store} />
      <div className="activity-meta">
        <span>Alta {when(store.createdAt)}</span>
        <span>Prueba hasta {when(store.trialEndsAt)}</span>
        <span>Última actividad {store.lastActivityAt ? when(store.lastActivityAt) : 'sin actividad'}</span>
      </div>
    </article>
  );
}

function ActivityTable({ stores }: { stores: StoreActivityRow[] }) {
  return (
    <div className="dcard flush">
      <div className="dtable-scroll">
        <table className="dtable compact" data-testid="activity-table">
          <thead>
            <tr>
              <th>Tienda</th>
              <th>Dueño</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Prueba hasta</th>
              <th>Alta</th>
              <th>Etapa</th>
              <th className="r">Miembros</th>
              <th className="r">Equipos</th>
              <th className="r">Ventas</th>
              <th className="r">Clientes</th>
              <th className="r">Reparaciones</th>
              <th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store.id} data-testid={`activity-row-${store.id}`}>
                <td><b>{store.name}</b></td>
                <td>{store.ownerEmail ?? '—'}</td>
                <td>{planLabel(store.billingPlan)}</td>
                <td>{statusLabel(store.billingStatus)}</td>
                <td>{when(store.trialEndsAt)}</td>
                <td>{when(store.createdAt)}</td>
                <td>{stageLabel(store.onboardingStage)}</td>
                <td className="r">{countLabel(store.counts.storeMembers)}</td>
                <td className="r">{countLabel(store.counts.inventoryItems)}</td>
                <td className="r">{countLabel(store.counts.sales)}</td>
                <td className="r">{countLabel(store.counts.clients)}</td>
                <td className="r">{countLabel(store.counts.repairOrders)}</td>
                <td>{store.lastActivityAt ? when(store.lastActivityAt) : 'Sin actividad'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StoreActivityPage() {
  const { user } = useAppContext();
  const phone = usePhoneLayout();
  const [range, setRange] = useState<StoreActivityRange>('30d');
  const [sort, setSort] = useState<ActivitySort>('createdAt');
  const [hideTests, setHideTests] = useState(true);
  const [data, setData] = useState<StoreActivityResponse | null>(null);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setData(null);
    setLoad({ status: 'loading' });
    (async () => {
      const access = await fetchAdminAccess(user);
      if (!active) return null;
      if (!access.isAdmin) { setData(null); setLoad({ status: 'missing' }); return null; }
      return fetchStoreActivity(user, range);
    })().then(
      (next) => {
        if (!active || !next) return;
        setData(next);
        setLoad({ status: 'ready' });
      },
      (error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
          setData(null);
          setLoad({ status: 'missing' });
          return;
        }
        setLoad({ status: 'error', message: error instanceof Error ? error.message : 'No pudimos cargar la actividad.' });
      },
    );
    return () => { active = false; };
  }, [user, range, requestId]);

  if (!user || load.status === 'missing') {
    return (
      <div className="desk-app store-activity" data-testid="activity-not-found">
        <main className="stage">
          <div className="dscreen activity-missing">
            <h1>No encontramos esta página</h1>
            <p>El enlace no existe o ya no está disponible.</p>
            <a className="dbtn p activity-home" href="/">Volver al inicio</a>
          </div>
        </main>
      </div>
    );
  }

  if (!data || load.status === 'error') {
    return (
      <div className="desk-app store-activity">
        <main className="stage">
          <div className="dscreen activity-status" role={load.status === 'error' ? 'alert' : 'status'}>
            <h1>{load.status === 'error' ? 'No pudimos cargar esta página' : 'Cargando…'}</h1>
            {load.status === 'error' && <p>{load.message}</p>}
            {load.status === 'error' && <button type="button" className="dbtn p" onClick={() => setRequestId((current) => current + 1)}>Reintentar</button>}
          </div>
        </main>
      </div>
    );
  }

  const stores = data.stores;
  const hidden = stores.filter(isTestStore).length;
  const visible = sortStoreActivity(hideTests ? stores.filter((store) => !isTestStore(store)) : stores, sort);

  return (
    <div className="desk-app store-activity" data-testid="activity-screen">
      <main className="stage">
        <div className="dscreen">
          <div className="whead">
            <div>
              <h1>Actividad de tiendas</h1>
              <div className="wsub">
                {range === 'all' ? 'Todas las tiendas' : 'Creadas en los últimos 30 días'}
                {` · actualizado ${formatArDateTime(data.generatedAt)}`}
              </div>
            </div>
            <a className="dbtn s activity-home" href="/">Ir a la tienda</a>
          </div>

          <div className="activity-toolbar" role="toolbar" aria-label="Filtros de actividad">
            <button type="button" className={`wchip${range === '30d' ? ' on' : ''}`} aria-pressed={range === '30d'} onClick={() => setRange('30d')}>30 días</button>
            <button type="button" className={`wchip${range === 'all' ? ' on' : ''}`} aria-pressed={range === 'all'} onClick={() => setRange('all')}>Todas</button>
            {SORTS.map((item) => (
              <button key={item.id} type="button" className={`wchip${sort === item.id ? ' on' : ''}`} aria-pressed={sort === item.id} onClick={() => setSort(item.id)}>{item.label}</button>
            ))}
            <button type="button" className={`wchip${hideTests ? ' on' : ''}`} aria-pressed={hideTests} onClick={() => setHideTests((current) => !current)}>Ocultar tiendas de prueba</button>
          </div>

          <p className="activity-note">
            {visible.length === 1 ? '1 tienda' : `${countLabel(visible.length)} tiendas`}
            {hideTests && hidden > 0 ? ` · ocultamos ${hidden === 1 ? '1 tienda de prueba' : `${countLabel(hidden)} tiendas de prueba`}` : ''}
          </p>
          {visible.length === 0 ? (
            <div className="wempty">No hay tiendas para mostrar.</div>
          ) : phone ? (
            <div className="activity-cards">
              {visible.map((store) => <ActivityCard key={store.id} store={store} />)}
            </div>
          ) : (
            <ActivityTable stores={visible} />
          )}
        </div>
      </main>
    </div>
  );
}
