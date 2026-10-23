import { useEffect, useState, type ReactNode } from 'react';
import { Box } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Skeleton } from '../../components/Skeleton';
import { fetchSupplierPurchase, type SupplierPurchase, type SupplierPurchaseDetail as PurchaseFile } from '../../services/suppliers-api';
import { useMoney } from '../exchange';
import { equipmentTitle, formatShortDate } from '../format';
import { usePhoneLayout } from '../section-notices';
import { DeskIcon, Sheet, useDesk } from '../ui';

const deviceCount = (count: number) => `${count} ${count === 1 ? 'equipo' : 'equipos'}`;
const purchaseLabel = (purchase: SupplierPurchase) => purchase.name || formatShortDate(purchase.purchasedAt);

type PurchaseReference = Pick<SupplierPurchase, 'id' | 'name' | 'purchasedAt'> & Partial<SupplierPurchase>;

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

export function SupplierPurchaseSheet({ title, subtitle, mobileSubtitle = false, children, onClose }: { title: string; subtitle?: string; mobileSubtitle?: boolean; children: ReactNode; onClose: () => void }) {
  const phone = usePhoneLayout();
  return <Sheet title={title} subtitle={!phone && mobileSubtitle ? undefined : subtitle} onClose={onClose} mobileBack className="sup-second" overlayClassName="center subov supplier-history-layer" footer={phone ? null : <button className="btn2 s" type="button" onClick={onClose}>Cerrar</button>}>
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

  return <SupplierPurchaseSheet title={purchase.name || `Compra del ${formatShortDate(purchase.purchasedAt)}`} subtitle={[info.devices != null ? deviceCount(info.devices) : '', total].filter(Boolean).join(' · ') || undefined} onClose={onClose}>
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
  </SupplierPurchaseSheet>;
}
