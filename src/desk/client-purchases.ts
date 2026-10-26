import type { Product, RepairOrder, Sale, TradeIn } from '../types';
import type { CommissionSeller } from '../types/commissions';
import { equipmentTitle, formatShortDate, isVoidRow, parseAppDate } from './format';
import { parseArDate } from '../lib/ar-date';
import { repairWarrantyView, saleWarrantyView, type WarrantyState } from '../lib/warranty';
import { recordCurrency, type MoneyCurrency } from './money';

export type PurchaseFilter = 'all' | 'sale' | 'trade' | 'repair';

export type PurchaseWarranty = {
  state: WarrantyState | 'por-vencer';
  badge: string;
  phrase: string;
};

export type ClientPurchase = {
  id: string;
  kind: 'sale' | 'trade' | 'repair';
  title: string;
  imei: string | null;
  dateLabel: string;
  sortKey: number;
  detail: string;
  amount: number;
  currency: string | null;
  negative: boolean;
  countsInTotals: boolean;
  annulled: boolean;
  warranty: PurchaseWarranty | null;
};

const PREVIEW_LIMIT = 3;

function fullImei(value: string | null | undefined) {
  const raw = (value ?? '').trim();
  return raw || null;
}

function sortKey(value: string | null | undefined) {
  return parseAppDate(value)?.getTime() ?? 0;
}

/** Calendar dates avoid DST and time-of-day changing the inclusive 30-day boundary. */
export function purchaseWarranty(state: WarrantyState, untilLabel: string | null, phrase: string, now = new Date()): PurchaseWarranty {
  const until = parseArDate(untilLabel);
  if (state === 'vigente' && until) {
    const days = (Date.UTC(until.getFullYear(), until.getMonth(), until.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000;
    if (days >= 0 && days <= 30) return { state: 'por-vencer', phrase, badge: `Por vencer · hasta ${untilLabel}` };
    return { state, phrase, badge: `Vigente · hasta ${untilLabel}` };
  }
  if (state === 'vencida' && untilLabel) return { state, phrase, badge: `Vencida · ${untilLabel}` };
  if (state === 'pendiente') return { state, phrase, badge: 'Al entregar' };
  return { state, phrase, badge: 'Sin garantía' };
}

function sellerName(sellerMemberId: string | null | undefined, sellers: CommissionSeller[]) {
  if (!sellerMemberId) return 'Sin vendedor';
  return sellers.find((person) => person.id === sellerMemberId)?.name ?? 'Vendedor no disponible';
}

export function clientPurchases(input: {
  clientId: string;
  sales: Sale[];
  tradeIns: TradeIn[];
  repairs: RepairOrder[];
  inventory: Product[];
  sellers: CommissionSeller[];
  now?: Date;
}): ClientPurchase[] {
  const now = input.now ?? new Date();
  const sales = input.sales
    .filter((sale) => sale.clientId === input.clientId)
    .map((sale): ClientPurchase => {
      const product = sale.productId ? input.inventory.find((item) => item.id === sale.productId) : undefined;
      const imei = fullImei(product?.imei);
      const annulled = isVoidRow(sale);
      const view = saleWarrantyView(sale, now);
      return {
        id: `sale-${sale.id}`,
        kind: 'sale',
        title: product ? equipmentTitle(product.model, product.capacity).replace(/\s*·\s*/g, ' ') : (sale.deviceLabel?.trim() || 'Equipo vendido').replace(/\s*·\s*/g, ' '),
        imei,
        dateLabel: formatShortDate(sale.date),
        sortKey: sortKey(sale.date),
        detail: sellerName(sale.sellerMemberId, input.sellers),
        amount: sale.amount,
        currency: sale.amountCurrency ?? null,
        negative: false,
        countsInTotals: !annulled,
        annulled,
        warranty: annulled ? null : purchaseWarranty(view.state, view.untilLabel, view.phrase, now),
      };
    });
  const trades = input.tradeIns
    .filter((trade) => trade.clientId === input.clientId)
    .map((trade): ClientPurchase => {
      const imei = fullImei(trade.deviceReceivedImei);
      return {
        id: `trade-${trade.id}`,
        kind: 'trade',
        title: (trade.deviceReceived?.trim() || 'Canje').replace(/\s*·\s*/g, ' '),
        imei,
        dateLabel: formatShortDate(trade.date),
        sortKey: sortKey(trade.date),
        detail: 'recibido',
        amount: trade.takeValue,
        currency: trade.currency ?? null,
        negative: true,
        countsInTotals: false,
        annulled: isVoidRow(trade),
        warranty: null,
      };
    });
  const repairs = input.repairs
    .filter((order) => order.clientId === input.clientId)
    .map((order): ClientPurchase => {
      const imei = fullImei(order.imei);
      const view = repairWarrantyView(order, now);
      const technician = order.technician?.trim();
      return {
        id: `repair-${order.id}`,
        kind: 'repair',
        title: [order.device?.trim() || 'Reparación', order.fault?.trim()].filter(Boolean).join(' · '),
        imei,
        dateLabel: formatShortDate(order.receivedAt),
        sortKey: sortKey(order.receivedAt) || sortKey(order.events.at(-1)?.createdAt),
        detail: technician ? `${technician} (técnico)` : 'Servicio técnico',
        amount: order.estimate ?? order.deposit ?? 0,
        currency: order.currency ?? null,
        negative: false,
        countsInTotals: !isVoidRow(order),
        annulled: isVoidRow(order),
        warranty: isVoidRow(order) ? null : purchaseWarranty(view.state, view.untilLabel, view.phrase, now),
      };
    });
  return [...sales, ...trades, ...repairs].sort((left, right) => right.sortKey - left.sortKey || left.title.localeCompare(right.title, 'es'));
}

export function filterPurchases(rows: ClientPurchase[], filter: PurchaseFilter) {
  if (filter === 'all') return rows;
  return rows.filter((row) => row.kind === filter);
}

export function visiblePurchases(rows: ClientPurchase[], expanded: boolean) {
  return expanded || rows.length <= PREVIEW_LIMIT ? rows : rows.slice(0, PREVIEW_LIMIT);
}

export function purchaseTotals(rows: ClientPurchase[], active: MoneyCurrency = 'ARS') {
  const counted = rows.filter((row) => row.countsInTotals && !row.annulled);
  const spent = new Map<string, { currency: string | null; amount: number }>();
  for (const row of counted) {
    const key = recordCurrency(row.currency, active);
    const current = spent.get(key) ?? { currency: key, amount: 0 };
    current.amount += row.amount;
    spent.set(key, current);
  }
  return {
    count: counted.length,
    activeWarranties: rows.filter((row) => !row.annulled && (row.warranty?.state === 'vigente' || row.warranty?.state === 'por-vencer')).length,
    spent: [...spent.values()].sort((left, right) => (left.currency ?? '').localeCompare(right.currency ?? '')),
  };
}

export function warrantiesLabel(count: number) {
  return count === 1 ? '1 vigente' : `${count} vigentes`;
}
