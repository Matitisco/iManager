import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, ChevronRight, CreditCard } from 'lucide-react';
import { Skeleton } from '../../components/Skeleton';
import { useAppContext } from '../../context/AppContext';
import { ROLE_LABEL } from '../../lib/roles';
import { isNetworkErrorMessage, toUserMessage } from '../../lib/user-message';
import { listMembers, type TeamMember } from '../../services/members-api';
import { fetchReportsOverview, type ReportsOverview } from '../../services/reports-api';
import { clientNet } from '../client-balance';
import { DashboardDateRange } from '../dashboard-date-range';
import { dashboardDay, dashboardMonth, dashboardTrendUnit, dayDate, type DashboardPeriod } from '../dashboard-period';
import { DashboardTrend } from '../dashboard-trend';
import { useMoney } from '../exchange';
import { initials, isInProgressTrade, isInStock, isVoidRow, parseAppDate, saleBuyer, saleCode, saleEquipment } from '../format';
import { ListSkeleton, listsAreLoading } from '../list-skeleton';
import { canOpenSection, canSeeFinancials, canViewTeam } from '../sections';
import { usePhoneLayout } from '../section-notices';
import { unreadBySection } from '../unread-count';
import { DeskCta, DeskIcon, Pill, PressTarget, ScreenTitle, useDesk } from '../ui';
import '../dashboard.css';

/** Same grid and reserved areas as the resolved dashboard. No business values. */
export function DashboardSkeleton() {
  const phone = usePhoneLayout();
  const { appSession } = useAppContext();
  const role = appSession?.membership?.role;
  const sections = appSession?.membership?.sections;
  const can = (section: string) => !role || canOpenSection(section, sections, role);
  const financials = !role || canSeeFinancials(sections, role);
  const kpis = (financials ? 2 : 0) + Number(financials || can('sales')) + Number(can('inventory'));
  const shortcuts = Number(can('tradeins')) + Number(can('clients'));
  return <div className="dscreen dashboard-screen dashboard-v2" aria-busy="true" data-testid="dashboard-initial-loading">
    <div className="dtop"><Skeleton className="dashboard-title-skeleton" /></div>
    {phone ? <>{can('sales') ? <div className="dashboard-register"><Skeleton style={{ height: 52 }} /></div> : null}<div className="dashboard-month-nav"><Skeleton style={{ height: 40 }} /></div></> : null}
    {kpis > 0 ? <div className="dashboard-kpis" data-count={kpis}>{Array.from({ length: kpis }, (_, i) => <Kpi key={i} label="" value="" loading />)}</div> : null}
    {financials ? <div className="dashboard-chart-row"><section className="dashboard-panel dashboard-trend"><div className="dashboard-panel-heading"><Skeleton style={{ width: 150, height: 24 }} /></div><div className="dashboard-chart-empty"><Skeleton style={{ height: 140 }} /></div></section><section className="dashboard-panel dashboard-payments"><Skeleton style={{ width: 150, height: 24 }} /></section></div> : null}
    <div className="dashboard-bottom-row">{can('sales') ? <section className="dashboard-panel dashboard-recent"><div className="dashboard-panel-heading"><Skeleton style={{ width: 150, height: 24 }} /></div><div className="dashboard-recent-body"><ListSkeleton variant="rows" rows={phone ? 4 : 5} /></div></section> : null}<div className="dashboard-shortcuts">{Array.from({ length: shortcuts }, (_, i) => <div key={i} className="dashboard-panel dashboard-shortcut"><Skeleton /></div>)}</div></div>
  </div>;
}

