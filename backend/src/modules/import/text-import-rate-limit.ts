import { DomainError } from '../../lib/domain-error.js';

/** Per-server-instance rolling quota; no database or user content retained. */
/** En el entorno de test de Railway no hay cupo, para poder probar sin esperar. */
export function textImportQuota(envName = process.env.RAILWAY_ENVIRONMENT_NAME): number {
  return envName && /test/i.test(envName) ? Infinity : 10;
}

export function createTextImportLimiter(now: () => number = Date.now, quota: number = textImportQuota()) {
  const stores = new Map<string, { timestamps: number[]; active: boolean }>();
  const windowMs = 10 * 60_000;
  return (storeId: string) => {
    const time = now();
    for (const [key, entry] of stores) {
      entry.timestamps = entry.timestamps.filter((timestamp) => time - timestamp < windowMs);
      if (!entry.active && entry.timestamps.length === 0) stores.delete(key);
    }
    const entry = stores.get(storeId) ?? { timestamps: [], active: false };
    if (entry.active) throw new DomainError('Ya hay un listado analizándose en esta tienda. Esperá a que termine.', 429);
    if (entry.timestamps.length >= quota) throw new DomainError('Llegaste al límite de 10 análisis cada 10 minutos por tienda. Probá más tarde.', 429);
    // Bound memory even if many distinct authenticated stores hit a single instance.
    if (!stores.has(storeId) && stores.size >= 10_000) throw new DomainError('El servicio de análisis está ocupado. Probá más tarde.', 503);
    entry.timestamps.push(time);
    entry.active = true;
    stores.set(storeId, entry);
    return () => { entry.active = false; };
  };
}
