import { DomainError } from "./domain-error.js";

const BLUE_URL = "https://dolarapi.com/v1/dolares/blue";
let cached: { rate: number; at: number } | null = null;
let pending: Promise<number> | null = null;

/** Same blue sell quote used by SaleForm; never substitute an invented rate. */
export async function currentBlueRate(): Promise<number> {
  if (cached && Date.now() - cached.at < 15 * 60_000) return cached.rate;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch(BLUE_URL, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("quote unavailable");
      const body = await response.json() as { venta?: unknown };
      const rate = Number(body.venta);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error("invalid quote");
      cached = { rate, at: Date.now() };
      return rate;
    } catch {
      throw new DomainError("No se pudo obtener la cotización blue. Indicá la cotización de la venta.", 503);
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export async function saleExchangeRate(explicit?: number): Promise<number> {
  if (explicit === undefined) return currentBlueRate();
  if (!Number.isFinite(explicit) || explicit <= 0) throw new DomainError("Cotización inválida");
  return explicit;
}
