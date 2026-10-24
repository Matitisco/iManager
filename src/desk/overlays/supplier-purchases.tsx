import { useEffect, useState, type ReactNode } from 'react';
import { Box } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Skeleton } from '../../components/Skeleton';
import { fetchHistory, type HistoryEvent } from '../../services/history-api';
import { formatArDateTime } from '../../lib/ar-date';
import { toUserMessage } from '../../lib/user-message';
import { historyRecordAction, historyDetailRows } from '../history-copy';
import { ListSkeleton } from '../list-skeleton';
import { fetchSupplierPurchase, type SupplierPurchase, type SupplierPurchaseDetail as PurchaseFile } from '../../services/suppliers-api';
import { useMoney } from '../exchange';
import { equipmentTitle, formatShortDate } from '../format';
import { usePhoneLayout } from '../section-notices';
import { DeskIcon, Sheet, useDesk } from '../ui';
import './supplier.css';

const deviceCount = (count: number) => `${count} ${count === 1 ? 'equipo' : 'equipos'}`;
const purchaseLabel = (purchase: SupplierPurchase) => purchase.name || formatShortDate(purchase.purchasedAt);

type PurchaseReference = Pick<SupplierPurchase, 'id'> & Partial<SupplierPurchase>;

function usePurchaseTotal(seeCosts: boolean) {
  const money = useMoney();
  return (purchase: Partial<SupplierPurchase>) => {
    if (!seeCosts) return '';
    if (purchase.costTotals?.length) return purchase.costTotals.map(cost => money.show(cost.totalCost, cost.currency)).join(' + ');
    return purchase.totalCost != null ? money.show(purchase.totalCost, purchase.currency) : '';
  };
}

export function SupplierPurchases({ purchases, seeCosts, onSelect }: { purchases: SupplierPurchase[]; seeCosts: boolean; onSelect: (purchase: SupplierPurchase) => void }) {
  const total = usePurchaseTotal(seeCosts);
  return <div className="supplier-purchase sup-card">
    {purchases.map(purchase => <button key={purchase.id} className="supplier-item sup-buy" type="button" onClick={() => onSelect(purchase)}>
      <span className="supplier-item-icon" aria-hidden="true"><Box size={16} /></span>
      <span className="supplier-item-name">{purchaseLabel(purchase)}</span>
      <span className="supplier-item-cost">{total(purchase)}<i aria-hidden="true">›</i></span>
      <span className="supplier-item-imei">{deviceCount(purchase.devices)}{purchase.name ? ` · ${formatShortDate(purchase.purchasedAt)}` : ''}{purchase.notes ? ` · ${purchase.notes}` : ''}</span>
      {purchase.problemCount > 0 ? <span className="supplier-item-status warn">{purchase.problemCount} con problemas</span> : null}
    </button>)}
  </div>;
}

export function SupplierPurchaseSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const phone = usePhoneLayout();
  return <Sheet title={title} onClose={onClose} mobileBack className="sup-second" overlayClassName="center subov supplier-history-layer" footer={phone ? null : <button className="btn2 s" type="button" onClick={onClose}>Cerrar</button>}>
    {children}
  </Sheet>;
}

