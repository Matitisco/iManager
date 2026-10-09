import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { listMembers, type TeamMember } from '../../services/members-api';
import {
  saleBuyer,
  formatMoney,
  formatMoneyCompact,
  formatShortDate,
  initials,
  isInProgressTrade,
  isInStock,
  parseAppDate,
  saleCode,
  saleEquipment,
  tradeClientLabel,
  tradeCode,
} from '../format';
import { ImanagerIcon } from '../icons';
import { canSeeFinancials } from '../sections';
import { DeskCta, DeskIcon, Pill, PressTarget, useDesk } from '../ui';

const TASKS = [
  { id: 'inv', label: 'Revisá ingresos o cambios en inventario' },
  { id: 'ven', label: 'Registrá ventas y canjes a medida que ocurren' },
  { id: 'fb', label: 'Si algo no cierra, avisá o dejá feedback' },
] as const;

export function DashboardScreen() {
  const { appSession, user, sales, inventory, tradeIns, clients } = useAppContext();
  const { go, open, toast } = useDesk();
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

  useEffect(() => {
    if (!user || !appSession?.store?.id) return;
    let cancelled = false;
    listMembers(user, appSession.store.id)
      .then((rows) => { if (!cancelled) setMembers(rows); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [user, appSession?.store?.id]);

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
  const monthTotal = monthSales.reduce((sum, sale) => sum + sale.amount, 0);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1);
  const prevTotal = sales.reduce((sum, sale) => {
    if (sale.status === 'CANCELADA') return sum;
    const date = parseAppDate(sale.date);
    if (!date || date < prevStart || date >= prevEnd) return sum;
    return sum + sale.amount;
  }, 0);
  const monthDelta = prevTotal > 0 ? Math.round(((monthTotal - prevTotal) / prevTotal) * 100) : null;
  const available = inventory.filter((item) => isInStock(item.status)).length;
  const openTrades = tradeIns.filter((item) => isInProgressTrade(item.status));
  const balance = clients.filter((client) => client.pendingBalance > 0);
  const balanceTotal = balance.reduce((sum, client) => sum + client.pendingBalance, 0);
  const recent = useMemo(() => [...sales].sort((a, b) => {
    const left = parseAppDate(b.date)?.getTime() ?? 0;
    const right = parseAppDate(a.date)?.getTime() ?? 0;
    if (left !== right) return left - right;
    return (b.saleNumber ?? 0) - (a.saleNumber ?? 0);
  }).slice(0, 5), [sales]);
  const seeFinancials = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const name = appSession?.user.displayName?.trim() || appSession?.user.email?.split('@')[0] || 'Usuario';
  const stockPct = inventory.length ? Math.round((available / inventory.length) * 100) : 0;

  return (
    <div className="dscreen">
      <div className="dtop">
        <div>
          <div className="greet">Hola, {name}</div>
          <h1 className="hero-h">¿Qué hay para <span className="hl">hoy</span>?</h1>
        </div>
        <div className="dright">
          <div className="avatars">
            {(members.length ? members.map((member) => member.user.displayName?.trim() || member.user.email || 'Usuario') : [name]).map((label, index) => (
              <div key={`${label}-${index}`} className={`av ${['b', 'p', 'g'][index % 3]}`}>{initials(label)}</div>
            ))}
            <button className="av add" type="button" aria-label="Invitar" onClick={() => open({ type: 'invite' })}>+</button>
          </div>
          <DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta>
        </div>
      </div>

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
        </div>
        <div className="dkpis">
          <button className="mini" type="button" onClick={() => go('sales')}>
            <div className="ico"><DeskIcon name="cart" size={22} /></div>
            <div className="eyebrow">Ventas del mes</div>
            <div className="val">{seeFinancials ? formatMoneyCompact(monthTotal) : monthSales.length}</div>
            <div className="sub">{seeFinancials ? <>{monthSales.length} ventas{monthDelta == null ? '' : <> · <span className={monthDelta >= 0 ? 'up' : 'down'}>{monthDelta >= 0 ? '▲' : '▼'} {Math.abs(monthDelta)}%</span></>}</> : 'operaciones'}</div>
          </button>
          <button className="mini" type="button" onClick={() => go('inventory')}>
            <div className="ico"><ImanagerIcon name="equipo" size={20} /></div>
            <div className="eyebrow">En stock</div>
            <div className="val">{inventory.length} equipos</div>
            <div className="sub">{available} disponibles</div>
            <div className="budget"><i style={{ width: `${stockPct}%` }} /></div>
          </button>
          <button className="mini" type="button" onClick={() => go('tradeins')}>
            <div className="ico"><ImanagerIcon name="canje" size={20} /></div>
            <div className="eyebrow">Canjes en curso</div>
            <div className="val">{openTrades.length}</div>
            <div className="sub">{tradeIns.length} en total</div>
          </button>
          <button className="mini" type="button" onClick={() => go('clients')}>
            <div className="ico"><ImanagerIcon name="cliente" size={20} /></div>
            <div className="eyebrow">Saldos a cobrar</div>
            <div className="val">{formatMoneyCompact(balanceTotal)}</div>
            <div className="sub">{balance.length} clientes</div>
          </button>
        </div>
      </div>

      <div className="dgrid two">
        <div className="dcard">
          <div className="dch"><h3>Ventas recientes</h3><button className="wlink" type="button" onClick={() => go('sales')}>Ver todas</button></div>
          {recent.length === 0 ? <div className="wempty">No encontré ventas.</div> : (
            <table className="dtable compact">
              <thead><tr><th>Venta</th><th>Cliente</th><th>Equipo</th><th className="r">Total</th><th>Estado</th></tr></thead>
              <tbody>
                {recent.map((sale) => {
                  return (
                    <PressTarget key={sale.id} as="tr" onActivate={() => open({ type: 'sale', id: sale.id })} onMenu={(point) => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${saleBuyer(sale, clients)}`, ...point })}>
                      <td><b>#{saleCode(sale)}</b><small>{formatShortDate(sale.date)}</small></td>
                      <td>{saleBuyer(sale, clients)}</td>
                      <td>{saleEquipment(sale, inventory)}</td>
                      <td className="r"><b>{formatMoney(sale.amount)}</b></td>
                      <td><Pill status={sale.status} kind="SALE_STATUS" /></td>
                    </PressTarget>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="dcard">
          <div className="dch"><h3>Canjes en curso</h3><button className="wlink" type="button" onClick={() => go('tradeins')}>Ver todos</button></div>
          {openTrades.length === 0 ? <div className="wempty">No hay canjes en curso.</div> : openTrades.slice(0, 3).map((trade) => (
            <PressTarget key={trade.id} as="button" className="ticket dash-cj" onActivate={() => open({ type: 'cj', id: trade.id })} onMenu={(point) => open({ type: 'ctx', kind: 'cj', id: trade.id, label: `${tradeCode(tradeIns, trade.id)} · ${tradeClientLabel(trade, clients)}`, ...point })}>
              <div className="wtop"><span className="date">#{tradeCode(tradeIns, trade.id)} · {formatShortDate(trade.date)}</span><Pill status={trade.status} kind="TRADE_IN_STATUS" /></div>
              <div className="store">Recibido: {trade.deviceReceived}</div>
              <div className="wbot">
                <div className="items">{tradeClientLabel(trade, clients)}<br />Entrega: {trade.deviceGiven}</div>
                <div className="wamt">{formatMoney(trade.takeValue)}<small>dif. {formatMoney(trade.differencePaid)}</small></div>
              </div>
            </PressTarget>
          ))}
        </div>
      </div>
    </div>
  );
}
