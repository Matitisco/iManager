import type { ReactNode } from 'react';

export const IMANAGER_ICON_NAMES = ['accesorio', 'agregar', 'borrar', 'buscar', 'canje', 'cerrar', 'cliente', 'comisiones', 'disponible', 'dolar', 'editar', 'en-revision', 'equipo', 'filtrar', 'importar', 'lista-de-precios', 'mas', 'novedad', 'reservado', 'servicio-tecnico', 'vendido', 'venta-por-registrar'] as const;
export type ImanagerIconName = typeof IMANAGER_ICON_NAMES[number];
export type ImanagerIconSize = 16 | 20 | 24;

const BODIES: Record<ImanagerIconName, () => ReactNode> = {
  'accesorio': () => (
    <>
      <path className="ic-fill" d="M15.5 14h2a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1 -1.5 1.5h-2a1.5 1.5 0 0 1 -1.5 -1.5v-4a1.5 1.5 0 0 1 1.5 -1.5z" fill="none" stroke="none"/>
      <path d="M10 6.5h3a3.5 3.5 0 0 1 3.5 3.5v4"/>
      <rect x="14" y="14" width="5" height="7" rx="1.5"/>
      <path d="M15.75 18h1.5"/>
      <rect className="ic-accent" x="3" y="3" width="7" height="7" rx="2" fill="currentColor" stroke="none"/>
    </>
  ),
  'agregar': () => (
    <>
      <path d="M12 5v14M5 12h14"/>
      <rect className="ic-accent" x="4.5" y="4.5" width="4" height="4" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'borrar': () => (
    <>
      <path className="ic-fill" d="M6 7l.9 12.2a2 2 0 0 0 2 1.8h6.2a2 2 0 0 0 2-1.8L18 7z" fill="none" stroke="none"/>
      <path d="M4 7h16M6 7l.9 12.2a2 2 0 0 0 2 1.8h6.2a2 2 0 0 0 2-1.8L18 7M10 11v5.5M14 11v5.5"/>
      <rect className="ic-accent" x="9.25" y="2.5" width="5.5" height="3.5" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'buscar': () => (
    <>
      <path className="ic-fill" d="M10.5 3.5a7 7 0 1 1 0 14a7 7 0 1 1 0-14z" fill="none" stroke="none"/>
      <circle cx="10.5" cy="10.5" r="7"/>
      <path d="M16 16l4.5 4.5"/>
      <rect className="ic-accent" x="6.75" y="6.75" width="3" height="3" rx="0.9" fill="currentColor" stroke="none"/>
    </>
  ),
  'canje': () => (
    <>
      <path className="ic-fill" d="M14.25 2.5h3.5a2.75 2.75 0 0 1 2.75 2.75v13.5a2.75 2.75 0 0 1 -2.75 2.75h-3.5a2.75 2.75 0 0 1 -2.75 -2.75v-13.5a2.75 2.75 0 0 1 2.75 -2.75z" fill="none" stroke="none"/>
      <rect x="11.5" y="2.5" width="9" height="19" rx="2.75"/>
      <path d="M3 12h6M6.5 9l3 3-3 3"/>
      <path className="ic-accent" d="M14.75 4.5h1.5a1.25 1.25 0 0 1 1.25 1.25v1.5a1.25 1.25 0 0 1 -1.25 1.25h-1.5a1.25 1.25 0 0 1 -1.25 -1.25v-1.5a1.25 1.25 0 0 1 1.25 -1.25zM14.1 5.78a0.68 0.68 0 1 0 1.36 0a0.68 0.68 0 1 0 -1.36 0zM15.54 7.22a0.68 0.68 0 1 0 1.36 0a0.68 0.68 0 1 0 -1.36 0z" fill="currentColor" fillRule="evenodd" stroke="none"/>
    </>
  ),
  'cerrar': () => (
    <>
      <path d="M6 6l12 12M18 6L6 18"/>
    </>
  ),
  'cliente': () => (
    <>
      <path className="ic-fill" d="M4.5 21v-.5a5.5 5.5 0 0 1 5.5-5.5h4a5.5 5.5 0 0 1 5.5 5.5v.5z" fill="none" stroke="none"/>
      <path d="M4.5 21v-.5a5.5 5.5 0 0 1 5.5-5.5h4a5.5 5.5 0 0 1 5.5 5.5v.5"/>
      <rect className="ic-accent" x="8.5" y="3.5" width="7" height="7" rx="2.4" fill="currentColor" stroke="none"/>
    </>
  ),
  'comisiones': () => (
    <>
      <path className="ic-fill" d="M16.75 14.5a2.25 2.25 0 1 1 0 4.5a2.25 2.25 0 1 1 0-4.5z" fill="none" stroke="none"/>
      <path d="M18.5 5.5l-13 13"/>
      <circle cx="16.75" cy="16.75" r="2.25"/>
      <rect className="ic-accent" x="4.5" y="4.5" width="4.5" height="4.5" rx="1.5" fill="currentColor" stroke="none"/>
    </>
  ),
  'disponible': () => (
    <>
      <path className="ic-fill" d="M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17z" fill="none" stroke="none"/>
      <path d="M8.41 4.3A8.5 8.5 0 1 1 4.3 8.41"/>
      <path d="M8.5 12.5l2.5 2.5 5-5.5"/>
      <rect className="ic-accent" x="2.5" y="2.5" width="4.5" height="4.5" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'dolar': () => (
    <>
      <path className="ic-fill" d="M8.5 6H18.5a2.5 2.5 0 0 1 2.5 2.5V15.5a2.5 2.5 0 0 1 -2.5 2.5H5.5a2.5 2.5 0 0 1 -2.5 -2.5V11.5H7.5V6z" fill="none" stroke="none"/>
      <path d="M8.5 6H18.5a2.5 2.5 0 0 1 2.5 2.5V15.5a2.5 2.5 0 0 1 -2.5 2.5H5.5a2.5 2.5 0 0 1 -2.5 -2.5V11.5"/>
      <circle cx="12" cy="12" r="2.75"/>
      <path d="M17 12h.01M7 14.5h.01"/>
      <rect className="ic-accent" x="2.5" y="5.5" width="4" height="4" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'editar': () => (
    <>
      <path className="ic-fill" d="M4 20L5.13 15.19L12.49 7.84L16.16 11.51L8.81 18.87z" fill="none" stroke="none"/>
      <path d="M4 20L5.13 15.19L12.49 7.84L16.16 11.51L8.81 18.87z"/>
      <path className="ic-accent" d="M17.33 9.99L14.01 6.67L16.55 4.13L19.87 7.45z" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/>
    </>
  ),
  'en-revision': () => (
    <>
      <path className="ic-fill" d="M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17z" fill="none" stroke="none"/>
      <path d="M8.41 4.3A8.5 8.5 0 1 1 4.3 8.41"/>
      <circle cx="8.25" cy="12.5" r="1.25" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="12.5" r="1.25" fill="currentColor" stroke="none"/>
      <circle cx="15.75" cy="12.5" r="1.25" fill="currentColor" stroke="none"/>
      <rect className="ic-accent" x="2.5" y="2.5" width="4.5" height="4.5" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'equipo': () => (
    <>
      <path className="ic-fill" d="M9 2.5h6a3.5 3.5 0 0 1 3.5 3.5v12a3.5 3.5 0 0 1 -3.5 3.5h-6a3.5 3.5 0 0 1 -3.5 -3.5v-12a3.5 3.5 0 0 1 3.5 -3.5z" fill="none" stroke="none"/>
      <rect x="5.5" y="2.5" width="13" height="19" rx="3.5"/>
      <path className="ic-accent" d="M9.5 4.75h2a1.75 1.75 0 0 1 1.75 1.75v2a1.75 1.75 0 0 1 -1.75 1.75h-2a1.75 1.75 0 0 1 -1.75 -1.75v-2a1.75 1.75 0 0 1 1.75 -1.75zM8.57 6.51a0.94 0.94 0 1 0 1.87 0a0.94 0.94 0 1 0 -1.87 0zM10.55 8.49a0.94 0.94 0 1 0 1.87 0a0.94 0.94 0 1 0 -1.87 0z" fill="currentColor" fillRule="evenodd" stroke="none"/>
    </>
  ),
  'filtrar': () => (
    <>
      <path className="ic-fill" d="M3.5 4h17l-6.5 7v3.5h-4V11z" fill="none" stroke="none"/>
      <path d="M3.5 4h17l-6.5 7v3.5h-4V11z"/>
      <rect className="ic-accent" x="9.75" y="17" width="4.5" height="4.5" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'importar': () => (
    <>
      <path d="M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3M12 10v5M9 12.5l3 3 3-3"/>
      <rect className="ic-accent" x="9.75" y="2.5" width="4.5" height="4.5" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'lista-de-precios': () => (
    <>
      <path d="M11 6h10M11 12h10M11 18h6.5"/>
      <circle cx="5.25" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="5.25" cy="18" r="1.5" fill="currentColor" stroke="none"/>
      <rect className="ic-accent" x="3" y="3.75" width="4.5" height="4.5" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'mas': () => (
    <>
      <rect className="ic-accent" x="3" y="9.75" width="4.5" height="4.5" rx="1.25" fill="currentColor" stroke="none"/>
      <circle cx="13" cy="12" r="2" fill="currentColor" stroke="none"/>
      <circle cx="19.5" cy="12" r="2" fill="currentColor" stroke="none"/>
    </>
  ),
  'novedad': () => (
    <>
      <path className="ic-fill" d="M6 15V10a6 6 0 0 1 12 0v5l1.5 1.5h-15z" fill="none" stroke="none"/>
      <path d="M6 15V10a6 6 0 0 1 12 0v5l1.5 1.5h-15z"/>
      <path d="M19 4.5L20.5 3M20 8.5h1"/>
      <rect className="ic-accent" x="10" y="18.75" width="4" height="3.25" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'reservado': () => (
    <>
      <path className="ic-fill" d="M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17z" fill="none" stroke="none"/>
      <path d="M8.41 4.3A8.5 8.5 0 1 1 4.3 8.41"/>
      <path d="M12 7.5V12l3 2"/>
      <rect className="ic-accent" x="2.5" y="2.5" width="4.5" height="4.5" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'servicio-tecnico': () => (
    <>
      <path className="ic-fill" d="M7.93 18.75L13.57 13.11A5 5 0 0 0 19.98 6.28L17.06 9.21L14.79 6.94L17.72 4.02A5 5 0 0 0 10.89 10.43L5.25 16.07A1.9 1.9 0 0 1 7.93 18.75z" fill="none" stroke="none"/>
      <path d="M7.93 18.75L13.57 13.11A5 5 0 0 0 19.98 6.28L17.06 9.21L14.79 6.94L17.72 4.02A5 5 0 0 0 10.89 10.43L5.25 16.07A1.9 1.9 0 0 1 7.93 18.75z"/>
      <rect className="ic-accent" x="3" y="3" width="4.5" height="4.5" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'vendido': () => (
    <>
      <path className="ic-fill" d="M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17z" fill="none" stroke="none"/>
      <path d="M8.41 4.3A8.5 8.5 0 1 1 4.3 8.41"/>
      <path d="M14.6 9.6c-.4-.9-1.4-1.5-2.6-1.5-1.5 0-2.6.8-2.6 2 0 1.2 1.1 1.7 2.6 2s2.6.8 2.6 2c0 1.2-1.1 2-2.6 2-1.2 0-2.2-.6-2.6-1.5M12 6.6v1.5M12 16.1v1.4"/>
      <rect className="ic-accent" x="2.5" y="2.5" width="4.5" height="4.5" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
  'venta-por-registrar': () => (
    <>
      <path className="ic-fill" d="M11 3H17a2.5 2.5 0 0 1 2.5 2.5V21l-2.5-1.5L14.5 21 12 19.5 9.5 21 7 19.5 4.5 21V9.5H10V3z" fill="none" stroke="none"/>
      <path d="M11 3H17a2.5 2.5 0 0 1 2.5 2.5V21l-2.5-1.5L14.5 21 12 19.5 9.5 21 7 19.5 4.5 21V9.5"/>
      <path d="M8.5 11h7M8.5 15h4"/>
      <rect className="ic-accent" x="4" y="2.5" width="4.5" height="4.5" rx="1.25" fill="currentColor" stroke="none"/>
    </>
  ),
};

export function ImanagerIcon({ name, size = 20, active = false }: { name: ImanagerIconName; size?: ImanagerIconSize; active?: boolean }) {
  return (
    <svg
      className={active ? 'ic act' : 'ic'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon={name}
      data-active={active ? 'true' : 'false'}
    >
      {BODIES[name]()}
    </svg>
  );
}

const STATUS_ICONS: Record<string, ImanagerIconName> = {
  DISPONIBLE: 'disponible',
  Disponible: 'disponible',
  RESERVADO: 'reservado',
  Reservado: 'reservado',
  EN_REVISION: 'en-revision',
  'EN REVISIÓN': 'en-revision',
  'En revisión': 'en-revision',
  VENDIDO: 'vendido',
  Vendido: 'vendido',
  PENDIENTE: 'reservado',
  Pendiente: 'reservado',
  COMPLETADA: 'disponible',
  Completada: 'disponible',
  LISTO: 'disponible',
  Completado: 'disponible',
  APROBADO: 'disponible',
  Aprobado: 'disponible',
  'PERITAJE TÉC.': 'servicio-tecnico',
  'Peritaje téc.': 'servicio-tecnico',
  CANCELADA: 'cerrar',
  Cancelada: 'cerrar',
  RECHAZADO: 'cerrar',
  Rechazado: 'cerrar',
};

export function statusIcon(status: string | null | undefined): ImanagerIconName | null {
  if (!status) return null;
  return STATUS_ICONS[status] ?? null;
}

export function notificationIcon(note: { section: string; title?: string | null; message?: string | null; kind?: string | null }): ImanagerIconName {
  const kind = note.kind ?? '';
  const text = `${note.title ?? ''} ${note.message ?? ''}`.toLowerCase();
  if (kind === 'MANUAL_SOLD_PENDING' || text.includes('por registrar')) return 'venta-por-registrar';
  if (note.section === 'tradeins') return 'canje';
  if (note.section === 'clients') return 'cliente';
  if (note.section === 'sales') return 'venta-por-registrar';
  if (note.section === 'inventory') return text.includes('vendid') ? 'vendido' : 'equipo';
  if (text.includes('canje')) return 'canje';
  if (text.includes('cliente') || text.includes('socio')) return 'cliente';
  if (text.includes('venta')) return 'venta-por-registrar';
  return 'novedad';
}

export function nearestIconSize(size: number): ImanagerIconSize {
  if (size <= 16) return 16;
  if (size <= 20) return 20;
  return 24;
}
