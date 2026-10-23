import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Sale } from '../../types';
import { Skeleton } from '../../components/Skeleton';
import { useAppContext } from '../../context/AppContext';
import { ROLE_LABEL } from '../../lib/roles';
import { isNetworkErrorMessage, toUserMessage } from '../../lib/user-message';
import { listMembers, type TeamMember } from '../../services/members-api';
import { fetchReportsOverview, type ReportsOverview } from '../../services/reports-api';
import { clientNet } from '../client-balance';
import { DashboardDateRange } from '../dashboard-date-range';
import { dashboardDay, dashboardMonth, dashboardTrendUnit, type DashboardPeriod } from '../dashboard-period';
import { DashboardTrend } from '../dashboard-trend';
import { useMoney } from '../exchange';
import { formatShortDate, paymentLabel, initials, isInProgressTrade, isInStock, isVoidRow, parseAppDate, saleBuyer, saleCode, saleEquipment } from '../format';
import { listsAreLoading } from '../list-skeleton';
import { canOpenSection, canSeeFinancials, canViewTeam } from '../sections';
import { usePhoneLayout } from '../section-notices';
import { PhoneRecord, PhoneRecords } from '../section-notice-view';
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
  return <div className="dscreen dashboard-screen" aria-busy="true" data-testid="dashboard-initial-loading">
    <ScreenTitle title={<><div className="greet"><Skeleton style={{ width: 100, height: '1lh' }} /></div><h1 className="hero-h"><Skeleton style={{ width: 320, maxWidth: '100%', height: '1lh' }} /></h1></>} desktop={<div className="dright"><Skeleton style={{ width: 100, height: 34 }} />{can('sales') ? <Skeleton style={{ width: 160, height: 42 }} /> : null}</div>} navigation={null} />
    {phone ? <>{can('sales') ? <div className="dashboard-register"><Skeleton style={{ height: 52 }} /></div> : null}<div className="dashboard-month-nav"><Skeleton style={{ height: 40 }} /></div></> : null}
    {kpis > 0 ? <div className="dstats" data-count={kpis}>{Array.from({ length: kpis }, (_, i) => <Kpi key={i} label="" value="" loading />)}</div> : null}
    {financials ? <div className={`dgrid${phone ? '' : ' two v3-stretch'}`}><section className="dcard dashboard-trend"><div className="dch"><h3><Skeleton style={{ width: 150, height: '1lh' }} /></h3></div><div className="dashboard-chart-empty"><Skeleton style={{ width: '85%', height: 140 }} /></div></section><section className="dcard dashboard-payments"><div className="dch"><h3><Skeleton style={{ width: 150, height: '1lh' }} /></h3></div></section></div> : null}
    <div className={phone ? undefined : 'dgrid two'}>
      {can('sales') ? <section className={phone ? 'dashboard-sales' : 'dcard dashboard-sales'}><div className={`dch${phone ? ' sec' : ''}`}><h3><Skeleton style={{ width: 100, height: phone ? 22 : '1lh' }} /></h3></div><SalesLoading phone={phone} /></section> : null}
      <div className="v3-side">{!phone ? <>{can('tradeins') ? <div className="dcard v3-link"><span>Canjes en curso</span><Skeleton style={{ width: 30, height: 26 }} /><ChevronRight size={16} /></div> : null}{can('clients') ? <div className="dcard v3-link"><span>Saldos a cobrar</span><Skeleton style={{ width: 70, height: 26 }} /><ChevronRight size={16} /></div> : null}</> : null}<DashboardContact /></div>
    </div>
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
  const avatars = <div className="avatars">{initialLoading ? <Skeleton style={{ width: 100, height: 34 }} /> : people.map((person, index) => <div key={index} className="av" style={{ background: index % 2 ? 'var(--lime)' : 'var(--primary)', color: index % 2 ? 'var(--primary)' : '#fff', fontSize: 12 }} title={[person.name, ROLE_LABEL[person.role ?? '']].filter(Boolean).join(' · ')}>{initials(person.name)}</div>)}{canViewTeam(role) ? <button className="av add" type="button" aria-label="Invitar" onClick={() => open({ type: 'invite' })}>+</button> : null}</div>;
  const currentMonth = dashboardMonth();
  const thisMonth = range?.start === currentMonth.start && range?.end === currentMonth.end;
  const emptyPeriod = !range ? 'en el historial' : thisMonth ? 'este mes' : 'en este período';
  const pendingText = current?.failed || !ready ? 'No se pudo consultar el período' : `Todavía no hay ventas ${emptyPeriod}`;
  const trendTitle = { day: 'Ventas por día', week: 'Ventas por semana', month: 'Ventas por mes' }[dashboardTrendUnit(range)];

  return <div className="dscreen dashboard-screen">
    <ScreenTitle title={<><div className="greet">Hola, {name}</div><h1 className="hero-h">¿Qué hay para <span className="hl">hoy</span>?</h1></>}
      tools={can('notifications') ? <DashboardBell count={initialLoading ? 0 : unreadBySection(operationNotifications ?? []).total} onClick={() => go('notifications')} /> : null}
      desktop={<div className="dright">{avatars}{can('sales') ? <DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta> : null}</div>}
      navigation={null} />
    {phone && can('sales') ? <div className="dashboard-register" data-testid="dashboard-register-sale"><DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta></div> : null}
    <DashboardDateRange range={range} onApply={setRange} phone={phone} />
    {kpiCount > 0 ? <div className="dstats" data-count={kpiCount}>
      {seeFinancials ? <>
        <Kpi label="Ventas" value={overview ? reportMoney(overview.summary.revenue, true) : '—'} loading={periodLoading} onClick={() => go('reports')}>{comparable ? <Delta value={overview?.comparison.revenueChange} /> : null}</Kpi>
        <Kpi label="Margen bruto" value={overview ? reportMoney(overview.summary.grossProfit, true) : '—'} loading={periodLoading} suffix={overview?.summary.revenue ? `${Math.round(overview.summary.marginRate)}%` : undefined} onClick={() => go('reports')}>{comparable ? <Delta value={overview?.comparison.grossProfitChange} /> : null}</Kpi>
      </> : null}
      {showUnits ? <Kpi label="Equipos vendidos" value={seeFinancials ? overview?.summary.unitsSold ?? '—' : listsLoadFailed ? '—' : units} loading={seeFinancials ? periodLoading : initialLoading} onClick={can('sales') ? () => go('sales') : undefined}>{comparable ? <Delta value={overview?.comparison.unitsChange} /> : null}</Kpi> : null}
      {showStock ? <Kpi label="Stock disponible" value={listsLoadFailed ? '—' : available} suffix={!listsLoadFailed && inventory.length ? `de ${inventory.length}` : undefined} loading={initialLoading} onClick={can('inventory') ? () => go('inventory') : undefined}>
        {!listsLoadFailed ? <div className="budget" role="meter" aria-label="Stock disponible" aria-valuemin={0} aria-valuemax={Math.max(1, inventory.length)} aria-valuenow={available}><i style={{ width: `${inventory.length ? available / inventory.length * 100 : 0}%` }} /></div> : null}
      </Kpi> : null}
    </div> : null}
    {seeFinancials ? <div className={`dgrid${phone ? '' : ' two v3-stretch'}`}>
      <section className="dcard dashboard-trend">
        <div className="dch"><h3>{phone ? trendTitle : 'Tendencia de ventas'}</h3>{comparable && !periodLoading && overview && overview.summary.unitsSold > 0 ? <Delta value={overview.comparison.revenueChange} /> : null}</div>
        {hideLoadMessage ? null : periodLoading ? <div className="dashboard-chart-empty" aria-busy="true"><Skeleton style={{ width: '85%', height: 140 }} /></div> : !overview || !overview.summary.unitsSold ? <div className="dashboard-chart-empty">{pendingText}</div> : <DashboardTrend series={overview.salesSeries} range={range} phone={phone} format={amount => reportMoney(amount, true)} />}
      </section>
      <section className="dcard dashboard-payments"><div className="dch"><h3>Medios de pago</h3></div>
        {hideLoadMessage ? null : periodLoading ? <div className="dashboard-payment-empty" aria-busy="true"><Skeleton style={{ width: '90%', height: phone ? 64 : 80 }} /></div> : !overview?.paymentMethods.length ? <div className="dashboard-payment-empty">{current?.failed || !ready ? 'No se pudo consultar el período' : `Sin ventas ${emptyPeriod}`}</div> : <>
          <div className="dashboard-payment-stack" aria-hidden="true">{overview.paymentMethods.map((method, index) => <i key={method.label} style={{ width: `${method.share}%`, background: paymentColor(index) }} />)}</div>
          <div className="dashboard-payment-list">{overview.paymentMethods.map((method, index) => <div key={method.label} className="dashboard-payment">
            <span className="dashboard-payment-name"><i style={{ background: paymentColor(index) }} />{method.label}</span><span className="dashboard-payment-amount">{reportMoney(method.revenue)}</span><b>{Math.round(method.share)}%</b><div className="dashboard-payment-bar"><i style={{ width: `${method.share}%` }} /></div>
          </div>)}</div>
        </>}
      </section>
    </div> : null}
    <div className={phone ? undefined : 'dgrid two'}>
      {can('sales') ? <section className={phone ? 'dashboard-sales' : 'dcard dashboard-sales'} data-testid="dashboard-sales">
        <div className={`dch${phone ? ' sec' : ''}`}><h3>Ventas</h3><button className="wlink" type="button" onClick={() => go('sales')}>Ver todas</button></div>
        <div className="dashboard-sales-body" aria-busy={periodLoading}>
          {periodLoading ? <SalesLoading phone={phone} /> : listsLoadFailed ? <div className="dashboard-recent-empty">No se pudieron consultar las ventas</div> : !recent.length ? <div className="dashboard-recent-empty">{sales.length ? 'Sin ventas en este período' : 'Todavía no registraste ventas'}</div> : phone ? <PhoneRecords>{recent.map(sale => <PhoneRecord key={sale.id} className={isVoidRow(sale) ? 'is-void' : undefined} onActivate={() => open({ type: 'sale', id: sale.id })} onMenu={point => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${saleBuyer(sale, clients)}`, ...point })}>
            <RecentSaleCard sale={sale} buyer={saleBuyer(sale, clients)} equipment={saleEquipment(sale, inventory)} amount={money.show(sale.amount, sale.amountCurrency)} />
          </PhoneRecord>)}</PhoneRecords> : <table className="dtable compact">
            <SalesTableHead />
            <tbody>{recent.map(sale => <PressTarget key={sale.id} as="tr" className={isVoidRow(sale) ? 'is-void' : undefined} onActivate={() => open({ type: 'sale', id: sale.id })} onMenu={point => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${saleBuyer(sale, clients)}`, ...point })}>
              <td><b>#{saleCode(sale)}</b><small>{formatShortDate(sale.date)}</small></td><td>{saleBuyer(sale, clients)}</td><td>{saleEquipment(sale, inventory)}</td><td className="r"><b>{money.show(sale.amount, sale.amountCurrency)}</b></td><td><Pill status={sale.status} kind="SALE_STATUS" /></td>
            </PressTarget>)}</tbody>
          </table>}
        </div>
      </section> : null}
      <div className="v3-side">
        {!phone ? <>{can('tradeins') ? <button type="button" className="dcard v3-link" data-testid="dashboard-trades" aria-busy={initialLoading} onClick={() => go('tradeins')}><span>Canjes en curso</span><b>{initialLoading ? <Skeleton style={{ width: 30, height: 26 }} /> : listsLoadFailed ? '—' : openTrades}</b><ChevronRight size={16} /></button> : null}
        {can('clients') ? <button type="button" className="dcard v3-link" aria-busy={initialLoading} onClick={() => go('clients')}><span>Saldos a cobrar</span><b>{initialLoading ? <Skeleton style={{ width: 70, height: 26 }} /> : listsLoadFailed || balance == null ? '—' : money.showActive(balance)}</b><ChevronRight size={16} /></button> : null}</> : null}
        <DashboardContact />
      </div>
    </div>
  </div>;
}

