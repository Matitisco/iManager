import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { clientName, formatMoney, formatShortDate, isInProgressTrade, tradeCode } from '../format';
import { ChipRow, DeskCta, ImportButton, Pill, PressTarget, SearchBox, useDesk } from '../ui';

const COLUMNS = [
  { id: 'PENDIENTE', label: 'Pendiente' },
  { id: 'PERITAJE TÉC.', label: 'Peritaje téc.' },
  { id: 'EN REVISIÓN', label: 'En revisión' },
  { id: 'APROBADO', label: 'Aprobado' },
  { id: 'LISTO', label: 'Completado' },
];

export function TradeInsScreen() {
  const { tradeIns, clients } = useAppContext();
  const { open } = useDesk();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const openCount = tradeIns.filter((item) => isInProgressTrade(item.status)).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tradeIns.filter((item) => {
      const name = clientName(clients, item.clientId);
      const haystack = `${name} ${item.deviceReceived} ${item.deviceGiven} ${tradeCode(tradeIns, item.id)}`.toLowerCase();
      return !q || haystack.includes(q);
    });
  }, [tradeIns, clients, query]);

  const columns = filter === 'Todos'
    ? COLUMNS
    : filter === 'RECHAZADO'
      ? [{ id: 'RECHAZADO', label: 'Rechazado' }]
      : COLUMNS.filter((column) => column.id === filter);

  return (
    <div className="dscreen">
      <div className="dtop">
        <div>
          <h1>Canjes</h1>
          <div className="dsub">{tradeIns.length} canjes · {openCount} en curso</div>
        </div>
        <div className="dright">
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar cliente o equipo" />
          <ImportButton onClick={() => open({ type: 'import', kind: 'cj' })} />
          <DeskCta onClick={() => open({ type: 'new-cj' })}>Nuevo canje</DeskCta>
        </div>
      </div>
      <div className="dbar">
        <ChipRow
          options={[{ id: 'Todos', label: 'Todos' }, ...COLUMNS.map((column) => ({ id: column.id, label: column.label })), { id: 'RECHAZADO', label: 'Rechazado' }]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <div className="dkanban" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(190px, 1fr))` }}>
        {columns.map((column) => {
          const items = filtered.filter((item) => item.status === column.id);
          return (
            <div className="dcol" key={column.id}>
              <div className="dcolh"><span>{column.label}</span><b>{items.length}</b></div>
              {items.length === 0 ? <div className="dempty">Sin canjes</div> : items.map((item) => (
                <PressTarget
                  key={item.id}
                  as="button"
                  className="ticket"
                  onActivate={() => open({ type: 'cj', id: item.id })}
                  onMenu={(point) => open({ type: 'ctx', kind: 'cj', id: item.id, label: `${tradeCode(tradeIns, item.id)} · ${clientName(clients, item.clientId)}`, ...point })}
                >
                  <div className="meta"><span>#{tradeCode(tradeIns, item.id)} · {formatShortDate(item.date)}</span><Pill status={item.status} /></div>
                  <div className="ttl">Recibido: {item.deviceReceived}</div>
                  <div className="who">{clientName(clients, item.clientId)}<br />Entrega: {item.deviceGiven}</div>
                  <div className="amt"><b>{formatMoney(item.takeValue)}</b><small>dif. {formatMoney(item.differencePaid)}</small></div>
                </PressTarget>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
