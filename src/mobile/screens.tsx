import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { canSeeBillingSection } from '../pages/settings-access';
import { fetchReportsOverview } from '../services/reports-api';
import { listMembers, type TeamMember } from '../services/members-api';
import { listInvitations, type Invitation } from '../services/invitations-api';
import { fetchInventoryPage } from '../services/inventory-api';
import { fetchSalesPage } from '../services/sales-table-api';
import { fetchClientsPage } from '../services/clients-table-api';
import { fetchTradeInsPage } from '../services/trade-ins-table-api';
import type { ReportsOverview } from '../types/reports';
import {
  IconBell, IconBox, IconCard, IconCart, IconChart, IconDots, IconDownload, IconFilter,
  IconGear, IconGrid, IconList, IconLock, IconSearch, IconStore, IconSwap, IconUp, IconUser,
} from './icons';
import {
  INVENTORY_CHIPS,
  ROLE_LABEL,
  TRADE_IN_CHIPS,
  avatarTone,
  buildStoreActivity,
  clientName,
  formatMoney,
  formatMoneyCompact,
  initials,
  isInPeriod,
  isOpenTradeIn,
  paymentLabel,
  pillClass,
  productLabel,
  reportQuery,
  saleCode,
  salesInPeriod,
  statusLabel,
  tabsForRole,
} from './logic';
import { useMobileUi } from './state';
import { usePagedList } from './use-paged-list';
import { Chips, LoadMore, PeriodPill, ScreenHeader, SearchField, Pressable } from './ui';

function statusPill(status: string) {
  return <span className={`spill ${pillClass(status)}`}>{statusLabel(status)}</span>;
}

export function DashboardScreen() {
  const { appSession, user, inventory, sales, tradeIns, clients } = useAppContext();
  const ui = useMobileUi();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const role = appSession?.membership?.role;
  const name = appSession?.user.displayName || user?.displayName || 'Hola';
  const storeName = appSession?.store?.name ?? 'Tu tienda';
  const activity = buildStoreActivity({ sales, tradeIns, inventory, clients });
  const unread = activity.filter((item) => !ui.readIds.includes(item.id)).length;
  const done = [ui.checks.inv, ui.checks.ven, ui.checks.cj].filter(Boolean).length;
  const pct = Math.round((done / 3) * 100);
  const monthSales = salesInPeriod(sales, 'Mes');
  const monthTotal = monthSales.reduce((sum, sale) => sum + sale.amount, 0);
  const available = inventory.filter((item) => item.status === 'DISPONIBLE').length;
  const openTrades = tradeIns.filter((trade) => isOpenTradeIn(trade.status));
  const canInvite = role === 'OWNER';

  useEffect(() => {
    if (!user || !appSession?.store || !canInvite) return;
    let cancel = false;
    listMembers(user, appSession.store.id).then((members) => {
      if (!cancel) setTeam(members);
    }).catch(() => {
      if (!cancel) setTeam([]);
    });
    return () => { cancel = true; };
  }, [user, appSession?.store, canInvite, ui.revision]);

  const people = team.length
    ? team
    : [{
      id: 'me',
      userId: appSession?.user.id ?? 'me',
      role: role ?? 'STAFF',
      isDefault: true,
      createdAt: '',
      user: { id: 'me', displayName: name, email: user?.email ?? null, avatarUrl: null },
    } satisfies TeamMember];

  return (
    <div className="screen s-hoy">
      <div className="header">
        <div className="hrow">
          <div>
            <div className="greet">Hola, {name}</div>
            <h1>¿Qué hay para <span className="hl">hoy</span>?</h1>
          </div>
          <button type="button" className="wico bell" aria-label="Notificaciones" onClick={() => ui.go('notif')}>
            <IconBell />
            {unread ? <span className="cnt">{unread}</span> : null}
          </button>
        </div>
        <div className="family-row">
          <div className="avatars">
            {people.slice(0, 4).map((member) => {
              const label = member.user.displayName || member.user.email || '·';
              const tone = avatarTone(member.userId);
              return <div key={member.id} className={`av ${tone === 'b' ? '' : tone === 'p' ? 'a' : 'g'}`}>{initials(label)}</div>;
            })}
            {canInvite ? (
              <button type="button" className="av add" aria-label="Invitar" onClick={() => ui.openOverlay({ type: 'invite' })}>+</button>
            ) : null}
          </div>
          <div className="family-meta">
            <div className="online">{storeName}</div>
            <div className="names">{people.length} en el equipo · vos sos {ROLE_LABEL[role ?? 'STAFF']}</div>
          </div>
        </div>
      </div>
      <div className="main scroll-y">
        <div className="hero">
          <div className="hero-top">
            <span className="badge">+ Tu turno</span>
            <div className="ring" style={{ background: `conic-gradient(var(--lime) ${pct}%, #ECECEC 0)` }}>
              <div className="ring-inner">{done}/3</div>
            </div>
          </div>
          <h2>Flujo sugerido</h2>
          <div className="sub">Una guía rápida para arrancar el turno. El progreso queda en este dispositivo.</div>
          <div className="hlist">
            {([
              ['inv', 'Revisá ingresos o cambios en inventario'],
              ['ven', 'Registrá ventas y canjes a medida que ocurren'],
              ['cj', 'Si algo no cierra, avisá o dejá feedback'],
            ] as const).map(([key, title]) => (
              <div key={key} className={`item${ui.checks[key] ? ' done' : ''}`} onClick={() => ui.toggleCheck(key)}>
                <span className={`cb${ui.checks[key] ? ' on' : ''}`} />
                <span className="name">{title}</span>
              </div>
            ))}
          </div>
          <div className="progress">
            <span>{done}/3</span>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <span>{done === 3 ? 'listo' : `faltan ${3 - done}`}</span>
          </div>
          <button type="button" className="cta" onClick={() => ui.openOverlay({ type: 'sale-new' })}>Registrar venta →</button>
        </div>
        <div className="grid">
          <div className="mini" onClick={() => ui.go('ven')}>
            <div className="ico"><IconCart /></div>
            <div className="eyebrow">Ventas del mes</div>
            <div className="val">{formatMoneyCompact(monthTotal)}</div>
            <div className="sub">{monthSales.length} ventas</div>
          </div>
          <div className="mini" onClick={() => ui.go('inv')}>
            <div className="ico"><IconBox /></div>
            <div className="eyebrow">En stock</div>
            <div className="val">{inventory.length} equipos</div>
            <div className="sub">{available} disponibles</div>
            <div className="budget"><i style={{ width: `${inventory.length ? (available / inventory.length) * 100 : 0}%` }} /></div>
          </div>
        </div>
        <div className="wsec">
          <span>Canjes en curso</span>
          <button type="button" className="wlink" onClick={() => ui.go('canjes')}>Ver todas</button>
        </div>
        {openTrades.length ? openTrades.slice(0, 2).map((trade) => (
          <TradeCard key={trade.id} id={trade.id} />
        )) : <div className="wempty">No hay canjes en curso.</div>}
      </div>
    </div>
  );
}