export function SupplierPurchaseDetail({ supplierId, purchase, seeCosts, onClose }: { supplierId: string; purchase: PurchaseReference; seeCosts: boolean; onClose: () => void }) {
  const { user, appSession } = useAppContext();
  const { open } = useDesk();
  const [detail, setDetail] = useState<PurchaseFile | null>(null);
  const [failed, setFailed] = useState(false);
  const money = useMoney();
  const info = detail ?? purchase;
  const total = usePurchaseTotal(seeCosts)(info);
  const storeId = appSession?.store?.id;
  useEffect(() => {
    let active = true;
    setDetail(null);
    setFailed(false);
    if (user) void fetchSupplierPurchase(user, supplierId, purchase.id).then(row => { if (active) setDetail(row); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [user, storeId, supplierId, purchase.id]);

  const purchasedAt = purchase.purchasedAt || info.purchasedAt;
  return <SupplierPurchaseSheet title={purchase.name || info.name || (purchasedAt ? `Compra del ${formatShortDate(purchasedAt)}` : 'Compra')} onClose={onClose}>
    <div className="sup-purchase-summary">{info.devices != null ? <span>{deviceCount(info.devices)}</span> : null}{total ? <strong>{total}</strong> : null}</div>
    {!detail && !failed ? <div className="supplier-purchase sup-card supplier-items" data-testid="supplier-purchase-loading" role="status" aria-label="Cargando" aria-busy="true">
      {Array.from({ length: Math.min(purchase.devices ?? 5, 10) }, (_, index) => <div className="supplier-item" key={index} aria-hidden="true">
        <span className="supplier-item-icon"><Skeleton style={{ width: 16 }} /></span>
        <Skeleton className="supplier-item-name" style={{ height: 21, width: '75%' }} />
        {seeCosts ? <Skeleton className="supplier-item-cost" style={{ height: 20.8, width: 70 }} /> : null}
        <Skeleton className="supplier-item-imei" style={{ height: 18, width: '60%' }} />
        {index < (purchase.problemCount ?? 0) ? <Skeleton style={{ gridColumn: '2 / -1', height: 24, width: 76 }} /> : null}
      </div>)}
    </div> : null}
    {detail ? <div className="supplier-purchase sup-card supplier-items" data-testid="supplier-purchase-detail">
      {detail.items.map(item => <button key={item.id} className="supplier-item" type="button" onClick={() => open({ type: 'eq', id: item.id })}>
        <span className="supplier-item-icon" aria-hidden="true"><DeskIcon name="list" size={16} /></span>
        <span className="supplier-item-name">{equipmentTitle(item.model, item.capacity)}</span>
        {seeCosts && item.cost != null ? <span className="supplier-item-cost">{money.show(item.cost, item.currency)}</span> : null}
        {item.imei ? <span className="supplier-item-imei">IMEI {item.imei}</span> : null}
        {item.problemLabel ? <span className="supplier-item-status warn">{item.problemLabel}</span> : null}
      </button>)}
    </div> : null}
    {failed ? <div className="ferr" role="alert">No se pudo abrir la compra.</div> : null}
  </SupplierPurchaseSheet>;
}

export function SupplierHistorySheet({ supplierId, onClose }: { supplierId: string; onClose: () => void }) {
  const { user } = useAppContext();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!user) throw new Error('Iniciá sesión para ver el historial.');
        const rows: HistoryEvent[] = [];
        let cursor: string | undefined;
        do {
          const page = await fetchHistory(user, { entityType: 'supplier', entityId: supplierId, limit: 50, ...(cursor ? { cursor } : {}) });
          if (!active) return;
          rows.push(...page.events);
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
        setEvents(rows);
      } catch (cause) {
        if (active) setError(toUserMessage(cause, 'No se pudo abrir el historial.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user, supplierId]);

  return <SupplierPurchaseSheet title="Historial" onClose={onClose}>
    {loading ? <ListSkeleton variant="cards" rows={3} /> : null}
    {error ? <div className="ferr" role="alert">{error}</div> : null}
    {!loading && !error && !events.length ? <div className="wempty">Sin movimientos</div> : null}
    {events.length ? <ol className="record-history-timeline">
      {events.map(event => <li key={event.id}>
        <b>{historyRecordAction(event) || event.title}</b>
        <p className="record-history-meta"><time dateTime={event.createdAt}>{formatArDateTime(event.createdAt)}</time> · {event.actorName || 'Sistema'}</p>
        {historyDetailRows(event).map((change, index) => <p className="record-history-change" key={`${change.label}-${index}`}><span>{change.label}: </span>{change.before ? <>{change.before} → </> : null}{change.after || '—'}</p>)}
        {!historyDetailRows(event).length && event.detail?.trim() ? <p className="record-history-change">{event.detail}</p> : null}
        {event.reason ? <p className="record-history-change">{event.reason}</p> : null}
      </li>)}
    </ol> : null}
  </SupplierPurchaseSheet>;
}
