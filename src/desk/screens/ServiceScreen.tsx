import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { catalogChoices, useCatalogs } from '../catalog';
import { useMoney } from '../exchange';
import { formatShortDate } from '../format';
import { countPhrase, dayMonth, DEFAULT_REPAIR_STATUSES, repairFault, repairOverdue, repairPrice, repairStatusMeta, REPAIR_DELIVERED, REPAIR_READY } from '../repairs';
import { usePhoneLayout } from '../section-notices';
import { DeskCta, DeskIcon, IconButton, MobileDock, Pill, ScreenTitle, SearchBox, useDesk } from '../ui';

export function ServiceScreen() {
  const { repairOrders = [], repairOrdersError = null } = useAppContext();
  const money = useMoney();
  const catalogs = useCatalogs();
  const { open, back } = useDesk();
  const phone = usePhoneLayout();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [view, setView] = useState<'board' | 'list'>('board');

  const statuses = useMemo(() => {
    const known = catalogChoices(catalogs?.options ?? [], 'REPAIR_STATUS', DEFAULT_REPAIR_STATUSES);
    const extra = [...new Set(repairOrders.map((order) => order.status))].filter((status) => !known.some((item) => item.id === status));
    return [
      ...known,
      ...extra.map((id) => ({ id, label: repairStatusMeta(id, []).label, color: repairStatusMeta(id, []).color })),
    ];
  }, [catalogs?.options, repairOrders]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rank = new Map(statuses.map((status, index) => [status.id, index]));
    return repairOrders.filter((order) => {
      if (!needle) return true;
      const haystack = `${order.code} ${order.clientName} ${order.device} ${order.imei} ${repairFault(order)} ${order.technician}`.toLowerCase();
      return haystack.includes(needle);
    }).sort((left, right) => (rank.get(left.status) ?? 99) - (rank.get(right.status) ?? 99) || right.orderNumber - left.orderNumber);
  }, [repairOrders, query, statuses]);

  const openCount = repairOrders.filter((order) => order.status !== REPAIR_DELIVERED).length;
  const readyCount = repairOrders.filter((order) => order.status === REPAIR_READY).length;

  const views = (
    <div className="svc-views" role="group" aria-label="Vista">
      <button type="button" className={view === 'board' ? 'on' : ''} aria-pressed={view === 'board'} onClick={() => setView('board')}>
        <DeskIcon name="board" size={15} /> Tablero
      </button>
      <button type="button" className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>
        <DeskIcon name="list" size={15} /> Lista
      </button>
    </div>
  );

  return (
    <div className={`dscreen svc-screen${phone ? ' has-dock' : ''}`}>
      <ScreenTitle
        title={<div className="svc-title"><h1>Servicio técnico</h1></div>}
        subtitle={`${countPhrase(openCount, 'orden abierta', 'órdenes abiertas')} · ${countPhrase(readyCount, 'lista para retirar', 'listas para retirar')}`}
        back={back}
        tools={<IconButton label="Buscar" name="buscar" pressed={searchOpen} onClick={() => setSearchOpen((current) => !current)} />}
        desktop={(
          <div className="dright">
            <SearchBox value={query} onChange={setQuery} placeholder="Buscar orden o cliente" />
            {views}
            <DeskCta onClick={() => open({ type: 'new-ot' })}>Nueva orden</DeskCta>
          </div>
        )}
      />
      {phone && searchOpen ? <div className="msearch"><SearchBox value={query} onChange={setQuery} placeholder="Buscar orden o cliente" /></div> : null}
      {phone ? <div className="mviews">{views}</div> : null}
      {repairOrdersError ? <div className="ferr">{repairOrdersError}</div> : null}
      {view === 'board' ? (
        <div className="dkanban svc">
          {statuses.map((status) => {
            const cards = rows.filter((order) => order.status === status.id);
            return (
              <section key={status.id} className="dcol" data-testid={`repair-column-${status.id}`}>
                <div className="dcolh">
                  <span><i className="svc-dot" style={{ background: status.color || '#9AA0AA' }} />{status.label}</span>
                  <b>{cards.length}</b>
                </div>
                {cards.map((order) => {
                  const when = order.estimatedDelivery || order.receivedAt;
                  const late = repairOverdue(order);
                  return (
                    <button key={order.id} className="ticket" type="button" data-testid={`repair-card-${order.id}`} onClick={() => open({ type: 'ot', id: order.id })}>
                      <div className="wtop">
                        <b>#{order.code}</b>
                        <span className={`date${late ? ' late' : ''}`}><DeskIcon name="cal" size={13} />{dayMonth(when)}</span>
                      </div>
                      <div className="store">{order.device}</div>
                      <div className="items">{repairFault(order)}</div>
                      <div className="wbot">
                        <span className="items">{order.clientName}</span>
                        <span className="wamt">{repairPrice(order.estimate, 'quote', (value) => money.show(value, order.currency))}</span>
                      </div>
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="dcard flush">
          {rows.length === 0 ? <div className="wempty">No encontré órdenes.</div> : (
            <div className="dtable-scroll">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Ingreso</th>
                    <th>Cliente</th>
                    <th>Equipo</th>
                    <th>Falla</th>
                    <th>Presupuesto</th>
                    <th>Entrega est.</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    <tr key={order.id} data-testid={`repair-row-${order.id}`} onClick={() => open({ type: 'ot', id: order.id })}>
                      <td><b>#{order.code}</b></td>
                      <td>{dayMonth(order.receivedAt) || formatShortDate(order.receivedAt)}</td>
                      <td>{order.clientName}</td>
                      <td>{order.device}{order.imei ? <small>IMEI {order.imei}</small> : null}</td>
                      <td>{repairFault(order)}</td>
                      <td>{repairPrice(order.estimate, 'dash', (value) => money.show(value, order.currency))}</td>
                      <td className={repairOverdue(order) ? 'late' : ''}>{order.estimatedDelivery ? dayMonth(order.estimatedDelivery) : '—'}</td>
                      <td><Pill status={order.status} kind="REPAIR_STATUS" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {phone ? <MobileDock primary="Nueva orden" onPrimary={() => open({ type: 'new-ot' })} /> : null}
    </div>
  );
}