function TradeCard({ id }: { id: string }) {
  const { tradeIns, clients } = useAppContext();
  const ui = useMobileUi();
  const trade = tradeIns.find((item) => item.id === id);
  if (!trade) return null;
  const name = clientName(clients, trade.clientId);
  return (
    <Pressable
      className="ticket"
      onOpen={() => ui.openOverlay({ type: 'trade', id })}
      onMenu={(point) => ui.openMenu('trade', id, `${name} · ${trade.deviceReceived}`, point)}
    >
      <div className="wtop"><span className="date">{trade.date}</span>{statusPill(trade.status)}</div>
      <div className="store">Recibido: {trade.deviceReceived}</div>
      <div className="wbot">
        <div className="items">{name}<br />Entrega: {trade.deviceGiven}</div>
        <div className="wamt">{formatMoney(trade.takeValue)}<small>dif. {formatMoney(trade.differencePaid)}</small></div>
      </div>
    </Pressable>
  );
}

export function InventoryScreen() {
  const { user, inventory } = useAppContext();
  const ui = useMobileUi();
  const chip = INVENTORY_CHIPS.find((item) => item.label === ui.invChip);
  const sort = ui.invSort === 'Precio ↑'
    ? { sortKey: 'price', sortDir: 'asc' as const }
    : ui.invSort === 'Precio ↓'
      ? { sortKey: 'price', sortDir: 'desc' as const }
      : {};
  const page = usePagedList(
    !!user,
    (skip, take) => fetchInventoryPage(user!, {
      skip,
      take,
      search: ui.queries.inv?.trim() || undefined,
      status: chip?.status,
      ...sort,
    }),
    [ui.revision, ui.queries.inv, ui.invChip, ui.invSort, user?.uid],
  );
  const available = inventory.filter((item) => item.status === 'DISPONIBLE').length;

  return (
    <div className="screen s-tickets">
      <ScreenHeader title="Inventario" subtitle={`${page.total} equipos · ${available} disponibles`}>
        <div className="wicons">
          <button type="button" className={`wico${ui.searchOn.inv ? ' on' : ''}`} aria-label="Buscar" onClick={() => ui.toggleSearch('inv')}><IconSearch /></button>
          <button type="button" className="wico" aria-label="Importar" onClick={() => ui.openOverlay({ type: 'import', entity: 'inv' })}><IconUp /></button>
          <button type="button" className="wico" aria-label="Ordenar" onClick={() => ui.openOverlay({ type: 'sort' })}><IconFilter /></button>
        </div>
      </ScreenHeader>
      {ui.searchOn.inv ? <SearchField value={ui.queries.inv ?? ''} placeholder="Buscar modelo, color o IMEI" onChange={(value) => ui.setQuery('inv', value)} /> : null}
      <Chips items={INVENTORY_CHIPS.map((item) => item.label)} current={ui.invChip} onChange={ui.setInvChip} />
      <div className="content">
        <div className="tl-scroll scroll-y">
          {page.loading ? <div className="wempty">Cargando equipos…</div> : null}
          {page.error ? <div className="wempty">{page.error}</div> : null}
          {!page.loading && !page.items.length ? <div className="wempty">No hay equipos con ese filtro.</div> : null}
          <div className="timeline">
            {page.items.map((item) => (
              <div key={item.id} className={`node${item.status === 'DISPONIBLE' ? '' : ' hollow'}`}>
                <Pressable
                  className="ticket"
                  onOpen={() => ui.openOverlay({ type: 'product', id: item.id })}
                  onMenu={(point) => ui.openMenu('product', item.id, `${item.model} · ${item.capacity}`, point)}
                >
                  <div className="wtop"><span className="date">IMEI {item.imei}</span>{statusPill(item.status)}</div>
                  <div className="store">{item.model} · {item.capacity}</div>
                  <div className="wbot">
                    <div className="items">{item.condition} · {item.color}<br />{item.grade ? `Grado ${item.grade} · ` : ''}Bat. {item.batteryHealth}</div>
                    <div className="wamt">{formatMoney(item.price)}</div>
                  </div>
                </Pressable>
              </div>
            ))}
          </div>
          <LoadMore loaded={page.items.length} total={page.total} loading={page.loadingMore} onClick={() => { void page.loadMore(); }} />
        </div>
        <div className="dock">
          <button type="button" className="btn2 p big" onClick={() => ui.openOverlay({ type: 'product-new' })}>+ Registrar equipo</button>
        </div>
      </div>
    </div>
  );
}

