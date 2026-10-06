import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import {
  clientName,
  formatMoney,
  inPeriod,
  paymentLabel,
  periodBounds,
  productLabel,
  saleCode,
  type PeriodKey,
} from '../format';
import { MenuButton, Pill, SearchBox, useDesk } from '../ui';

const PERIODS: PeriodKey[] = ['Semana', 'Mes', 'Año'];

export function SalesScreen() {
  const { sales, clients, inventory } = useAppContext();
  const { open } = useDesk();
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<PeriodKey>('Mes');
  const bounds = periodBounds(period);

  const periodSales = useMemo(
    () => sales.filter((sale) => sale.status !== 'CANCELADA' && (parseOk(sale.date) ? inPeriod(sale.date, bounds.start, bounds.end) : period === 'Mes')),
    [sales, bounds.start, bounds.end, period],
  );
  const previous = sales.filter((sale) => sale.status !== 'CANCELADA' && inPeriod(sale.date, bounds.prevStart, bounds.prevEnd));
  const total = periodSales.reduce((sum, sale) => sum + sale.amount, 0);
  const prevTotal = previous.reduce((sum, sale) => sum + sale.amount, 0);
  const avg = periodSales.length ? Math.round(total / periodSales.length) : 0;
  const cost = periodSales.reduce((sum, sale) => sum + (inventory.find((item) => item.id === sale.productId)?.cost ?? 0), 0);
  const hasCost = periodSales.some((sale) => (inventory.find((item) => item.id === sale.productId)?.cost ?? 0) > 0);
  const margin = total - cost;
  const delta = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const rows = periodSales.filter((sale) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const product = inventory.find((item) => item.id === sale.productId);
    return `${clientName(clients, sale.clientId)} ${productLabel(product)} ${saleCode(sale)}`.toLowerCase().includes(q);
  });

  const subtitle = period === 'Semana' ? 'Esta semana' : period === 'Mes' ? 'Este mes' : 'Este año';

  return (
    <div className="dscreen">
      <div className="dtop">
        <div>
          <h1>Ventas</h1>
          <div className="dsub">{subtitle}</div>
        </div>
        <div className="dright">
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar cliente, equipo o número" />
          <MenuButton label={`${period} ▾`} options={PERIODS} value={period} onChange={(value) => setPeriod(value as PeriodKey)} />
          <button className="dbtn s" type="button" onClick={() => open({ type: 'import', kind: 'sale' })}>↑ Importar</button>
          <button className="dbtn p" type="button" onClick={() => open({ type: 'new-sale' })}>+ Registrar venta</button>
        </div>
      </div>
      <div className="dstats">
        <div className="dstat"><div className="eb">Facturación total</div><div className="big">{formatMoney(total)}</div><span className="spill lime">{periodSales.length} ventas</span></div>
        <div className="dstat"><div className="eb">Ticket promedio</div><div className="big">{formatMoney(avg)}</div></div>
        <div className="dstat">
          <div className="eb">Margen bruto</div>
          <div className="big">{hasCost ? formatMoney(margin) : '—'}</div>
          <small className="mut">{hasCost ? 'precio menos costo' : 'Cargá el costo en el equipo'}</small>
        </div>
        <div className="dstat">
          <div className="eb">Variación</div>
          <div className="big">{delta == null ? '—' : <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%</span>}</div>
          <small className="mut">vs período anterior</small>
        </div>
      </div>
      <div className="dcard flush">
        <div className="dch pad"><h3>Ventas del período</h3><span className="mut">{rows.length} de {periodSales.length}</span></div>
        {rows.length === 0 ? <div className="wempty">No encontré ventas.</div> : (
          <table className="dtable">
            <thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Equipo</th><th>Pago</th><th className="r">Total</th><th>Estado</th></tr></thead>
            <tbody>
              {rows.map((sale) => {
                const product = inventory.find((item) => item.id === sale.productId);
                return (
                  <tr
                    key={sale.id}
                    onClick={() => open({ type: 'sale', id: sale.id })}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${clientName(clients, sale.clientId)}`, x: event.clientX, y: event.clientY });
                    }}
                  >
                    <td><b>#{saleCode(sale)}</b></td>
                    <td>{sale.date}</td>
                    <td>{clientName(clients, sale.clientId)}</td>
                    <td>{productLabel(product)}</td>
                    <td>{paymentLabel(sale.paymentMethod)}</td>
                    <td className="r"><b>{formatMoney(sale.amount)}</b></td>
                    <td><Pill status={sale.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function parseOk(value: string) {
  return /\d/.test(value);
}
