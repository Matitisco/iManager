const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;

export function markStoreContactOffer(storeId: string) {
  try { sessionStorage.setItem(`imanager.contact-offer.${storeId}`, '1'); } catch { /* private mode */ }
}

export function clearStoreContactOffer(storeId: string) {
  try { sessionStorage.removeItem(`imanager.contact-offer.${storeId}`); } catch { /* private mode */ }
}

export function hasStoreContactOffer(storeId: string) {
  try { return sessionStorage.getItem(`imanager.contact-offer.${storeId}`) === '1'; } catch { return false; }
}

export function storeContactErrors(input: { email: string; instagram: string }) {
  const errors: { email?: string; instagram?: string } = {};
  const email = input.email.trim();
  const instagram = input.instagram.trim().replace(/^@+/, '');
  if (email && !EMAIL.test(email)) errors.email = 'El correo no es válido';
  if (instagram && !INSTAGRAM.test(instagram)) errors.instagram = 'Usá el usuario de Instagram, sin espacios';
  return errors;
}

export function contactSummary(store?: { phone?: string | null; email?: string | null; instagram?: string | null } | null) {
  const instagram = store?.instagram?.trim().replace(/^@+/, '');
  const parts = [store?.phone?.trim(), store?.email?.trim(), instagram ? `@${instagram}` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Sin datos de contacto';
}
