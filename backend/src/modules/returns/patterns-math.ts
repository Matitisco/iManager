const FAMILIES = [
  { family: "bateria", label: "batería", pattern: /\bbaterias?\b/ },
  { family: "pantalla", label: "pantalla", pattern: /\b(?:pantallas?|display)\b/ },
  { family: "carga", label: "carga", pattern: /\b(?:carga|cargar|cargador|cargando|puerto de carga)\b/ },
  { family: "camara", label: "cámara", pattern: /\bcamaras?\b/ },
  { family: "audio", label: "audio", pattern: /\b(?:audio|sonido|parlantes?|altavoz|microfonos?)\b/ },
  { family: "face-id", label: "Face ID", pattern: /\bface[\s-]*id\b/ },
  { family: "conectividad", label: "señal, wifi o bluetooth", pattern: /\b(?:senal|wi[\s-]?fi|bluetooth)\b/ },
  { family: "botones-tactil", label: "botones o táctil", pattern: /\b(?:boton(?:es)?|tactil|touch)\b/ },
  { family: "agua", label: "agua", pattern: /\b(?:mojad[oa]s?|agua|humedad)\b/ },
] as const;

export interface TopReason { family: string; label: string; claims: number }

export function reasonFamilies(reason: string): string[] {
  const normalized = reason.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return FAMILIES.filter(family => family.pattern.test(normalized)).map(family => family.family);
}

/** A claim contributes at most once per family. Ties follow the documented family order. */
export function topReason(reasons: string[], minimum = 2): TopReason | null {
  const counts = new Map<string, number>();
  for (const reason of reasons) for (const family of reasonFamilies(reason)) counts.set(family, (counts.get(family) ?? 0) + 1);
  let result: TopReason | null = null;
  for (const { family, label } of FAMILIES) {
    const claims = counts.get(family) ?? 0;
    if (claims >= minimum && claims > (result?.claims ?? 0)) result = { family, label, claims };
  }
  if (minimum === 1) {
    const raw = new Map<string, { label: string; claims: number }>();
    for (const reason of reasons) {
      const label = reason.trim();
      if (!label || reasonFamilies(label).length) continue;
      const key = label.toLocaleLowerCase("es-AR");
      const entry = raw.get(key) ?? { label, claims: 0 };
      entry.claims++;
      raw.set(key, entry);
    }
    const first = [...raw.entries()].sort((a, b) => b[1].claims - a[1].claims || a[0].localeCompare(b[0]))[0];
    if (first && first[1].claims > (result?.claims ?? 0)) result = { family: "otro", ...first[1] };
  }
  return result;
}

export function problemMetrics(problems: number, devices: number) {
  const ratio = devices > 0 ? problems / devices : 0;
  return { percent: Math.round(ratio * 100), hot: problems >= 3 || ratio >= 0.4 };
}

export function comparePatterns(a: { problems: number; percent: number; key: string }, b: { problems: number; percent: number; key: string }) {
  return b.problems - a.problems || b.percent - a.percent || a.key.localeCompare(b.key);
}