export function SalesScreen() {
  const { user, sales, clients, inventory } = useAppContext();
  const ui = useMobileUi();
  const page = usePagedList(
    !!user,
    (skip, take) => fetchSalesPage(user!, {
      skip,
      take,
      search: ui.queries.ven?.trim() || undefined,
      sortKey: 'date',
      sortDir: 'desc',
      filters: {},
    }, { clients, inventory }),
    [ui.revision, ui.queries.ven, user?.uid, clients.length, inventory.length],
  );
  const periodSales = salesInPeriod(sales, ui.salePeriod);
  const total = periodSales.reduce((sum, sale) => sum + sale.amount, 0);
  const average = periodSales.length ? Math.round(total / periodSales.length) : 0;
  const margin = periodSales.reduce((sum, sale) => {
    const product = inventory.find((item) => item.id === sale.productId);
    return sum + (product ? sale.amount - product.cost : 0);
  }, 0);

  return (
    <div className="screen s-tickets">
      <ScreenHeader title="Ventas" subtitle={ui.salePeriod === 'Semana' ? 'Esta semana' : ui.salePeriod === 'Año' ? 'Este año' : 'Este mes'}>
        <div className="wicons">
          <button type="button" className={`wico${ui.searchOn.ven ? ' on' : ''}`} aria-label="Buscar" onClick={() => ui.toggleSearch('ven')}><IconSearch /></button>
          <button type="button" className="wico" aria-label="Importar" onClick={() => ui.openOverlay({ type: 'import', entity: 'ven' })}><IconUp /></button>
          <PeriodPill label={ui.salePeriod} onClick={() => ui.openOverlay({ type: 'sale-period' })} />
        </div>
      </ScreenHeader>
      {ui.searchOn.ven ? <SearchField value={ui.queries.ven ?? ''} placeholder="Buscar cliente, equipo o número" onChange={(value) => ui.setQuery('ven', value)} /> : null}
      <div className="content">
        <div className="tl-scroll scroll-y">
          <div className="kcard">
            <div className="eb">Facturación total</div>
            <div className="big">{formatMoney(total)}</div>
            <span className="spill lime">{periodSales.length} ventas</span>
            <div className="kcols">
              <div><div className="eb">Ticket promedio</div><b>{formatMoney(average)}</b></div>
              <div><div className="eb">Margen bruto</div><b>{formatMoney(margin)}</b><small>precio − costo</small></div>
            </div>
          </div>
          <div className="wsec"><span>Ventas recientes</span><span>{page.items.length} de {page.total}</span></div>
          {page.loading ? <div className="wempty">Cargando ventas…</div> : null}
          {page.error ? <div className="wempty">{page.error}</div> : null}
          {!page.loading && !page.items.length ? <div className="wempty">No encontré ventas.</div> : null}
          <div className="timeline">
            {page.items.map((sale) => {
              const name = clientName(clients, sale.clientId);
              const product = inventory.find((item) => item.id === sale.productId);
              return (
                <div key={sale.id} className={`node${sale.status === 'COMPLETADA' ? '' : ' hollow'}`}>
                  <Pressable
                    className="ticket"
                    onOpen={() => ui.openOverlay({ type: 'sale', id: sale.id })}
                    onMenu={(point) => ui.openMenu('sale', sale.id, `${saleCode(sale)} · ${name}`, point)}
                  >
                    <div className="wtop"><span className="date">#{saleCode(sale)} · {sale.date}</span>{statusPill(sale.status)}</div>
                    <div className="store">{name}</div>
                    <div className="wbot">
                      <div className="items">{productLabel(product)}<br />{paymentLabel(sale.paymentMethod)}</div>
                      <div className="wamt">{formatMoney(sale.amount)}</div>
                    </div>
                  </Pressable>
                </div>
              );
            })}
          </div>
          <LoadMore loaded={page.items.length} total={page.total} loading={page.loadingMore} onClick={() => { void page.loadMore(); }} />
        </div>
        <div className="dock">
          <button type="button" className="btn2 p big" onClick={() => ui.openOverlay({ type: 'sale-new' })}>+ Registrar venta</button>
        </div>
      </div>
    </div>
  );
}

