import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { listMembers, type TeamMember } from '../../services/members-api';
import { clientNet } from '../client-balance';
import { useMoney } from '../exchange';
import {
  saleBuyer,
  formatShortDate,
  initials,
  isInProgressTrade,
  isInStock,
  parseAppDate,
  paymentLabel,
  isVoidSale,
  saleCode,
  saleEquipment,
  tradeClientLabel,
  tradeCode,
} from '../format';
import { ImanagerIcon } from '../icons';
import { ListSkeleton, listsAreLoading } from '../list-skeleton';
import { canOpenSection, canSeeFinancials, canViewTeam } from '../sections';
import { usePhoneLayout } from '../section-notices';
import { PhoneRecord, PhoneRecords } from '../section-notice-view';
import { unreadBySection } from '../unread-count';
import { DeskCta, DeskIcon, Pill, PressTarget, ScreenTitle, useDesk } from '../ui';
import type { Sale } from '../../types';
import { ROLE_LABEL } from '../../lib/roles';
import { Plus } from 'lucide-react';

const TASKS = [
  { id: 'inv', label: 'Revisá ingresos o cambios en inventario' },
  { id: 'ven', label: 'Registrá ventas y canjes a medida que ocurren' },
  { id: 'fb', label: 'Si algo no cierra, avisá o dejá feedback' },
] as const;

