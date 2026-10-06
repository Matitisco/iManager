import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { avatarTone, formatMoney, formatMoneyCompact, initials } from '../format';
import { ChipRow, DeskCta, SearchBox, useDesk } from '../ui';

export function ClientsScreen() {
  const { clients } = useAppContext();
  const { open } = useDesk();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const withBalance = clients.filter((client) => client.pendingBalance > 0).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((client) => {
      const matches = filter === 'Todos' || client.pendingBalance > 0;
      const haystack = `${client.name} ${client.phone} ${client.dni} ${client.email}`.toLowerCase();
      return matches && (!q || haystack.includes(q));
    });
  }, [clients, query, filter]);

  return (
    <div className="dscreen">
      <div className="dtop">
        <div>
          <h1>Clientes</h1>
          <div className="dsub">{clients.length} clientes · {withBalance} con saldo</div>
        </div>
        <div className="dright">
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar por nombre, DNI o teléfono" />
          <button className="dbtn s" type="button" onClick={() => open({ type: 'import', kind: 'cl' })}>↑ Importar</button>
          <DeskCta onClick={() => open({ type: 'new-cl' })}>Nuevo cliente</DeskCta>
        </div>
      </div>
      <div className="dbar">
        <ChipRow
          options={[{ id: 'Todos', label: 'Todos' }, { id: 'saldo', label: 'Con saldo pendiente' }]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <div className="dcard flush">
        {rows.length === 0 ? <div className="wempty">No encontré clientes.</div> : (
          <table className="dtable">
            <thead><tr><th>Cliente</th><th>DNI</th><th>Teléfono</th><th>Última compra</th><th className="r">Gastado</th><th>Saldo</th></tr></thead>
            <tbody>
              {rows.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => open({ type: 'cl', id: client.id })}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    open({ type: 'ctx', kind: 'cl', id: client.id, label: client.name, x: event.clientX, y: event.clientY });
                  }}
                >
                  <td>
                    <div className="dcell">
                      <div className={`av-c ${avatarTone(client.name)}`}>{initials(client.name)}</div>
                      <div><b>{client.name}</b><small>{client.email || 'Sin email'}</small></div>
                    </div>
                  </td>
                  <td>{client.dni || '—'}</td>
                  <td>{client.phone || '—'}</td>
                  <td>{client.lastPurchaseDate && client.lastPurchaseDate !== 'N/A' ? client.lastPurchaseDate : '—'}</td>
                  <td className="r">{formatMoney(client.totalSpent)}</td>
                  <td>{client.pendingBalance > 0 ? <span className="spill off">Saldo {formatMoneyCompact(client.pendingBalance)}</span> : <span className="spill mid">Sin saldo</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