export function DashboardContent() {
  const { appSession, user, backendStatus, sales, inventory, tradeIns, clients, operationNotifications, listsLoaded, listsSettled, listsLoadFailed } = useAppContext();
  const loadingLists = listsAreLoading(listsLoaded) || listsSettled === false;
  const money = useMoney();
  const { go, open } = useDesk();
  const phone = usePhoneLayout();
  const [range, setRange] = useState<DashboardPeriod>(() => dashboardMonth());
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [report, setReport] = useState<{ key: string; data: ReportsOverview | null; failed?: boolean; networkFailure?: boolean; sales: typeof sales; inventory: typeof inventory } | null>(null);
  const [initialScope, setInitialScope] = useState('');
  const role = appSession?.membership?.role;
  const sections = appSession?.membership?.sections;
  const storeId = appSession?.store?.id;
  const seeFinancials = !!role && canSeeFinancials(sections, role);
  const can = (section: string) => canOpenSection(section, sections, role);
  const showUnits = seeFinancials || can('sales');
  const showStock = can('inventory');
  const kpiCount = (seeFinancials ? 2 : 0) + Number(showUnits) + Number(showStock);
  const ready = backendStatus === 'ready' && !!storeId && !appSession?.onboardingRequired && !!user;
  const scope = `${storeId}:${user?.uid}:${role}:${JSON.stringify(sections)}`;
  const queryKey = `${scope}:${range?.start}:${range?.end}`;

  useEffect(() => {
    setMembers([]);
    if (!canViewTeam(role) || !user || !storeId) return;
    let cancelled = false;
    listMembers(user, storeId).then(rows => { if (!cancelled) setMembers(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user, storeId, role]);

  useEffect(() => {
    setReport(null);
    if (!ready || loadingLists || !seeFinancials || !user) return;
    let cancelled = false;
    const controller = new AbortController();
    fetchReportsOverview(user, range?.start, range?.end, controller.signal)
      .then(data => { if (!cancelled) setReport({ key: queryKey, data, sales, inventory }); })
      .catch((cause: unknown) => { if (!cancelled) setReport({ key: queryKey, data: null, failed: true, networkFailure: isNetworkErrorMessage(toUserMessage(cause)), sales, inventory }); });
    return () => { cancelled = true; controller.abort(); };
  }, [ready, loadingLists, seeFinancials, user, queryKey, range?.start, range?.end, sales, inventory]);

  const current = ready && seeFinancials && report?.key === queryKey && report.sales === sales && report.inventory === inventory ? report : null;
  const overview = current?.data;
  const reportLoading = ready && seeFinancials && !current;
  const initialLoading = !ready || loadingLists || (initialScope !== scope && reportLoading);
  useEffect(() => { if (!initialLoading) setInitialScope(scope); }, [initialLoading, scope]);
  const periodLoading = initialLoading || reportLoading;
  const hideLoadMessage = backendStatus === 'offline' || current?.networkFailure;
  const comparable = !!range && !!overview?.comparison.available;
  const reportMoney = (amount: number, compact = false) => compact ? money.compact(amount, appSession?.store?.currency) : money.show(amount, appSession?.store?.currency);
  const available = inventory.filter(item => isInStock(item.status)).length;
  const openTrades = tradeIns.filter(item => !isVoidRow(item) && isInProgressTrade(item.status)).length;
  const balance = money.sum(clients.filter(client => clientNet(client) > 0).map(client => ({ amount: clientNet(client), currency: client.balanceCurrency })));
  const inRange = (value: string) => {
    if (!range) return true;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : parseAppDate(value);
    const key = typeof date === 'string' ? date : date ? dashboardDay(date) : '';
    return key >= range.start && key <= range.end;
  };
  const units = sales.filter(sale => !isVoidRow(sale) && sale.status === 'COMPLETADA' && inRange(sale.date)).length;
  const recent = useMemo(() => sales.filter(sale => inRange(sale.date)).sort((a, b) => (parseAppDate(b.date)?.getTime() ?? 0) - (parseAppDate(a.date)?.getTime() ?? 0) || (b.saleNumber ?? 0) - (a.saleNumber ?? 0)).slice(0, phone ? 4 : 5), [sales, range, phone]);
  const name = appSession?.user.displayName?.trim() || appSession?.user.email?.split('@')[0] || 'Usuario';
  const people = members.length ? members.map(member => ({ name: member.user.displayName?.trim() || member.user.email || 'Usuario', role: member.role })) : [{ name, role }];
  const avatars = <div className="avatars">{initialLoading ? <Skeleton style={{ width: 100, height: 34 }} /> : people.map((person, index) => <div key={index} className={`av ${['b', 'p', 'g'][index % 3]}`} title={[person.name, ROLE_LABEL[person.role ?? '']].filter(Boolean).join(' · ')}>{initials(person.name)}</div>)}{canViewTeam(role) ? <button className="av add" type="button" aria-label="Invitar" onClick={() => open({ type: 'invite' })}>+</button> : null}</div>;
  const currentMonth = dashboardMonth();
  const thisMonth = range?.start === currentMonth.start && range?.end === currentMonth.end;
  const emptyPeriod = !range ? 'en el historial' : thisMonth ? 'este mes' : 'en este período';
  const revenueLabel = !range ? 'Ventas totales' : thisMonth ? 'Ventas del mes' : 'Ventas del período';
  const pendingText = current?.failed || !ready ? 'No se pudo consultar el período' : `Todavía no hay ventas ${emptyPeriod}`;
  const trendTitle = { day: 'Ventas por día', week: 'Ventas por semana', month: 'Ventas por mes' }[dashboardTrendUnit(range)];

  return <div className="dscreen dashboard-screen dashboard-v2">
    <ScreenTitle title={<><div className="greet">Hola, {name}</div><h1 className="hero-h">¿Qué hay para <span className="hl">hoy</span>?</h1></>}
      tools={can('notifications') ? <DashboardBell count={initialLoading ? 0 : unreadBySection(operationNotifications ?? []).total} onClick={() => go('notifications')} /> : null}
      desktop={<div className="dright">{avatars}{can('sales') ? <DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta> : null}</div>}
      navigation={null} />
    {phone && can('sales') ? <div className="dashboard-register" data-testid="dashboard-register-sale"><DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta></div> : null}
    <DashboardDateRange range={range} onApply={setRange} phone={phone} />
    {kpiCount > 0 ? <div className="dashboard-kpis dkpis" data-count={kpiCount}>
      {seeFinancials ? <>
        <Kpi label={revenueLabel} value={overview ? reportMoney(overview.summary.revenue, true) : '—'} loading={periodLoading} onClick={() => go('reports')}>{comparable ? <Delta value={overview?.comparison.revenueChange} /> : null}</Kpi>
        <Kpi label="Margen bruto" value={overview ? reportMoney(overview.summary.grossProfit, true) : '—'} loading={periodLoading} suffix={overview?.summary.revenue ? `${Math.round(overview.summary.marginRate)}%` : undefined} onClick={() => go('reports')}>{comparable ? <Delta value={overview?.comparison.grossProfitChange} /> : null}</Kpi>
      </> : null}
      {showUnits ? <Kpi label="Equipos vendidos" value={seeFinancials ? overview?.summary.unitsSold ?? '—' : listsLoadFailed ? '—' : units} loading={seeFinancials ? periodLoading : initialLoading} onClick={can('sales') ? () => go('sales') : undefined}>{comparable ? <Delta value={overview?.comparison.unitsChange} /> : null}</Kpi> : null}
      {showStock ? <Kpi label="Stock disponible" value={listsLoadFailed ? '—' : available} suffix={!listsLoadFailed && inventory.length ? `de ${inventory.length}` : undefined} loading={initialLoading} onClick={can('inventory') ? () => go('inventory') : undefined}>
        {!listsLoadFailed ? <div className="dashboard-stock-bar" role="meter" aria-label="Stock disponible" aria-valuemin={0} aria-valuemax={Math.max(1, inventory.length)} aria-valuenow={available}><i style={{ width: `${inventory.length ? available / inventory.length * 100 : 0}%` }} /></div> : null}
      </Kpi> : null}
    </div> : null}
    {seeFinancials ? <div className="dashboard-chart-row">
      <section className="dashboard-panel dashboard-trend">
        <div className="dashboard-panel-heading"><h2>{phone ? trendTitle : 'Tendencia de ventas'}</h2>{comparable && !periodLoading && overview && overview.summary.unitsSold > 0 ? <Delta value={overview.comparison.revenueChange} /> : null}</div>
        {hideLoadMessage ? null : periodLoading ? <div className="dashboard-chart-empty" aria-busy="true"><Skeleton style={{ width: '85%', height: 140 }} /></div> : !overview || !overview.summary.unitsSold ? <div className="dashboard-chart-empty">{pendingText}</div> : <DashboardTrend series={overview.salesSeries} range={range} phone={phone} format={amount => reportMoney(amount, true)} />}
      </section>
      <section className="dashboard-panel dashboard-payments"><h2>Medios de pago</h2>
        {hideLoadMessage ? null : periodLoading ? <div className="dashboard-payment-empty" aria-busy="true"><Skeleton style={{ width: '90%', height: 80 }} /></div> : !overview?.paymentMethods.length ? <div className="dashboard-payment-empty">{current?.failed || !ready ? 'No se pudo consultar el período' : `Sin ventas ${emptyPeriod}`}</div> : <>
          <div className="dashboard-payment-stack" aria-hidden="true">{overview.paymentMethods.map((method, index) => <i key={method.label} style={{ width: `${method.share}%`, background: paymentColor(index) }} />)}</div>
          <div className="dashboard-payment-list">{overview.paymentMethods.map((method, index) => <div key={method.label} className="dashboard-payment">
            <span className="dashboard-payment-name"><i style={{ background: paymentColor(index) }} />{method.label}</span><span className="dashboard-payment-amount">{reportMoney(method.revenue)}</span><b>{Math.round(method.share)}%</b><div className="dashboard-payment-bar"><i style={{ width: `${method.share}%` }} /></div>
          </div>)}</div>
        </>}
      </section>
    </div> : null}
    <div className="dashboard-bottom-row">
      {can('sales') ? <section className="dashboard-panel dashboard-recent" data-testid="dashboard-sales">
        <div className="dashboard-panel-heading"><h2>Ventas recientes</h2><button className="wlink" type="button" onClick={() => go('sales')}>Ver todas</button></div>
        <div className="dashboard-recent-body" aria-busy={periodLoading}>
          {periodLoading ? <ListSkeleton variant="rows" rows={phone ? 4 : 5} testId="dashboard-sales-loading" /> : listsLoadFailed ? <div className="dashboard-recent-empty">No se pudieron consultar las ventas</div> : !recent.length ? <div className="dashboard-recent-empty">{sales.length ? 'Sin ventas en este período' : 'Todavía no registraste ventas'}</div> : recent.map(sale => {
            const buyer = saleBuyer(sale, clients);
            const date = parseAppDate(sale.date);
            const day = /^\d{4}-\d{2}-\d{2}$/.test(sale.date) ? sale.date : date ? dashboardDay(date) : '';
            const label = day === dashboardDay() ? 'hoy' : day ? dayDate(day).toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }) : '—';
            return <PressTarget key={sale.id} as="button" className={`dashboard-sale-row${isVoidRow(sale) ? ' is-void' : ''}`} onActivate={() => open({ type: 'sale', id: sale.id })} onMenu={point => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${buyer}`, ...point })}>
              <span className="dashboard-sale-avatar">{initials(buyer)}</span>
              <span className="dashboard-sale-person"><b>{buyer}</b><small><span className="dashboard-sale-code">#{saleCode(sale)} · </span>{saleEquipment(sale, inventory)}{phone ? ` · ${label}` : ''}</small></span>
              <span className="dashboard-sale-status"><Pill status={sale.status} kind="SALE_STATUS" /></span>
              <span className="dashboard-sale-amount"><b>{money.show(sale.amount, sale.amountCurrency)}</b>{phone ? null : <small>{label}</small>}</span>
            </PressTarget>;
          })}
        </div>
      </section> : null}
      <div className={`dashboard-shortcuts${!initialLoading && !sales.length && !inventory.length && !tradeIns.length && !clients.length ? ' is-empty' : ''}`}>
        {can('tradeins') ? <button type="button" className="dashboard-panel dashboard-shortcut" data-testid="dashboard-trades" aria-busy={initialLoading} onClick={() => go('tradeins')}><ArrowLeftRight size={18} /><span>Canjes en curso</span><b>{initialLoading ? <Skeleton style={{ width: 30 }} /> : listsLoadFailed ? '—' : openTrades}</b><ChevronRight size={16} /></button> : null}
        {can('clients') ? <button type="button" className="dashboard-panel dashboard-shortcut" aria-busy={initialLoading} onClick={() => go('clients')}><CreditCard size={18} /><span>Saldos a cobrar</span><b>{initialLoading ? <Skeleton style={{ width: 70 }} /> : listsLoadFailed || balance == null ? '—' : money.showActive(balance)}</b><ChevronRight size={16} /></button> : null}
      </div>
    </div>
  </div>;
}

function Kpi({ label, value, suffix, loading, onClick, children }: { label: string; value: ReactNode; suffix?: string; loading: boolean; onClick?: () => void; children?: ReactNode }) {
  const content = <><span className="dashboard-kpi-label">{label}</span><span className="dashboard-kpi-value">{loading ? <Skeleton style={{ width: 100, height: 34 }} /> : <>{value}{suffix ? <small>{suffix}</small> : null}</>}</span>{!loading ? children : null}</>;
  return onClick ? <button type="button" className="dashboard-panel dashboard-kpi" aria-busy={loading} onClick={onClick}>{content}</button> : <div className="dashboard-panel dashboard-kpi" aria-busy={loading}>{content}</div>;
}

export function Delta({ value }: { value: number | null | undefined }) {
  const valid = value != null && Number.isFinite(value);
  if (!valid) return null;
  return <span className={`dashboard-delta ${value === 0 ? 'flat' : value > 0 ? 'positive' : 'negative'}`} aria-label={`Variación frente al período anterior: ${Math.round(value)}%`}>{`${value > 0 ? '▲' : value < 0 ? '▼' : '—'} ${Math.abs(Math.round(value))}%`}</span>;
}

const paymentColor = (index: number) => ['var(--primary)', 'var(--lime)', '#9CA3AF', '#E5E7EB'][index] ?? '#737984';

function DashboardBell({ count, onClick }: { count: number; onClick: () => void }) {
  return <button type="button" className="rbtn dash-bell" data-testid="dashboard-bell" aria-label={count > 0 ? `Notificaciones, ${count} sin leer` : 'Notificaciones'} onClick={onClick}><DeskIcon name="bell" size={21} />{count > 0 ? <span className="dash-bell-count" aria-hidden="true">{count > 9 ? '9+' : count}</span> : null}</button>;
}
