import { renderToString } from 'react-dom/server';
import { App } from './App';
import { SITE_URL } from './content';
import { normalizePath } from './paths';

export interface PageMeta {
  title: string;
  description: string;
  /** Path con barra inicial. Vacío en el 404, que no se canonicaliza. */
  path: string;
  noindex?: boolean;
}

const HOME_DESCRIPTION = 'Inventario por IMEI, ventas, canjes, servicio técnico y dólar blue en un solo lugar. Hecho para tiendas de iPhone en Argentina.';

export const PAGES: Record<string, PageMeta> = {
  '/': {
    title: 'iManager · Gestión para tiendas de celulares',
    description: HOME_DESCRIPTION,
    path: '/',
  },
  '/404': {
    title: 'Página no encontrada · iManager',
    description: 'Esta página no existe.',
    path: '',
    noindex: true,
  },
};

export function render(url: string): { html: string; meta: PageMeta } {
  const path = normalizePath(url);
  const meta = PAGES[path] ?? PAGES['/404'];
  const html = renderToString(<App path={path} />);
  return { html, meta };
}

export function pageUrl(meta: PageMeta): string {
  if (!meta.path) return SITE_URL;
  return meta.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${meta.path}`;
}
