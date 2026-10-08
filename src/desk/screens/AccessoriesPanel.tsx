import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { AccessoryMark } from '../AccessoryMark';
import { accessoryStatus, needsRestock } from '../accessories';
import { formatMoney } from '../format';
import { TablePager, usePagedRows } from '../pager';
import { ChipRow, PressTarget, useDesk } from '../ui';

export function AccessoriesPanel({ query }: { query: string }) {
  const { accessories = [] } = useAppContext();
  const { open } = useDesk();
  const [category, setCategory] = useState('Todas');
  const [lowOnly, setLowOnly] = useState(false);
  const low = accessories.filter((item) => needsRestock(item));
  const units = accessories.reduce((sum, item) => sum + item.stock, 0);
  const cost = accessories.reduce((sum, item) => sum + item.stock * item.cost, 0);
  const below = accessories.filter((item) => item.stock > 0 && item.stock <= item.minStock).length;
  const empty = accessories.filter((item) => item.stock <= 0).length;
  const categories = useMemo(() => {
    const names = [...new Set(accessories.map((item) => item.category))];
    const preferred = ['Cargadores', 'Cables', 'Fundas', 'Templados', 'Otros'];
    names.sort((left, right) => {
      const leftRank = preferred.indexOf(left);
      const rightRank = preferred.indexOf(right);
      if (leftRank !== -1 || rightRank !== -1) return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
      return left.localeCompare(right, 'es');
    });
    return [{ id: 'Todas', label: 'Todas' }, ...names.map((name) => ({ id: name, label: name }))];
  }, [accessories]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return accessories.filter((item) => {
      if (category !== 'Todas' && item.category !== category) return false;
      if (lowOnly && !needsRestock(item)) return false;
      if (!needle) return true;
      return `${item.name} ${item.sku} ${item.compatibleWith} ${item.category}`.toLowerCase().includes(needle);
    });
  }, [accessories, query, category, lowOnly]);
  const page = usePagedRows(rows, `${query}|${category}|${lowOnly}`);

  return (
    <>
      <div className="dstats">
        <div className="dstat"><div className="eb">Unidades en stock</div><div className="big">{units}</div><small className="mut">{accessories.length} productos</small></div>
        <div className="dstat"><div className="eb">Valor del stock (costo)</div><div className="big">{formatMoney(cost)}</div></div>
        <div className="dstat"><div className="eb">Stock bajo</div><div className="big">{below}</div><small className="mut">en o debajo del mínimo</small></div>
        <div className="dstat"><div className="eb">Sin stock</div><div className="big">{empty}</div><small className="mut">no se pueden vender</small></div>
      </div>
      {low.length > 0 ? (
        <div className="acc-alert">
          <span className="warn" aria-hidden="true">!</span>
          <div><b>{low.length} {low.length === 1 ? 'accesorio necesita' : 'accesorios necesitan'} reposición</b><small>{low.map((item) => item.name).join(' · ')}</small></div>
          <button className="wlink" type="button" onClick={() => setLowOnly(true)}>Ver solo esos</button>
        </div>
      ) : null}
      <div className="dbar">
        <ChipRow options={categories} value={category} onChange={setCategory} />
        <label className="op-check acc-only"><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} />Solo stock bajo</label>
      </div>
      <div className="dcard flush">
        <table className="dtable">
          <thead>
            <tr>
              <th>Accesorio</th><th>Categoría</th><th>Código</th><th>Stock</th><th>Mínimo</th><th className="r">Costo</th><th className="r">Precio</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {page.visible.map((item) => {
              const status = accessoryStatus(item);
              return (
                <PressTarget key={item.id} as="tr" onActivate={() => open({ type: 'edit-acc', id: item.id })} onMenu={(point) => open({ type: 'ctx', kind: 'acc', id: item.id, label: item.name, ...point })}>
                  <td>
                    <div className="dcell"><AccessoryMark category={item.category} /><div><b>{item.name}</b><small>{item.compatibleWith || '—'}</small></div></div>
                  </td>
                  <td>{item.category}</td>
                  <td>{item.sku || '—'}</td>
                  <td className={needsRestock(item) ? 'stk low' : 'stk'}>{item.stock} u.</td>
                  <td>{item.minStock}</td>
                  <td className="r">{formatMoney(item.cost)}</td>
                  <td className="r"><b>{formatMoney(item.price)}</b></td>
                  <td><span className={`spill ${status === 'En stock' ? 'ok' : status === 'Sin stock' ? 'no' : 'lime'}`}>{status}</span></td>
                </PressTarget>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <div className="wempty">{accessories.length === 0 ? 'Todavía no cargaste accesorios.' : 'No hay accesorios con ese filtro.'}</div> : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
    </>
  );
}
