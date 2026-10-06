import { useMemo, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { batteryPercent, conditionLabel, formatImei, formatMoney } from '../format';
import { Battery, ChipRow, DeskCta, MenuButton, Pill, SearchBox, useDesk } from '../ui';

const FILTERS = [
  { id: 'Todos', label: 'Todos' },
  { id: 'DISPONIBLE', label: 'Disponible' },
  { id: 'EN_REVISION', label: 'En revisión' },
  { id: 'VENDIDO', label: 'Vendido' },
];

export function InventoryScreen() {
  const { inventory } = useAppContext();
  const { open } = useDesk();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [sort, setSort] = useState('Recientes');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = inventory.filter((item) => {
      const matchesFilter = filter === 'Todos' || item.status === filter;
      const haystack = `${item.model} ${item.capacity} ${item.color} ${item.imei}`.toLowerCase();
      return matchesFilter && (!q || haystack.includes(q));
    });
    if (sort === 'Precio ↑') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'Precio ↓') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [inventory, query, filter, sort]);

  const available = inventory.filter((item) => item.status === 'DISPONIBLE').length;

  return (
    <div className="dscreen">
      <div className="dtop">
        <div>
          <h1>Inventario</h1>
          <div className="dsub">{inventory.length} equipos · {available} disponibles</div>
        </div>
        <div className="dright">
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar modelo, color o IMEI" />
          <button className="dbtn s" type="button" onClick={() => open({ type: 'import', kind: 'inv' })}>↑ Importar</button>
          <DeskCta onClick={() => open({ type: 'new-eq' })}>Registrar equipo</DeskCta>
        </div>
      </div>
      <div className="dbar">
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
        <MenuButton label={sort} options={['Recientes', 'Precio ↑', 'Precio ↓']} value={sort} onChange={setSort} />
      </div>
      <div className="dcard flush">
        {rows.length === 0 ? <div className="wempty">No hay equipos con ese filtro.</div> : (
          <table className="dtable">
            <thead>
              <tr><th>Equipo</th><th>IMEI</th><th>Condición</th><th>Batería</th><th className="r">Precio</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => open({ type: 'eq', id: item.id })}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    open({
                      type: 'ctx',
                      kind: 'eq',
                      id: item.id,
                      label: `${item.model} · ${item.capacity}`,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                >
                  <td>
                    <div className="dcell">
                      <div className="dthumb"><Smartphone size={16} /></div>
                      <div><b>{item.model} · {item.capacity}</b><small>{item.color}</small></div>
                    </div>
                  </td>
                  <td className="mono">{formatImei(item.imei)}</td>
                  <td>{conditionLabel(item.condition, item.grade)}</td>
                  <td><Battery value={batteryPercent(item.batteryHealth)} /></td>
                  <td className="r"><b>{formatMoney(item.price)}</b></td>
                  <td><Pill status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="dhint">Tip: clic derecho en una fila para editar o eliminar.</div>
    </div>
  );
}
