import { parseArDate } from '../../lib/ar-date.js';

let history: { at: number; rates: Map<string, number> } | undefined;
let pending: Promise<Map<string, number>> | undefined;

/** One bounded request for the daily series, rather than one request per sale. */
export async function historicalSaleRates(): Promise<Map<string, number>> {
  if (history && Date.now() - history.at < 15 * 60_000) return history.rates;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/blue', { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('history unavailable');
      const body: unknown = await response.json();
      if (!Array.isArray(body)) throw new Error('invalid history');
      const rates = new Map<string, number>();
      for (const quote of body) {
        if (!quote || typeof quote !== 'object') continue;
        const { fecha, venta } = quote as { fecha?: unknown; venta?: unknown };
        if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !parseArDate(fecha)) continue;
        const rate = Number(venta);
        if (Number.isFinite(rate) && rate > 0) rates.set(fecha, rate);
      }
      history = { at: Date.now(), rates };
      return rates;
    } catch {
      // A missing/unreachable history is explicitly reported on each affected sale.
      history = { at: Date.now() - 14 * 60_000, rates: new Map() };
      return history.rates;
    } finally { pending = undefined; }
  })();
  return pending;
}

