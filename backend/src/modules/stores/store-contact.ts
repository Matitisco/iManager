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

export function assertStoreContact(data: { email?: string | null; instagram?: string | null }) {
  const next: { email?: string | null; instagram?: string | null } = {};
  if ('email' in data) {
    const email = blankToNull(data.email);
    if (email && !EMAIL.test(email)) {
      throw Object.assign(new Error('El correo no es válido'), { statusCode: 400 });
    }
    next.email = email;
  }
  if ('instagram' in data) {
    const instagram = normalizeInstagram(data.instagram);
    if (instagram && !INSTAGRAM.test(instagram)) {
      throw Object.assign(new Error('El Instagram no es válido'), { statusCode: 400 });
    }
    next.instagram = instagram;
  }
  return next;
}
