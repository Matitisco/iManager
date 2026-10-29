export const SITE_URL = 'https://imanager.com.ar';
export const APP_URL = 'https://app.imanager.com.ar';
export const WHATSAPP_URL = 'https://wa.me/5491141722188';

export const HOME_TITLE = 'iManager · Tu tienda de iPhone, ordenada pieza por pieza';
export const HOME_DESCRIPTION = 'Stock por IMEI, ventas, canjes, clientes y dólar blue en un solo lugar. Probá iManager gratis durante la beta.';

export const SCREEN_TABS = [
  {
    id: 'stock',
    label: 'Stock',
    caption: 'Cada equipo con su IMEI, modelo, batería, estado y precio.',
    image: 'd-inventario',
    width: 2880,
    height: 1040,
    alt: 'Inventario de iManager: equipos con modelo, IMEI, condición, batería y precio.',
  },
  {
    id: 'ventas',
    label: 'Ventas',
    caption: 'Registrás la venta y el equipo sale del stock solo.',
    image: 'd-ventas',
    width: 2880,
    height: 1120,
    alt: 'Ventas de iManager: operaciones con cliente, equipo, medio de pago y estado de cobro.',
  },
  {
    id: 'reportes',
    label: 'Reportes',
    caption: 'Ventas, stock y margen bruto estimado, sin armar planillas.',
    image: 'd-reportes',
    width: 2880,
    height: 1800,
    alt: 'Reportes de iManager: resumen de ventas, stock y margen bruto estimado.',
  },
] as const;