export function TradeInsScreen() {
  const { user, clients, tradeIns } = useAppContext();
  const ui = useMobileUi();
  const chip = TRADE_IN_CHIPS.find((item) => item.label === ui.tradeChip);
  const page = usePagedList(
    !!user,
    (skip, take) => fetchTradeInsPage(user!, {
      skip,
      take,
      search: ui.queries.cj?.trim() || undefined,
      filters: chip?.status ? { status: chip.status } : {},
    }, clients),
    [ui.revision, ui.queries.cj, ui.tradeChip, user?.uid, clients.length],
  );
  const open = tradeIns.filter((trade) => isOpenTradeIn(trade.status)).length;

  return (
    <div className="screen s-tickets">
      <ScreenHeader title="Canjes" subtitle={`${page.total} canjes · ${open} en curso`} onBack={ui.back}>
        <div className="wicons">
          <button type="button" className={`wico${ui.searchOn.cj ? ' on' : ''}`} aria-label="Buscar" onClick={() => ui.toggleSearch('cj')}><IconSearch /></button>
          <button type="button" className="wico" aria-label="Importar" onClick={() => ui.openOverlay({ type: 'import', entity: 'cj' })}><IconUp /></button>
        </div>
      </ScreenHeader>
      {ui.searchOn.cj ? <SearchField value={ui.queries.cj ?? ''} placeholder="Buscar cliente o equipo" onChange={(value) => ui.setQuery('cj', value)} /> : null}
      <Chips items={TRADE_IN_CHIPS.map((item) => item.label)} current={ui.tradeChip} onChange={ui.setTradeChip} />
      <div className="content">
        <div className="tl-scroll scroll-y">
          {page.loading ? <div className="wempty">Cargando canjes…</div> : null}
          {page.error ? <div className="wempty">{page.error}</div> : null}
          {!page.loading && !page.items.length ? <div className="wempty">No hay canjes en este estado.</div> : null}
          <div className="timeline">
            {page.items.map((trade) => {
              const name = clientName(clients, trade.clientId);
              return (
                <div key={trade.id} className={`node${['APROBADO', 'LISTO'].includes(trade.status) ? '' : ' hollow'}`}>
                  <Pressable
                    className="ticket"
                    onOpen={() => ui.openOverlay({ type: 'trade', id: trade.id })}
                    onMenu={(point) => ui.openMenu('trade', trade.id, `${name} · ${trade.deviceReceived}`, point)}
                  >
                    <div className="wtop"><span className="date">{trade.date}</span>{statusPill(trade.status)}</div>
                    <div className="store">Recibido: {trade.deviceReceived}</div>
                    <div className="wbot">
                      <div className="items">{name}<br />Entrega: {trade.deviceGiven}</div>
                      <div className="wamt">{formatMoney(trade.takeValue)}<small>dif. {formatMoney(trade.differencePaid)}</small></div>
                    </div>
                  </Pressable>
                </div>
              );
            })}
          </div>
          <LoadMore loaded={page.items.length} total={page.total} loading={page.loadingMore} onClick={() => { void page.loadMore(); }} />
        </div>
        <div className="dock">
          <button type="button" className="btn2 p big" onClick={() => ui.openOverlay({ type: 'trade-new' })}>+ Nuevo canje</button>
        </div>
      </div>
    </div>
  );
}

