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

export interface PlanSpec {
  t: string;
  soon?: boolean;
}

/** Montos ya formateados (coma decimal, punto de miles), tal como los confirmó el dueño. */
export interface PlanPrice {
  monthly: string;
  /** Anual: precio por mes con el descuento y total del año. */
  annual: { perMonth: string; perYear: string };
}

export interface Plan {
  name: string;
  desc: string;
  /** Sin `price` el plan es a medida y no muestra monto en ningún modo. */
  price?: PlanPrice;
  /** Primer ítem de la lista: «Todo lo del plan …». */
  includes?: string;
  specs: PlanSpec[];
  cta: { label: string; href: string; external?: boolean };
  badge?: string;
}

/** Precios confirmados. Para ocultar la sección, `SHOW_PRICING = false` (también saca el link del menú). */
export const SHOW_PRICING = true;

/** Selector Mensual/Anual. Con `false` se muestran solo los precios mensuales. */
export const SHOW_BILLING_TOGGLE = true;
export const ANNUAL_LABEL = '25% menos';

export const PLANS: Plan[] = [
  {
    name: 'Básico',
    desc: 'Para empezar a ordenar ventas y stock.',
    price: { monthly: '22', annual: { perMonth: '16,50', perYear: '198' } },
    specs: [
      { t: 'Inventario por IMEI con estado y batería' },
      { t: 'Ventas en efectivo, transferencia, tarjeta o cripto' },
      { t: 'Clientes con historial y saldo pendiente' },
      { t: 'Importación desde Excel o CSV' },
      { t: 'Dólar blue, oficial o MEP al día' },
    ],
    cta: { label: 'Probalo gratis', href: SIGNUP_URL },
  },
  {
    name: 'Avanzado',
    desc: 'Para el día a día del local.',
    price: { monthly: '87', annual: { perMonth: '65,25', perYear: '783' } },
    includes: 'Básico',
    specs: [
      { t: 'Canjes como parte de pago, con batería y calidad' },
      { t: 'Servicio técnico con aviso por WhatsApp' },
      { t: 'Equipo con roles y permisos por sección' },
      { t: 'Reportes de ventas, stock, canjes, clientes y servicio' },
    ],
    cta: { label: 'Probalo gratis', href: SIGNUP_URL },
    badge: 'Recomendado',
  },
  {
    name: 'Completo',
    desc: 'Para tiendas con más volumen.',
    price: { monthly: '246', annual: { perMonth: '184,50', perYear: '2.214' } },
    includes: 'Avanzado',
    specs: [
      { t: 'Escaneo de IMEI con la cámara', soon: true },
    ],
    cta: { label: 'Probalo gratis', href: SIGNUP_URL },
  },
  {
    name: 'A medida',
    desc: 'Según lo que necesites.',
    includes: 'Completo',
    specs: [
      { t: 'Desarrollos a pedido' },
    ],
    cta: { label: 'Hablemos', href: 'mailto:hola@imanager.com.ar', external: true },
  },
];

/** Franja debajo de los planes. Solo cosas que la app hace hoy. */
export const PRICING_BENEFITS: string[] = [
  'Sin tarjeta para empezar',
  'Importación desde Excel',
  'En la compu y en el celular',
  'Dólar actualizado cada 15 minutos',
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
