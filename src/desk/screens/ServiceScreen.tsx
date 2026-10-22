import { useArchivedRows } from '../use-archived-rows';
import { isVoidRow, mergeRecordRows } from '../format';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { NETWORK_ERROR_MESSAGE } from '../../lib/user-message';
import { suppressLocalNetworkBanner, useOfflineBannerOwned } from '../offline-banner';
import { catalogChoices, useCatalogs } from '../catalog';
import { useMoney } from '../exchange';
import { formatShortDate } from '../format';
import { dayMonth, DEFAULT_REPAIR_STATUSES, presentRepairStatusChange, repairColumnStatus, repairFault, repairOverdue, repairPrice, repairStatusChangeNotice, REPAIR_DELIVERED, visibleRepairStatuses } from '../repairs';
import { usePhoneLayout } from '../section-notices';
import { DeskCta, DeskIcon, IconButton, MobileDock, Pill, PressTarget, ScreenTitle, SearchBox, useDesk } from '../ui';
import type { RepairOrder } from '../../types';
import { fetchArchivedRepairs } from '../../services/repairs-api';
import { rememberArchivedRepairs } from '../archive-cache';

export function ServiceScreen() {
  const { repairOrders = [], repairOrdersError = null, changeRepairStatus } = useAppContext();
  const money = useMoney();
  const catalogs = useCatalogs();
  const { open, back, toast } = useDesk();
  const phone = usePhoneLayout();
  const offlineOwned = useOfflineBannerOwned();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [statusId, setStatusId] = useState(phone ? 'ABIERTAS' : 'Todos');
  const [archivedMode, setArchivedMode] = useState(false);
  const { rows: archivedOrders, error: archiveError } = useArchivedRows(repairOrders, fetchArchivedRepairs, rememberArchivedRepairs);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const moving = useRef(false);

  const statuses = useMemo(
    () => visibleRepairStatuses(catalogChoices(catalogs?.options ?? [], 'REPAIR_STATUS', DEFAULT_REPAIR_STATUSES), mergeRecordRows(repairOrders, archivedOrders)),
    [catalogs?.options, repairOrders, archivedOrders],
  );

  const repairSource = archivedMode ? archivedOrders : mergeRecordRows(repairOrders, archivedOrders);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rank = new Map(statuses.map((status, index) => [status.id, index]));
    return repairSource.filter((order) => {
      if (!archivedMode && statusId !== 'Todos' && isVoidRow(order)) return false;
      if (!archivedMode && statusId !== 'Todos' && statusId !== 'ABIERTAS' && repairColumnStatus(order.status) !== statusId) return false;
      if (!archivedMode && statusId === 'ABIERTAS' && order.status === REPAIR_DELIVERED) return false;
      if (!needle) return true;
      const haystack = `${order.code} ${order.clientName} ${order.device} ${order.imei} ${repairFault(order)} ${order.technician}`.toLowerCase();
      return haystack.includes(needle);
    }).sort((left, right) => (rank.get(repairColumnStatus(left.status)) ?? 99) - (rank.get(repairColumnStatus(right.status)) ?? 99) || right.orderNumber - left.orderNumber);
  }, [repairSource, query, statuses, archivedMode, statusId]);

  const chips = useMemo(() => {
    const countRows = archivedMode ? repairSource : repairSource.filter(order => !isVoidRow(order));
    const open = countRows.filter((order) => order.status !== REPAIR_DELIVERED).length;
    return [
      { id: 'Todos', label: 'Todos', color: '' },
      { id: 'ABIERTAS', label: `Abiertas ${open}`, color: '' },
      ...statuses.map((status) => ({
        id: status.id,
        label: `${status.label} ${countRows.filter((order) => repairColumnStatus(order.status) === status.id).length}`,
        color: status.color || '#9AA0AA',
      })),
    ];
  }, [repairSource, statuses, archivedMode]);
  const groups = useMemo(() => {
    const selected = statusId === 'Todos' || archivedMode ? statuses : statusId === 'ABIERTAS'
      ? statuses.filter((status) => status.id !== REPAIR_DELIVERED)
      : statuses.filter((status) => status.id === statusId);
    return selected
      .map((status) => ({ status, cards: rows.filter((order) => repairColumnStatus(order.status) === status.id) }))
      .filter((group) => !['Todos', 'ABIERTAS'].includes(statusId) || group.cards.length > 0);
  }, [rows, statusId, statuses, archivedMode]);
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

  const openOrder = (id: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    open({ type: 'ot', id });
  };
  const openMenu = (order: { id: string; code: string; device: string }) => (point: { x: number; y: number }) => {
    open({ type: 'ctx', kind: 'ot', id: order.id, label: `#${order.code} · ${order.device}`, ...point });
  };
  const dragStart = (orderId: string) => (event: DragEvent<HTMLElement>) => {
    suppressClick.current = true;
    draggingIdRef.current = orderId;
    setDraggingId(orderId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', orderId);
  };
  const dragEnd = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropStatus(null);
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  };

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
      {archiveError ? <p className="ferr" role="alert">{archiveError}</p> : null}
      <ScreenTitle
        title={<div className="svc-title"><h1>Servicio técnico</h1></div>}
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
      <div className="svc-chips" data-testid="service-chips" role="group" aria-label="Estado">
          {chips.map((chip) => (
            <button key={chip.id} type="button" className={`wchip${chip.id === statusId ? ' on' : ''}`} aria-pressed={chip.id === statusId} onClick={() => setStatusId(chip.id)}>
              {chip.color ? <i className="svc-dot" style={{ background: chip.color }} /> : null}
              {chip.label}
            </button>
          ))}
        </div>
      <button type="button" className={`wchip${archivedMode ? ' on' : ''}`} aria-pressed={archivedMode} onClick={() => setArchivedMode((current) => !current)}>Archivados</button>
      {repairOrdersError && !suppressLocalNetworkBanner(repairOrdersError, offlineOwned) ? <div className="ferr" role="alert" data-testid={repairOrdersError === NETWORK_ERROR_MESSAGE ? 'offline-banner' : undefined}>{repairOrdersError}</div> : null}
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
                    <PressTarget key={order.id} as="button" className={`ticket${isVoidRow(order) ? ' is-void' : ''}`} testId={`repair-card-${order.id}`} onActivate={() => openOrder(order.id)} onMenu={openMenu(order)}>
                      <div className="wtop">
                        <b>#{order.code}</b>
                        {dateText ? <span className={`date${late ? ' late' : ''}`}><DeskIcon name="cal" size={13} />{dateText}</span> : null}
                      </div>
                      <div className="store" data-testid={`repair-device-${order.id}`}>{order.device}</div>
                      {order.clientName ? <div className="svc-card-client" data-testid={`repair-client-${order.id}`}>{order.clientName}</div> : null}
                      <div className="items svc-fault" data-testid={`repair-fault-${order.id}`}>{repairFault(order)}</div>
                      <div className="wbot">
                        <span className="wamt">{repairPrice(order.estimate, 'quote', (value) => money.show(value, order.currency))}</span>
                      </div>
                    </PressTarget>
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
                    <PressTarget
                      key={order.id}
                      as="button"
                      className={`ticket${isVoidRow(order) ? ' is-void' : ''}${draggingId === order.id ? ' dragging' : ''}`}
                      testId={`repair-card-${order.id}`}
                      draggable={!isVoidRow(order)}
                      grabbed={draggingId === order.id}
                      onDragStart={dragStart(order.id)}
                      onDragEnd={dragEnd}
                      onActivate={() => openOrder(order.id)}
                      onMenu={openMenu(order)}
                    >
                      <div className="wtop">
                        <b>#{order.code}</b>
                        <span className={`date${late ? ' late' : ''}`}><DeskIcon name="cal" size={13} />{dayMonth(when)}</span>
                      </div>
                      <div className="store" data-testid={`repair-device-${order.id}`}>{order.device}</div>
                      {order.clientName ? <div className="svc-card-client" data-testid={`repair-client-${order.id}`}>{order.clientName}</div> : null}
                      <div className="items svc-fault" data-testid={`repair-fault-${order.id}`}>{repairFault(order)}</div>
                      <div className="wbot">
                        <span className="wamt">{repairPrice(order.estimate, 'quote', (value) => money.show(value, order.currency))}</span>
                      </div>
                    </PressTarget>
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
                    <th>Equipo</th>
                    <th>Cliente</th>
                    <th>Falla</th>
                    <th>Presupuesto</th>
                    <th>Entrega est.</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    <PressTarget key={order.id} as="tr" className={isVoidRow(order) ? 'is-void' : undefined} testId={`repair-row-${order.id}`} onActivate={() => openOrder(order.id)} onMenu={openMenu(order)}>
                      <td><b>#{order.code}</b></td>
                      <td>{dayMonth(order.receivedAt) || formatShortDate(order.receivedAt)}</td>
                      <td>{order.device}{order.imei ? <small>IMEI {order.imei}</small> : null}</td>
                      <td>{order.clientName || '—'}</td>
                      <td><div className="svc-fault" data-testid={`repair-fault-${order.id}`}>{repairFault(order)}</div></td>
                      <td>{repairPrice(order.estimate, 'dash', (value) => money.show(value, order.currency))}</td>
                      <td className={repairOverdue(order) ? 'late' : ''}>{order.estimatedDelivery ? dayMonth(order.estimatedDelivery) : '—'}</td>
                      <td><Pill status={repairColumnStatus(order.status)} kind="REPAIR_STATUS" /></td>
                    </PressTarget>
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
