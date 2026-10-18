import type { Product, RepairOrder, Sale, TradeIn } from '../types';
import type { CommissionSeller } from '../types/commissions';
import { equipmentTitle, formatShortDate, parseAppDate } from './format';
import { repairWarrantyView, saleWarrantyView, type WarrantyState } from '../lib/warranty';

export type PurchaseFilter = 'all' | 'sale' | 'trade' | 'repair';

export type PurchaseWarranty = {
  state: WarrantyState;
  badge: string;
  phrase: string;
};

export type ClientPurchase = {
  id: string;
  kind: 'sale' | 'trade' | 'repair';
  title: string;
  imei: string | null;
  imeiShort: string | null;
  dateLabel: string;
  sortKey: number;
  detail: string;
  amount: number;
  currency: string | null;
  negative: boolean;
  countsInTotals: boolean;
  warranty: PurchaseWarranty | null;
};

const PREVIEW_LIMIT = 5;

export function shortImei(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `IMEI ···${digits.slice(-4)}`;
}

function fullImei(value: string | null | undefined) {
  const raw = (value ?? '').trim();
  return raw || null;
}

function sortKey(value: string | null | undefined) {
  return parseAppDate(value)?.getTime() ?? 0;
}

function badgeFor(state: WarrantyState, untilLabel: string | null, phrase: string): PurchaseWarranty {
  if (state === 'vigente' && untilLabel) return { state, phrase, badge: `Vigente · ${untilLabel.slice(0, 5)}` };
  if (state === 'vencida' && untilLabel) return { state, phrase, badge: `Vencida · ${untilLabel.slice(0, 5)}` };
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
    .filter((sale) => sale.clientId === input.clientId && sale.status !== 'CANCELADA')
    .map((sale): ClientPurchase => {
      const product = sale.productId ? input.inventory.find((item) => item.id === sale.productId) : undefined;
      const imei = fullImei(product?.imei);
      const view = saleWarrantyView(sale, now);
      return {
        id: `sale-${sale.id}`,
        kind: 'sale',
        title: product ? equipmentTitle(product.model, product.capacity) : (sale.deviceLabel?.trim() || 'Equipo vendido'),
        imei,
        imeiShort: shortImei(imei),
        dateLabel: formatShortDate(sale.date),
        sortKey: sortKey(sale.date),
        detail: sellerName(sale.sellerMemberId, input.sellers),
        amount: sale.amount,
        currency: sale.amountCurrency ?? null,
        negative: false,
        countsInTotals: true,
        warranty: badgeFor(view.state, view.untilLabel, view.phrase),
      };
    });
  const trades = input.tradeIns
    .filter((trade) => trade.clientId === input.clientId && trade.confirmationStatus !== 'CANCELLED')
    .map((trade): ClientPurchase => {
      const imei = fullImei(trade.deviceReceivedImei);
      return {
        id: `trade-${trade.id}`,
        kind: 'trade',
        title: trade.deviceReceived?.trim() || 'Canje',
        imei,
        imeiShort: shortImei(imei),
        dateLabel: formatShortDate(trade.date),
        sortKey: sortKey(trade.date),
        detail: 'recibido',
        amount: trade.takeValue,
        currency: trade.currency ?? null,
        negative: true,
        countsInTotals: false,
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
        imeiShort: shortImei(imei),
        dateLabel: formatShortDate(order.receivedAt),
        sortKey: sortKey(order.receivedAt) || sortKey(order.events.at(-1)?.createdAt),
        detail: technician ? `${technician} (técnico)` : 'Servicio técnico',
        amount: order.estimate ?? order.deposit ?? 0,
        currency: order.currency ?? null,
        negative: false,
        countsInTotals: true,
        warranty: badgeFor(view.state, view.untilLabel, view.phrase),
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

export function purchaseTotals(rows: ClientPurchase[]) {
  const counted = rows.filter((row) => row.countsInTotals);
  const spent = new Map<string, { currency: string | null; amount: number }>();
  for (const row of counted) {
    const key = row.currency ?? '';
    const current = spent.get(key) ?? { currency: row.currency, amount: 0 };
    current.amount += row.amount;
    spent.set(key, current);
  }
  return {
    count: counted.length,
    activeWarranties: rows.filter((row) => row.warranty?.state === 'vigente').length,
    spent: [...spent.values()],
  };
}

export function warrantiesLabel(count: number) {
  return count === 1 ? '1 vigente' : `${count} vigentes`;
}
