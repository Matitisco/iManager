import './inventory-model-groups.css';
import { Fragment, useId, useMemo, useState } from 'react';
import type { Product } from '../types';
import type { MoneyApi } from './exchange';
import { conditionLabel, equipmentTitle, formatImei } from './format';
import { ImanagerIcon } from './icons';
import {
  groupInventoryModels,
  summarizeGroupMoney,
  type InventoryModelGroup,
} from './inventory-model-groups';
import { TablePager, usePagedRows } from './pager';
import { displayQuality } from './quality';
import { Battery, Pill } from './ui';

export function useInventoryLineView(storeId?: string) {
  const read = () => {
    try {
      return (
        Boolean(storeId) &&
        localStorage.getItem(`inventory-line-view:${storeId}`) === 'line'
      );
    } catch {
      return false;
    }
  };
  const [choice, setChoice] = useState(() => ({ storeId, value: read() }));
  if (choice.storeId !== storeId) setChoice({ storeId, value: read() });
  const toggle = () => {
    const value = !choice.value;
    setChoice({ storeId, value });
    try {
      if (storeId)
        localStorage.setItem(
          `inventory-line-view:${storeId}`,
          value ? 'line' : 'units',
        );
    } catch {
      /* The view remains usable when browser storage is unavailable. */
    }
  };
  return [choice.storeId === storeId ? choice.value : read(), toggle] as const;
}

function GroupRows({
  group,
  money,
  seeCosts,
  onOpen,
}: {
  group: InventoryModelGroup;
  money: MoneyApi;
  seeCosts: boolean;
  onOpen: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [all, setAll] = useState(false);
  const detailsId = useId();
  const title = equipmentTitle(group.model, group.capacity);
  const price = summarizeGroupMoney(
    group.items,
    'price',
    money.active,
    money.rate,
  );
  const cost = seeCosts
    ? summarizeGroupMoney(group.items, 'cost', money.active, money.rate)
    : null;
  const priceLabel = !price
    ? 'A definir'
    : price.blocked === true
      ? 'Sin cotización'
      : price.min === price.max
        ? money.show(price.min, price.currency)
        : `${money.show(price.min, price.currency)} – ${money.show(price.max, price.currency)}`;
  const costLabel = !cost
    ? '—'
    : cost.blocked === true
      ? 'Sin cotización'
      : cost.average == null
        ? '—'
        : money.show(cost.average, cost.currency);
  return (
    <Fragment>
      <tr className="inv-model-row">
        <td data-label="Equipo">
          <button
            type="button"
            className="inv-model-toggle"
            aria-expanded={expanded}
            aria-controls={expanded ? detailsId : undefined}
            onClick={() => setExpanded((value) => !value)}
          >
            <span className="inv-model-chevron" aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
            <span className="dthumb">
              <ImanagerIcon name="equipo" size={24} />
            </span>
            <b>{title}</b>
          </button>
        </td>
        <td data-label="Unidades">
          <b>{group.units} u.</b>
        </td>
        <td data-label="Disponibles">{group.available}</td>
        <td data-label="Colores" className="mut">
          {group.colors.join(', ') || '—'}
        </td>
        {seeCosts ? (
          <td data-label="Costo prom." className="r" data-ph-mask>
            {costLabel}
          </td>
        ) : null}
        <td data-label="Precio" className="r" data-ph-mask>
          {priceLabel}
        </td>
      </tr>
      {expanded ? (
        <tr className="inv-model-detail">
          <td colSpan={seeCosts ? 6 : 5}>
            <div
              id={detailsId}
              className="inv-model-units"
              role="region"
              aria-label={`Unidades de ${title}`}
            >
              <ul>
                {(all ? group.items : group.items.slice(0, 3)).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="inv-model-unit"
                      onClick={() => onOpen(item.id)}
                      aria-label={`Abrir equipo ${item.imei?.trim() || item.color || item.id}`}
                    >
                      <span data-ph-mask>
                        {item.imei?.trim()
                          ? `IMEI ${formatImei(item.imei)}`
                          : `Sin IMEI · ${item.cantidad ?? 1} u.`}
                      </span>
                      <span>{item.color.trim() || '—'}</span>
                      <span>
                        {[
                          conditionLabel(item.condition),
                          displayQuality(item.condition, item.grade),
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      </span>
                      <span>
                        {item.batteryHealth ? (
                          <Battery value={item.batteryHealth} />
                        ) : (
                          'Sin batería'
                        )}
                      </span>
                      {seeCosts ? (
                        <span className="r" data-ph-mask>
                          {item.cost == null
                            ? '—'
                            : money.show(item.cost, item.currency)}
                        </span>
                      ) : null}
                      <span>
                        {item.archivedAt ? (
                          <span className="spill mid">Archivado</span>
                        ) : (
                          <Pill status={item.status} kind="INVENTORY_STATUS" />
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {group.items.length > 3 ? (
                <button
                  type="button"
                  className="wlink"
                  onClick={() => setAll((value) => !value)}
                >
                  {all
                    ? 'Ver menos unidades'
                    : `Ver las ${group.units} unidades`}
                </button>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

export function InventoryModelGroups({
  items,
  money,
  seeCosts,
  onOpen,
  resetKey,
}: {
  items: Product[];
  money: MoneyApi;
  seeCosts: boolean;
  onOpen: (id: string) => void;
  resetKey: string;
}) {
  const groups = useMemo(() => groupInventoryModels(items), [items]);
  const page = usePagedRows(groups, resetKey);
  const units = groups.reduce((sum, group) => sum + group.units, 0);
  return (
    <div className={`inv-model-groups${seeCosts ? ' with-costs' : ''}`}>
      <p className="inv-model-count mut" data-testid="inventory-group-total">
        {groups.length} {groups.length === 1 ? 'modelo' : 'modelos'} · {units}{' '}
        {units === 1 ? 'equipo' : 'equipos'}
      </p>
      <table className="dtable inv-model-table" aria-label="Equipos por línea">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Unidades</th>
            <th>Disponibles</th>
            <th>Colores</th>
            {seeCosts ? <th className="r">Costo prom.</th> : null}
            <th className="r">Precio</th>
          </tr>
        </thead>
        <tbody>
          {page.visible.map((group) => (
            <GroupRows
              key={`${resetKey}:${group.key}`}
              group={group}
              money={money}
              seeCosts={seeCosts}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
      {groups.length === 0 ? (
        <div className="table-empty">No hay equipos con ese filtro.</div>
      ) : null}
      <TablePager
        page={page.page}
        pages={page.pages}
        total={page.total}
        from={page.from}
        to={page.to}
        onPage={page.setPage}
      />
    </div>
  );
}
