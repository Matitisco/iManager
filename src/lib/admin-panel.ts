import { formatArDateTime } from './ar-date';
import type { StoreActivityRange } from './store-activity';

export const PANEL_STEPS = [
  ['signup', 'Se registró', 'Se registró'],
  ['store_created', 'Puso el nombre de la tienda', 'Nombre'],
  ['stock_viewed', 'Vio «Cargá tu stock»', 'Vio stock'],
  ['stock_method', 'Eligió cómo cargar', 'Eligió cómo cargar'],
  ['real_stock', 'Cargó stock real', 'Cargó stock real'],
  ['onboarding_done', 'Terminó el onboarding', 'Terminó el onboarding'],
  ['first_sale', 'Hizo su primera venta', 'Primera venta'],
  ['team_invited', 'Invitó a alguien', 'Invitó a alguien'],
  ['team_joined', 'Se sumó alguien del equipo', 'Se sumó alguien'],
  ['installed', 'Instaló la app', 'Instaló la app'],
  ['steps_done', 'Completó Primeros pasos (5/5)', 'Primeros pasos 5/5'],
  ['returned', 'Volvió otro día', 'Volvió otro día'],
] as const;
export type FunnelStepId = typeof PANEL_STEPS[number][0];
export type StockMethod = 'excel' | 'paste' | 'manual' | 'sample' | 'skip' | 'go_inventory';
export type FunnelResponse = {
  range: StoreActivityRange;
  generatedAt: string;
  steps: { id: FunnelStepId; label: string; count: number; pctOfStart: number; dropFromPrev: number }[];
  stockMethods: { method: StockMethod; chosen: number; finishedOk: number; abandoned: number }[];
  retention: { nextDay: number; week1Active: number; cohort: number };
  medianHours: { signupToStore: number | null; storeToRealStock: number | null; storeToFirstSale: number | null };
};
export type TimelineEvent = {
  at: string; name: string; label: string; props: Record<string, unknown>; source: 'server' | 'client' | 'derived';
};
export type TimelineResponse = {
  store: { id: string; name: string; createdAt: string; ownerEmail: string | null; stuckAt: string | null; activeDays30: number };
  events: TimelineEvent[];
};

export const METHOD_LABELS: Record<StockMethod, string> = {
  excel: 'Subir Excel', paste: 'Pegar lista', manual: 'A mano', sample: 'Datos de ejemplo', skip: 'Saltar por ahora', go_inventory: 'Ir a mi inventario',
};
export function stuckLabel(step: string | null | undefined) {
  if (step == null) return 'Al día';
  return ({ store_created: 'Poner nombre', stock_viewed: 'Ver stock', stock_method: 'Elegir carga', real_stock: 'Cargar stock', onboarding_done: 'Terminar onboarding', first_sale: 'Primera venta' } as Record<string, string>)[step] ?? 'Completar un paso';
}
export function percent(count: number, start: number) { return start ? Math.round(count / start * 100) : 0; }
export function medianDuration(hours: number | null) {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)} ${Math.round(hours) === 1 ? 'hora' : 'horas'}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}