export function ClientsScreen() {
  const { user, clients } = useAppContext();
  const ui = useMobileUi();
  const page = usePagedList(
    !!user,
    (skip, take) => fetchClientsPage(user!, {
      skip,
      take,
      search: ui.queries.cl?.trim() || undefined,
      filters: ui.clientChip === 'Con saldo pendiente' ? { balance: 'debt' } : {},
    }),
    [ui.revision, ui.queries.cl, ui.clientChip, user?.uid],
  );
  const withBalance = clients.filter((client) => client.pendingBalance > 0).length;
  const owing = page.items.filter((client) => client.pendingBalance > 0);
  const clear = page.items.filter((client) => client.pendingBalance <= 0);

  const row = (client: typeof page.items[number]) => (
    <Pressable
      key={client.id}
      className="member"
      onOpen={() => ui.openOverlay({ type: 'client', id: client.id })}
      onMenu={(point) => ui.openMenu('client', client.id, client.name, point)}
    >
      <div className={`av-c ${avatarTone(client.id)}`}>{initials(client.name)}</div>
      <div className="info">
        <div className="name">{client.name}</div>
        <div className="role">
          {client.lastPurchaseDate && client.lastPurchaseDate !== 'N/A'
            ? `Última compra ${client.lastPurchaseDate}`
            : 'Sin compras todavía'}
        </div>
      </div>
      {client.pendingBalance > 0
        ? <span className="spill off">Saldo {formatMoneyCompact(client.pendingBalance)}</span>
        : <span className="spill mid">Sin saldo</span>}
    </Pressable>
  );

  return (
    <div className="screen s-familia">
      <ScreenHeader title="Clientes" subtitle={`${page.total} clientes · ${withBalance} con saldo`} onBack={ui.back}>
        <div className="wicons">
          <button type="button" className={`wico${ui.searchOn.cl ? ' on' : ''}`} aria-label="Buscar" onClick={() => ui.toggleSearch('cl')}><IconSearch /></button>
          <button type="button" className="wico" aria-label="Importar" onClick={() => ui.openOverlay({ type: 'import', entity: 'cl' })}><IconUp /></button>
        </div>
      </ScreenHeader>
      {ui.searchOn.cl ? <SearchField value={ui.queries.cl ?? ''} placeholder="Buscar por nombre, DNI o teléfono" onChange={(value) => ui.setQuery('cl', value)} /> : null}
      <Chips items={['Todos', 'Con saldo pendiente']} current={ui.clientChip} onChange={(value) => ui.setClientChip(value === 'Todos' ? 'Todos' : 'Con saldo pendiente')} />
      <div className="content scroll-y">
        {page.loading ? <div className="wempty">Cargando clientes…</div> : null}
        {page.error ? <div className="wempty">{page.error}</div> : null}
        {!page.loading && !page.items.length ? <div className="wempty">No encontré clientes.</div> : null}
        {owing.length ? <><div className="wsec"><span>Con saldo</span></div><div className="card">{owing.map(row)}</div></> : null}
        {ui.clientChip === 'Todos' && clear.length ? (
          <>
            <div className="wsec"><span>Todos</span></div>
            <div className="card">{clear.map(row)}</div>
          </>
        ) : null}
        <button type="button" className="invite" onClick={() => ui.openOverlay({ type: 'client-new' })}>+ Nuevo cliente</button>
        <LoadMore loaded={page.items.length} total={page.total} loading={page.loadingMore} onClick={() => { void page.loadMore(); }} />
      </div>
    </div>
  );
}

