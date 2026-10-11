import { DomainError } from "../../lib/domain-error.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;

export function blankToNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

export function normalizeInstagram(value: string | null | undefined) {
  const trimmed = blankToNull(value);
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/instagram\.com\/@?([A-Za-z0-9._]+)/i)?.[1];
  const handle = (fromUrl ?? trimmed).replace(/^@+/, '').replace(/\/$/, '');
  return handle || null;
}

export function requireInstagram(value: string | null | undefined) {
  const instagram = normalizeInstagram(value);
  if (!instagram) {
    throw new DomainError('Completá el Instagram de la tienda', 400);
  }
  if (!INSTAGRAM.test(instagram)) {
    throw new DomainError('Usá @usuario o el link del perfil', 400);
  }
  return instagram;
}

export function assertStoreContact(data: { email?: string | null; instagram?: string | null }) {
  const next: { email?: string | null; instagram?: string | null } = {};
  if ('email' in data) {
    const email = blankToNull(data.email);
    if (email && !EMAIL.test(email)) {
      throw new DomainError('El correo no es válido', 400);
    }
    next.email = email;
  }
  if ('instagram' in data) {
    next.instagram = requireInstagram(data.instagram);
  }
  return next;
}
