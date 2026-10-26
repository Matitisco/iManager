const STATUS_MAP: Record<string, string> = {
  disponible: "DISPONIBLE", available: "DISPONIBLE",
  vendido: "VENDIDO", sold: "VENDIDO",
  "en revision": "EN_REVISION", en_revision: "EN_REVISION", review: "EN_REVISION",
  reservado: "RESERVADO", reserved: "RESERVADO",
  "sin servicio": "EN_REVISION", "servicio tecnico": "EN_REVISION", "servicio tec": "EN_REVISION",
};

export function normalizeInventoryImportStatus(raw: string | undefined): { status: string; originalStatus?: string } {
  const original = raw?.trim() ?? "";
  const key = original.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
  const status = STATUS_MAP[key] ?? "DISPONIBLE";
  const canonical = original.toUpperCase();
  return { status, ...(original && canonical !== status ? { originalStatus: original } : {}) };
}
