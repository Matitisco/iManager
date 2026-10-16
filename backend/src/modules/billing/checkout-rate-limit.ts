import { DomainError } from '../../lib/domain-error.js';

/** Per-server-instance rolling quota. No card data, emails or tokens are stored. */
export function createCheckoutLimiter(now: () => number = Date.now) {
  const stores = new Map<string, number[]>();
  const windowMs = 10 * 60_000;
  const limit = 8;
  return (storeId: string) => {
    const time = now();
    for (const [key, stamps] of stores) {
      const fresh = stamps.filter(stamp => time - stamp < windowMs);
      if (fresh.length === 0) stores.delete(key);
      else stores.set(key, fresh);
    }
    const stamps = stores.get(storeId) ?? [];
    if (stamps.length >= limit) throw new DomainError('Demasiados intentos de suscripción. Esperá unos minutos y volvé a intentar.', 429);
    if (!stores.has(storeId) && stores.size >= 10_000) throw new DomainError('El servicio de suscripción está ocupado. Probá más tarde.', 503);
    stamps.push(time);
    stores.set(storeId, stamps);
  };
}

export const limitCheckout = createCheckoutLimiter();
