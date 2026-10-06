import { useEffect, useMemo, useState } from 'react';
import { Box, RefreshCcw, ShoppingCart, UserRound } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { listMembers, type TeamMember } from '../../services/members-api';
import {
  clientName,
  formatMoney,
  formatMoneyCompact,
  initials,
  isOpenTrade,
  parseAppDate,
  productLabel,
  saleCode,
} from '../format';
import { Pill, useDesk } from '../ui';

const TASKS = [
  { id: 'inv', label: 'Revisá ingresos o cambios en inventario' },
  { id: 'ven', label: 'Registrá ventas y canjes a medida que ocurren' },
  { id: 'fb', label: 'Si algo no cierra, avisá o dejá feedback' },
] as const;

export function DashboardScreen() {
  const { appSession, user, sales, inventory, tradeIns, clients } = useAppContext();
  const { go, open } = useDesk();
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

  const toggle = (id: string) => {
    setChecks((current) => {
      const next = { ...current, [id]: !current[id] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const done = TASKS.filter((task) => checks[task.id]).length;
  const pct = Math.round((done / TASKS.length) * 100);
  const now = new Date();
  const monthSales = sales.filter((sale) => {
    if (sale.status === 'CANCELADA') return false;
    const date = parseAppDate(sale.date);
    if (!date) return false;
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const monthTotal = monthSales.reduce((sum, sale) => sum + sale.amount, 0);
  const available = inventory.filter((item) => item.status === 'DISPONIBLE').length;
  const openTrades = tradeIns.filter((item) => isOpenTrade(item.status));
  const balance = clients.filter((client) => client.pendingBalance > 0);
  const balanceTotal = balance.reduce((sum, client) => sum + client.pendingBalance, 0);
  const recent = useMemo(() => sales.slice(0, 5), [sales]);
  const name = appSession?.user.displayName?.trim() || 'equipo';
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
            {(members.length ? members.map((member) => member.user.displayName || name) : [name]).slice(0, 4).map((label, index) => (
              <div key={`${label}-${index}`} className={`av ${['b', 'p', 'g', 'a'][index]}`}>{initials(label)}</div>
            ))}
            <button className="av add" type="button" aria-label="Invitar" onClick={() => open({ type: 'invite' })}>+</button>
          </div>
          <button className="dbtn p" type="button" onClick={() => open({ type: 'new-sale' })}>+ Registrar venta</button>
        </div>
      </div>

      <div className="dgrid dash">
        <div className="hero">
          <div className="hero-top">
            <span className="badge">↑ Tu turno</span>
            <div className="ring" style={{ background: `conic-gradient(var(--lime) ${pct}%, #ECECEC 0)` }}>
              <div className="ring-inner">{done}/{TASKS.length}</div>
            </div>
          </div>
          <h2>Flujo sugerido</h2>
          <div className="sub">Una guía rápida para arrancar el turno</div>
          {TASKS.map((task) => (
            <button key={task.id} type="button" className={`item${checks[task.id] ? ' done' : ''}`} onClick={() => toggle(task.id)}>
              <span className={`cb${checks[task.id] ? ' on' : ''}`} />
              <span className="name">{task.label}</span>
            </button>
          ))}
          <div className="progress">
            <span>{done}/{TASKS.length}</span>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <span>{done === TASKS.length ? 'listo' : `faltan ${TASKS.length - done}`}</span>
          </div>
        </div>
        <div className="dkpis">
          <button className="mini" type="button" onClick={() => go('sales')}>
            <div className="ico"><ShoppingCart size={16} /></div>
            <div className="eyebrow">Ventas del mes</div>
            <div className="val">{formatMoneyCompact(monthTotal)}</div>
            <div className="sub">{monthSales.length} ventas</div>
          </button>
          <button className="mini" type="button" onClick={() => go('inventory')}>
            <div className="ico"><Box size={16} /></div>
            <div className="eyebrow">En stock</div>
            <div className="val">{inventory.length} equipos</div>
            <div className="sub">{available} disponibles</div>
            <div className="budget"><i style={{ width: `${stockPct}%` }} /></div>
          </button>
          <button className="mini" type="button" onClick={() => go('tradeins')}>
            <div className="ico"><RefreshCcw size={16} /></div>
            <div className="eyebrow">Canjes en curso</div>
            <div className="val">{openTrades.length}</div>
            <div className="sub">{tradeIns.length} en total</div>
          </button>
          <button className="mini" type="button" onClick={() => go('clients')}>
            <div className="ico"><UserRound size={16} /></div>
            <div className="eyebrow">Saldos a cobrar</div>
            <div className="val">{formatMoneyCompact(balanceTotal)}</div>
            <div className="sub">{balance.length} clientes</div>
          </button>
        </div>
      </div>

      <div className="dgrid two">
        <div className="dcard">
          <div className="dch"><h3>Ventas recientes</h3><button className="wlink" type="button" onClick={() => go('sales')}>Ver todas</button></div>
          {recent.length === 0 ? <div className="wempty">Todavía no hay ventas.</div> : (
            <table className="dtable">
              <thead><tr><th>Venta</th><th>Cliente</th><th>Equipo</th><th className="r">Total</th><th>Estado</th></tr></thead>
              <tbody>
                {recent.map((sale) => {
                  const product = inventory.find((item) => item.id === sale.productId);
                  return (
                    <tr key={sale.id} onClick={() => open({ type: 'sale', id: sale.id })}>
                      <td><b>#{saleCode(sale)}</b><small>{sale.date}</small></td>
                      <td>{clientName(clients, sale.clientId)}</td>
                      <td>{productLabel(product)}</td>
                      <td className="r"><b>{formatMoney(sale.amount)}</b></td>
                      <td><Pill status={sale.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="dcard">
          <div className="dch"><h3>Canjes en curso</h3><button className="wlink" type="button" onClick={() => go('tradeins')}>Ver todos</button></div>
          {openTrades.length === 0 ? <div className="wempty">No hay canjes en curso.</div> : openTrades.slice(0, 3).map((trade) => (
            <button key={trade.id} className="ticket" type="button" onClick={() => open({ type: 'cj', id: trade.id })}>
              <div className="meta"><span>#{trade.id.slice(-4).toUpperCase()} · {trade.date}</span><Pill status={trade.status} /></div>
              <div className="ttl">Recibido: {trade.deviceReceived}</div>
              <div className="who">{clientName(clients, trade.clientId)}<br />Entrega: {trade.deviceGiven}</div>
              <div className="amt"><b>{formatMoney(trade.takeValue)}</b><small>dif. {formatMoney(trade.differencePaid)}</small></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
