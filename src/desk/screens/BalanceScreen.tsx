import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchStoreGroupBalance, type GroupBalance } from '../../services/store-group-api';
import { ownedStoreGroup, canSeeFinancials } from '../sections';
import { DeskSelect } from '../select';
import { storeKindLabel } from '../store-group';
import { ScreenTitle, useDesk } from '../ui';
import { NoSectionAccess } from './NoSectionAccess';
import '../store-group.css';

const number = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
export function shortBalanceMoney(value: number) {
  const divisor = Math.abs(value) >= 1e6 ? 1e6 : Math.abs(value) >= 1e3 ? 1e3 : 1;
  return `$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value / divisor)}${divisor === 1e6 ? 'M' : divisor === 1e3 ? ' mil' : ''}`;
}
const monthDate = (month: string) => new Date(`${month}-15T12:00:00Z`);
const monthName = (month: string, long = false) => new Intl.DateTimeFormat('es-AR', { month: long ? 'long' : 'short', timeZone: 'UTC' }).format(monthDate(month)).replace('.', '');

export function BalanceScreen() {
  const { appSession } = useAppContext();
  const { go } = useDesk();
  if (!ownedStoreGroup(appSession).length || !canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role)) return <NoSectionAccess section="Balance" ownerName={appSession?.store?.ownerDisplayName || 'el propietario'} onDashboard={() => go('dashboard')} />;
  return <BalanceContent key={appSession?.store?.id} />;
}

function BalanceContent() {
  const { user, appSession } = useAppContext();
  const { back } = useDesk();
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const [data, setData] = useState<GroupBalance | null>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    if (!user) { setLoading(false); setError('No hay una sesión disponible.'); return; }
    void fetchStoreGroupBalance(user, months).then(result => {
      if (!active) return;
      setData(result); setSelected(result.months.at(-1) ?? '');
    }).catch(cause => { if (active) setError(getFriendlyErrorMessage(cause, 'No se pudo cargar el balance.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, months, retry, appSession?.store?.id]);
  const stores = [...(data?.stores ?? [])].sort((a, b) => Number(a.kind === 'RETAIL') - Number(b.kind === 'RETAIL'));
  const max = Math.max(1, ...stores.flatMap(store => store.monthly.map(month => month.revenue)));
  const empty = !data?.months.length || !stores.length || stores.every(store => Object.values(store.totals).every(value => value === 0));
  const period = <DeskSelect label="Período del balance" value={String(months)} onChange={value => setMonths(Number(value) as 3 | 6 | 12)} options={[3, 6, 12].map(value => ({ value: String(value), label: `Últimos ${value} meses` }))} />;
  const kpi = (label: string, revenue: number, profit: number) => <article className="dcard balance-kpi" key={label} aria-label={label}><h2>{label}</h2><strong data-ph-mask>{shortBalanceMoney(revenue)}</strong><p data-ph-mask>ganancia {shortBalanceMoney(profit)}</p></article>;
  return <div className="dscreen balance-screen" data-testid="balance-screen">
    <ScreenTitle title="Balance" back={back} tools={period} desktop={period} />
    {loading ? <p className="wempty" role="status">Cargando balance…</p> : error ? <p className="ferr" role="alert">{error} <button className="wlink" type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></p> : data ? <>
      {data.mixedCurrency ? <p className="balance-warning" role="status">Las tiendas usan monedas distintas. Cada importe está en la moneda de su tienda y no se muestra un total general.</p> : <span className="sr-only">Importes en {data.currency}</span>}
      <div className="balance-kpis">
        {stores.map(store => kpi(storeKindLabel(store.kind), store.totals.revenue, store.totals.netProfit))}
        {!data.mixedCurrency && data.combined ? kpi('General', data.combined.totals.revenue, data.combined.totals.netProfit) : null}
      </div>
      {empty ? <p className="balance-empty" role="status">Todavía no hay movimientos en este período.</p> : null}
      {data.months.length > 0 && stores.length > 0 ? <div className="balance-body">
        <section className="dcard balance-chart" aria-labelledby="balance-chart-title">
          <div className="balance-chart-heading"><h2 id="balance-chart-title">Ingresos por mes</h2><div className="balance-legend">{stores.map(store => <span key={store.storeId}><i className={store.kind === 'RETAIL' ? 'retail' : 'wholesale'} />{storeKindLabel(store.kind)}</span>)}</div></div>
          <div className="balance-bars" style={{ gridTemplateColumns: `repeat(${data.months.length}, minmax(0, 1fr))` }} role="group" aria-label="Elegí un mes">
            {data.months.map(month => <button type="button" className="balance-month" key={month} aria-label={month} aria-pressed={selected === month} onClick={() => setSelected(month)}>
              <span className="balance-pair">{stores.map(store => {
                const revenue = store.monthly.find(value => value.month === month)?.revenue ?? 0;
                return <span key={store.storeId} className={`balance-bar ${store.kind === 'RETAIL' ? 'retail' : 'wholesale'}`} style={{ height: `${Math.max(0, revenue) / max * 100}%` }} title={`${storeKindLabel(store.kind)}: $ ${number.format(revenue)}`}><span className="sr-only">{storeKindLabel(store.kind)}: $ {number.format(revenue)}</span></span>;
              })}</span>
              <span className="balance-month-label">{monthName(month)}</span>
            </button>)}
          </div>
        </section>
        <div className="balance-details" aria-live="polite">{stores.map(store => {
          const value = store.monthly.find(month => month.month === selected);
          return <section key={store.storeId} className="dcard balance-detail" aria-label={`Detalle ${storeKindLabel(store.kind)}`}>
            <div className="balance-detail-heading"><h2>{storeKindLabel(store.kind)}</h2><span>{selected ? monthName(selected, true) : ''}</span></div>
            <dl>{[['Ventas', value?.revenue], ['Costo', value?.cost], ['Gastos', value?.expenses], ['Resultado', value?.netProfit]].map(([label, amount]) => <div key={label} className={label === 'Resultado' ? 'balance-result' : ''}><dt>{label}</dt><dd data-ph-mask>{amount == null ? '—' : `$ ${number.format(Number(amount))}`}</dd></div>)}</dl>
          </section>;
        })}</div>
      </div> : null}
    </> : null}
  </div>;
}
