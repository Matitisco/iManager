export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Alguien";
}

export function joinNames(names: string[]) {
  const unique: string[] = [];
  for (const name of names) {
    const label = firstName(name);
    if (!unique.includes(label)) unique.push(label);
  }
  if (unique.length <= 1) return unique[0] ?? "";
  if (unique.length === 2) return `${unique[0]} y ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")} y ${unique[unique.length - 1]}`;
}

export function ymd(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function clockIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = (parts.find((part) => part.type === "hour")?.value ?? "00").padStart(2, "0");
  const minute = (parts.find((part) => part.type === "minute")?.value ?? "00").padStart(2, "0");
  return `${hour}:${minute}`;
}

export function dayPhrase(date: Date, timeZone: string, now = new Date()) {
  const day = ymd(date, timeZone);
  const today = ymd(now, timeZone);
  const yesterday = ymd(new Date(now.getTime() - 24 * 60 * 60 * 1000), timeZone);
  const time = clockIn(date, timeZone);
  if (day === today) return `hoy ${time}`;
  if (day === yesterday) return `ayer ${time}`;
  const [year, month, dateNumber] = day.split("-");
  return `${dateNumber}/${month}/${year} ${time}`;
}

export function summaryLine(counts: { matched: number; missing: number; surplus: number; sold: number }) {
  const sold = counts.sold === 1 ? "1 figura vendido" : `${counts.sold} figuran vendidos`;
  return `${counts.matched} coinciden · ${counts.missing} faltan · ${counts.surplus} sobran · ${sold}`;
}

export function openSubtitle(input: { starter: string; at: Date; timeZone: string; counters: string[]; now?: Date }) {
  const when = dayPhrase(input.at, input.timeZone, input.now);
  const names = joinNames(input.counters.filter((name) => firstName(name) !== firstName(input.starter)));
  const counting = names ? ` · contando ${names}` : input.counters.length ? ` · contando ${firstName(input.starter)}` : "";
  return `Abierto por ${firstName(input.starter)} · ${when}${counting}`;
}

export function closedSubtitle(input: { at: Date; timeZone: string; counters: string[]; scanCount: number; now?: Date; withScans?: boolean }) {
  const when = dayPhrase(input.at, input.timeZone, input.now);
  const names = joinNames(input.counters);
  const who = names ? ` · contaron ${names}` : " · nadie escaneó";
  const scans = input.withScans === false ? "" : ` · ${input.scanCount} ${input.scanCount === 1 ? "escaneo" : "escaneos"}`;
  return `Cerrado ${when}${who}${scans}`;
}

export function countNoun(count: number, one: string, many: string) {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export function openedClause(at: Date, timeZone: string) {
  return `abrió un control de stock a las ${clockIn(at, timeZone)}.`;
}

export function closedClause(input: { at: Date; timeZone: string; counters: string[]; matched: number; missing: number; surplus: number; sold: number }) {
  const who = joinNames(input.counters);
  const counted = who ? ` Contaron ${who}.` : " Nadie escaneó.";
  return `cerró el control de stock a las ${clockIn(input.at, input.timeZone)}.${counted} ${summaryLine(input)}.`;
}

export function adjustedClause(input: { at: Date; timeZone: string; archived: number; loaded: number }) {
  const archived = input.archived === 0
    ? "no archivó faltantes"
    : `archivó ${countNoun(input.archived, "faltante", "faltantes")} con el motivo Faltante`;
  const loaded = input.loaded === 0
    ? "no cargó sobrantes"
    : `cargó ${countNoun(input.loaded, "sobrante", "sobrantes")}`;
  return `ajustó el control de stock a las ${clockIn(input.at, input.timeZone)}: ${archived} y ${loaded}.`;
}

export function recordedClause(at: Date, timeZone: string) {
  return `dejó registrado el control de stock a las ${clockIn(at, timeZone)}, sin cambiar el inventario.`;
}
