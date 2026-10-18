import { useMemo, useState } from 'react';
import type { Product, RepairOrder, Sale, TradeIn } from '../types';
import type { CommissionSeller } from '../types/commissions';
import { useMoney, type MoneyApi } from './exchange';
import {
  clientPurchases,
  filterPurchases,
  purchaseTotals,
  visiblePurchases,
  warrantiesLabel,
  type ClientPurchase,
  type PurchaseFilter,
} from './client-purchases';

const FILTERS: { id: PurchaseFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'sale', label: 'Ventas' },
  { id: 'trade', label: 'Canjes' },
  { id: 'repair', label: 'Reparaciones' },
];

const KIND_MARK = { sale: 'V', trade: 'C', repair: 'R' } as const;
const KIND_TONE = { sale: 'l', trade: 'n', repair: 'b' } as const;

function formatSpent(parts: { currency: string | null; amount: number }[], money: MoneyApi) {
  if (parts.length === 0) return money.show(0);
  if (parts.length === 1) return money.show(parts[0].amount, parts[0].currency);
  const combined = money.sum(parts);
  if (combined != null) return money.showActive(combined);
  return parts.map((part) => money.show(part.amount, part.currency)).join(' + ');
}

function amountLabel(row: ClientPurchase, money: MoneyApi) {
  const text = money.show(row.amount, row.currency);
  return row.negative ? `- ${text}` : text;
}

function metaLine(row: ClientPurchase) {
  return [row.imeiShort, row.dateLabel, row.detail].filter(Boolean).join(' · ');
}

export function ClientPurchases({ clientId, sales, tradeIns, repairs, inventory, sellers }: {
  clientId: string;
  sales: Sale[];
  tradeIns: TradeIn[];
  repairs: RepairOrder[];
  inventory: Product[];
  sellers: CommissionSeller[];
}) {
  const money = useMoney();
  const [filter, setFilter] = useState<PurchaseFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = useMemo(
    () => clientPurchases({ clientId, sales, tradeIns, repairs, inventory, sellers }),
    [clientId, sales, tradeIns, repairs, inventory, sellers],
  );
  const totals = purchaseTotals(rows);
  const filtered = filterPurchases(rows, filter);
  const visible = visiblePurchases(filtered, expanded);
  const hidden = filtered.length - visible.length;

  return (
    <section className="client-purchases" data-testid="client-purchases" aria-label="Compras">
      <div className="cl-buy-stats" data-testid="client-purchase-stats">
        <div className="dstat"><div className="eb">Total gastado</div><div className="big">{formatSpent(totals.spent, money)}</div></div>
        <div className="dstat"><div className="eb">Compras</div><div className="big">{totals.count}</div></div>
        <div className="dstat"><div className="eb">Garantías</div><div className="big ok">{warrantiesLabel(totals.activeWarranties)}</div></div>
      </div>
      <div className="buy-head">
        <h4>Compras</h4>
        <span data-testid="client-purchase-count">{filtered.length}</span>
      </div>
      <div className="wchips buy-chips" role="group" aria-label="Filtrar compras">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`wchip${filter === option.id ? ' on' : ''}`}
            aria-pressed={filter === option.id}
            onClick={() => { setFilter(option.id); setExpanded(false); setOpenId(null); }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? <p className="eqs-note">No hay compras con ese filtro.</p> : null}
      <div className="buy-list">
        {visible.map((row) => {
          const open = openId === row.id;
          return (
            <div key={row.id} className="buy-item" data-testid={`purchase-${row.id}`}>
              <button type="button" className="buy-row" aria-expanded={open} onClick={() => setOpenId(open ? null : row.id)}>
                <span className={`av-c buy-kind ${KIND_TONE[row.kind]}`} aria-hidden="true">{KIND_MARK[row.kind]}</span>
                <span className="buy-copy">
                  <b>{row.title}</b>
                  <small>{metaLine(row)}</small>
                  {row.warranty ? <span className={`spill ${row.warranty.state === 'vigente' ? 'ok' : row.warranty.state === 'vencida' ? 'no' : 'mid'}`}>{row.warranty.badge}</span> : null}
                </span>
                <b className="buy-amt">{amountLabel(row, money)}</b>
              </button>
              {open ? (
                <div className="buy-detail" data-testid={`purchase-detail-${row.id}`}>
                  <div>IMEI {row.imei ?? 'sin cargar'}</div>
                  {row.warranty ? <div>{row.warranty.phrase}</div> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {hidden > 0 ? <button type="button" className="wlink" data-testid="purchases-more" onClick={() => setExpanded(true)}>Ver todas</button> : null}
    </section>
  );
}
