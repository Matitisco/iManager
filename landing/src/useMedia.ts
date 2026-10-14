import { useSyncExternalStore } from 'react';

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const MOBILE_HERO_QUERY = '(max-width: 900px)';
/** Layout ancho pero alto (iPad vertical, “Sitio de escritorio” en un celular): copy arriba, teléfono abajo. */
export const PORTRAIT_HERO_QUERY = '(min-width: 901px) and (max-aspect-ratio: 6/5)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
