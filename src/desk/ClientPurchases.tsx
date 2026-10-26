import { ReplayValue } from './replay-privacy';
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { ModalLayerContext, useModalLayer } from './modal-layer';
import { ModalCloseButton } from './close-button';
import { usePhoneLayout } from './section-notices';
import type { Client, Product, RepairOrder, Sale, TradeIn } from '../types';
import type { CommissionSeller } from '../types/commissions';
import { useMoney, type MoneyApi } from './exchange';
import { ClientSpending } from './ClientSpending';
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

function amountLabel(row: ClientPurchase, money: MoneyApi) {
  const text = money.show(row.amount, row.currency);
  return row.negative ? `- ${text}` : text;
}

function metaLine(row: ClientPurchase) {
  return [row.imei ? `IMEI ${row.imei}` : null, row.dateLabel, row.detail].filter(Boolean).join(' · ');
}

function PurchaseRows({ rows, money }: { rows: ClientPurchase[]; money: MoneyApi }) {
  return <div className="buy-list">
    {rows.map((row) => <div key={row.id} className={`buy-item${row.annulled ? ' annulled' : ''}`} data-testid={`purchase-${row.id}`}>
      <div className="buy-row">
        <span className={`av-c buy-kind ${KIND_TONE[row.kind]}`} aria-hidden="true">{KIND_MARK[row.kind]}</span>
        <b className="buy-title">{row.title}</b>
        <b data-ph-mask className="buy-amt">{amountLabel(row, money)}</b>
        <small data-ph-mask={Boolean(row.imei) || undefined} className="buy-meta">{metaLine(row)}</small>
        {row.annulled ? <span className="spill buy-pill annulled">Anulada</span>
          : row.warranty ? <span className={`spill buy-pill ${row.warranty.state}`}>{row.warranty.badge}</span> : null}
      </div>
    </div>)}
  </div>;
}

function PurchaseChips({ filter, onChange, count }: { filter: PurchaseFilter; onChange: (filter: PurchaseFilter) => void; count?: number }) {
  return <div className="buy-filter-bar">
    <div className="wchips buy-chips" role="group" aria-label="Filtrar compras">
      {FILTERS.map((option) => <button key={option.id} type="button" className={`wchip${filter === option.id ? ' on' : ''}`} aria-pressed={filter === option.id} onClick={() => onChange(option.id)}>{option.label}</button>)}
    </div>
    {count !== undefined ? <span className="buy-count">{count}</span> : null}
  </div>;
}

function PurchasesModal({ clientName, rows, money, initialFilter, onClose }: {
  clientName: string; rows: ClientPurchase[]; money: MoneyApi; initialFilter: PurchaseFilter; onClose: () => void;
}) {
  const phone = usePhoneLayout();
  const [filter, setFilter] = useState(initialFilter);
  const ref = useRef<HTMLDivElement>(null);
  const modal = useModalLayer({ ref, onClose });
  const filtered = filterPurchases(rows, filter);
  const title = phone ? 'Compras' : `Compras · ${clientName}`;
  return createPortal(<ModalLayerContext.Provider value={modal.scope}>
    <div className="ov buy-overlay" onMouseDown={modal.requestClose}>
      <div ref={ref} tabIndex={-1} className="sheet sheet-frame buy-sheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-h buy-modal-head">
          {phone ? <button type="button" className="buy-back" aria-label="Volver a la ficha del cliente" onClick={modal.requestClose}><ArrowLeft size={22} /></button> : null}
          <div className="sheet-title"><h3>Compras{phone ? null : <> · <ReplayValue>{clientName}</ReplayValue></>}</h3>{phone ? <p data-ph-mask className="sub">{clientName}</p> : null}</div>
          {!phone ? <ModalCloseButton onClick={modal.requestClose} /> : null}
        </div>
        <PurchaseChips filter={filter} onChange={setFilter} count={filtered.filter(row => !row.annulled).length} />
        <div className="sheet-scroll">
          <PurchaseRows rows={filtered} money={money} />
          {filtered.length === 0 ? <p className="eqs-note">No hay compras con ese filtro.</p> : null}
        </div>
      </div>
    </div>
  </ModalLayerContext.Provider>, document.querySelector('.desk-app') ?? document.body);
}

export function ClientPurchases({ client, clientId, clientName, sales, tradeIns, repairs, inventory, sellers }: {
  client?: Client;
  clientId: string;
  clientName: string;
  sales: Sale[];
  tradeIns: TradeIn[];
  repairs: RepairOrder[];
  inventory: Product[];
  sellers: CommissionSeller[];
}) {
  const money = useMoney();
  const [filter, setFilter] = useState<PurchaseFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(
    () => clientPurchases({ clientId, sales, tradeIns, repairs, inventory, sellers }),
    [clientId, sales, tradeIns, repairs, inventory, sellers],
  );
  const totals = purchaseTotals(rows, money.active);
  const filtered = filterPurchases(rows, filter);
  const visible = visiblePurchases(filtered, false);

  return (
    <section className="client-purchases" data-testid="client-purchases" aria-label="Compras">
      <div className="cl-buy-stats" data-testid="client-purchase-stats">
        <ClientSpending client={client} parts={totals.spent} money={money} />
        <div className="dstat"><div className="eb">Compras</div><div className="big">{totals.count}</div></div>
        <div className="dstat"><div className="eb">Garantías</div><div className="big ok">{warrantiesLabel(totals.activeWarranties)}</div></div>
      </div>
      <div className="buy-head"><h4>Compras</h4><span data-testid="client-purchase-count">{filtered.filter(row => !row.annulled).length}</span></div>
      <PurchaseChips filter={filter} onChange={setFilter} />
      {filtered.length === 0 ? <p className="eqs-note">{rows.length === 0 ? 'Todavía no tiene compras' : 'No hay compras con ese filtro.'}</p> : null}
      <PurchaseRows rows={visible} money={money} />
      {filtered.length > visible.length ? <button type="button" className="wlink purchases-more" data-testid="purchases-more" onClick={() => setExpanded(true)}>Ver todas</button> : null}
      {expanded ? <PurchasesModal clientName={clientName} rows={rows} money={money} initialFilter={filter} onClose={() => setExpanded(false)} /> : null}
    </section>
  );
}
