import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { catalogChoices, useCatalogs } from '../catalog';
import { useMoney } from '../exchange';
import { formatShortDate } from '../format';
import { countPhrase, dayMonth, DEFAULT_REPAIR_STATUSES, presentRepairStatusChange, repairColumnStatus, repairFault, repairOverdue, repairPrice, repairStatusChangeNotice, REPAIR_DELIVERED, REPAIR_READY, visibleRepairStatuses } from '../repairs';
import { usePhoneLayout } from '../section-notices';
import { DeskCta, DeskIcon, IconButton, MobileDock, Pill, ScreenTitle, SearchBox, useDesk } from '../ui';

export function ServiceScreen() {
  const { repairOrders = [], repairOrdersError = null, changeRepairStatus } = useAppContext();
  const money = useMoney();
  const catalogs = useCatalogs();
  const { open, back, toast } = useDesk();
  const phone = usePhoneLayout();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [statusId, setStatusId] = useState('ABIERTAS');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const moving = useRef(false);

  const statuses = useMemo(
    () => visibleRepairStatuses(catalogChoices(catalogs?.options ?? [], 'REPAIR_STATUS', DEFAULT_REPAIR_STATUSES), repairOrders),
    [catalogs?.options, repairOrders],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rank = new Map(statuses.map((status, index) => [status.id, index]));
    return repairOrders.filter((order) => {
      if (!needle) return true;
      const haystack = `${order.code} ${order.clientName} ${order.device} ${order.imei} ${repairFault(order)} ${order.technician}`.toLowerCase();
      return haystack.includes(needle);
    }).sort((left, right) => (rank.get(repairColumnStatus(left.status)) ?? 99) - (rank.get(repairColumnStatus(right.status)) ?? 99) || right.orderNumber - left.orderNumber);
  }, [repairOrders, query, statuses]);

  const openCount = repairOrders.filter((order) => order.status !== REPAIR_DELIVERED).length;
  const readyCount = repairOrders.filter((order) => order.status === REPAIR_READY).length;
  const chips = useMemo(() => {
    const open = rows.filter((order) => order.status !== REPAIR_DELIVERED).length;
    return [
      { id: 'ABIERTAS', label: `Abiertas ${open}`, color: '' },
      ...statuses.map((status) => ({
        id: status.id,
        label: `${status.label} ${rows.filter((order) => repairColumnStatus(order.status) === status.id).length}`,
        color: status.color || '#9AA0AA',
      })),
    ];
  }, [rows, statuses]);
  const groups = useMemo(() => {
    const selected = statusId === 'ABIERTAS'
      ? statuses.filter((status) => status.id !== REPAIR_DELIVERED)
      : statuses.filter((status) => status.id === statusId);
    return selected
      .map((status) => ({ status, cards: rows.filter((order) => repairColumnStatus(order.status) === status.id) }))
      .filter((group) => statusId !== 'ABIERTAS' || group.cards.length > 0);
  }, [rows, statusId, statuses]);
  const emptyCopy = repairOrders.length === 0 && !query.trim()
    ? 'No hay órdenes'
    : statusId === 'ABIERTAS' && !query.trim()
      ? 'No hay órdenes abiertas.'
      : 'No encontré órdenes.';

  const moveOrder = async (id: string, statusId: string) => {
    const current = repairOrders.find((order) => order.id === id);
    if (!current || !changeRepairStatus || moving.current) return;
    if (current.status === statusId || repairColumnStatus(current.status) === statusId) return;
    moving.current = true;
    try {
      const saved = await changeRepairStatus(id, statusId);
      presentRepairStatusChange(repairStatusChangeNotice(current.status, saved, statuses), toast);
    } catch (err) {
      toast(getFriendlyErrorMessage(err, 'No se pudo cambiar el estado'));
    } finally {
      moving.current = false;
    }
  };

  const dragProps = (orderId: string) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      suppressClick.current = true;
      draggingIdRef.current = orderId;
      setDraggingId(orderId);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', orderId);
    },
    onDragEnd: () => {
      draggingIdRef.current = null;
      setDraggingId(null);
      setDropStatus(null);
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    },
  });

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
      {phone ? (
        <div className="svc-chips" data-testid="service-chips" role="group" aria-label="Estado">
          {chips.map((chip) => (
            <button key={chip.id} type="button" className={`wchip${chip.id === statusId ? ' on' : ''}`} aria-pressed={chip.id === statusId} onClick={() => setStatusId(chip.id)}>
              {chip.color ? <i className="svc-dot" style={{ background: chip.color }} /> : null}
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}
      {repairOrdersError ? <div className="ferr">{repairOrdersError}</div> : null}
      {phone ? (
        groups.length === 0 ? <div className="wempty" data-testid={repairOrders.length === 0 && !query.trim() ? 'service-empty' : undefined}>{emptyCopy}</div> : (
          <div className="svc-groups" data-testid="service-groups">
            {groups.map((group) => (
              <section key={group.status.id} data-testid={`repair-group-${group.status.id}`}>
                <div className="svc-gh">
                  <span><i className="svc-dot" style={{ background: group.status.color || '#9AA0AA' }} />{group.status.label}</span>
                  <b>{group.cards.length}</b>
                </div>
                {group.cards.map((order) => {
                  const when = order.estimatedDelivery || order.receivedAt;
                  const late = repairOverdue(order);
                  const date = dayMonth(when);
                  const dateText = !date ? '' : late ? `Atrasada · ${date}` : order.estimatedDelivery ? `Entrega ${date}` : date;
                  return (
                    <button key={order.id} className="ticket" type="button" data-testid={`repair-card-${order.id}`} onClick={() => open({ type: 'ot', id: order.id })}>
                      <div className="wtop">
                        <b>#{order.code}</b>
                        {dateText ? <span className={`date${late ? ' late' : ''}`}><DeskIcon name="cal" size={13} />{dateText}</span> : null}
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
            ))}
          </div>
        )
      ) : view === 'board' ? (
        <div className="dkanban svc" data-testid="repair-board">
          <p className="svc-drag-hint">Arrastrá una orden a otra columna para cambiar el estado. Con el teclado, abrí la orden y usá Pasar a.</p>
          {statuses.map((status) => {
            const cards = rows.filter((order) => repairColumnStatus(order.status) === status.id);
            return (
              <section
                key={status.id}
                className={`dcol${dropStatus === status.id ? ' over' : ''}`}
                data-testid={`repair-column-${status.id}`}
                aria-label={status.label}
                onDragOver={(event) => {
                  if (!draggingIdRef.current) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDropStatus(status.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData('text/plain') || draggingIdRef.current || '';
                  setDropStatus(null);
                  setDraggingId(null);
                  if (id) void moveOrder(id, status.id);
                }}
              >
                <div className="dcolh">
                  <span><i className="svc-dot" style={{ background: status.color || '#9AA0AA' }} />{status.label}</span>
                  <b>{cards.length}</b>
                </div>
                {cards.map((order) => {
                  const when = order.estimatedDelivery || order.receivedAt;
                  const late = repairOverdue(order);
                  return (
                    <button
                      key={order.id}
                      className={`ticket${draggingId === order.id ? ' dragging' : ''}`}
                      type="button"
                      data-testid={`repair-card-${order.id}`}
                      aria-grabbed={draggingId === order.id}
                      {...dragProps(order.id)}
                      onClick={() => {
                        if (suppressClick.current) {
                          suppressClick.current = false;
                          return;
                        }
                        open({ type: 'ot', id: order.id });
                      }}
                    >
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
                      <td><Pill status={repairColumnStatus(order.status)} kind="REPAIR_STATUS" /></td>
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