export function MoreScreen() {
  const { appSession, user, tradeIns, sales, inventory, clients } = useAppContext();
  const ui = useMobileUi();
  const role = appSession?.membership?.role;
  const name = appSession?.user.displayName || user?.displayName || 'Tu cuenta';
  const open = tradeIns.filter((trade) => isOpenTradeIn(trade.status)).length;
  const unread = buildStoreActivity({ sales, tradeIns, inventory, clients }).filter((item) => !ui.readIds.includes(item.id)).length;

  return (
    <div className="screen s-familia">
      <ScreenHeader title="Más" subtitle="Todo lo que no entra en la barra" />
      <div className="content scroll-y">
        <div className="card">
          <div className="member" onClick={() => ui.go('config')}>
            <div className={`av-c ${avatarTone(appSession?.user.id ?? 'me')}`}>{initials(name)}</div>
            <div className="info">
              <div className="name">{name}</div>
              <div className="role">{appSession?.store?.name} · {ROLE_LABEL[role ?? 'STAFF']}</div>
            </div>
            <span className="chev">›</span>
          </div>
        </div>
        <div className="wsec"><span>Módulos</span></div>
        <div className="card">
          <div className="member" onClick={() => ui.go('canjes')}>
            <div className="ico-row"><IconSwap /></div>
            <div className="info"><div className="name">Canjes</div><div className="role">Equipos dados y recibidos</div></div>
            <span className="rtxt">{open} en curso</span><span className="chev">›</span>
          </div>
          <div className="member" onClick={() => ui.go('clientes')}>
            <div className="ico-row"><IconUser /></div>
            <div className="info"><div className="name">Clientes</div><div className="role">Agenda y saldos</div></div>
            <span className="chev">›</span>
          </div>
          <div className="member" onClick={() => ui.go('notif')}>
            <div className="ico-row"><IconBell size={18} /></div>
            <div className="info"><div className="name">Notificaciones</div><div className="role">Avisos de la tienda</div></div>
            {unread ? <span className="rtxt">{unread} sin leer</span> : null}
            <span className="chev">›</span>
          </div>
        </div>
        <div className="wsec"><span>Ajustes</span></div>
        <div className="card">
          <div className="member" onClick={() => ui.go('config')}>
            <div className="ico-row"><IconGear /></div>
            <div className="info"><div className="name">Configuración</div><div className="role">Tienda, equipo y tu cuenta</div></div>
            <span className="chev">›</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationsScreen() {
  const { sales, tradeIns, inventory, clients } = useAppContext();
  const ui = useMobileUi();
  const activity = buildStoreActivity({ sales, tradeIns, inventory, clients });
  const visible = activity.filter((item) => ui.notifChip === 'Todas' || !ui.readIds.includes(item.id));
  const unread = activity.filter((item) => !ui.readIds.includes(item.id));

  return (
    <div className="screen s-familia">
      <ScreenHeader title="Notificaciones" subtitle={unread.length ? `${unread.length} sin leer` : 'Todo al día'} onBack={ui.back}>
        {unread.length ? (
          <button type="button" className="wlink" onClick={() => ui.markAllRead(unread.map((item) => item.id))}>Leer todas</button>
        ) : null}
      </ScreenHeader>
      <Chips items={['Todas', 'Sin leer']} current={ui.notifChip} onChange={(value) => ui.setNotifChip(value === 'Sin leer' ? 'Sin leer' : 'Todas')} />
      <div className="content scroll-y">
        {visible.length ? (
          <div className="card">
            {visible.map((item) => {
              const unreadItem = !ui.readIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="member"
                  onClick={() => {
                    ui.markRead(item.id);
                    ui.go(item.screen);
                  }}
                >
                  <div className={`ico-row${unreadItem ? ' l' : ''}`}><IconBell size={18} /></div>
                  <div className="info">
                    <div className="name">{item.title}</div>
                    <div className="role">{item.subtitle}</div>
                  </div>
                  {unreadItem ? <span className="unread" /> : <span className="chev">›</span>}
                </div>
              );
            })}
          </div>
        ) : <div className="wempty">Estás al día. No hay avisos sin leer.</div>}
        <p className="disabled-note">Los avisos salen de ventas, canjes, stock y saldos reales. Marcar como leído se guarda en este dispositivo: no hay bandeja en el servidor.</p>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const { appSession, user } = useAppContext();
  const ui = useMobileUi();
  const role = appSession?.membership?.role;
  const canManage = role === 'OWNER' || role === 'MANAGER';
  const canBill = canSeeBillingSection(role);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !appSession?.store || !canManage) return;
    let cancel = false;
    Promise.all([
      listMembers(user, appSession.store.id),
      listInvitations(user),
    ]).then(([members, pending]) => {
      if (cancel) return;
      setTeam(members);
      setInvites(pending);
    }).catch((err: unknown) => {
      if (!cancel) setError(err instanceof Error ? err.message : 'No se pudo cargar el equipo');
    });
    return () => { cancel = true; };
  }, [user, appSession?.store, canManage, ui.revision]);

  const meName = appSession?.user.displayName || user?.displayName || 'Tu cuenta';

  return (
    <div className="screen s-familia">
      <ScreenHeader title="Configuración" subtitle="Tienda, equipo y tu cuenta" onBack={ui.back} />
      <div className="content scroll-y">
        {error ? <div className="sheet-error">{error}</div> : null}
        {canManage ? (
          <>
            <div className="wsec"><span>Tienda</span></div>
            <div className="card">
              <div className="member" onClick={() => ui.openOverlay({ type: 'store' })}>
                <div className="ico-row"><IconStore /></div>
                <div className="info">
                  <div className="name">{appSession?.store?.name}</div>
                  <div className="role">Nombre, CUIT, dirección y moneda</div>
                </div>
                <span className="chev">›</span>
              </div>
            </div>
            <div className="wsec"><span>Equipo</span><span>{team.length} miembros</span></div>
            <div className="card">
              {team.map((member) => {
                const label = member.user.displayName || member.user.email || 'Miembro';
                const mine = member.userId === appSession?.user.id;
                return (
                  <div key={member.id} className="member">
                    <div className={`av-c ${avatarTone(member.userId)}`}>{initials(label)}</div>
                    <div className="info">
                      <div className="name">{label}</div>
                      <div className="role">{member.user.email}</div>
                    </div>
                    {mine ? <span className="spill mid">vos</span> : null}
                    <span className={`spill ${member.role === 'OWNER' ? 'off' : 'mid'}`}>{ROLE_LABEL[member.role]}</span>
                  </div>
                );
              })}
              {invites.length ? (
                <div className="member" onClick={() => ui.openOverlay({ type: 'invites' })}>
                  <div className="info">
                    <div className="name">{invites.length === 1 ? '1 link de invitación activo' : `${invites.length} links de invitación activos`}</div>
                    <div className="role">{invites.map((invite) => ROLE_LABEL[invite.role]).join(' · ')}</div>
                  </div>
                  <span className="chev">›</span>
                </div>
              ) : null}
              {role === 'OWNER' ? (
                <button type="button" className="invite" onClick={() => ui.openOverlay({ type: 'invite' })}>+ Invitar al equipo</button>
              ) : (
                <p className="disabled-note">Solo el propietario puede generar o cancelar links. Los socios ven el equipo.</p>
              )}
            </div>
          </>
        ) : (
          <p className="disabled-note">Como agente podés ver tu perfil y la seguridad. La tienda y las invitaciones las manejan el propietario o un socio.</p>
        )}
        <div className="wsec"><span>Mi cuenta</span></div>
        <div className="card">
          <div className="member" onClick={() => ui.openOverlay({ type: 'profile' })}>
            <div className="ico-row"><IconUser /></div>
            <div className="info"><div className="name">Perfil</div><div className="role">{meName} · {user?.email}</div></div>
            <span className="chev">›</span>
          </div>
          <div className="member" onClick={() => ui.openOverlay({ type: 'password' })}>
            <div className="ico-row"><IconLock /></div>
            <div className="info"><div className="name">Seguridad</div><div className="role">Cambiar contraseña</div></div>
            <span className="chev">›</span>
          </div>
          {canBill ? (
            <div className="member" onClick={() => ui.openOverlay({ type: 'billing' })}>
              <div className="ico-row"><IconCard /></div>
              <div className="info"><div className="name">Facturación</div><div className="role">Usuario Beta</div></div>
              <span className="rtxt">Acceso anticipado</span>
              <span className="chev">›</span>
            </div>
          ) : null}
        </div>
        <div className="logout">
          <button type="button" onClick={() => ui.openOverlay({ type: 'logout' })}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}

