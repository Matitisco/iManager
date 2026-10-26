export type PriceCurrency = 'ARS' | 'USD' | 'ORIGINAL';
export interface CatalogSettings {
  active: boolean;
  hideWithoutStock: boolean;
  hideReserved: boolean;
  minBattery: number | null;
  showPrice: boolean;
  priceCurrency: PriceCurrency;
  logoUrl: string | null;
  hours: string | null;
}
export interface CatalogItem {
  model: string; capacity: string; color: string; condition: string; grade: string; batteryHealth: string;
  price?: number | null; currency?: string | null;
}
export interface ManagedCatalogItem extends CatalogItem {
  id: string; catalogVisible: boolean; reason: string | null;
}
export interface ManagedCatalog extends CatalogSettings {
  slug: string;
  items: ManagedCatalogItem[];
  counts: { visible: number; rules: number; manual: number; available: number };
}
export interface PublicCatalog {
  store: { name: string; phone: string | null; address: string | null; logoUrl: string | null; hours: string | null; currency?: string | null };
  active: boolean; showPrice: boolean; priceCurrency: string;
  items: CatalogItem[];
}
