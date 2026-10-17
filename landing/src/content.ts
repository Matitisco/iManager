import type { IconName } from './icons';

export const SITE_URL = 'https://imanager.com.ar';
export const APP_URL = 'https://app.imanager.com.ar';
/** Prueba que arranca en la app, sin pedir tarjeta. */
export const TRIAL = '7 días gratis, sin tarjeta';
/** La app no tiene ruta ni deep link de registro: la cuenta se crea desde el login («Crear cuenta» o Google). */
export const SIGNUP_URL = 'https://app.imanager.com.ar/';

export type LayerKey = 'carcasa' | 'bateria' | 'placa' | 'marco' | 'pantalla';

export interface HeroState {
  k: string;
  t: string;
  a: number;
  b: number;
  layer?: LayerKey;
}

/** Rangos de scroll del hero desktop (progreso 0..1 dentro de la sección de 280vh). */
export const STATES: HeroState[] = [
  { k: 'entero', t: 'Entero', a: 0, b: 0.16 },
  { k: 'capas', t: 'En capas', a: 0.16, b: 0.42 },
  { k: 'piezas', t: 'Piezas', a: 0.42, b: 0.7 },
  { k: 'listo', t: 'Todo junto', a: 0.7, b: 1 },
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
    desc: 'Hasta 3 personas',
    price: { monthly: '22', annual: { perMonth: '16,50', perYear: '198' } },
    specs: [
      { t: 'Inventario por IMEI con estado y batería' },
      { t: 'Ventas con todos los medios de pago' },
      { t: 'Canjes' },
      { t: 'Clientes y cuenta corriente' },
      { t: 'Caja diaria en pesos y dólares' },
      { t: 'Importación desde Excel' },
      { t: 'Dólar al día' },
    ],
    cta: { label: 'Probalo gratis', href: SIGNUP_URL },
  },
  {
    name: 'Negocio',
    desc: 'Hasta 5 personas con permisos',
    price: { monthly: '87', annual: { perMonth: '65,25', perYear: '783' } },
    includes: 'Básico',
    specs: [
      { t: 'Catálogo público' },
      { t: 'Servicio técnico' },
      { t: 'Señas, reservas y garantías' },
      { t: 'Reportes y comisiones por vendedor' },
    ],
    cta: { label: 'Probalo gratis', href: SIGNUP_URL },
    badge: 'Recomendado',
  },
  {
    name: 'Sistema propio',
    desc: '',
    specs: [
      { t: 'Marca y configuración propias' },
      { t: 'Desarrollos a pedido' },
      { t: 'Implementación acompañada' },
    ],
    cta: { label: 'Hablemos', href: 'mailto:hola@imanager.com.ar', external: true },
  },
];

/** Franja debajo de los planes. Solo cosas que la app hace hoy. */
export const PRICING_BENEFITS: string[] = [
  TRIAL,
  'Importación desde Excel',
  'En la compu y en el celular',
  'Dólar actualizado cada 15 minutos',
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
    bullets: ['IMEI de 15 dígitos, sin duplicados', 'Disponible, reservado, en revisión o vendido', 'Importá tu planilla en Excel, CSV o texto'],
    chip: { title: 'IMEI de 15 dígitos', sub: 'iPhone 13 · 128GB · Medianoche', pill: 'Disponible' },
    img: 'app-mob-inventario.png',
  },
  {
    k: 'ventas',
    icon: 'ventas',
    chipIcon: 'ventas',
    capa: 'La pantalla · lo que ve tu cliente',
    title: 'Ventas y cobros',
    text: 'Registrás la venta y su forma de pago. El equipo sale del stock solo.',
    bullets: ['Efectivo, transferencia, tarjeta o cripto', 'Cobrada o con saldo pendiente', 'Comprobante para compartir'],
    chip: { title: 'Venta · iPhone 14 Pro', sub: 'Transferencia · sale del stock' },
    img: 'app-mob-venta.png',
  },
  {
    k: 'canjes',
    icon: 'canjes',
    chipIcon: 'canje',
    capa: 'La carcasa · el usado que entra',
    title: 'Canjes sin vueltas',
    text: 'Tomás el usado en parte de pago, lo peritás y entra al inventario con su costo real.',
    bullets: ['Batería y calidad del usado, de A+ a C', 'Cotización del usado en pesos o dólares', 'Queda atado a la venta y al cliente'],
    chip: { title: 'Canje · iPhone 12 · 64GB', sub: 'Batería y calidad, de A+ a C' },
    img: 'app-mob-dashboard.png',
  },
  {
    k: 'servicio',
    icon: 'servicio-tecnico',
    chipIcon: 'servicio-tecnico',
    capa: 'La batería · lo que se gasta',
    title: 'Servicio técnico',
    text: 'Órdenes de reparación en un tablero: cada equipo avanza de estado hasta que el cliente lo retira.',
    bullets: ['Recibido → En reparación → Listo para retirar → Entregado', 'Historial de estados de cada orden'],
    chip: { title: 'Orden · iPhone 12', sub: 'En reparación' },
    img: 'app-mob-servicio.png',
  },
  {
    k: 'dolar',
    icon: 'dolar',
    chipIcon: 'dolar',
    capa: 'El marco · lo que sostiene el precio',
    title: 'Dólar blue al día',
    text: 'Cargás precios en dólares y ves los pesos con la cotización del momento.',
    bullets: ['Blue, oficial, MEP o tu propio tipo de cambio', 'Catálogo con precios para compartir por link', 'Margen bruto estimado de tus ventas'],
    chip: { title: 'Blue, oficial o MEP', sub: 'Se actualiza cada 15 minutos' },
    img: 'app-mob-dolar.png',
  },
];