const stepNames: Record<string, string> = { store: 'nombre de la tienda', stock: 'stock real', sale: 'primera venta', team: 'equipo', install: 'instalar la app' };
export type EventIcon = 'user' | 'store' | 'eye' | 'file' | 'box' | 'cart' | 'send' | 'phone' | 'x' | 'flag' | 'skip';
/** Event labels come from allowlisted enums; unknown events never expose raw names or props. */
export function describeEvent(event: TimelineEvent): { text: string; icon: EventIcon; negative?: boolean } {
  const p = event.props;
  const method = METHOD_LABELS[p.method as StockMethod];
  const role = p.role === 'MANAGER' ? 'Encargado' : p.role === 'STAFF' ? 'Empleado' : 'integrante del equipo';
  switch (event.name) {
    case 'signup': return { text: `Se registró${p.provider === 'google' ? ' con Google' : p.provider === 'password' ? ' con email y contraseña' : ''}${p.via === 'invite' ? ' por invitación' : ''}`, icon: 'user' };
    case 'onboarding_name_viewed': return { text: 'Vio el paso Nombre de la tienda', icon: 'eye' };
    case 'store_created': case 'onboarding_name_completed': return { text: `Puso el nombre${p.currency ? ` · moneda ${p.currency}` : ''}${p.exchangeMode === 'manual' ? ' · cambio manual' : ''}`, icon: 'store' };
    case 'stock_viewed': case 'onboarding_stock_viewed': return { text: 'Vio Cargá tu stock', icon: 'eye' };
    case 'stock_method': case 'stock_method_chosen': return { text: `Eligió ${method ?? 'cómo cargar el stock'}`, icon: p.method === 'skip' ? 'skip' : 'file', negative: p.method === 'skip' };
    case 'real_stock': return { text: 'Cargó stock real', icon: 'box' };
    case 'stock_import_finished': {
      const via = p.method === 'excel' ? ' por Excel' : p.method === 'paste' ? ' pegando una lista' : p.method === 'manual' ? ' a mano' : '';
      const rows = ({ '1': '1 equipo', '2-10': 'entre 2 y 10 equipos', '11-50': 'entre 11 y 50 equipos', '51+': '51 o más equipos' } as Record<string, string>)[String(p.rows)] ?? 'equipos';
      return { text: p.ok === false ? `La carga${via} no terminó${typeof p.errors === 'number' ? ` · ${p.errors} errores` : ''}` : `Cargó ${rows}${via}${typeof p.errors === 'number' && p.errors > 0 ? ` · ${p.errors} errores` : ''}`, icon: p.ok === false ? 'x' : 'box', negative: p.ok === false };
    }
    case 'stock_import_abandoned': {
      const at = ({ file: 'Archivo', mapping: 'Columnas', review: 'Revisar', analyze: 'Analizar' } as Record<string, string>)[String(p.at)];
      return { text: `${p.method === 'excel' ? 'Cerró el Excel sin importar' : p.method === 'paste' ? 'Volvió sin guardar la lista' : 'Cerró la carga sin guardar'}${at ? ` (en ${at})` : ''}`, icon: 'x', negative: true };
    }
    case 'sample_stock_loaded': return { text: 'Cargó datos de ejemplo', icon: 'box' };
    case 'sample_stock_deleted': return { text: 'Borró los datos de ejemplo', icon: 'box' };
    case 'onboarding_done': case 'onboarding_completed': return { text: `Terminó el onboarding${p.via === 'skip' ? ' · saltó la carga de stock' : p.via === 'sample' ? ' · con datos de ejemplo' : ''}`, icon: p.via === 'skip' ? 'skip' : 'flag', negative: p.via === 'skip' };
    case 'first_step_completed': return { text: `Primeros pasos ${p.index ?? '—'}/5: ${stepNames[String(p.step)] ?? 'paso completado'}`, icon: p.step === 'sale' ? 'cart' : p.step === 'stock' ? 'box' : p.step === 'install' ? 'phone' : p.step === 'team' ? 'send' : 'store' };
    case 'first_steps_opened': return { text: `Abrió Primeros pasos${typeof p.done === 'number' ? ` · ${p.done}/5` : ''}`, icon: 'eye' };
    case 'first_steps_step_clicked': return { text: `Tocó Primeros pasos: ${stepNames[String(p.step)] ?? 'un paso'}`, icon: 'flag' };
    case 'steps_done': case 'first_steps_finished': return { text: `Completó Primeros pasos (5/5)${typeof p.days === 'number' ? ` · ${p.days} ${p.days === 1 ? 'día' : 'días'}` : ''}`, icon: 'flag' };
    case 'first_sale': return { text: `Hizo su primera venta${p.source === 'import' ? ' · importada' : ''}`, icon: 'cart' };
    case 'team_invited': case 'invite_created': return { text: p.role ? `Invitó a un ${role}` : 'Invitó a alguien', icon: 'send' };
    case 'invite_shared': return { text: p.channel === 'whatsapp' ? 'Compartió la invitación por WhatsApp' : p.channel === 'copy' ? 'Copió el link de invitación' : 'Compartió una invitación', icon: 'send' };
    case 'team_joined': case 'invite_accepted': return { text: p.role ? `Se sumó un ${role}` : 'Se sumó alguien del equipo', icon: 'user' };
    case 'installed': case 'app_installed': return { text: `Instaló la app${p.how === 'manual' ? ' · manualmente' : ''}`, icon: 'phone' };
    case 'active_day': return { text: `Entró${p.device === 'phone' ? ' · celular' : p.device === 'desktop' ? ' · compu' : ''}`, icon: 'user' };
    case 'returned': return { text: 'Volvió otro día', icon: 'flag' };
    default: return { text: 'Actividad registrada', icon: 'flag' };
  }
}