function Kpi({ label, value, suffix, loading, onClick, children }: { label: string; value: ReactNode; suffix?: string; loading: boolean; onClick?: () => void; children?: ReactNode }) {
  const content = <><div className="eb">{label || <Skeleton style={{ width: 100, height: '1lh' }} />}</div><div className="big">{loading ? <Skeleton style={{ width: 100, height: '1lh' }} /> : <>{value}{suffix ? <> <small className="mut">{suffix}</small></> : null}</>}</div>{!loading && children ? children : <span className="spill dashboard-delta-reserve" aria-hidden="true">&nbsp;</span>}</>;
  return onClick ? <button type="button" className="dstat" aria-busy={loading} onClick={onClick}>{content}</button> : <div className="dstat" aria-busy={loading}>{content}</div>;
}

function SalesTableHead() {
  return <thead><tr><th>Venta</th><th>Cliente</th><th>Equipo</th><th className="r">Total</th><th>Estado</th></tr></thead>;
}

function SalesLoading({ phone }: { phone: boolean }) {
  return <div className="dashboard-sales-body" aria-busy="true" data-testid="dashboard-sales-loading">{phone ? <div className="phone-rows">{Array.from({ length: 4 }, (_, i) => <div key={i} className="phone-row" aria-hidden="true"><span className="sale-card">
    <span className="sale-top"><Skeleton style={{ width: 140, height: 16 }} /><Skeleton style={{ width: 90, height: 20 }} /></span>
    <span className="sale-who"><span className="av-c"><Skeleton style={{ height: 36, borderRadius: '50%' }} /></span><span><Skeleton style={{ width: 140, height: 20 }} /><Skeleton style={{ width: 110, height: 16 }} /></span></span>
    <span className="sale-bot"><Skeleton style={{ width: 90, height: 21 }} /><Skeleton style={{ width: 100, height: 21 }} /></span>
  </span></div>)}</div> : <table className="dtable compact"><SalesTableHead /><tbody>{Array.from({ length: 5 }, (_, i) => <tr key={i} aria-hidden="true"><td><Skeleton style={{ width: 65, height: 18 }} /><Skeleton style={{ width: 65, height: 16 }} /></td>{Array.from({ length: 4 }, (_, j) => <td key={j}><Skeleton style={{ width: j === 1 ? 120 : 80, maxWidth: '100%', height: 18 }} /></td>)}</tr>)}</tbody></table>}</div>;
}

