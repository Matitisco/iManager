import { splitModelCapacity } from "../src/modules/import/sheet-plan.js";

const normalizeModel = (value = "") => value.toLowerCase().replace(/iphone|iph/g, "").replace(/\s+/g, " ").trim();
const normalizeCapacity = (value = "") => {
  const match = value.match(/(\d+)\s*(gb|tb)?/i);
  return match ? `${match[1]}${(match[2] ?? "gb").toLowerCase()}` : "";
};

type ExpectedRow = { imei?: string; model?: string; capacity?: string };

export function scoreImportRows(expected: ExpectedRow[], got: Record<string, string>[]) {
  const used = new Array(got.length).fill(false);
  const byImei = new Map<string, number[]>();
  got.forEach((row, index) => {
    if (!row.imei) return;
    const list = byImei.get(row.imei) ?? [];
    list.push(index);
    byImei.set(row.imei, list);
  });
  let matched = 0;
  let cursor = 0;
  for (const row of expected) {
    let index = -1;
    if (row.imei) index = (byImei.get(String(row.imei)) ?? []).find((item) => !used[item]) ?? -1;
    if (index < 0) {
      for (let item = cursor; item < got.length; item += 1) {
        if (used[item]) continue;
        const gotModel = normalizeModel(got[item]?.model);
        if (gotModel !== normalizeModel(row.model)) continue;
        if (row.capacity) {
          const fromModel = normalizeCapacity(splitModelCapacity(got[item]?.model ?? "").capacity || got[item]?.capacity);
          const fromColumn = normalizeCapacity(got[item]?.capacity);
          if (fromModel !== normalizeCapacity(row.capacity) && fromColumn !== normalizeCapacity(row.capacity)) continue;
        }
        index = item;
        break;
      }
    }
    if (index < 0) {
      for (let item = cursor; item < got.length; item += 1) {
        if (used[item]) continue;
        const gotModel = normalizeModel(got[item]?.model);
        const wanted = normalizeModel(row.model);
        if (gotModel.includes(wanted) || wanted.includes(gotModel)) {
          index = item;
          break;
        }
      }
    }
    if (index < 0) continue;
    used[index] = true;
    matched += 1;
    if (!row.imei) cursor = index + 1;
  }
  return {
    expected: expected.length,
    imported: got.length,
    matched,
    missing: expected.length - matched,
    extra: used.filter((item) => !item).length,
  };
}
