import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useCatalogs } from '../catalog';
import { formatMoney, formatShortDate, isInProgressTrade, parseAppDate, statusLabel, tradeClientLabel, tradeCode } from '../format';
import { useOperationDraftError } from '../operation-drafts';
import { TablePager, usePagedRows } from '../pager';
import { ChipRow, DeskCta, ImportButton, MenuButton, Pill, PressTarget, SearchBox, useDesk } from '../ui';

const DEFAULT_STATUSES = [
  { id: 'PENDIENTE', label: 'Pendiente' },
  { id: 'PERITAJE TÉC.', label: 'Peritaje téc.' },
  { id: 'EN REVISIÓN', label: 'En revisión' },
  { id: 'APROBADO', label: 'Aprobado' },
  { id: 'LISTO', label: 'Completado' },
  { id: 'RECHAZADO', label: 'Rechazado' },
];

export function TradeInsScreen() {
  const { tradeIns, clients, operationDrafts = [] } = useAppContext();
  const catalogs = useCatalogs();
  const { open } = useDesk();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [sort, setSort] = useState('Recientes');
  const draftError = useOperationDraftError('tradeins');
  const ownDrafts = operationDrafts.filter((trade) => trade.confirmationStatus === 'PENDING');
  const openCount = tradeIns.filter((item) => isInProgressTrade(item.status)).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const direction = sort === 'Recientes' ? -1 : 1;
    return tradeIns.filter((item) => {
      const name = tradeClientLabel(item, clients);
      const haystack = `${name} ${item.clientName ?? ''} ${item.deviceReceived} ${item.deviceReceivedImei} ${item.deviceGiven} ${tradeCode(tradeIns, item.id)}`.toLowerCase();
      return (filter === 'Todos' || item.status === filter) && (!q || haystack.includes(q));
    }).sort((left, right) => {
      const a = parseAppDate(left.date)?.getTime();
      const b = parseAppDate(right.date)?.getTime();
      if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1;
      return direction * (a - b) || direction * ((left.tradeNumber ?? 0) - (right.tradeNumber ?? 0));
    });
  }, [tradeIns, clients, query, filter, sort]);
  const page = usePagedRows(rows, `${query}|${filter}|${sort}`);

  const statuses = useMemo(() => {
    const known = catalogs?.ready
      ? catalogs.options.filter((option) => option.kind === 'TRADE_IN_STATUS').map((option) => ({ id: option.value, label: option.label }))
      : DEFAULT_STATUSES;
    const extra = [...new Set(tradeIns.map((item) => item.status))].filter((status) => !known.some((item) => item.id === status));
    return [...known, ...extra.map((id) => ({ id, label: statusLabel(id) || 'Sin estado' }))];
  }, [catalogs?.ready, catalogs?.options, tradeIns]);

  return (
    <div className="dscreen">
      <div className="dtop">
        <div>
          <h1>Canjes</h1>
          <div className="dsub">{tradeIns.length} canjes · {openCount} en curso</div>
        </div>
        <div className="dright">
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar cliente, equipo, IMEI o número" />
          <ImportButton onClick={() => open({ type: 'import', kind: 'cj' })} />
          <DeskCta onClick={() => open({ type: 'new-cj' })}>Nuevo canje</DeskCta>
        </div>
      </div>
      {draftError ? <div className="ferr">{draftError}</div> : null}
      {ownDrafts.length > 0 ? (
        <div className="dcard op-drafts">
          <div><b>Canjes pendientes de confirmar</b><small>Podés retomarlos para completar la venta y el equipo entregado.</small></div>
          <div className="op-draft-list">{ownDrafts.map((trade) => (
            <button key={trade.id} type="button" onClick={() => open({ type: 'edit-cj', id: trade.id, source: 'tradeins' })}>
              <span>{trade.clientName || 'Cliente por completar'} · {trade.deviceReceived || 'Equipo recibido'}</span><b>Retomar</b>
            </button>
          ))}</div>
        </div>
      ) : null}
      <div className="dbar">
        <ChipRow
          options={[{ id: 'Todos', label: 'Todos' }, ...statuses]}
          value={filter}
          onChange={setFilter}
        />
        <MenuButton label={sort} options={['Recientes', 'Antiguos']} value={sort} onChange={setSort} />
      </div>
      <div className="dcard flush">
        {rows.length === 0 ? <div className="wempty">No encontré canjes.</div> : (
          <div className="dtable-scroll">
            <table className="dtable trade-table" aria-label="Canjes">
              <thead><tr><th>Canje</th><th>Fecha</th><th>Cliente</th><th>Recibido</th><th>Entregado</th><th className="r">Valor / diferencia</th><th>Estado</th></tr></thead>
              <tbody>
                {page.visible.map((item) => (
                  <PressTarget
                    key={item.id}
                    as="tr"
                    onActivate={() => open({ type: 'cj', id: item.id })}
                    onMenu={(point) => open({ type: 'ctx', kind: 'cj', id: item.id, label: `${tradeCode(tradeIns, item.id)} · ${tradeClientLabel(item, clients)}`, ...point })}
                  >
                    <td className="trade-nowrap"><b>#{tradeCode(tradeIns, item.id)}</b></td>
                    <td className="trade-nowrap">{formatShortDate(item.date)}</td>
                    <td>{tradeClientLabel(item, clients)}</td>
                    <td className="trade-device"><b>{item.deviceReceived || '—'}</b>{item.deviceReceivedImei ? <small>{item.deviceReceivedImei}</small> : null}</td>
                    <td className="trade-device">{item.deviceGiven || '—'}</td>
                    <td className="r trade-nowrap"><b>{formatMoney(item.takeValue)}</b><small>Dif. {formatMoney(item.differencePaid)}</small></td>
                    <td>
                      {item.status ? <Pill status={item.status} kind="TRADE_IN_STATUS" /> : '—'}
                      {item.confirmationStatus === 'PENDING' ? <small className="trade-confirmation pending">Pendiente de confirmación</small> : null}
                      {item.confirmationStatus === 'CONFIRMED' ? <small className="trade-confirmation">Canje confirmado</small> : null}
                      {item.confirmationStatus === 'CANCELLED' ? <small className="trade-confirmation cancelled">Operación cancelada</small> : null}
                    </td>
                  </PressTarget>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
    </div>
  );
}
