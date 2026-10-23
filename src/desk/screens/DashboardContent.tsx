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
import { dashboardDay, dashboardMonth, dashboardTrendUnit, dayDate, type DashboardRange } from '../dashboard-period';
import { DashboardTrend } from '../dashboard-trend';
import { useMoney } from '../exchange';
import { initials, isInProgressTrade, isInStock, isVoidRow, parseAppDate, saleBuyer, saleCode, saleEquipment } from '../format';
import { ListSkeleton, listsAreLoading } from '../list-skeleton';
import { canOpenSection, canSeeFinancials, canViewTeam } from '../sections';
import { usePhoneLayout } from '../section-notices';
import { unreadBySection } from '../unread-count';
import { DeskCta, DeskIcon, Pill, PressTarget, ScreenTitle, useDesk } from '../ui';
import '../dashboard.css';

export function DashboardContent() {
  const { appSession, user, backendStatus, sales, inventory, tradeIns, clients, operationNotifications, listsLoaded } = useAppContext();
  const loadingLists = listsAreLoading(listsLoaded);
  const money = useMoney();
  const { go, open } = useDesk();
  const phone = usePhoneLayout();
  const [range, setRange] = useState<DashboardRange>(() => dashboardMonth());
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [report, setReport] = useState<{ key: string; data: ReportsOverview | null; failed?: boolean; networkFailure?: boolean } | null>(null);
  const role = appSession?.membership?.role;
  const sections = appSession?.membership?.sections;
  const storeId = appSession?.store?.id;
  const seeFinancials = canSeeFinancials(sections, role);
  const can = (section: string) => canOpenSection(section, sections, role);
  const ready = backendStatus === 'ready' && !!storeId && !appSession?.onboardingRequired && !!user;
  const queryKey = `${storeId}:${user?.uid}:${range.start}:${range.end}`;

  useEffect(() => {
    setMembers([]);
    if (!canViewTeam(role) || !user || !storeId) return;
    let cancelled = false;
    listMembers(user, storeId).then(rows => { if (!cancelled) setMembers(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user, storeId, role]);

  useEffect(() => {
    setReport(null);
    if (!ready || !seeFinancials || !user) return;
    let cancelled = false;
    const controller = new AbortController();
    fetchReportsOverview(user, range.start, range.end, controller.signal)
      .then(data => { if (!cancelled) setReport({ key: queryKey, data }); })
      .catch((cause: unknown) => { if (!cancelled) setReport({ key: queryKey, data: null, failed: true, networkFailure: isNetworkErrorMessage(toUserMessage(cause)) }); });
    return () => { cancelled = true; controller.abort(); };
  }, [ready, seeFinancials, user, queryKey, range.start, range.end, sales, inventory]);

  const current = ready && seeFinancials && report?.key === queryKey ? report : null;
  const overview = current?.data;
  const reportLoading = ready && seeFinancials && !current;
  const hideLoadMessage = backendStatus === 'offline' || current?.networkFailure;
  const reportMoney = (amount: number, compact = false) => compact ? money.compact(amount, appSession?.store?.currency) : money.show(amount, appSession?.store?.currency);
  const available = inventory.filter(item => isInStock(item.status)).length;
  const openTrades = tradeIns.filter(item => isInProgressTrade(item.status)).length;
  const balance = money.sum(clients.filter(client => clientNet(client) > 0).map(client => ({ amount: clientNet(client), currency: client.balanceCurrency })));
  const inRange = (value: string) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : parseAppDate(value);
    const key = typeof date === 'string' ? date : date ? dashboardDay(date) : '';
    return key >= range.start && key <= range.end;
  };
  const units = sales.filter(sale => !isVoidRow(sale) && sale.status === 'COMPLETADA' && inRange(sale.date)).length;
  const recent = useMemo(() => [...sales].sort((a, b) => (parseAppDate(b.date)?.getTime() ?? 0) - (parseAppDate(a.date)?.getTime() ?? 0) || (b.saleNumber ?? 0) - (a.saleNumber ?? 0)).slice(0, phone ? 4 : 5), [sales, phone]);
  const name = appSession?.user.displayName?.trim() || appSession?.user.email?.split('@')[0] || 'Usuario';
  const people = members.length ? members.map(member => ({ name: member.user.displayName?.trim() || member.user.email || 'Usuario', role: member.role })) : [{ name, role }];
  const avatars = <div className="avatars">{people.map((person, index) => <div key={index} className={`av ${['b', 'p', 'g'][index % 3]}`} title={[person.name, ROLE_LABEL[person.role ?? '']].filter(Boolean).join(' · ')}>{initials(person.name)}</div>)}{canViewTeam(role) ? <button className="av add" type="button" aria-label="Invitar" onClick={() => open({ type: 'invite' })}>+</button> : null}</div>;
  const currentMonth = dashboardMonth();
  const thisMonth = range.start === currentMonth.start && range.end === currentMonth.end;
  const emptyPeriod = thisMonth ? 'este mes' : 'en este período';
  const pendingText = current?.failed || !ready ? 'No se pudo consultar el período' : `Todavía no hay ventas ${emptyPeriod}`;
  const trendTitle = { day: 'Ventas por día', week: 'Ventas por semana', month: 'Ventas por mes' }[dashboardTrendUnit(range)];

  return <div className="dscreen dashboard-screen dashboard-v2">
    <ScreenTitle title={<><div className="greet">Hola, {name}</div><h1 className="hero-h">¿Qué hay para <span className="hl">hoy</span>?</h1></>}
      tools={can('notifications') ? <DashboardBell count={unreadBySection(operationNotifications ?? []).total} onClick={() => go('notifications')} /> : null}
      desktop={<div className="dright">{avatars}{can('sales') ? <DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta> : null}</div>}
      navigation={null} />
    {phone && can('sales') ? <div className="dashboard-register" data-testid="dashboard-register-sale"><DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta></div> : null}
    <DashboardDateRange range={range} onApply={setRange} phone={phone} />
    <div className={`dashboard-kpis dkpis${seeFinancials ? '' : ' limited'}`}>
      {seeFinancials ? <>
        <Kpi label="Ventas del mes" value={overview ? reportMoney(overview.summary.revenue, true) : '—'} loading={reportLoading} onClick={() => go('reports')}><Delta value={overview?.comparison.revenueChange} /></Kpi>
        <Kpi label="Margen bruto" value={overview ? reportMoney(overview.summary.grossProfit, true) : '—'} loading={reportLoading} suffix={overview?.summary.revenue ? `${Math.round(overview.summary.marginRate)}%` : undefined} onClick={() => go('reports')}><Delta value={overview?.comparison.grossProfitChange} /></Kpi>
      </> : null}
      <Kpi label="Equipos vendidos" value={seeFinancials ? overview?.summary.unitsSold ?? '—' : units} loading={seeFinancials ? reportLoading : loadingLists} onClick={can('sales') ? () => go('sales') : undefined}>{seeFinancials ? <Delta value={overview?.comparison.unitsChange} /> : null}</Kpi>
      <Kpi label="Stock disponible" value={available} suffix={inventory.length ? `de ${inventory.length}` : undefined} loading={loadingLists} onClick={can('inventory') ? () => go('inventory') : undefined}>
        <div className="dashboard-stock-bar" role="meter" aria-label="Stock disponible" aria-valuemin={0} aria-valuemax={Math.max(1, inventory.length)} aria-valuenow={available}><i style={{ width: `${inventory.length ? available / inventory.length * 100 : 0}%` }} /></div>
      </Kpi>
    </div>
    {seeFinancials ? <div className="dashboard-chart-row">
      <section className="dashboard-panel dashboard-trend">
        <div className="dashboard-panel-heading"><h2>{phone ? trendTitle : 'Tendencia de ventas'}</h2>{overview && overview.summary.unitsSold > 0 ? <Delta value={overview.comparison.revenueChange} /> : null}</div>
        {reportLoading ? <div className="dashboard-chart-empty" aria-busy="true"><Skeleton style={{ width: '85%', height: 140 }} /></div> : hideLoadMessage ? null : !overview || !overview.summary.unitsSold ? <div className="dashboard-chart-empty">{pendingText}</div> : <DashboardTrend series={overview.salesSeries} range={range} phone={phone} format={amount => reportMoney(amount, true)} />}
      </section>
      <section className="dashboard-panel dashboard-payments"><h2>Medios de pago</h2>
        {reportLoading ? <div className="dashboard-chart-empty" aria-busy="true"><Skeleton style={{ width: '90%', height: 80 }} /></div> : hideLoadMessage ? null : !overview?.paymentMethods.length ? <div className="dashboard-payment-empty">{current?.failed || !ready ? 'No se pudo consultar el período' : `Sin ventas ${emptyPeriod}`}</div> : <>
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
        <div className="dashboard-recent-body">
          {loadingLists ? <ListSkeleton variant="rows" rows={4} testId="dashboard-sales-loading" /> : !recent.length ? <div className="dashboard-recent-empty">Todavía no registraste ventas</div> : recent.map(sale => {
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
      <div className={`dashboard-shortcuts${!loadingLists && !sales.length && !inventory.length && !tradeIns.length && !clients.length ? ' is-empty' : ''}`}>
        {can('tradeins') ? <button type="button" className="dashboard-panel dashboard-shortcut" data-testid="dashboard-trades" aria-busy={loadingLists} onClick={() => go('tradeins')}><ArrowLeftRight size={18} /><span>Canjes en curso</span><b>{loadingLists ? <Skeleton style={{ width: 30 }} /> : openTrades}</b><ChevronRight size={16} /></button> : null}
        {can('clients') ? <button type="button" className="dashboard-panel dashboard-shortcut" onClick={() => go('clients')}><CreditCard size={18} /><span>Saldos a cobrar</span><b>{loadingLists ? <Skeleton style={{ width: 70 }} /> : balance == null ? '—' : money.showActive(balance)}</b><ChevronRight size={16} /></button> : null}
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
  return <span className={`dashboard-delta ${!valid || value === 0 ? 'flat' : value > 0 ? 'positive' : 'negative'}`} aria-label={valid ? `Variación frente al período anterior: ${Math.round(value)}%` : 'Sin base de comparación'}>{!valid ? '—' : `${value > 0 ? '▲' : value < 0 ? '▼' : '—'} ${Math.abs(Math.round(value))}%`}</span>;
}

const paymentColor = (index: number) => ['var(--primary)', 'var(--lime)', '#9CA3AF', '#E5E7EB'][index] ?? '#737984';

function DashboardBell({ count, onClick }: { count: number; onClick: () => void }) {
  return <button type="button" className="rbtn dash-bell" data-testid="dashboard-bell" aria-label={count > 0 ? `Notificaciones, ${count} sin leer` : 'Notificaciones'} onClick={onClick}><DeskIcon name="bell" size={21} />{count > 0 ? <span className="dash-bell-count" aria-hidden="true">{count > 9 ? '9+' : count}</span> : null}</button>;
}
