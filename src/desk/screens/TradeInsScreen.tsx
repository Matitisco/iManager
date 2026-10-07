import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useCatalogs } from '../catalog';
import { clientName, formatMoney, formatShortDate, isInProgressTrade, parseAppDate, statusLabel, tradeCode } from '../format';
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
  const { tradeIns, clients } = useAppContext();
  const catalogs = useCatalogs();
  const { open } = useDesk();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [sort, setSort] = useState('Recientes');
  const openCount = tradeIns.filter((item) => isInProgressTrade(item.status)).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const direction = sort === 'Recientes' ? -1 : 1;
    return tradeIns.filter((item) => {
      const name = clientName(clients, item.clientId);
      const haystack = `${name} ${item.deviceReceived} ${item.deviceReceivedImei} ${item.deviceGiven} ${tradeCode(tradeIns, item.id)}`.toLowerCase();
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
                    onMenu={(point) => open({ type: 'ctx', kind: 'cj', id: item.id, label: `${tradeCode(tradeIns, item.id)} · ${clientName(clients, item.clientId)}`, ...point })}
                  >
                    <td className="trade-nowrap"><b>#{tradeCode(tradeIns, item.id)}</b></td>
                    <td className="trade-nowrap">{formatShortDate(item.date)}</td>
                    <td>{clientName(clients, item.clientId)}</td>
                    <td className="trade-device"><b>{item.deviceReceived || '—'}</b>{item.deviceReceivedImei ? <small>{item.deviceReceivedImei}</small> : null}</td>
                    <td className="trade-device">{item.deviceGiven || '—'}</td>
                    <td className="r trade-nowrap"><b>{formatMoney(item.takeValue)}</b><small>Dif. {formatMoney(item.differencePaid)}</small></td>
                    <td>{item.status ? <Pill status={item.status} kind="TRADE_IN_STATUS" /> : '—'}</td>
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
