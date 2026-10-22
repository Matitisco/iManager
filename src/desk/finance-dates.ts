const DEFAULT_ZONE = 'America/Argentina/Buenos_Aires';

export function financeDay(now = new Date(), timeZone = DEFAULT_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(row => row.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Calendar dates have no timezone offset; never parse them as midnight UTC. */
export function financeDate(day: string) {
  const [year, month, date] = day.slice(0, 10).split('-');
  return year && month && date ? `${date}/${month}/${year}` : '—';
}

export function openingDescription(openedAt: string, openedBy?: string | null, timeZone = DEFAULT_ZONE, now = new Date()) {
  const opened = new Date(openedAt);
  if (!Number.isFinite(opened.getTime())) return '';
  const day = financeDay(opened, timeZone);
  const today = financeDay(now, timeZone);
  const yesterday = financeDay(new Date(now.getTime() - 86400000), timeZone);
  const label = day === today ? 'hoy' : day === yesterday ? 'ayer' : `el ${financeDate(day)}`;
  const time = new Intl.DateTimeFormat('es-AR', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(opened);
  const minutes = Math.max(0, Math.floor((now.getTime() - opened.getTime()) / 60000));
  const age = minutes < 1 ? 'recién' : minutes < 60 ? `hace ${minutes} min` : `hace ${Math.floor(minutes / 60)} h${minutes % 60 ? ` y ${minutes % 60} min` : ''}`;
  return `Abierta ${label}, ${time}${openedBy ? ` por ${openedBy}` : ''} · ${age}`;
}

export function financeMonth(month: string) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number, 0, 12));
  return { from: `${month}-01`, to: `${month}-${String(date.getUTCDate()).padStart(2, '0')}`, label: new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date) };
}

export function financeMoney(value: number, currency: 'ARS' | 'USD') {
  return `${currency === 'USD' ? 'US$' : '$'} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)}`;
}

export function financeDateTime(value: string, timeZone = DEFAULT_ZONE) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const time = new Intl.DateTimeFormat('es-AR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return `${financeDate(financeDay(date, timeZone))} ${time}`;
}