export function DashboardContent() {
  const { appSession, user, sales, inventory, tradeIns, clients, operationNotifications, listsLoaded } = useAppContext();
  const loadingLists = listsAreLoading(listsLoaded);
  const money = useMoney();
  const { go, open, toast, back } = useDesk();
  const phone = usePhoneLayout();
  const storeId = appSession?.store?.id ?? 'local';
  const storageKey = `imanager-desk-focus:${storeId}`;
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    try {
      setChecks(JSON.parse(localStorage.getItem(storageKey) || '{}'));
    } catch {
      setChecks({});
    }
  }, [storageKey]);

  const role = appSession?.membership?.role;
  const teamStoreId = appSession?.store?.id;
  useEffect(() => {
    if (!canViewTeam(role) || !user || !teamStoreId) return;
    let cancelled = false;
    listMembers(user, teamStoreId)
      .then((rows) => { if (!cancelled) setMembers(rows); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [user, teamStoreId, role]);

  useEffect(() => {
    const onCheck = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id !== 'inv' && id !== 'ven') return;
      setChecks((current) => {
        if (current[id]) return current;
        const next = { ...current, [id]: true };
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener('desk-check', onCheck);
    return () => window.removeEventListener('desk-check', onCheck);
  }, [storageKey]);

  const now = new Date();
  const sameDay = (value: string) => {
    const date = parseAppDate(value);
    return !!date && date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };
  const autoVen = sales.some((sale) => sale.status !== 'CANCELADA' && sameDay(sale.date));
  const taskOn = (id: string, map: Record<string, boolean>) => map[id] || (id === 'ven' && autoVen);

  const toggle = (id: string) => {
    setChecks((current) => {
      const next = { ...current, [id]: !current[id] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      const wasDone = TASKS.every((task) => taskOn(task.id, current));
      const isDone = TASKS.every((task) => taskOn(task.id, next));
      if (isDone && !wasDone) toast('¡Flujo del día completo!');
      return next;
    });
  };

  const done = TASKS.filter((task) => taskOn(task.id, checks)).length;
  const pct = Math.round((done / TASKS.length) * 100);
  const monthSales = sales.filter((sale) => {
    if (sale.status === 'CANCELADA') return false;
    const date = parseAppDate(sale.date);
    if (!date) return false;
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const monthTotal = money.sum(monthSales.map((sale) => ({ amount: sale.amount, currency: sale.amountCurrency })));
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1);
  const prevSales = sales.filter((sale) => {
    if (sale.status === 'CANCELADA') return false;
    const date = parseAppDate(sale.date);
    return !!date && date >= prevStart && date < prevEnd;
  });
  const prevTotal = money.sum(prevSales.map((sale) => ({ amount: sale.amount, currency: sale.amountCurrency })));
  const monthDelta = monthTotal != null && prevTotal != null && prevTotal > 0 ? Math.round(((monthTotal - prevTotal) / prevTotal) * 100) : null;
  const available = inventory.filter((item) => isInStock(item.status)).length;
  const openTrades = tradeIns.filter((item) => isInProgressTrade(item.status));
  const balance = clients.filter((client) => clientNet(client) > 0);
  const balanceTotal = money.sum(balance.map((client) => ({ amount: clientNet(client), currency: client.balanceCurrency })));
  const recent = useMemo(() => [...sales].sort((a, b) => {
    const left = parseAppDate(b.date)?.getTime() ?? 0;
    const right = parseAppDate(a.date)?.getTime() ?? 0;
    if (left !== right) return left - right;
    return (b.saleNumber ?? 0) - (a.saleNumber ?? 0);
  }).slice(0, 5), [sales]);
  const seeFinancials = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const canNotify = canOpenSection('notifications', appSession?.membership?.sections, appSession?.membership?.role);
  const seeTrades = canOpenSection('tradeins', appSession?.membership?.sections, appSession?.membership?.role);
  const seeTeam = canViewTeam(appSession?.membership?.role);
  const unread = unreadBySection(operationNotifications ?? []);
  const name = appSession?.user.displayName?.trim() || appSession?.user.email?.split('@')[0] || 'Usuario';
  const stockPct = inventory.length ? Math.round((available / inventory.length) * 100) : 0;
  const avatarLabels = members.length
    ? members.map((member) => ({ name: member.user.displayName?.trim() || member.user.email || 'Usuario', role: member.role }))
    : [{ name, role }];
  const shownAvatars = phone ? avatarLabels.slice(0, 3) : avatarLabels;

  const people = (
    <div className="avatars">
      {shownAvatars.map((person, index) => (
        <div key={`${person.name}-${index}`} className={`av ${['b', 'p', 'g'][index % 3]}`} title={[person.name, ROLE_LABEL[person.role ?? '']].filter(Boolean).join(' · ')}>{initials(person.name)}</div>
      ))}
      {seeTeam ? <button className="av add" type="button" aria-label="Invitar" onClick={() => open({ type: 'invite' })}>+</button> : null}
    </div>
  );

  return (
    <div className="dscreen dashboard-screen">
      <ScreenTitle
        title={<><div className="greet">Hola, {name}</div><h1 className="hero-h">¿Qué hay para <span className="hl">hoy</span>?</h1></>}
        back={back}
        tools={phone ? (
          <div className="dash-tools">
            {people}
            {canNotify ? <DashboardBell count={unread.total} onClick={() => go('notifications')} /> : null}
          </div>
        ) : people}
        desktop={<div className="dright">{people}<DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta></div>}
      />
      <div className="dgrid dash">
        <div className="hero">
          <div className="hero-top">
            <span className="badge">+ Tu turno</span>
            <div className="turn-ring" style={{ background: `conic-gradient(var(--lime) ${pct}%, #ECECEC 0%)` }}>
              <div className="ring-inner">{done}/{TASKS.length}</div>
            </div>
          </div>
          <h2>Flujo sugerido</h2>
          <div className="sub">Una guía rápida para arrancar el turno</div>
          <div className="hlist">
            {TASKS.map((task) => {
              const on = taskOn(task.id, checks);
              return (
                <button key={task.id} type="button" className={`item${on ? ' done' : ''}`} onClick={() => toggle(task.id)}>
                  <span className={`cb${on ? ' on' : ''}`} />
                  <span className="name">{task.label}</span>
                </button>
              );
            })}
          </div>
          <div className="progress">
            <span>{done}/{TASKS.length}</span>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <span>{done === TASKS.length ? 'listo' : `faltan ${TASKS.length - done}`}</span>
          </div>
          {phone ? (
            <div className="hero-cta" data-testid="dashboard-register-sale">
              <DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta>
            </div>
          ) : null}
        </div>
        <div className="dkpis">
          <button className="mini" type="button" onClick={() => go('sales')}>
            <div className="ico"><DeskIcon name="cart" size={22} /></div>
            <div className="eyebrow">Ventas del mes</div>
            <div className="val">{loadingLists ? <span className="list-skel-bar" /> : seeFinancials ? (monthTotal == null ? '—' : money.compactActive(monthTotal)) : monthSales.length}</div>
            <div className="sub">{loadingLists ? 'Cargando…' : seeFinancials ? <>{monthSales.length === 1 ? '1 venta' : `${monthSales.length} ventas`}{monthDelta == null ? '' : <> · <span className={monthDelta >= 0 ? 'up' : 'down'}>{monthDelta >= 0 ? '▲' : '▼'} {Math.abs(monthDelta)}%</span></>}</> : 'operaciones'}</div>
          </button>
          <button className="mini" type="button" onClick={() => go('inventory')}>
            <div className="ico"><ImanagerIcon name="equipo" size={20} /></div>
            <div className="eyebrow">En stock</div>
            <div className="val">{loadingLists ? <span className="list-skel-bar" /> : <>{inventory.length} {inventory.length === 1 ? 'equipo' : 'equipos'}</>}</div>
            <div className="sub">{loadingLists ? 'Cargando…' : <>{available} {available === 1 ? 'disponible' : 'disponibles'}</>}</div>
            <div className="budget"><i style={{ width: `${stockPct}%` }} /></div>
          </button>
          {seeTrades ? <button className="mini" type="button" onClick={() => go('tradeins')}>
            <div className="ico"><ImanagerIcon name="canje" size={20} /></div>
            <div className="eyebrow">Canjes en curso</div>
            <div className="val">{loadingLists ? <span className="list-skel-bar" /> : openTrades.length}</div>
            <div className="sub">{loadingLists ? 'Cargando…' : `${tradeIns.length} en total`}</div>
          </button> : null}
          <button className="mini" type="button" onClick={() => go('clients')}>
            <div className="ico"><ImanagerIcon name="cliente" size={20} /></div>
            <div className="eyebrow">Saldos a cobrar</div>
            <div className="val">{loadingLists ? <span className="list-skel-bar" /> : balanceTotal == null ? '—' : money.compactActive(balanceTotal)}</div>
            <div className="sub">{loadingLists ? 'Cargando…' : balance.length === 1 ? '1 cliente' : `${balance.length} clientes`}</div>
          </button>
        </div>
      </div>

      <div className="dgrid two">
        <div className="dcard" data-testid="dashboard-sales">
          <div className="dch"><h3>Ventas recientes</h3><button className="wlink" type="button" onClick={() => go('sales')}>Ver todas</button></div>
          {loadingLists ? <ListSkeleton variant={phone ? 'cards' : 'rows'} rows={4} testId="dashboard-sales-loading" /> : recent.length === 0 ? (
            <div className="wempty dashboard-empty">
              <div><b>Todavía no registraste ventas</b><small>Tu primera venta aparece acá</small></div>
              <DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta>
            </div>
          ) : phone ? (
            <PhoneRecords>
              {recent.map((sale) => (
                <PhoneRecord
                  key={sale.id}
                  className={isVoidSale(sale) ? 'is-void' : undefined}
                  onActivate={() => open({ type: 'sale', id: sale.id })}
                  onMenu={(point) => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${saleBuyer(sale, clients)}`, ...point })}
                >
                  <RecentSaleCard
                    sale={sale}
                    buyer={saleBuyer(sale, clients)}
                    equipment={saleEquipment(sale, inventory)}
                    amount={money.show(sale.amount, sale.amountCurrency)}
                  />
                </PhoneRecord>
              ))}
            </PhoneRecords>
          ) : (
            <table className="dtable compact">
              <thead><tr><th>Venta</th><th>Cliente</th><th>Equipo</th><th className="r">Total</th><th>Estado</th></tr></thead>
              <tbody>
                {recent.map((sale) => {
                  return (
                    <PressTarget key={sale.id} as="tr" className={isVoidSale(sale) ? 'is-void' : undefined} onActivate={() => open({ type: 'sale', id: sale.id })} onMenu={(point) => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${saleBuyer(sale, clients)}`, ...point })}>
                      <td><b>#{saleCode(sale)}</b><small>{formatShortDate(sale.date)}</small></td>
                      <td>{saleBuyer(sale, clients)}</td>
                      <td>{saleEquipment(sale, inventory)}</td>
                      <td className="r"><b>{money.show(sale.amount, sale.amountCurrency)}</b></td>
                      <td><Pill status={sale.status} kind="SALE_STATUS" /></td>
                    </PressTarget>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {seeTrades ? <div className="dcard" data-testid="dashboard-trades">
          <div className="dch"><h3>Canjes en curso</h3><button className="wlink" type="button" onClick={() => go('tradeins')}>Ver todos</button></div>
          {loadingLists ? <ListSkeleton variant="cards" rows={3} testId="dashboard-trades-loading" /> : openTrades.length === 0 ? (
            <div className="wempty dashboard-empty">
              <div><b>Sin canjes en curso</b><small>Los equipos que recibas como parte de pago aparecen acá</small></div>
              <button className="dbtn s" type="button" onClick={() => open({ type: 'new-cj' })}><Plus size={16} />Nuevo canje</button>
            </div>
          ) : openTrades.slice(0, 3).map((trade) => (
            <PressTarget key={trade.id} as="button" className="ticket dash-cj" onActivate={() => open({ type: 'cj', id: trade.id })} onMenu={(point) => open({ type: 'ctx', kind: 'cj', id: trade.id, label: `${tradeCode(tradeIns, trade.id)} · ${tradeClientLabel(trade, clients)}`, ...point })}>
              <div className="wtop"><span className="date">#{tradeCode(tradeIns, trade.id)} · {formatShortDate(trade.date)}</span><Pill status={trade.status} kind="TRADE_IN_STATUS" /></div>
              <div className="store">Recibido: {trade.deviceReceived}</div>
              <div className="wbot">
                <div className="items">{tradeClientLabel(trade, clients)}<br />Entrega: {trade.deviceGiven}</div>
                <div className="wamt">{money.show(trade.takeValue, trade.currency)}<small>dif. {money.show(trade.differencePaid, trade.currency)}</small></div>
              </div>
            </PressTarget>
          ))}
        </div> : null}
      </div>
    </div>
  );
}

function DashboardBell({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rbtn dash-bell"
      data-testid="dashboard-bell"
      aria-label={count > 0 ? `Notificaciones, ${count} sin leer` : 'Notificaciones'}
      onClick={onClick}
    >
      <DeskIcon name="bell" size={18} />
      {count > 0 ? <span className="dash-bell-count" aria-hidden="true">{count > 9 ? '9+' : count}</span> : null}
    </button>
  );
}

function RecentSaleCard({ sale, buyer, equipment, amount }: { sale: Sale; buyer: string; equipment: string; amount: string }) {
  return (
    <span className="sale-card">
      <span className="sale-top">
        <span className="sale-id">#{saleCode(sale)} · {formatShortDate(sale.date)}</span>
        <Pill status={sale.status} kind="SALE_STATUS" />
      </span>
      <b>{buyer}</b>
      <small>{equipment}</small>
      <span className="sale-bot"><span>{paymentLabel(sale.paymentMethod)}</span><b>{amount}</b></span>
    </span>
  );
}
