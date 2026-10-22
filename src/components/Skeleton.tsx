import type { CSSProperties } from 'react';
import './skeleton.css';

/** Decorative content placeholder; the surrounding status owns its accessible name. */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

export function FieldSkeleton() {
  return <span role="status" aria-label="Cargando" aria-busy="true"><Skeleton className="skeleton-field" /></span>;
}