export function arDay(value: string | Date) { return formatArDateTime(value).slice(0, 10); }
export function dayLabel(at: string, now = new Date()) {
  if (arDay(at) === arDay(now)) return 'Hoy';
  // Subtract a calendar day from the AR date, independent of the host timezone.
  if (arDay(at) === arDay(new Date(now.getTime() - 86400000))) return 'Ayer';
  const weekday = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short' }).format(new Date(at)).replace('.', '');
  return `${weekday[0].toUpperCase()}${weekday.slice(1)} ${arDay(at).slice(0, 5)}`;
}
export type TimelineEntry = { event: TimelineEvent; text: string; icon: EventIcon; negative?: boolean; compact: boolean };
export function groupTimeline(events: TimelineEvent[], now = new Date()) {
  const groups: { key: string; label: string; entries: TimelineEntry[] }[] = [];
  for (const event of [...events].sort((a, b) => b.at.localeCompare(a.at))) {
    const key = arDay(event.at);
    let group = groups.at(-1);
    if (!group || group.key !== key) { group = { key, label: dayLabel(event.at, now), entries: [] }; groups.push(group); }
    const previous = group.entries.at(-1);
    if (event.name === 'active_day' && previous?.compact) {
      const device = event.props.device === 'phone' ? 'celular' : event.props.device === 'desktop' ? 'compu' : '';
      if (device && !previous.text.includes(device)) previous.text += ` · ${device}`;
      continue;
    }
    group.entries.push({ event, ...describeEvent(event), compact: event.name === 'active_day' });
  }
  return groups;
}
export function timelineMilestones(events: TimelineEvent[]) {
  const done = new Set<FunnelStepId>(['signup', 'store_created']);
  const names: Record<string, FunnelStepId> = { signup: 'signup', onboarding_name_completed: 'store_created', onboarding_stock_viewed: 'stock_viewed', stock_method_chosen: 'stock_method', onboarding_completed: 'onboarding_done', first_sale: 'first_sale', invite_created: 'team_invited', invite_accepted: 'team_joined', app_installed: 'installed', first_steps_finished: 'steps_done' };
  const days = new Set<string>();
  for (const e of events) {
    if (names[e.name]) done.add(names[e.name]);
    if (PANEL_STEPS.some(([id]) => id === e.name)) done.add(e.name as FunnelStepId);
    if (e.name === 'active_day') days.add(arDay(e.at));
    if (e.name === 'first_step_completed') {
      const id = ({ store: 'store_created', stock: 'real_stock', sale: 'first_sale', team: 'team_invited', install: 'installed' } as const)[e.props.step as 'store' | 'stock' | 'sale' | 'team' | 'install'];
      if (id) done.add(id);
      if (e.props.index === 5) done.add('steps_done');
    }
  }
  if (days.size >= 2) done.add('returned');
  return done;
}
