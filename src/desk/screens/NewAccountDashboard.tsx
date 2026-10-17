import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { listMembers, type TeamMember } from "../../services/members-api";
import type { Product, Sale, TradeIn } from "../../types";
import { clientNet } from "../client-balance";
import { useMoney } from "../exchange";
import { formatMoneyCompact, isInProgressTrade, isInStock, parseAppDate } from "../format";
import { ImanagerIcon } from "../icons";
import { canSeeFinancials, canViewTeam } from "../sections";
import { usePhoneLayout } from "../section-notices";
import { DeskIcon, useDesk } from "../ui";

const ZONE = "America/Argentina/Buenos_Aires";
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const EMPTY_BARS = [38, 62, 48, 78, 54, 90, 42];

function dayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function shiftKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const weekDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return shiftKey(key, weekDay === 0 ? -6 : 1 - weekDay);
}

function clock(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ZONE,
  }).format(value);
}

function whenLabel(value: Date, now = new Date()) {
  const key = dayKey(value);
  const today = dayKey(now);
  if (key === today) return `Hoy ${clock(value)}`;
  if (key === shiftKey(today, -1)) return "Ayer";
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: ZONE }).format(value).replace(".", "");
}

function shortName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]?.toUpperCase()}.`;
}

function saleMoment(sale: Sale) {
  if (sale.soldAt) {
    const date = new Date(sale.soldAt);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return parseAppDate(sale.date);
}

function roleName(role: string) {
  if (role === "MANAGER") return "Socio";
  if (role === "OWNER") return "Propietario";
  return "Empleado";
}

interface ActivityRow {
  id: string;
  title: string;
  meta: string;
  amount?: string;
  tone: "sale" | "stock" | "trade" | "team";
  at: number;
  onOpen?: () => void;
}

export function NewAccountDashboard() {
  const { appSession, user, sales, inventory, tradeIns, clients } = useAppContext();
  const money = useMoney();
  const { open, go } = useDesk();
  const phone = usePhoneLayout();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const role = appSession?.membership?.role;
  const seeMoney = canSeeFinancials(appSession?.membership?.sections, role);
  const storeId = appSession?.store?.id;

  useEffect(() => {
    if (!canViewTeam(role) || !user || !storeId) return;
    let cancelled = false;
    listMembers(user, storeId)
      .then((rows) => { if (!cancelled) setMembers(rows); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [user, storeId, role]);

  const now = new Date();
  const today = dayKey(now);
  const monthKey = today.slice(0, 7);
  const liveSales = sales.filter((sale) => sale.status !== "CANCELADA");
  const monthSales = liveSales.filter((sale) => {
    const date = saleMoment(sale);
    return !!date && dayKey(date).startsWith(monthKey);
  });
  const monthTotal = money.sum(monthSales.map((sale) => ({ amount: sale.amount, currency: sale.amountCurrency })));
  const inStock = inventory.filter((item) => isInStock(item.status) && !item.archivedAt);
  const stockUsd = stockValueUsd(inStock, appSession?.store?.currency, money.rate);
  const openTrades = tradeIns.filter((item) => isInProgressTrade(item.status));
  const debtors = clients.filter((client) => clientNet(client) > 0);
  const debt = money.sum(debtors.map((client) => ({ amount: clientNet(client), currency: client.balanceCurrency })));
  const weekStart = mondayKey(today);
  const week = DAY_LABELS.map((label, index) => {
    const key = shiftKey(weekStart, index);
    const rows = liveSales.filter((sale) => {
      const date = saleMoment(sale);
      return !!date && dayKey(date) === key;
    });
    return { label, key, total: money.sum(rows.map((sale) => ({ amount: sale.amount, currency: sale.amountCurrency }))) ?? 0 };
  });
  const weekTotal = week.reduce((sum, day) => sum + day.total, 0);
  const weekPeak = Math.max(...week.map((day) => day.total), 0);
  const salesToday = monthSales.filter((sale) => {
    const date = saleMoment(sale);
    return !!date && dayKey(date) === today;
  }).length;
  const moneyText = (value: number | null) => {
    if (value == null) return "—";
    if (Math.abs(value) >= 1_000_000) return formatMoneyCompact(value, money.active).replace("M", " M");
    return money.showActive(value);
  };
  const salesHint = monthSales.length === 0
    ? "Tu primera venta aparece acá"
    : salesToday === monthSales.length
      ? `${monthSales.length === 1 ? "1 venta" : `${monthSales.length} ventas`} · hoy`
      : monthSales.length === 1 ? "1 venta" : `${monthSales.length} ventas`;

  const activity = useMemo(() => buildActivity({
    sales: liveSales,
    inventory: inStock,
    trades: openTrades,
    members,
    show: (amount, currency) => money.show(amount, currency),
    openSale: (id) => open({ type: "sale", id }),
    openTrade: (id) => open({ type: "cj", id }),
    openStock: () => go("inventory"),
  }), [liveSales, inStock, openTrades, members, money, open, go]);
  const shownActivity = activityOpen ? activity : activity.slice(0, 4);
  const firstName = appSession?.user.displayName?.trim().split(/\s+/)[0] || "Matias";

  return (
    <div className={`dscreen fresh-dash${phone ? " is-phone" : ""}`} data-testid="fresh-dashboard">
      <div className="fresh-top">
        <div>
          <h1>Hola, {firstName}</h1>
          <p>{appSession?.store?.name || "Tu tienda"}</p>
        </div>
        <div className="fresh-actions">
          <button className="dbtn p" type="button" onClick={() => open({ type: "new-sale" })}><Plus size={16} /> Registrar venta</button>
          <button className="dbtn s" type="button" onClick={() => open(inventory.length === 0 ? { type: "onboarding-stock" } : { type: "new-eq" })}>
            <ImanagerIcon name="equipo" size={16} /> Cargar equipo
          </button>
        </div>
      </div>

      <div className="fresh-metrics">
        <button className="fresh-metric" type="button" onClick={() => go("sales")}>
          <span className="label"><span className="ico"><DeskIcon name="cart" size={16} /></span>Ventas del mes</span>
          <b>{seeMoney ? (monthSales.length === 0 ? money.showActive(0) : moneyText(monthTotal)) : monthSales.length}</b>
          <small>{salesHint}</small>
        </button>
        <button className="fresh-metric" type="button" onClick={() => go("inventory")}>
          <span className="label"><span className="ico"><ImanagerIcon name="equipo" size={16} /></span>En stock</span>
          <b>{inStock.length}</b>
          <small>{inStock.length === 0 || stockUsd == null ? "Equipos disponibles" : `US$ ${new Intl.NumberFormat("es-AR").format(Math.round(stockUsd))}`}</small>
        </button>
        <button className="fresh-metric" type="button" onClick={() => go("tradeins")}>
          <span className="label"><span className="ico"><ImanagerIcon name="canje" size={16} /></span>Canjes en curso</span>
          <b>{openTrades.length}</b>
          <small>{openTrades.length === 0 ? "Nada pendiente" : "A revisar"}</small>
        </button>
        <button className="fresh-metric" type="button" onClick={() => go("clients")}>
          <span className="label"><span className="ico"><ImanagerIcon name="cliente" size={16} /></span>Saldos a cobrar</span>
          <b>{seeMoney ? (debtors.length === 0 ? money.showActive(0) : moneyText(debt)) : debtors.length}</b>
          <small>{debtors.length === 0 ? "Todo al día" : debtors.length === 1 ? "1 cliente" : `${debtors.length} clientes`}</small>
        </button>
      </div>

      <div className="fresh-main">
        <section className="dcard fresh-chart" data-testid="fresh-chart">
          <div className="fresh-chart-head">
            <h2>Ventas de la semana</h2>
            <span>{weekTotal > 0 ? moneyText(weekTotal) : "Sin datos"}</span>
          </div>
          <div className={`fresh-chart-plot${weekTotal > 0 ? "" : " is-empty"}`}>
            {weekTotal > 0 ? null : <p>Acá vas a ver tus ventas de la semana</p>}
            <div className="fresh-bars" aria-hidden="true">
              {week.map((day, index) => (
                <i
                  key={day.label}
                  className={weekTotal > 0 ? "is-live" : ""}
                  style={{ height: `${weekTotal > 0 ? Math.max(8, Math.round((day.total / weekPeak) * 100)) : EMPTY_BARS[index]}%` }}
                />
              ))}
            </div>
            {weekTotal > 0 ? null : (
              <button className="dbtn p fresh-chart-cta" type="button" onClick={() => open({ type: "new-sale" })}>Registrar venta</button>
            )}
          </div>
          <div className="fresh-days">{DAY_LABELS.map((label) => <span key={label}>{label}</span>)}</div>
        </section>

        <section className="dcard fresh-activity" data-testid="fresh-activity">
          <div className="fresh-chart-head">
            <h2>Actividad reciente</h2>
            {activity.length > 0 ? (
              <button className="wlink" type="button" onClick={() => setActivityOpen((value) => !value)}>{activityOpen ? "Ver menos" : "Ver todo"}</button>
            ) : null}
          </div>
          {activity.length === 0 ? (
            <div className="fresh-empty">
              <p className="fresh-empty-copy"><b>Todavía no hay movimientos</b><small>Ventas, canjes y cargas de stock</small></p>
              <div className="fresh-ghost" />
              <div className="fresh-ghost" />
            </div>
          ) : shownActivity.map((row) => (
            <button key={row.id} className={`fresh-row is-${row.tone}`} type="button" onClick={row.onOpen}>
              <span className="ico" aria-hidden="true">
                {row.tone === "sale" ? <DeskIcon name="cart" size={16} /> : row.tone === "trade" ? <ImanagerIcon name="canje" size={16} /> : row.tone === "team" ? <DeskIcon name="user" size={16} /> : <ImanagerIcon name="equipo" size={16} />}
              </span>
              <span><b>{row.title}</b><small>{row.meta}</small></span>
              {row.amount ? <strong>{row.amount}</strong> : <span />}
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}

function stockValueUsd(items: Product[], storeCurrency: string | null | undefined, rate: number | null) {
  let usd = 0;
  let known = true;
  for (const item of items) {
    const price = Number(item.price) || 0;
    const currency = item.currency || storeCurrency || "ARS";
    if (currency === "USD") usd += price;
    else if (rate) usd += price / rate;
    else if (price) known = false;
  }
  return known ? usd : null;
}

function buildActivity({
  sales,
  inventory,
  trades,
  members,
  show,
  openSale,
  openTrade,
  openStock,
}: {
  sales: Sale[];
  inventory: Product[];
  trades: TradeIn[];
  members: TeamMember[];
  show: (amount: number, currency?: string | null) => string;
  openSale: (id: string) => void;
  openTrade: (id: string) => void;
  openStock: () => void;
}): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const sale of sales) {
    const at = saleMoment(sale);
    if (!at) continue;
    const seller = members.find((member) => member.id === sale.sellerMemberId);
    const who = shortName(seller?.user.displayName || seller?.user.email || sale.clientName || "");
    rows.push({
      id: `sale-${sale.id}`,
      title: `Venta · ${sale.deviceLabel || "equipo"}`,
      meta: [whenLabel(at), who].filter(Boolean).join(" · "),
      amount: show(sale.amount, sale.amountCurrency),
      tone: "sale",
      at: at.getTime(),
      onOpen: () => openSale(sale.id),
    });
  }
  const batches = new Map<string, { at: Date; count: number }>();
  for (const item of inventory) {
    if (!item.createdAt) continue;
    const at = new Date(item.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    const key = `${dayKey(at)} ${clock(at)}`;
    const current = batches.get(key);
    if (!current || at > current.at) batches.set(key, { at, count: (current?.count ?? 0) + 1 });
    else current.count += 1;
  }
  for (const [key, batch] of batches) {
    rows.push({
      id: `stock-${key}`,
      title: "Stock cargado",
      meta: `${whenLabel(batch.at)} · ${batch.count === 1 ? "1 equipo" : `${batch.count} equipos`}`,
      tone: "stock",
      at: batch.at.getTime(),
      onOpen: openStock,
    });
  }
  for (const trade of trades) {
    const at = parseAppDate(trade.date);
    if (!at) continue;
    rows.push({
      id: `trade-${trade.id}`,
      title: `Canje · ${trade.deviceReceived || "equipo"}`,
      meta: `${whenLabel(at)} · a revisar`,
      amount: show(trade.takeValue, trade.currency),
      tone: "trade",
      at: at.getTime(),
      onOpen: () => openTrade(trade.id),
    });
  }
  for (const member of members) {
    if (member.role === "OWNER" || !member.createdAt) continue;
    const at = new Date(member.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    const name = member.user.displayName?.trim().split(/\s+/)[0] || member.user.email || "alguien";
    rows.push({
      id: `member-${member.id}`,
      title: `Se unió ${name}`,
      meta: `${whenLabel(at)} · ${roleName(member.role)}`,
      tone: "team",
      at: at.getTime(),
    });
  }
  return rows.sort((left, right) => right.at - left.at).slice(0, 12);
}
