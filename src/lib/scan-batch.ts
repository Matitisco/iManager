export type StockImei = {
  imei: string;
  status: string;
  archivedAt?: string | null;
};

export type ScanRowKind = 'ready' | 'retired' | 'duplicate' | 'in-stock' | 'invalid';

export type ScanRowClass = {
  kind: ScanRowKind;
  loadable: boolean;
  tone: 'ok' | 'warn' | 'bad';
  message: string;
};

const RETIRED_STATUS = 'VENDIDO';

export function classifyScannedImei(imei: string, options: {
  valid: boolean;
  earlierImeis: string[];
  stock: StockImei[];
}): ScanRowClass {
  if (!options.valid) {
    return { kind: 'invalid', loadable: false, tone: 'bad', message: 'IMEI inválido · no se carga' };
  }
  if (options.earlierImeis.includes(imei)) {
    return { kind: 'duplicate', loadable: false, tone: 'warn', message: 'Repetido en esta carga · no se carga' };
  }
  const matches = options.stock.filter((item) => item.imei.replace(/\D/g, '') === imei);
  const active = matches.find((item) => !item.archivedAt && item.status !== RETIRED_STATUS);
  if (active) {
    return { kind: 'in-stock', loadable: false, tone: 'warn', message: 'Ya está en stock · no se carga' };
  }
  const retired = matches.find((item) => item.archivedAt || item.status === RETIRED_STATUS);
  if (retired) {
    const sold = !retired.archivedAt && retired.status === RETIRED_STATUS;
    return {
      kind: 'retired',
      loadable: true,
      tone: 'warn',
      message: sold ? 'Ya estuvo en stock (vendido) · se carga igual' : 'Ya estuvo archivado · se carga igual',
    };
  }
  return { kind: 'ready', loadable: true, tone: 'ok', message: '' };
}

export function batchCounts(rows: ScanRowClass[]) {
  const loadable = rows.filter((row) => row.loadable).length;
  const warnings = rows.filter((row) => row.tone === 'warn').length;
  return { scanned: rows.length, loadable, warnings };
}

export function loadButtonLabel(loadable: number) {
  if (loadable === 1) return 'Cargar 1 equipo';
  return `Cargar ${loadable} equipos`;
}

export function rowSummary(input: {
  classification: ScanRowClass;
  color: string;
  battery: string;
  editedColor: boolean;
  editedBattery: boolean;
}) {
  if (input.classification.kind !== 'ready') return input.classification.message;
  if (input.editedColor && input.editedBattery) return 'Lista · cambiaste color y batería';
  if (input.editedColor) return 'Lista · cambiaste el color';
  if (input.editedBattery) return 'Lista · cambiaste la batería';
  const color = input.color.trim();
  const battery = input.battery.trim();
  if (color && battery) return `Lista · ${color} · bat. ${battery} %`;
  if (color) return `Lista · ${color} · sin batería`;
  if (battery) return `Lista · bat. ${battery} %`;
  return 'Lista · sin batería';
}

/** Store models with the most units first. Fills from the catalog when the store has fewer. */
export function frequentModels(inventory: { model: string }[], catalog: string[], limit = 4): string[] {
  const counts = new Map<string, number>();
  for (const item of inventory) {
    const model = item.model.trim();
    if (!model) continue;
    counts.set(model, (counts.get(model) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'es'))
    .map(([model]) => model);
  return [...new Set([...ranked, ...catalog])].slice(0, limit);
}
