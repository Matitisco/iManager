export type ScanResult = "FOUND" | "NOT_LOADED" | "SOLD" | "REPEATED";

export type SnapshotRow = {
  inventoryItemId: string;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  statusAtSnapshot: string;
  price: number;
  currency: string | null;
};

export type CountScan = {
  imei: string;
  result: ScanResult;
  counts: boolean;
  inventoryItemId: string | null;
  model: string | null;
  capacity: string | null;
  color: string | null;
  scannedByName: string;
};

export type LiveDevice = {
  id: string;
  status: string;
  archivedAt?: Date | null;
};

export type ResultLine = {
  key: string;
  inventoryItemId: string | null;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  price: number | null;
  currency: string | null;
  note: string | null;
};

export type CloseResult = {
  matched: ResultLine[];
  missing: ResultLine[];
  surplus: ResultLine[];
  sold: ResultLine[];
  excludedNoImei: number;
  scanCount: number;
  counters: string[];
};

const COUNTABLE = new Set(["DISPONIBLE", "RESERVADO", "EN_REVISION"]);

export function statusKey(status: string) {
  return status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function isCountableStatus(status: string) {
  return COUNTABLE.has(statusKey(status));
}

export function isSoldStatus(status: string) {
  return statusKey(status) === "VENDIDO";
}

export function normalizeImei(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 15 ? digits : "";
}

export function classifyScan(input: {
  alreadyCounted: boolean;
  snapshot: SnapshotRow | null;
  live: { id: string; status: string; model: string; capacity: string; color: string; archivedAt: Date | null } | null;
}): { result: ScanResult; counts: boolean; inventoryItemId: string | null; model: string | null; capacity: string | null; color: string | null } {
  if (input.alreadyCounted) {
    const known = input.snapshot ?? input.live;
    return {
      result: "REPEATED",
      counts: false,
      inventoryItemId: known && "inventoryItemId" in known ? known.inventoryItemId : input.live?.id ?? input.snapshot?.inventoryItemId ?? null,
      model: known?.model ?? null,
      capacity: known?.capacity ?? null,
      color: known?.color ?? null,
    };
  }
  if (input.snapshot) {
    return {
      result: "FOUND",
      counts: true,
      inventoryItemId: input.snapshot.inventoryItemId,
      model: input.snapshot.model,
      capacity: input.snapshot.capacity,
      color: input.snapshot.color,
    };
  }
  if (input.live && !input.live.archivedAt && isSoldStatus(input.live.status)) {
    return {
      result: "SOLD",
      counts: true,
      inventoryItemId: input.live.id,
      model: input.live.model,
      capacity: input.live.capacity,
      color: input.live.color,
    };
  }
  if (input.live && !input.live.archivedAt && isCountableStatus(input.live.status)) {
    return {
      result: "FOUND",
      counts: true,
      inventoryItemId: input.live.id,
      model: input.live.model,
      capacity: input.live.capacity,
      color: input.live.color,
    };
  }
  return { result: "NOT_LOADED", counts: true, inventoryItemId: null, model: null, capacity: null, color: null };
}

function lineFromSnapshot(row: SnapshotRow, note: string | null): ResultLine {
  return {
    key: row.inventoryItemId,
    inventoryItemId: row.inventoryItemId,
    imei: row.imei,
    model: row.model,
    capacity: row.capacity,
    color: row.color,
    price: row.price,
    currency: row.currency,
    note,
  };
}

function lineFromScan(scan: CountScan, note: string | null): ResultLine {
  return {
    key: scan.imei,
    inventoryItemId: scan.inventoryItemId,
    imei: scan.imei,
    model: scan.model ?? "",
    capacity: scan.capacity ?? "",
    color: scan.color ?? "",
    price: null,
    currency: null,
    note,
  };
}

export function classifyClose(input: {
  expected: SnapshotRow[];
  scans: CountScan[];
  live: LiveDevice[];
  excludedNoImei: number;
}): CloseResult {
  const counting = input.scans.filter((scan) => scan.counts && scan.result !== "REPEATED");
  const scanned = new Set(counting.map((scan) => scan.imei));
  const expectedImeis = new Set(input.expected.map((row) => row.imei));
  const liveById = new Map(input.live.map((row) => [row.id, row]));
  const matched: ResultLine[] = [];
  const missing: ResultLine[] = [];
  const sold: ResultLine[] = [];
  const surplus: ResultLine[] = [];

  for (const row of input.expected) {
    if (scanned.has(row.imei)) {
      matched.push(lineFromSnapshot(row, null));
      continue;
    }
    const current = liveById.get(row.inventoryItemId);
    if (current && !current.archivedAt && isSoldStatus(current.status)) {
      sold.push(lineFromSnapshot(row, "Se vendió durante el conteo"));
    } else {
      missing.push(lineFromSnapshot(row, null));
    }
  }

  for (const scan of counting) {
    if (scan.result === "FOUND" && expectedImeis.has(scan.imei)) continue;
    if (scan.result === "SOLD") sold.push(lineFromScan(scan, "Figura vendido"));
    else if (scan.result === "NOT_LOADED") surplus.push(lineFromScan(scan, "No está cargado"));
    else if (scan.result === "FOUND") matched.push(lineFromScan(scan, null));
  }

  const counters = [...new Set(input.scans.map((scan) => scan.scannedByName.trim()).filter(Boolean))];
  return {
    matched,
    missing,
    surplus,
    sold,
    excludedNoImei: input.excludedNoImei,
    scanCount: counting.length,
    counters,
  };
}

const BLIND_KEYS = new Set([
  "expected",
  "expectedcount",
  "missing",
  "faltan",
  "faltantes",
  "snapshot",
  "excludednoimei",
  "price",
  "cost",
  "sobrantes",
  "coinciden",
]);

export function blindLeak(value: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = walk(item);
        if (hit) return hit;
      }
      return null;
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (BLIND_KEYS.has(key.toLowerCase())) return key;
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(value);
}