function RecentSaleCard({ sale, buyer, equipment, amount }: { sale: Sale; buyer: string; equipment: string; amount: string }) {
  return <span className="sale-card">
    <span className="sale-top"><span className="sale-id">#{saleCode(sale)} · {formatShortDate(sale.date)}</span><Pill status={sale.status} kind="SALE_STATUS" /></span>
    <span className="sale-who"><span className="av-c" aria-hidden="true" style={{ background: 'var(--section)', color: '#fff' }} /><span><b>{buyer}</b><small>{equipment}</small></span></span>
    <span className="sale-bot"><span>{paymentLabel(sale.paymentMethod)}</span><span className="sale-amt"><b>{amount}</b></span></span>
  </span>;
}

function DashboardContact() {
  return <a className="commission-hero v3-contact" href="https://wa.me/5491141722188" target="_blank" rel="noopener noreferrer">
    <b>¿Encontraste un error o tenés una idea?</b>
    <span className="btn2 l"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.17-1.51A9.9 9.9 0 1 0 12.04 2Zm0 18.1c-1.5 0-2.97-.4-4.25-1.17l-.3-.18-3.07.9.92-2.99-.2-.31a8.1 8.1 0 1 1 6.9 3.75Zm4.45-6.06c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.8-.2-.47-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z" /></svg>Contanos</span>
  </a>;
}

export function Delta({ value }: { value: number | null | undefined }) {
  const valid = value != null && Number.isFinite(value);
  if (!valid) return null;
  return <span className={`spill ${value === 0 ? 'mid' : value > 0 ? 'ok' : 'cst'}`} style={value < 0 ? { '--pc': '#E8A33D' } as React.CSSProperties : undefined} aria-label={`Variación frente al período anterior: ${Math.round(value)}%`}>{`${value > 0 ? '▲' : value < 0 ? '▼' : '—'} ${Math.abs(Math.round(value))}%`}</span>;
}

const paymentColor = (index: number) => ['var(--primary)', 'var(--lime)', '#9CA3AF', '#E5E7EB'][index] ?? '#737984';

function DashboardBell({ count, onClick }: { count: number; onClick: () => void }) {
  return <button type="button" className="rbtn dash-bell" data-testid="dashboard-bell" aria-label={count > 0 ? `Notificaciones, ${count} sin leer` : 'Notificaciones'} onClick={onClick}><DeskIcon name="bell" size={21} />{count > 0 ? <span className="dash-bell-count" aria-hidden="true">{count > 9 ? '9+' : count}</span> : null}</button>;
}