const DONUT_COLORS = ['#397964', '#5B8DEF', '#DF668B', '#DDF43B', '#16181D'];

export function ReportsScreen() {
  const { user, inventory, tradeIns, clients } = useAppContext();
  const ui = useMobileUi();
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    setLoading(true);
    fetchReportsOverview(user, reportQuery(ui.repPeriod))
      .then((data) => { if (!cancel) setOverview(data); })
      .catch((err: unknown) => { if (!cancel) setError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [user, ui.repPeriod, ui.revision]);

  const series = ui.repTab === 'Ventas'
    ? (overview?.salesSeries ?? []).map((point) => ({ label: point.label, value: point.revenue }))
    : ui.repTab === 'Stock'
      ? (overview?.inventory.series ?? []).map((point) => ({ label: point.label, value: point.unitsSold }))
      : (overview?.tradeIns.series ?? []).map((point) => ({ label: point.label, value: point.unitsSold }));
  const max = Math.max(...series.map((point) => point.value), 1);
  const selected = ui.repBar != null && ui.repBar < series.length ? ui.repBar : series.length - 1;
  const cats = ui.repTab === 'Ventas'
    ? (overview?.paymentMethods ?? []).map((method) => ({ label: paymentLabel(method.label), value: method.count || method.revenue }))
    : ui.repTab === 'Stock'
      ? [
        { label: 'Disponible', value: overview?.inventory.availableItems ?? inventory.filter((item) => item.status === 'DISPONIBLE').length },
        { label: 'En revisión', value: overview?.inventory.inReviewItems ?? inventory.filter((item) => item.status === 'EN_REVISION').length },
        { label: 'Vendido', value: overview?.inventory.soldItems ?? inventory.filter((item) => item.status === 'VENDIDO').length },
      ]
      : ['PENDIENTE', 'PERITAJE TÉC.', 'EN REVISIÓN', 'APROBADO', 'LISTO', 'RECHAZADO'].map((status) => ({
        label: statusLabel(status),
        value: tradeIns.filter((trade) => trade.status === status && (ui.repPeriod === 'Mes' ? isInPeriod(trade.date, 'Mes') || isInPeriod(trade.date, ui.repPeriod) : isInPeriod(trade.date, ui.repPeriod))).length,
      }));
  const catTotal = cats.reduce((sum, cat) => sum + cat.value, 0);
  const headline = ui.repTab === 'Ventas'
    ? formatMoney(overview?.summary.revenue ?? 0)
    : ui.repTab === 'Stock'
      ? String(overview?.inventory.totalItems ?? inventory.length)
      : String(overview?.tradeIns.totalInRange ?? tradeIns.length);
  const eye = ui.repTab === 'Ventas' ? 'Facturación' : ui.repTab === 'Stock' ? 'Equipos' : 'Canjes';

  const exportCsv = () => {
    const lines = ['etiqueta,valor', ...series.map((point) => `${point.label},${point.value}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reportes-${ui.repTab.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="screen s-gastos">
      <div className="topbar">
        <h1>Reportes</h1>
        <button type="button" className="circ" aria-label="Exportar" onClick={exportCsv}><IconDownload /></button>
      </div>
      <div className="gfilters">
        <div className="gper">
          {(['Ventas', 'Stock', 'Canjes'] as const).map((tab) => (
            <button key={tab} type="button" className={`gchip${ui.repTab === tab ? ' on' : ''}`} onClick={() => ui.setRepTab(tab)}>{tab}</button>
          ))}
        </div>
        <div className="gcats">
          {(['Semana', 'Mes', '3 meses', 'Año'] as const).map((period) => (
            <button key={period} type="button" className={`gchip sm${ui.repPeriod === period ? ' on' : ''}`} onClick={() => ui.setRepPeriod(period)}>{period}</button>
          ))}
        </div>
      </div>
      <div className="gscroll scroll-y">
        {loading ? <div className="wempty">Cargando reportes…</div> : null}
        {error ? <div className="wempty">{error}</div> : null}
        <div className="gtotal">
          <div className="geye">{eye} · {ui.repPeriod.toLowerCase()}</div>
          <div className="gamount">{headline}</div>
          {overview?.comparison.revenueChange != null && ui.repTab === 'Ventas' ? (
            <span className="gdelta up">{overview.comparison.revenueChange >= 0 ? '▲' : '▼'} {Math.round(overview.comparison.revenueChange)}% vs período anterior</span>
          ) : <span className="gdelta up">{clients.length} clientes en la tienda</span>}
        </div>
        <div className="gcard">
          <div className="ghd"><h3>Evolución</h3><span>{ui.repTab === 'Ventas' ? 'facturación' : 'cantidad'}</span></div>
          {series.length ? (
            <>
              <div className="gbars">
                {series.map((point, index) => {
                  const height = Math.max(3, Math.round((point.value / max) * 120));
                  return (
                    <div key={`${point.label}-${index}`} className={`gcol${index === selected ? ' sel' : ''}`} onClick={() => ui.setRepBar(index)}>
                      {index === selected ? <span className="gtip" style={{ bottom: height + 8 }}><b>{ui.repTab === 'Ventas' ? formatMoneyCompact(point.value) : point.value}</b> · {point.label}</span> : null}
                      <i style={{ height }} />
                    </div>
                  );
                })}
              </div>
              <div className="gxl">
                {series.map((point, index) => <span key={`${point.label}-l-${index}`} className={index === selected ? 'sel' : ''}>{point.label}</span>)}
              </div>
            </>
          ) : <div className="wempty">Sin movimientos en este período.</div>}
        </div>
        <div className="gcard">
          <div className="ghd"><h3>{ui.repTab === 'Ventas' ? 'Por medio de pago' : 'Por estado'}</h3><span>tocá para filtrar</span></div>
          <div className="gcomp">
            <div className="gdonut">
              <svg width="132" height="132" viewBox="0 0 132 132">
                {catTotal === 0 ? <circle cx="66" cy="66" r="46" fill="none" stroke="#E7E7E7" strokeWidth="20" /> : cats.map((cat, index) => {
                  const length = circumference * (cat.value / catTotal);
                  const dash = Math.max(0, length - 1.6);
                  const color = !ui.repCat || ui.repCat === cat.label ? DONUT_COLORS[index % DONUT_COLORS.length] : '#E7E7E7';
                  const segment = (
                    <circle
                      key={cat.label}
                      cx="66"
                      cy="66"
                      r="46"
                      fill="none"
                      stroke={color}
                      strokeWidth={ui.repCat === cat.label ? 24 : 20}
                      strokeDasharray={`${dash} ${circumference - dash}`}
                      strokeDashoffset={-offset}
                      transform="rotate(-90 66 66)"
                      onClick={() => ui.setRepCat(cat.label)}
                    />
                  );
                  offset += length;
                  return segment;
                })}
              </svg>
              <div className="gc"><b>{catTotal ? (ui.repTab === 'Ventas' && !ui.repCat ? formatMoneyCompact(overview?.summary.revenue ?? 0) : String(catTotal)) : '—'}</b><small>{ui.repCat ?? 'total'}</small></div>
            </div>
            <div className="gleg">
              {cats.map((cat, index) => (
                <button key={cat.label} type="button" className={`glg${ui.repCat === cat.label ? ' sel' : ''}`} onClick={() => ui.setRepCat(cat.label)}>
                  <i style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                  <span>{cat.label}</span>
                  <b>{cat.value}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileNav() {
  const { appSession } = useAppContext();
  const ui = useMobileUi();
  const tabs = tabsForRole(appSession?.membership?.role);
  const active = ui.screen === 'canjes' || ui.screen === 'clientes' || ui.screen === 'config'
    ? 'mas'
    : ui.screen === 'notif'
      ? null
      : ui.screen;
  if (!active || !tabs.some((tab) => tab.id === active)) {
    if (ui.screen === 'notif') return null;
  }
  if (ui.screen === 'notif') return null;
  const icons = {
    dash: IconGrid,
    inv: IconList,
    ven: IconCart,
    rep: IconChart,
    mas: IconDots,
  };

  return (
    <nav className="nav" aria-label="Principal">
      {tabs.map((tab) => {
        const Icon = icons[tab.id];
        const on = tab.id === active;
        return (
          <button key={tab.id} type="button" className={`tab${on ? ' active' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => ui.go(tab.id)}>
            <span className="ti"><Icon /></span>
            <span className="tl">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
