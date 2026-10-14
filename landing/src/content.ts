import type { IconName } from './icons';

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

/** Rangos de scroll del hero desktop (progreso 0..1 dentro de la sección de 900vh). */
export const STATES: HeroState[] = [
  { k: 'entero', t: 'Entero', a: 0, b: 0.1 },
  { k: 'separando', t: 'Separando', a: 0.1, b: 0.2 },
  { k: 'capas', t: 'Explotado en capas', a: 0.2, b: 0.3 },
  { k: 'inventario', t: 'Inventario / IMEI', a: 0.3, b: 0.42, layer: 'placa' },
  { k: 'ventas', t: 'Ventas', a: 0.42, b: 0.54, layer: 'pantalla' },
  { k: 'canjes', t: 'Canjes', a: 0.54, b: 0.66, layer: 'carcasa' },
  { k: 'servicio', t: 'Servicio técnico', a: 0.66, b: 0.78, layer: 'bateria' },
  { k: 'dolar', t: 'Dólar / moneda', a: 0.78, b: 0.9, layer: 'marco' },
  { k: 'listo', t: 'Re-armado + CTA', a: 0.9, b: 1 },
];

/** Orden de apilado de las capas (0 = atrás). */
export const LAYERS: { key: LayerKey; label: string; area: string }[] = [
  { key: 'carcasa', label: 'Carcasa + cubito', area: 'Canjes' },
  { key: 'bateria', label: 'Batería', area: 'Servicio' },
  { key: 'placa', label: 'Placa', area: 'Inventario' },
  { key: 'marco', label: 'Marco', area: 'Dólar' },
  { key: 'pantalla', label: 'Pantalla', area: 'Ventas' },
];

export interface Feature {
  k: string;
  icon: IconName;
  chipIcon: IconName;
  capa: string;
  title: string;
  text: string;
  bullets: string[];
  chip: { title: string; sub: string; pill?: string };
  img: string;
}

export const FEATURES: Feature[] = [
  {
    k: 'inventario',
    icon: 'equipo',
    chipIcon: 'equipo',
    capa: 'La placa · el cerebro',
    title: 'Inventario por IMEI',
    text: 'Cada equipo con su IMEI, capacidad, color, batería y estado. Sabés qué tenés y a cuánto.',
    bullets: ['Alta en segundos, con IMEI validado', 'Disponible, reservado, en revisión o vendido', 'Importá tu planilla de Excel o Sheets'],
    chip: { title: 'IMEI 35 000000 000001 0', sub: 'iPhone 13 · 128GB · Medianoche', pill: 'Disponible' },
    img: 'app-mob-inventario.png',
  },
  {
    k: 'ventas',
    icon: 'ventas',
    chipIcon: 'ventas',
    capa: 'La pantalla · lo que ve tu cliente',
    title: 'Ventas en dos toques',
    text: 'Registrás la venta, el pago y los accesorios. El equipo sale del stock solo.',
    bullets: ['Efectivo, transferencia, tarjeta o mixto', 'Accesorios en la misma venta', 'Comprobante para mandar por WhatsApp'],
    chip: { title: 'Venta V-0128 · iPhone 14 Pro', sub: 'US$ 846 · $ 1.100.000 · Transferencia' },
    img: 'app-mob-venta.png',
  },
  {
    k: 'canjes',
    icon: 'canjes',
    chipIcon: 'canje',
    capa: 'La carcasa · el usado que entra',
    title: 'Canjes sin vueltas',
    text: 'Tomás el usado en parte de pago, lo peritás y entra al inventario con su costo real.',
    bullets: ['Peritaje: batería, pantalla, Face ID', 'Cotización del usado en pesos o dólares', 'Queda atado a la venta y al cliente'],
    chip: { title: 'Canje: iPhone 12 · 64GB', sub: 'Bat. 84 % · Grado B · toma US$ 260' },
    img: 'app-mob-dashboard.png',
  },
  {
    k: 'servicio',
    icon: 'servicio-tecnico',
    chipIcon: 'servicio-tecnico',
    capa: 'La batería · lo que se gasta',
    title: 'Servicio técnico',
    text: 'Órdenes de reparación en un tablero: cada equipo avanza de estado hasta que el cliente lo retira.',
    bullets: ['Recibido → En reparación → Listo para retirar → Entregado', 'Aviso al cliente cuando está listo', 'Historial de cada equipo'],
    chip: { title: '#OT-0101 · iPhone 12', sub: 'Pantalla rota · En reparación · entrega 08/10' },
    img: 'app-mob-servicio.png',
  },
  {
    k: 'dolar',
    icon: 'dolar',
    chipIcon: 'dolar',
    capa: 'El marco · lo que sostiene el precio',
    title: 'Dólar blue al día',
    text: 'Cargás precios en dólares y ves los pesos con la cotización del momento.',
    bullets: ['Blue, oficial o tu propio tipo de cambio', 'Lista de precios lista para compartir', 'Márgenes reales, sin calcular a mano'],
    chip: { title: 'Blue $ 1.280 / $ 1.300', sub: 'Actualizado hace 5 min' },
    img: 'app-mob-dolar.png',
  },
];
