export const APP_URL = 'https://app.imanager.com.ar';
export const SIGNUP_URL = 'https://app.imanager.com.ar/registro';

export type LayerKey = 'carcasa' | 'bateria' | 'placa' | 'marco' | 'pantalla';

export interface HeroState {
  k: string;
  t: string;
  a: number;
  b: number;
  layer?: LayerKey;
}

/** Rangos de scroll del hero desktop (progreso 0..1 dentro de la sección de 500vh). */
export const STATES: HeroState[] = [
  { k: 'entero', t: 'Entero', a: 0, b: 0.08 },
  { k: 'capas', t: 'En capas', a: 0.08, b: 0.2 },
  { k: 'inventario', t: 'Inventario / IMEI', a: 0.2, b: 0.33, layer: 'placa' },
  { k: 'ventas', t: 'Ventas', a: 0.33, b: 0.46, layer: 'pantalla' },
  { k: 'canjes', t: 'Canjes', a: 0.46, b: 0.59, layer: 'carcasa' },
  { k: 'servicio', t: 'Servicio técnico', a: 0.59, b: 0.72, layer: 'bateria' },
  { k: 'dolar', t: 'Dólar / moneda', a: 0.72, b: 0.85, layer: 'marco' },
  { k: 'listo', t: 'Todo junto', a: 0.85, b: 1 },
];

/** Orden de apilado de las capas (0 = atrás). */
export const LAYERS: { key: LayerKey; label: string; area: string }[] = [
  { key: 'carcasa', label: 'Carcasa y cámaras', area: 'Canjes' },
  { key: 'bateria', label: 'Batería', area: 'Servicio' },
  { key: 'placa', label: 'Placa', area: 'Inventario' },
  { key: 'marco', label: 'Marco', area: 'Dólar' },
  { key: 'pantalla', label: 'Pantalla', area: 'Ventas' },
];

export interface Plan {
  name: string;
  desc: string;
  /** Texto chico antes del monto («desde»). */
  pre?: string;
  amount: string;
  per?: string;
  cta: { label: string; href: string };
  primary?: boolean;
}

/** Precios confirmados. Para ocultar la sección, `SHOW_PRICING = false` (también saca el link del menú). */
export const SHOW_PRICING = true;
export const PLANS: Plan[] = [
  { name: 'Básico', desc: 'Para empezar a ordenar tu stock.', amount: 'US$ 22', per: '/mes', cta: { label: 'Empezar', href: SIGNUP_URL } },
  { name: 'Avanzado', desc: 'Para el día a día del local.', amount: 'US$ 87', per: '/mes', cta: { label: 'Empezar', href: SIGNUP_URL }, primary: true },
  { name: 'Completo', desc: 'Para tiendas con más volumen.', amount: 'US$ 246', per: '/mes', cta: { label: 'Empezar', href: SIGNUP_URL } },
  { name: 'A medida', desc: 'Según lo que necesites.', pre: 'desde', amount: 'US$ 1.500', cta: { label: 'Hablemos', href: 'mailto:hola@imanager.com.ar' } },
];

export interface Feature {
  k: string;
  capa: string;
  title: string;
  text: string;
  bullets: string[];
  img: string;
}

export const FEATURES: Feature[] = [
  {
    k: 'inventario',
    capa: 'La placa · el cerebro',
    title: 'Inventario por IMEI',
    text: 'Cada equipo con su IMEI, capacidad, color, batería y estado. Sabés qué tenés y a cuánto.',
    bullets: ['Alta en segundos, con IMEI validado', 'Disponible, reservado, en revisión o vendido', 'Importá tu planilla de Excel o Sheets'],
    img: 'app-mob-inventario.png',
  },
  {
    k: 'ventas',
    capa: 'La pantalla · lo que ve tu cliente',
    title: 'Ventas en dos toques',
    text: 'Registrás la venta, el pago y los accesorios. El equipo sale del stock solo.',
    bullets: ['Efectivo, transferencia, tarjeta o mixto', 'Accesorios en la misma venta', 'Comprobante para mandar por WhatsApp'],
    img: 'app-mob-venta.png',
  },
  {
    k: 'canjes',
    capa: 'La carcasa · el usado que entra',
    title: 'Canjes sin vueltas',
    text: 'Tomás el usado en parte de pago, lo peritás y entra al inventario con su costo real.',
    bullets: ['Peritaje: batería, pantalla, Face ID', 'Cotización del usado en pesos o dólares', 'Queda atado a la venta y al cliente'],
    img: 'app-mob-dashboard.png',
  },
  {
    k: 'servicio',
    capa: 'La batería · lo que se gasta',
    title: 'Servicio técnico',
    text: 'Órdenes de reparación en un tablero: cada equipo avanza de estado hasta que el cliente lo retira.',
    bullets: ['Recibido → En reparación → Listo para retirar → Entregado', 'Aviso al cliente cuando está listo', 'Historial de cada equipo'],
    img: 'app-mob-servicio.png',
  },
  {
    k: 'dolar',
    capa: 'El marco · lo que sostiene el precio',
    title: 'Dólar blue al día',
    text: 'Cargás precios en dólares y ves los pesos con la cotización del momento.',
    bullets: ['Blue, oficial o tu propio tipo de cambio', 'Lista de precios lista para compartir', 'Márgenes reales, sin calcular a mano'],
    img: 'app-mob-dolar.png',
  },
];
