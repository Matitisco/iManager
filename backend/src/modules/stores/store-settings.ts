import {
  asCurrency,
  asExchangeMode,
  asExchangeSource,
  positiveRate,
  type ExchangeMode,
  type ExchangeSource,
  type MoneyCurrency,
} from "../../lib/money-currency.js";

export interface StoreSettings {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  currency: MoneyCurrency;
  exchangeMode: ExchangeMode;
  exchangeSource: ExchangeSource;
  manualBuy: number | null;
  manualSell: number | null;
  timezone: string;
}

type StoreRow = {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  exchangeMode?: string | null;
  exchangeSource?: string | null;
  manualBuy?: { toNumber(): number } | number | null;
  manualSell?: { toNumber(): number } | number | null;
};

export function serializeStore(store: StoreRow): StoreSettings {
  return {
    id: store.id,
    name: store.name,
    legalName: store.legalName,
    taxId: store.taxId,
    phone: store.phone,
    email: store.email,
    instagram: store.instagram,
    address: store.address,
    currency: asCurrency(store.currency),
    exchangeMode: asExchangeMode(store.exchangeMode),
    exchangeSource: asExchangeSource(store.exchangeSource),
    manualBuy: positiveRate(store.manualBuy),
    manualSell: positiveRate(store.manualSell),
    timezone: store.timezone,
  };
}
