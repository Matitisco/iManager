import { useMemo, useState } from 'react';
import type { Accessory } from '../types';
import { AccessoryMark } from './AccessoryMark';
import { formatMoney } from './format';

export type SaleAccessoryLine = { id: string; quantity: number };

export function SaleAccessories({
  catalog,
  lines,
  onChange,
  equipmentLabel,
  equipmentAmount,
}: {
  catalog: Accessory[];
  lines: SaleAccessoryLine[];
  onChange: (lines: SaleAccessoryLine[]) => void;
  equipmentLabel: string;
  equipmentAmount: number;
}) {
  const [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const selected = lines.map((line) => ({ ...line, item: byId.get(line.id) })).filter((line) => line.item);
  const units = selected.reduce((sum, line) => sum + line.quantity, 0);
  const accessoryTotal = selected.reduce((sum, line) => sum + line.quantity * (line.item?.price ?? 0), 0);
  const needle = query.trim().toLowerCase();
  const hits = needle
    ? catalog.filter((item) => `${item.name} ${item.sku} ${item.compatibleWith} ${item.category}`.toLowerCase().includes(needle))
    : [];

  const setQuantity = (id: string, quantity: number) => {
    const item = byId.get(id);
    if (!item) return;
    const next = Math.max(0, Math.min(item.stock, quantity));
    onChange(next === 0 ? lines.filter((line) => line.id !== id) : lines.map((line) => line.id === id ? { ...line, quantity: next } : line));
  };

  const add = (item: Accessory) => {
    if (item.stock <= 0) return;
    const current = lines.find((line) => line.id === item.id);
    if (!current) onChange([...lines, { id: item.id, quantity: 1 }]);
    else setQuantity(item.id, current.quantity + 1);
    setQuery('');
  };

  return (
    <aside className="sale-acc">
      <div className="sale-acc-h"><b>Sumar accesorios</b><span className="spill mid">Opcional</span></div>
      <label className="xsearch sale-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>
        <input aria-label="Buscar accesorio" placeholder="Buscar accesorio por nombre o modelo" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {needle ? (
        <div className="acc-hits">
          {hits.length === 0 ? <div className="wempty">No hay accesorios con ese nombre.</div> : hits.map((item) => (
            <div key={item.id} className="acc-hit">
              <AccessoryMark category={item.category} />
              <span><b>{item.name}</b><small>{item.category} · quedan {item.stock}</small></span>
              <b>{formatMoney(item.price)}</b>
              <button type="button" aria-label={`Agregar ${item.name}`} disabled={item.stock <= 0 || (lines.find((line) => line.id === item.id)?.quantity ?? 0) >= item.stock} onClick={() => add(item)}>+</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="acc-lines">
          {selected.map((line) => {
            const item = line.item!;
            const left = Math.max(0, item.stock - line.quantity);
            return (
              <div key={line.id} className="acc-line">
                <AccessoryMark category={item.category} />
                <span><b>{item.name}</b><small>{formatMoney(item.price)} c/u · quedan {left}</small></span>
                <span className="stepper">
                  <button type="button" aria-label={`Restar ${item.name}`} onClick={() => setQuantity(item.id, line.quantity - 1)}>-</button>
                  <b>{line.quantity}</b>
                  <button type="button" aria-label={`Sumar ${item.name}`} disabled={line.quantity >= item.stock} onClick={() => setQuantity(item.id, line.quantity + 1)}>+</button>
                </span>
                <b>{formatMoney(item.price * line.quantity)}</b>
                <button type="button" className="acc-x" aria-label={`Quitar ${item.name}`} onClick={() => onChange(lines.filter((row) => row.id !== line.id))}>×</button>
              </div>
            );
          })}
        </div>
      )}
      <div className="sale-sum">
        <div><span>Equipo · {equipmentLabel || 'Sin equipo'}</span><b>{formatMoney(equipmentAmount)}</b></div>
        <div><span>Accesorios ({units} u.)</span><b>{formatMoney(accessoryTotal)}</b></div>
        <div className="total"><span>Total a cobrar</span><b>{formatMoney(equipmentAmount + accessoryTotal)}</b></div>
      </div>
      {units > 0 ? <div className="acc-note">Al confirmar se {units === 1 ? 'descuenta 1 unidad' : `descuentan ${units} unidades`} del stock de accesorios.</div> : null}
    </aside>
  );
}
